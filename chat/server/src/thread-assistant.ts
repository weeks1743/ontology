import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { nanoid } from "nanoid";

import { answerThreadQuery } from "./query-engine.js";
import {
  createTask,
  getLatestActiveTaskByThread,
  getLatestTaskByThread,
  getThread,
  insertMessage,
  updateTask,
  updateMessagePayload,
  updateThreadProjection,
} from "./db.js";
import { createAudioAnalysisJob, queueResumeTask, queueStartTask, startAudioWorker } from "./graph.js";
import { ARTIFACTS_DIR } from "./paths.js";
import { SqliteSaver } from "./sqlite-checkpointer.js";
import type { AnalysisCardPayload, AssistantTextPayload, PersistedThread } from "./types.js";

type ThreadAssistantState = {
  threadId?: string;
  ontologyId?: string;
  text?: string;
  audioPath?: string | null;
  audioFileName?: string | null;
  route?: "start_recording_task" | "resume_recording_task" | "answer_query";
  activeTaskId?: string | null;
  activeInterrupt?: string | null;
};

const ThreadAssistantAnnotation = Annotation.Root({
  threadId: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  ontologyId: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  text: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  audioPath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  audioFileName: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  route: Annotation<ThreadAssistantState["route"] | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  activeTaskId: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  activeInterrupt: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
});

const runningThreads = new Set<string>();

function ensureThread(threadId: string) {
  const payload = getThread(threadId);
  if (!payload) {
    throw new Error(`Thread not found: ${threadId}`);
  }
  return payload.thread;
}

function looksLikeQuery(text: string) {
  return /[?？]|(什么|多少|谁|怎么|如何|阶段|预算|商机|联系人|为什么|哪些|哪条|是不是|能否|有没有|总结|解释)/.test(text);
}

function updateThreadFocusFromLatestTask(thread: PersistedThread, threadId: string) {
  const latestTask = getLatestTaskByThread(threadId);
  if (!latestTask) return;
  updateThreadProjection(threadId, {
    activeMode: latestTask.status === "completed" || latestTask.status === "failed" ? "query_mode" : "recording_task",
    activeTaskId: latestTask.status === "completed" || latestTask.status === "failed" ? null : latestTask.taskId,
    lastCompletedTaskId: latestTask.status === "completed" ? latestTask.taskId : thread.lastCompletedTaskId,
    focusCustomerId: latestTask.customerId ?? thread.focusCustomerId,
    focusVisitRecordId: latestTask.visitRecordId ?? thread.focusVisitRecordId,
  });
}

function determineRoute(state: ThreadAssistantState) {
  if (state.audioPath && state.audioFileName) {
    return "start_recording_task" as const;
  }

  const text = String(state.text ?? "").trim();
  if (!text) {
    return "answer_query" as const;
  }

  if (
    state.activeInterrupt &&
    (state.activeInterrupt === "wait_customer_name" || state.activeInterrupt === "wait_opportunity_confirmation") &&
    !looksLikeQuery(text)
  ) {
    return "resume_recording_task" as const;
  }

  return "answer_query" as const;
}

async function startRecordingTaskForThread(params: {
  threadId: string;
  ontologyId: string;
  audioPath: string;
  audioFileName: string;
}) {
  const activeTask = getLatestActiveTaskByThread(params.threadId);
  if (activeTask) {
    insertMessage({
      id: nanoid(16),
      threadId: params.threadId,
      role: "assistant",
      kind: "assistant-text",
      payload: {
        text: "当前会话已有进行中的录音任务。请先完成当前任务，或新建会话后再上传新的录音。",
      } satisfies AssistantTextPayload,
    });
    return;
  }

  const taskId = nanoid(16);
  const artifactRoot = join(ARTIFACTS_DIR, taskId);
  mkdirSync(artifactRoot, { recursive: true });

  const analysisCard = insertMessage({
    id: nanoid(16),
    threadId: params.threadId,
    role: "assistant",
    kind: "analysis-card",
    payload: {
      fileName: params.audioFileName,
      status: "queued",
      jobId: null,
      taskId: null,
      error: null,
    } satisfies AnalysisCardPayload,
  });

  const task = createTask({
    id: taskId,
    threadId: params.threadId,
    capabilityCode: "crm.visit_audio_intake",
    artifactRoot,
    status: "queued",
    analysisMessageId: analysisCard.id,
    payload: {
      ontologyId: params.ontologyId,
    },
  });

  if (!task) {
    throw new Error("Failed to create recording task");
  }

  const jobId = createAudioAnalysisJob(taskId, params.audioFileName, params.audioPath);
  insertMessage({
    id: nanoid(16),
    threadId: params.threadId,
    role: "assistant",
    kind: "task-status-card",
    payload: {
      taskId,
      title: "任务已创建",
      status: "info",
      body: "录音任务已挂载到当前线程，系统将继续执行录音解析与后续业务推进。",
    },
  });

  updateThreadProjection(params.threadId, {
    activeMode: "recording_task",
    activeTaskId: taskId,
    focusCustomerId: null,
    focusVisitRecordId: null,
    focusOpportunityId: null,
    threadSummary: {
      lastEntry: "recording_task_started",
      audioFileName: params.audioFileName,
      latestTaskId: taskId,
    },
  });

  startAudioWorker(taskId);
  queueStartTask({
    taskId,
    threadId: params.threadId,
    ontologyId: params.ontologyId,
    capabilityCode: "crm.visit_audio_intake",
    audioPath: params.audioPath,
    audioFileName: params.audioFileName,
    analysisMessageId: analysisCard.id,
  });

  updateMessagePayload(params.threadId, analysisCard.id, {
    jobId,
    taskId,
  } satisfies Partial<AnalysisCardPayload>);
}

async function answerQueryForThread(params: {
  threadId: string;
  text: string;
  activeTaskId?: string | null;
}) {
  const answer = await generateThreadQueryAnswer({
    threadId: params.threadId,
    text: params.text,
  });
  finalizeThreadQueryAnswer({
    threadId: params.threadId,
    text: params.text,
    answer,
    activeTaskId: params.activeTaskId,
  });
}

export async function generateThreadQueryAnswer(params: {
  threadId: string;
  text: string;
}) {
  return answerThreadQuery({
    threadId: params.threadId,
    question: params.text,
  });
}

export function finalizeThreadQueryAnswer(params: {
  threadId: string;
  text: string;
  answer: Awaited<ReturnType<typeof generateThreadQueryAnswer>>;
  activeTaskId?: string | null;
}) {
  const message = insertMessage({
    id: nanoid(16),
    threadId: params.threadId,
    role: "assistant",
    kind: "assistant-text",
    payload: {
      text: params.answer.text,
    } satisfies AssistantTextPayload,
  });

  const thread = ensureThread(params.threadId);
  updateThreadProjection(params.threadId, {
    activeMode: params.activeTaskId ? "recording_task" : "query_mode",
    focusCustomerId: params.answer.customerId ?? thread.focusCustomerId,
    focusVisitRecordId: params.answer.visitRecordId ?? thread.focusVisitRecordId,
    focusOpportunityId: params.answer.opportunityId ?? thread.focusOpportunityId,
    threadSummary: {
      ...(thread.threadSummary ?? {}),
      lastQuery: params.text,
      lastAnswer: params.answer.summary ?? {},
      lastAnswerConfidence: params.answer.confidence,
    },
  });
  return message;
}

const assistantThreadGraph = new StateGraph(ThreadAssistantAnnotation)
  .addNode("load_thread_context", async (state: ThreadAssistantState) => {
    if (!state.threadId) throw new Error("Missing threadId");
    const thread = ensureThread(state.threadId);
    updateThreadFocusFromLatestTask(thread, state.threadId);
    const activeTask = getLatestActiveTaskByThread(state.threadId);
    return {
      activeTaskId: activeTask?.taskId ?? null,
      activeInterrupt: activeTask?.currentInterrupt ?? null,
    };
  })
  .addNode("route_turn", async (state: ThreadAssistantState) => ({
    route: determineRoute(state),
  }))
  .addNode("start_recording_task", async (state: ThreadAssistantState) => {
    if (!state.threadId || !state.ontologyId || !state.audioPath || !state.audioFileName) {
      throw new Error("Missing recording task prerequisites");
    }
    await startRecordingTaskForThread({
      threadId: state.threadId,
      ontologyId: state.ontologyId,
      audioPath: state.audioPath,
      audioFileName: state.audioFileName,
    });
    return {};
  })
  .addNode("resume_recording_task", async (state: ThreadAssistantState) => {
    if (!state.threadId || !state.activeTaskId) {
      throw new Error("Missing task to resume");
    }
    updateTask(state.activeTaskId, { status: "running" });
    updateThreadProjection(state.threadId, {
      activeMode: "recording_task",
      activeTaskId: state.activeTaskId,
      threadSummary: {
        lastEntry: "recording_task_resumed",
        resumedBy: String(state.text ?? ""),
      },
    });
    queueResumeTask(state.activeTaskId, String(state.text ?? "").trim());
    return {};
  })
  .addNode("answer_query", async (state: ThreadAssistantState) => {
    if (!state.threadId) throw new Error("Missing threadId");
    await answerQueryForThread({
      threadId: state.threadId,
      text: String(state.text ?? ""),
      activeTaskId: state.activeTaskId,
    });
    return {};
  })
  .addEdge(START, "load_thread_context")
  .addEdge("load_thread_context", "route_turn")
  .addConditionalEdges("route_turn", (state) => state.route ?? "answer_query", {
    start_recording_task: "start_recording_task",
    resume_recording_task: "resume_recording_task",
    answer_query: "answer_query",
  })
  .addEdge("start_recording_task", END)
  .addEdge("resume_recording_task", END)
  .addEdge("answer_query", END)
  .compile({
    checkpointer: new SqliteSaver(),
  });

function threadGraphConfig(threadId: string) {
  return {
    configurable: {
      thread_id: threadId,
      checkpoint_ns: "assistant_thread",
    },
  };
}

export async function runThreadAssistantTurn(input: {
  threadId: string;
  ontologyId: string;
  text: string;
  audioPath?: string | null;
  audioFileName?: string | null;
}) {
  if (runningThreads.has(input.threadId)) {
    return;
  }
  runningThreads.add(input.threadId);
  try {
    await assistantThreadGraph.invoke(input, threadGraphConfig(input.threadId));
  } finally {
    runningThreads.delete(input.threadId);
  }
}
