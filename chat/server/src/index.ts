import cors from "cors";
import express from "express";
import multer from "multer";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import http from "node:http";
import { nanoid } from "nanoid";

import { cleanupCustomerData, executeOntologySkill } from "./ability-client.js";
import { getDb, getLatestActiveTaskByThread, getLatestTaskByThread, getTask, getTaskByTingwuTaskId, getThread, insertMessage, listArtifacts, listThreads, updateMessagePayload, updateTask, createTask, createThread, updateThreadTitle, deleteTaskCascade, deleteThreadCascade, getAudioJob, listAudioJobs } from "./db.js";
import { loadEnvFiles } from "./env.js";
import { createAudioAnalysisJob, queueResumeTask, queueStartTask, startAudioWorker, triggerSpeakerProfileWorkflow } from "./graph.js";
import { ARTIFACTS_DIR, CHAT_ROOT_DIR, CHAT_SERVER_PORT, MEETING_VIEWER_PORT, OUTPUTS_DIR, TONGYI_ROOT_DIR, UPLOADS_DIR } from "./paths.js";
import type {
  AnalysisCardPayload,
  AssistantTextPayload,
  MessageAttachment,
} from "./types.js";
import { decodeMaybeLatin1FileName, deriveThreadTitle, ensureDir, isSupportedAudioFile, nowIso, parseOpportunityInput } from "./utils.js";

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

  const activeTask = getLatestActiveTaskByThread(threadId);
  const firstAudio = files.find((file) => isSupportedAudioFile(file.originalname));

  if (firstAudio) {
    if (activeTask) {
      insertMessage({
        id: nanoid(16),
        threadId,
        role: "assistant",
        kind: "assistant-text",
        payload: {
          text: "当前会话已有进行中的录音任务。请新建会话后再上传新的录音。",
        } satisfies AssistantTextPayload,
      });
      const payload = getThread(threadId)!;
      res.status(201).json({ thread: payload.thread, messages: payload.messages, createdMessages: [userMessage] });
      return;
    }

    const taskId = nanoid(16);
    const artifactRoot = join(ARTIFACTS_DIR, taskId);
    ensureDir(artifactRoot);
    const ext = firstAudio.originalname.split(".").pop() || "m4a";
    const uploadPath = join(UPLOADS_DIR, `${taskId}-${Date.now()}.${ext}`);
    writeFileSync(uploadPath, firstAudio.buffer);

    const analysisCard = insertMessage({
      id: nanoid(16),
      threadId,
      role: "assistant",
      kind: "analysis-card",
      payload: {
        fileName: firstAudio.originalname,
        status: "queued",
        jobId: null,
        taskId: null,
        error: null,
      } satisfies AnalysisCardPayload,
    });

    const task = createTask({
      id: taskId,
      threadId,
      capabilityCode: "crm.visit_audio_intake",
      artifactRoot,
      status: "queued",
      analysisMessageId: analysisCard.id,
      payload: {
        ontologyId: threadPayload.thread.ontologyId,
      },
    });
    if (!task) {
      res.status(500).json({ error: "Failed to create task" });
      return;
    }

    const jobId = createAudioAnalysisJob(taskId, firstAudio.originalname, uploadPath);
    updateMessagePayload(threadId, analysisCard.id, { jobId, taskId });
    startAudioWorker(taskId);
    queueStartTask({
      taskId,
      threadId,
      ontologyId: threadPayload.thread.ontologyId,
      capabilityCode: "crm.visit_audio_intake",
      audioPath: uploadPath,
      audioFileName: firstAudio.originalname,
      analysisMessageId: analysisCard.id,
    });

    const payload = getThread(threadId)!;
    res.status(201).json({
      thread: payload.thread,
      messages: payload.messages,
      createdMessages: [userMessage, getThread(threadId)!.messages.at(-1)],
    });
    return;
  }

  if (activeTask && activeTask.currentInterrupt === "wait_customer_name" && text.trim()) {
    updateTask(activeTask.taskId, { status: "running" });
    queueResumeTask(activeTask.taskId, text.trim());
    const payload = getThread(threadId)!;
    res.status(201).json({ thread: payload.thread, messages: payload.messages, createdMessages: [userMessage] });
    return;
  }

  if (activeTask && activeTask.currentInterrupt === "wait_opportunity_confirmation" && text.trim()) {
    updateTask(activeTask.taskId, { status: "running" });
    queueResumeTask(activeTask.taskId, text.trim());
    const payload = getThread(threadId)!;
    res.status(201).json({ thread: payload.thread, messages: payload.messages, createdMessages: [userMessage] });
    return;
  }

  const latestTask = getLatestTaskByThread(threadId);
  const pendingOpportunityClarification = threadPayload.messages.find((message) => {
    if (message.kind !== "clarification-card") return false;
    const payload = message.payload as Record<string, unknown>;
    return payload.stepCode === "wait_opportunity_confirmation" && payload.status === "pending";
  });

  if (!activeTask && latestTask && pendingOpportunityClarification && latestTask.customerId && text.trim()) {
    const parsed = parseOpportunityInput(text.trim());
    const result = await executeOntologySkill<{ success: boolean; data?: { opportunity_id?: string }; error?: string }>(
      "ont.crm.opportunity_create",
      {
        customer_id: latestTask.customerId,
        name: `${latestTask.customerName ?? "客户"} 拜访商机`,
        amount: parsed.amount ?? 0,
        product_notes: parsed.productNotes,
        source_task_id: latestTask.taskId,
        stage: "需求分析",
        probability: 50,
      },
    );
    if (result.success) {
      updateMessagePayload(threadId, pendingOpportunityClarification.id, { status: "resolved" });
      updateTask(latestTask.taskId, {
        opportunityStatus: "completed",
        status: "completed",
      });
      insertMessage({
        id: nanoid(16),
        threadId,
        role: "assistant",
        kind: "task-status-card",
        payload: {
          taskId: latestTask.taskId,
          title: "商机已保存",
          status: "success",
          body: `已保存客户意向产品：${parsed.productNotes || "未填写"}；金额：${parsed.amount ?? 0} 元。`,
        },
      });
      const payload = getThread(threadId)!;
      res.status(201).json({ thread: payload.thread, messages: payload.messages, createdMessages: [userMessage] });
      return;
    }
  }

  insertMessage({
    id: nanoid(16),
    threadId,
    role: "assistant",
    kind: "assistant-text",
    payload: {
      text: activeTask?.currentInterrupt === "wait_speaker_fix"
        ? "当前任务正在等待发言人修正。请先到录音详情页完成姓名修正与“我司成员”标记。"
        : "当前主会话仅处理录音拜访任务。请上传 m4a/mp3 音频，或在任务提示下继续填写客户名称 / 商机信息。",
    } satisfies AssistantTextPayload,
  });
  const payload = getThread(threadId)!;
  res.status(201).json({ thread: payload.thread, messages: payload.messages, createdMessages: [userMessage] });
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
