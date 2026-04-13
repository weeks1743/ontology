import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AssistantRuntimeProvider,
  useAssistantRuntime,
  useExternalStoreRuntime,
  type ExternalStoreAdapter,
  type ExternalStoreThreadData,
  type MessageState,
  type ThreadMessage,
} from "@assistant-ui/react";
import { useAuiState } from "@assistant-ui/store";

type JobStatus = "queued" | "analyzing" | "succeeded" | "failed";

type PersistedThread = {
  id: string;
  assistantId: string;
  title: string;
  status: "regular" | "archived";
  createdAt: string;
  updatedAt: string;
};

type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type UserEntryPayload = {
  text: string;
  attachments: MessageAttachment[];
};

type AssistantTextPayload = {
  text: string;
};

type AnalysisCardPayload = {
  fileName: string;
  status: JobStatus;
  jobId: string | null;
  taskId: string | null;
  error: string | null;
};

type PersistedMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  kind: "user-entry" | "assistant-text" | "analysis-card";
  payload: UserEntryPayload | AssistantTextPayload | AnalysisCardPayload;
  createdAt: string;
  updatedAt: string;
};

type ThreadDetailResponse = {
  thread: PersistedThread;
  messages: PersistedMessage[];
};

type ThreadListResponse = {
  threads: PersistedThread[];
};

type CreateThreadResponse = {
  thread: PersistedThread;
};

type CreateMessagesResponse = {
  thread: PersistedThread;
  messages: PersistedMessage[];
  createdMessages: PersistedMessage[];
};

type PendingAttachment = {
  id: string;
  file: File;
};

const ACTIVE_THREAD_STORAGE_KEY = "chat-active-thread-id-v1";
const DEFAULT_THREAD_TITLE = "新对话";

const CRM_ASSISTANTS = [
  { id: "crm-copilot", name: "CRM Copilot", subtitle: "线索到商机推进" },
  { id: "sales-coach", name: "Sales Coach", subtitle: "销售话术与推进建议" },
  { id: "meeting-analyst", name: "Meeting Analyst", subtitle: "录音洞察与复盘" },
];

const QUICK_ACTIONS = [
  { id: "create_lead", label: "新增线索" },
  { id: "advance_opportunity", label: "推进商机" },
  { id: "customer_profile", label: "客户画像" },
  { id: "upload_files", label: "上传文件" },
];

const SUGGESTION_CARDS = [
  {
    title: "新增制造业线索",
    description: "一句话创建线索并补全关键字段",
    prompt: "新增线索：江苏某制造企业，预算 50 万，需求是销售流程数字化。",
  },
  {
    title: "本周高风险商机",
    description: "快速识别停滞机会与建议动作",
    prompt: "帮我查看本周高风险商机，并给每个商机一条可执行建议。",
  },
  {
    title: "拜访复盘提炼",
    description: "生成客户关注点和跟进清单",
    prompt: "整理今天客户拜访纪要，提炼关注点、风险和下一步跟进动作。",
  },
  {
    title: "上传客户录音",
    description: "将 m4a/mp3 音频作为附件发送，生成分析卡片",
    prompt: "我会上传一段拜访录音，请帮我分析并跟踪进度。",
  },
];

const DRAFT_PRESETS: Record<string, string> = {
  create_lead: "新增线索：客户是华东制造企业，预算 80 万，当前希望 3 个月内试点上线。",
  advance_opportunity: "帮我梳理商机 OP-2026-032 的推进阻塞点，并给出下周行动计划。",
  customer_profile: "基于最近拜访记录，生成“江苏某制造集团”的客户画像与关键决策链。",
};

const STATUS_TEXT: Record<JobStatus, string> = {
  queued: "排队中",
  analyzing: "分析中",
  succeeded: "分析完成",
  failed: "分析失败",
};

const STATUS_CLASS: Record<JobStatus, string> = {
  queued: "queued",
  analyzing: "analyzing",
  succeeded: "succeeded",
  failed: "failed",
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
};

const sortThreads = (threads: PersistedThread[]) =>
  [...threads].sort((a, b) => {
    if (a.updatedAt === b.updatedAt) {
      return a.createdAt > b.createdAt ? -1 : 1;
    }
    return a.updatedAt > b.updatedAt ? -1 : 1;
  });

const upsertThread = (threads: PersistedThread[], thread: PersistedThread) =>
  sortThreads([...threads.filter((item) => item.id !== thread.id), thread]);

const buildThreadData = (threads: PersistedThread[]): ExternalStoreThreadData<"regular">[] =>
  threads
    .filter((thread) => thread.status === "regular")
    .map((thread) => ({
      id: thread.id,
      remoteId: thread.id,
      title: thread.title,
      status: "regular",
    }));

const fetchJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
};

const toThreadMessage = (message: PersistedMessage): ThreadMessage => {
  const createdAt = new Date(message.createdAt);

  if (message.kind === "user-entry") {
    const payload = message.payload as UserEntryPayload;
    const content =
      payload.text.trim().length > 0
        ? [{ type: "text" as const, text: payload.text }]
        : [{ type: "data" as const, name: "attachments", data: payload.attachments }];

    return {
      id: message.id,
      role: "user",
      createdAt,
      content,
      attachments: [],
      metadata: {
        custom: {
          kind: message.kind,
          payload,
        },
      },
    };
  }

  if (message.kind === "assistant-text") {
    const payload = message.payload as AssistantTextPayload;
    return {
      id: message.id,
      role: "assistant",
      createdAt,
      content: [{ type: "text", text: payload.text }],
      status: { type: "complete", reason: "stop" },
      metadata: {
        unstable_state: null,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {
          kind: message.kind,
          payload,
        },
      },
    };
  }

  const payload = message.payload as AnalysisCardPayload;
  const status =
    payload.status === "succeeded"
      ? { type: "complete" as const, reason: "stop" as const }
      : payload.status === "failed"
        ? {
            type: "incomplete" as const,
            reason: "error" as const,
            error: payload.error ?? "analysis failed",
          }
        : { type: "running" as const };

  return {
    id: message.id,
    role: "assistant",
    createdAt,
    content: [{ type: "data", name: "analysis-card", data: payload }],
    status,
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {
        kind: message.kind,
        payload,
      },
    },
  };
};

const getMessageMeta = (message: MessageState) => {
  const custom = (message.metadata?.custom || {}) as {
    kind?: PersistedMessage["kind"];
    payload?: PersistedMessage["payload"];
  };
  return {
    kind: custom.kind,
    payload: custom.payload,
  };
};

function Composer({
  draft,
  attachments,
  busy,
  onDraftChange,
  onSubmit,
  onUploadClick,
  onRemoveAttachment,
}: {
  draft: string;
  attachments: PendingAttachment[];
  busy: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUploadClick: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
}) {
  const canSubmit = draft.trim().length > 0 || attachments.length > 0;

  return (
    <form className="composer" onSubmit={onSubmit}>
      {attachments.length > 0 ? (
        <div className="pending-attachments">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="pending-chip">
              <div>
                <div className="pending-chip-name">{attachment.file.name}</div>
                <div className="pending-chip-meta">
                  {attachment.file.type || "未知类型"} · {formatFileSize(attachment.file.size)}
                </div>
              </div>
              <button
                type="button"
                className="pending-chip-remove"
                onClick={() => onRemoveAttachment(attachment.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <textarea
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        className="composer-input"
        placeholder="从任何想法开始... 例如：新增线索、推进商机，或上传录音后发送"
      />

      <div className="composer-actions">
        <button className="tool-btn" type="button" onClick={onUploadClick} disabled={busy}>
          上传文件
        </button>
        <button className="send-btn" type="submit" disabled={!canSubmit || busy}>
          {busy ? "处理中..." : "发送"}
        </button>
      </div>
    </form>
  );
}

function UserEntryMessageView({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || { text: "", attachments: [] }) as UserEntryPayload;

  return (
    <article className="message-row user">
      <div className="message-bubble user-bubble">
        {payload.text ? <div className="message-content">{payload.text}</div> : null}
        {payload.attachments.length > 0 ? (
          <div className="message-attachments">
            {payload.attachments.map((attachment) => (
              <div key={attachment.id} className="message-attachment-chip">
                <div className="message-attachment-name">{attachment.fileName}</div>
                <div className="message-attachment-meta">
                  {attachment.mimeType || "未知类型"} · {formatFileSize(attachment.size)}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function AssistantTextMessageView({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || { text: "" }) as AssistantTextPayload;

  return (
    <article className="message-row assistant">
      <div className="message-bubble assistant-bubble">
        <div className="message-content">{payload.text}</div>
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function AnalysisCard({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || {
    fileName: "",
    status: "analyzing",
    jobId: null,
    taskId: null,
    error: null,
  }) as AnalysisCardPayload;

  return (
    <article className="message-row assistant">
      <div className="analysis-card">
        <div className="analysis-card-top">
          <div>
            <div className="analysis-card-label">录音分析</div>
            <div className="analysis-card-file">{payload.fileName}</div>
          </div>
          <span className={`status-pill ${STATUS_CLASS[payload.status]}`}>
            {STATUS_TEXT[payload.status]}
          </span>
        </div>
        <div className="analysis-card-meta">
          {payload.jobId ? `任务ID：${payload.jobId}` : "任务创建中..."}
        </div>
        {payload.error ? <div className="analysis-card-error">{payload.error}</div> : null}
        {payload.status === "analyzing" || payload.status === "queued" ? (
          <div className="analysis-card-progress">正在解析录音、提炼关键词与章节，请稍候...</div>
        ) : null}
        {payload.status === "succeeded" && payload.taskId ? (
          <a className="analysis-card-link" href={`/meeting-viewer/?task=${payload.taskId}`}>
            查看详情
          </a>
        ) : null}
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function Workspace({
  activeAssistantId,
  setActiveAssistantId,
  draft,
  setDraft,
  pendingAttachments,
  setPendingAttachments,
  submitBusy,
  submitDraft,
}: {
  activeAssistantId: string;
  setActiveAssistantId: (value: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  pendingAttachments: PendingAttachment[];
  setPendingAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>;
  submitBusy: boolean;
  submitDraft: (input: string, attachments: PendingAttachment[]) => Promise<void>;
}) {
  const runtime = useAssistantRuntime();
  const threadsState = useAuiState((state) => state.threads);
  const messages = useAuiState((state) => state.thread.messages);
  const isEmpty = useAuiState((state) => state.thread.isEmpty);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageStageRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  useEffect(() => {
    if (messageStageRef.current && !isEmpty) {
      messageStageRef.current.scrollTop = messageStageRef.current.scrollHeight;
    }
  }, [messages, isEmpty]);

  const onFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }
    setPendingAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({ id: makeId(), file })),
    ]);
    event.target.value = "";
  };

  const onRemoveAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const onQuickAction = (actionId: string) => {
    if (actionId === "upload_files") {
      fileInputRef.current?.click();
      return;
    }
    const preset = DRAFT_PRESETS[actionId];
    if (preset) {
      setDraft(preset);
    }
  };

  const onSubmitComposer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitDraft(draft, pendingAttachments);
  };

  return (
    <div className="crm-shell">
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        onChange={onFilesSelected}
      />

      <aside className="crm-sidebar">
        <div className="sidebar-user">
          <div className="avatar">SC</div>
          <div className="sidebar-user-meta">
            <div className="user-name">Sven Chen</div>
            <div className="user-role">AI Native CRM</div>
          </div>
        </div>

        <div className="sidebar-search">搜索会话 / 助手</div>

        <div className="sidebar-section-title">助手</div>
        <div className="assistant-list">
          {CRM_ASSISTANTS.map((assistant) => (
            <button
              key={assistant.id}
              className={`assistant-item ${assistant.id === activeAssistantId ? "active" : ""}`}
              onClick={() => setActiveAssistantId(assistant.id)}
              type="button"
            >
              <div className="assistant-name">{assistant.name}</div>
              <div className="assistant-subtitle">{assistant.subtitle}</div>
            </button>
          ))}
        </div>

        <div className="thread-toolbar">
          <div className="sidebar-section-title">会话</div>
          <button
            type="button"
            className="new-thread-btn"
            onClick={() => void runtime.threads.switchToNewThread()}
          >
            新建会话
          </button>
        </div>

        <div className="thread-list">
          {threadsState.threadIds.length === 0 ? (
            <div className="thread-empty">还没有会话，发送第一条消息开始。</div>
          ) : (
            threadsState.threadIds.map((threadId) => {
              const item = threadsState.threadItems.find((entry) => entry.id === threadId);
              if (!item) {
                return null;
              }
              return (
                <button
                  key={threadId}
                  className={`thread-item ${threadsState.mainThreadId === threadId ? "active" : ""}`}
                  type="button"
                  onClick={() => void runtime.threads.switchToThread(threadId)}
                >
                  {item.title || DEFAULT_THREAD_TITLE}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="crm-workspace">
        <header className="workspace-head">
          <div className="workspace-head-main">
            <div className="workspace-title">
              {CRM_ASSISTANTS.find((assistant) => assistant.id === activeAssistantId)?.name ||
                CRM_ASSISTANTS[0].name}
            </div>
            <div className="workspace-subtitle">
              {CRM_ASSISTANTS.find((assistant) => assistant.id === activeAssistantId)?.subtitle ||
                CRM_ASSISTANTS[0].subtitle}
            </div>
          </div>
          <div className="workspace-tools" aria-label="快捷动作">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                className="quick-action"
                type="button"
                onClick={() => onQuickAction(action.id)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </header>

        {isEmpty ? (
          <section className="landing">
            <div className="landing-hero">
              <div className="landing-kicker">AI Native CRM</div>
              <h1>开始一条真正可落地的业务对话</h1>
              <p>在这里，线索创建、商机推进、客户画像和录音分析都进入同一条 CRM 工作流，而不是分散在多个孤立工具里。</p>
            </div>
            <div className="landing-composer">
            <Composer
              draft={draft}
              attachments={pendingAttachments}
              busy={submitBusy}
              onDraftChange={setDraft}
              onSubmit={onSubmitComposer}
              onUploadClick={() => fileInputRef.current?.click()}
              onRemoveAttachment={onRemoveAttachment}
            />
            </div>
            <div className="suggestion-grid">
              {SUGGESTION_CARDS.map((card) => (
                <button
                  key={card.title}
                  className="suggestion-card"
                  type="button"
                  onClick={() => setDraft(card.prompt)}
                >
                  <div className="suggestion-title">{card.title}</div>
                  <div className="suggestion-desc">{card.description}</div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="conversation">
            <div className="message-stage" ref={messageStageRef}>
              <div className="message-list">
              {messages.map((message) => {
                const meta = getMessageMeta(message);
                if (message.role === "user" && meta.kind === "user-entry") {
                  return <UserEntryMessageView key={message.id} message={message} />;
                }
                if (meta.kind === "analysis-card") {
                  return <AnalysisCard key={message.id} message={message} />;
                }
                return <AssistantTextMessageView key={message.id} message={message} />;
              })}
              </div>
            </div>
            <div className="composer-dock">
              <Composer
                draft={draft}
                attachments={pendingAttachments}
                busy={submitBusy}
                onDraftChange={setDraft}
                onSubmit={onSubmitComposer}
                onUploadClick={() => fileInputRef.current?.click()}
                onRemoveAttachment={onRemoveAttachment}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function App() {
  const [activeAssistantId, setActiveAssistantId] = useState("crm-copilot");
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [threads, setThreads] = useState<PersistedThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(undefined);
  const [persistedMessages, setPersistedMessages] = useState<PersistedMessage[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const threadMessages = useMemo<ThreadMessage[]>(
    () => persistedMessages.map((message) => toThreadMessage(message)),
    [persistedMessages],
  );

  const loadThread = async (threadId: string, preferredThread?: PersistedThread) => {
    setThreadLoading(true);
    try {
      const payload = await fetchJson<ThreadDetailResponse>(`/api/chat/threads/${threadId}`);
      setSelectedThreadId(threadId);
      setPersistedMessages(payload.messages);
      setThreads((prev) => upsertThread(prev, payload.thread));
      setActiveAssistantId((preferredThread || payload.thread).assistantId || "crm-copilot");
      window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
    } finally {
      setThreadLoading(false);
    }
  };

  const switchToNewThread = async () => {
    setSelectedThreadId(undefined);
    setPersistedMessages([]);
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
  };

  const refreshThreads = async () => {
    const payload = await fetchJson<ThreadListResponse>("/api/chat/threads");
    const nextThreads = sortThreads(payload.threads || []);
    setThreads(nextThreads);
    return nextThreads;
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setThreadsLoading(true);
      try {
        const nextThreads = await refreshThreads();
        if (cancelled) {
          return;
        }
        const rememberedThreadId = window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY) || "";
        const preferredThread =
          nextThreads.find((thread) => thread.id === rememberedThreadId) || nextThreads[0];
        if (preferredThread) {
          await loadThread(preferredThread.id, preferredThread);
        } else {
          await switchToNewThread();
        }
      } finally {
        if (!cancelled) {
          setThreadsLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeAnalysisCards = useMemo(
    () =>
      persistedMessages.filter(
        (message) =>
          message.kind === "analysis-card" &&
          ((message.payload as AnalysisCardPayload).status === "queued" ||
            (message.payload as AnalysisCardPayload).status === "analyzing"),
      ),
    [persistedMessages],
  );

  useEffect(() => {
    if (!selectedThreadId || activeAnalysisCards.length === 0) {
      return;
    }

    const syncCardStatus = async () => {
      await Promise.all(
        activeAnalysisCards.map(async (message) => {
          const payload = message.payload as AnalysisCardPayload;
          if (!payload.jobId) {
            return;
          }
          try {
            const job = await fetchJson<{
              id: string;
              status: JobStatus;
              fileName: string;
              taskId: string | null;
              error: string | null;
            }>(`/api/chat/jobs/${payload.jobId}`);

            const nextPayload: AnalysisCardPayload = {
              ...payload,
              status: job.status,
              taskId: job.taskId,
              error: job.error,
            };

            const changed =
              nextPayload.status !== payload.status ||
              nextPayload.taskId !== payload.taskId ||
              nextPayload.error !== payload.error;
            if (!changed) {
              return;
            }

            setPersistedMessages((prev) =>
              prev.map((item) =>
                item.id === message.id
                  ? {
                      ...item,
                      payload: nextPayload,
                    }
                  : item,
              ),
            );

            await fetchJson<{ message: PersistedMessage }>(
              `/api/chat/threads/${selectedThreadId}/messages/${message.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nextPayload),
              },
            );
          } catch {
            return;
          }
        }),
      );
    };

    void syncCardStatus();
    const timer = window.setInterval(() => {
      void syncCardStatus();
    }, 2200);
    return () => window.clearInterval(timer);
  }, [activeAnalysisCards, selectedThreadId]);

  const runtimeStore = useMemo<ExternalStoreAdapter<ThreadMessage>>(
    () => ({
      isLoading: threadLoading,
      messages: threadMessages,
      onNew: async () => {},
      adapters: {
        threadList: {
          threadId: selectedThreadId,
          isLoading: threadsLoading || threadLoading,
          threads: buildThreadData(threads),
          onSwitchToNewThread: async () => {
            await switchToNewThread();
          },
          onSwitchToThread: async (threadId) => {
            const thread = threads.find((item) => item.id === threadId);
            await loadThread(threadId, thread);
          },
        },
      },
    }),
    [selectedThreadId, threadLoading, threadMessages, threads, threadsLoading],
  );

  const runtime = useExternalStoreRuntime(runtimeStore);

  const submitDraft = async (input: string, attachments: PendingAttachment[]) => {
    const text = input.trim();
    if (!text && attachments.length === 0) {
      return;
    }

    setSubmitBusy(true);
    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        const created = await fetchJson<CreateThreadResponse>("/api/chat/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assistantId: activeAssistantId }),
        });
        threadId = created.thread.id;
        setSelectedThreadId(threadId);
        setThreads((prev) => upsertThread(prev, created.thread));
        window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
      }

      const formData = new FormData();
      formData.append("text", text);
      attachments.forEach((attachment) => {
        formData.append("files", attachment.file);
      });

      const response = await fetchJson<CreateMessagesResponse>(
        `/api/chat/threads/${threadId}/messages`,
        {
          method: "POST",
          body: formData,
        },
      );

      setThreads((prev) => upsertThread(prev, response.thread));
      setPersistedMessages(response.messages);
      setDraft("");
      setPendingAttachments([]);
      setActiveAssistantId(response.thread.assistantId || activeAssistantId);
      window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, response.thread.id);
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Workspace
        activeAssistantId={activeAssistantId}
        setActiveAssistantId={setActiveAssistantId}
        draft={draft}
        setDraft={setDraft}
        pendingAttachments={pendingAttachments}
        setPendingAttachments={setPendingAttachments}
        submitBusy={submitBusy}
        submitDraft={submitDraft}
      />
    </AssistantRuntimeProvider>
  );
}
