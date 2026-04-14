import cors from "cors";
import express from "express";
import multer from "multer";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import { nanoid } from "nanoid";

import { cleanupCustomerData } from "./ability-client.js";
import { getDb, getTask, getTaskByTingwuTaskId, getThread, insertMessage, listArtifacts, listThreads, updateMessagePayload, createThread, updateThreadTitle, deleteTaskCascade, deleteThreadCascade, getAudioJob, listAudioJobs, getLatestActiveTaskByThread } from "./db.js";
import { loadEnvFiles } from "./env.js";
import { queueResumeTask, triggerSpeakerProfileWorkflow } from "./graph.js";
import { ARTIFACTS_DIR, CHAT_ROOT_DIR, CHAT_SERVER_PORT, MEETING_VIEWER_PORT, OUTPUTS_DIR, TONGYI_ROOT_DIR, UPLOADS_DIR } from "./paths.js";
import { finalizeThreadQueryAnswer, generateThreadQueryAnswer, runThreadAssistantTurn } from "./thread-assistant.js";
import type { MessageAttachment } from "./types.js";
import { decodeMaybeLatin1FileName, deriveThreadTitle, ensureDir, isSupportedAudioFile } from "./utils.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

loadEnvFiles([join(TONGYI_ROOT_DIR, ".env"), join(CHAT_ROOT_DIR, ".env")]);
getDb();
ensureDir(UPLOADS_DIR);
ensureDir(ARTIFACTS_DIR);

app.use(cors());

const ONTOLOGIES = [
  {
    id: "crm",
    ontology_code: "CRM",
    display_name: "CRM",
    description: "客户关系管理：线索、商机与客户跟进",
  },
];

function proxyToMeetingViewer(req: express.Request, res: express.Response) {
  const target = http.request(
    {
      hostname: "127.0.0.1",
      port: MEETING_VIEWER_PORT,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${MEETING_VIEWER_PORT}`,
      },
    },
    (targetRes) => {
      res.status(targetRes.statusCode || 502);
      Object.entries(targetRes.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          res.setHeader(key, value as string);
        }
      });
      targetRes.pipe(res);
    },
  );
  target.on("error", (error) => {
    res.status(502).json({ error: `Meeting viewer proxy failed: ${error.message}` });
  });
  req.pipe(target);
}

function normalizeUploadedFile(file: Express.Multer.File) {
  const fileName = decodeMaybeLatin1FileName(file.originalname);
  return {
    ...file,
    originalname: fileName,
  };
}

function streamTextChunks(text: string) {
  const chunks: string[] = [];
  const paragraphs = text.split("\n");
  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    if (!paragraph) {
      chunks.push("\n");
      continue;
    }
    const trimmed = paragraph;
    for (let index = 0; index < trimmed.length; index += 24) {
      chunks.push(trimmed.slice(index, index + 24));
    }
    if (paragraphIndex < paragraphs.length - 1) {
      chunks.push("\n");
    }
  }
  return chunks;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "chat-server", port: CHAT_SERVER_PORT, meeting_viewer_port: MEETING_VIEWER_PORT });
});

app.use("/meeting-viewer", proxyToMeetingViewer);
app.use("/tongyi-agent", proxyToMeetingViewer);
app.use("/api/task", proxyToMeetingViewer);
app.use("/api/tasks", proxyToMeetingViewer);

app.use(express.json({ limit: "10mb" }));

app.get("/api/ontologies", (_req, res) => {
  res.json(ONTOLOGIES);
});

app.get("/api/chat/threads", (req, res) => {
  const ontologyId = typeof req.query.ontology_id === "string" ? req.query.ontology_id : undefined;
  res.json({ threads: listThreads(ontologyId) });
});

app.get("/api/chat/threads/:threadId", (req, res) => {
  const threadId = String(req.params.threadId);
  const payload = getThread(threadId);
  if (!payload) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  res.json(payload);
});

app.post("/api/chat/threads", (req, res) => {
  const assistantId = String(req.body.assistantId || "crm-copilot");
  const ontologyId = String(req.body.ontologyId || "crm");
  const title = typeof req.body.title === "string" ? req.body.title : undefined;
  const thread = createThread({
    id: nanoid(16),
    assistantId,
    ontologyId,
    title,
  });
  res.status(201).json({ thread });
});

app.patch("/api/chat/threads/:threadId/messages/:messageId", (req, res) => {
  const threadId = String(req.params.threadId);
  const messageId = String(req.params.messageId);
  const message = updateMessagePayload(threadId, messageId, req.body ?? {});
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  res.json({ message });
});

app.post("/api/chat/threads/:threadId/query-stream", async (req, res) => {
  const threadId = String(req.params.threadId);
  const threadPayload = getThread(threadId);
  if (!threadPayload) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const activeTask = getLatestActiveTaskByThread(threadId);
  if (activeTask || threadPayload.thread.activeMode !== "query_mode") {
    res.status(409).json({ error: "Thread is not in query mode" });
    return;
  }

  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "Query text is empty" });
    return;
  }

  const userMessage = insertMessage({
    id: nanoid(16),
    threadId,
    role: "user",
    kind: "user-entry",
    payload: {
      text,
      attachments: [],
    },
  });

  if (threadPayload.messages.length === 0) {
    updateThreadTitle(threadId, deriveThreadTitle(text, []));
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const writeEvent = (payload: Record<string, unknown>) => {
    res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    writeEvent({
      type: "user_message",
      message: userMessage,
      thread: getThread(threadId)?.thread,
    });

    const tempMessageId = `stream-${nanoid(12)}`;
    writeEvent({
      type: "assistant_begin",
      messageId: tempMessageId,
    });

    const answer = await generateThreadQueryAnswer({
      threadId,
      text,
    });

    for (const chunk of streamTextChunks(answer.text)) {
      writeEvent({
        type: "assistant_delta",
        messageId: tempMessageId,
        delta: chunk,
      });
      await new Promise((resolve) => setTimeout(resolve, 12));
    }

    const assistantMessage = finalizeThreadQueryAnswer({
      threadId,
      text,
      answer,
    });

    writeEvent({
      type: "assistant_complete",
      message: assistantMessage,
      thread: getThread(threadId)?.thread,
    });
    writeEvent({ type: "done" });
    res.end();
  } catch (error) {
    writeEvent({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    res.end();
  }
});

app.post("/api/chat/threads/:threadId/messages", upload.array("files"), async (req, res) => {
  const threadId = String(req.params.threadId);
  const threadPayload = getThread(threadId);
  if (!threadPayload) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const text = String(req.body.text || "");
  const files = (((req.files as Express.Multer.File[] | undefined) ?? []).map(normalizeUploadedFile));
  const attachments: MessageAttachment[] = files.map((file) => ({
    id: nanoid(12),
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  }));

  if (!text.trim() && attachments.length === 0) {
    res.status(400).json({ error: "Message is empty" });
    return;
  }

  const userMessage = insertMessage({
    id: nanoid(16),
    threadId,
    role: "user",
    kind: "user-entry",
    payload: {
      text,
      attachments,
    },
  });

  if (threadPayload.messages.length === 0) {
    updateThreadTitle(threadId, deriveThreadTitle(text, attachments));
  }
  const firstAudio = files.find((file) => isSupportedAudioFile(file.originalname));

  const beforeMessageIds = new Set(threadPayload.messages.map((message) => message.id));
  beforeMessageIds.add(userMessage.id);

  const uploadPath = firstAudio
    ? (() => {
        const ext = firstAudio.originalname.split(".").pop() || "m4a";
        const nextPath = join(UPLOADS_DIR, `${nanoid(12)}-${Date.now()}.${ext}`);
        writeFileSync(nextPath, firstAudio.buffer);
        return nextPath;
      })()
    : null;

  await runThreadAssistantTurn({
    threadId,
    ontologyId: threadPayload.thread.ontologyId,
    text,
    audioPath: uploadPath,
    audioFileName: firstAudio?.originalname ?? null,
  });

  const payload = getThread(threadId)!;
  const createdMessages = payload.messages.filter((message) => !beforeMessageIds.has(message.id));
  res.status(201).json({
    thread: payload.thread,
    messages: payload.messages,
    createdMessages: [userMessage, ...createdMessages],
  });
});

app.get("/api/chat/tasks/:taskId", (req, res) => {
  const taskId = String(req.params.taskId);
  const task = getTask(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({
    task,
    artifacts: listArtifacts(task.taskId),
  });
});

app.get("/api/chat/jobs", (_req, res) => {
  res.json({ jobs: listAudioJobs() });
});

app.get("/api/chat/jobs/:jobId", (req, res) => {
  const jobId = String(req.params.jobId);
  const job = getAudioJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    fileName: job.fileName,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    taskId: job.outputTaskId,
    error: job.error,
    action: "analyze_recording",
  });
});

app.post("/api/chat/tasks/:taskId/resume", (req, res) => {
  const taskId = String(req.params.taskId);
  const task = getTask(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  queueResumeTask(task.taskId, req.body.resume);
  res.json({ success: true });
});

app.post("/api/chat/tasks/:taskId/speaker-profile-ready", (req, res) => {
  const taskId = String(req.params.taskId);
  const task = getTask(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  void triggerSpeakerProfileWorkflow(task.taskId)
    .then((result) => res.json(result))
    .catch((error) => res.status(500).json({ error: error instanceof Error ? error.message : String(error) }));
});

app.post("/api/chat/runtime/tingwu/:tingwuTaskId/speaker-profile-ready", (req, res) => {
  const tingwuTaskId = String(req.params.tingwuTaskId);
  const task = getTaskByTingwuTaskId(tingwuTaskId);
  if (!task) {
    res.status(404).json({ error: "Conversation task not found for tingwu task" });
    return;
  }
  void triggerSpeakerProfileWorkflow(task.taskId)
    .then(() => res.json({ success: true, task_id: task.taskId }))
    .catch((error) => res.status(500).json({ error: error instanceof Error ? error.message : String(error) }));
});

app.get("/api/chat/artifacts/:taskId/:fileName", (req, res) => {
  const taskId = String(req.params.taskId);
  const fileName = String(req.params.fileName);
  const artifacts = listArtifacts(taskId);
  const artifact = artifacts.find((item) => item.fileName === fileName);
  if (!artifact || !existsSync(artifact.filePath)) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }
  res.download(artifact.filePath, artifact.fileName);
});

app.post("/api/chat/tasks/:taskId/cleanup", async (req, res) => {
  const taskId = String(req.params.taskId);
  const task = getTask(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const dryRun = Boolean(req.body?.dry_run);
  const artifacts = listArtifacts(task.taskId);
  const outputDir = task.tingwuTaskId ? join(OUTPUTS_DIR, task.tingwuTaskId) : null;
  const fileCount = artifacts.length + (outputDir && existsSync(outputDir) ? 1 : 0);

  if (dryRun) {
    const remoteSummary = task.customerId || task.customerName
      ? await cleanupCustomerData<unknown>({
          ontology_id: "crm",
          customer_id: task.customerId,
          customer_name: task.customerName,
          dry_run: true,
        }).catch(() => null)
      : null;
    res.json({
      success: true,
      dry_run: true,
      task_id: task.taskId,
      thread_id: task.threadId,
      files_to_delete: fileCount,
      remote_summary: remoteSummary,
    });
    return;
  }

  const remoteDeleted = task.customerId || task.customerName
    ? await cleanupCustomerData<unknown>({
        ontology_id: "crm",
        customer_id: task.customerId,
        customer_name: task.customerName,
        dry_run: false,
      }).catch((error) => ({ success: false, error: error instanceof Error ? error.message : String(error) }))
    : null;

  deleteTaskCascade(task.taskId);
  deleteThreadCascade(task.threadId);
  if (existsSync(task.artifactRoot)) {
    rmSync(task.artifactRoot, { recursive: true, force: true });
  }
  if (outputDir && existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  res.json({
    success: true,
    task_id: task.taskId,
    deleted_files: fileCount,
    remote_deleted: remoteDeleted,
  });
});

app.post("/api/admin/cleanup-customer", async (req, res) => {
  try {
    const payload = {
      ontology_id: "crm",
      customer_id: req.body?.customer_id,
      customer_name: req.body?.customer_name,
      dry_run: Boolean(req.body?.dry_run),
    };
    const result = await cleanupCustomerData<unknown>(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.listen(CHAT_SERVER_PORT, () => {
  console.log(`Chat server listening on http://127.0.0.1:${CHAT_SERVER_PORT}`);
});
