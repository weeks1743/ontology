import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

// ─── Types ───────────────────────────────────────────────────────────

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

type ClarificationCardPayload = {
  taskId: string;
  stepCode: "wait_customer_name" | "wait_opportunity_confirmation";
  title: string;
  question: string;
  placeholder?: string;
  status: "pending" | "resolved";
};

type ArtifactCardPayload = {
  taskId: string;
  artifactType:
    | "company_research"
    | "it_assessment_markdown"
    | "company_analysis_pptx"
    | "it_assessment_pptx";
  title: string;
  fileName: string;
  filePath: string;
  downloadUrl: string;
  status: "ready" | "failed";
  subtitle?: string;
};

type ProfileCardPayload = {
  taskId: string;
  profileId: string;
  name: string;
  role: string;
  influence?: string;
  attitude?: string;
  tags: string[];
  traits?: string[];
  focus?: string;
  summary: string;
};

type GraphCardPayload = {
  taskId: string;
  title: string;
  summary: string;
  nodes?: Array<{
    id: string;
    label: string;
    kind: "customer" | "visit_record" | "contact" | "opportunity";
    meta?: Record<string, string>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
  }>;
  company?: {
    name: string;
    businessType?: string;
    industry?: string;
    headquarters?: string;
    founded?: string;
    scale?: string;
    revenue?: string;
    businesses: string[];
    characteristics: string[];
    researchSummary?: string;
  };
  people?: Array<{
    id: string;
    name: string;
    role: string;
    influence?: string;
    attitude?: string;
    traits: string[];
    focus?: string;
    summary: string;
  }>;
  peopleRelations?: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    description?: string;
  }>;
  visit?: {
    id: string;
    summary?: string;
  };
  opportunity?: {
    id: string;
    summary?: string;
  } | null;
};

type GraphPerson = {
  id: string;
  name: string;
  role: string;
  influence?: string;
  attitude?: string;
  traits: string[];
  focus?: string;
  summary: string;
};

type GraphCompany = NonNullable<GraphCardPayload["company"]>;

type TaskStatusCardPayload = {
  taskId: string;
  title: string;
  status: "info" | "success" | "warning" | "error";
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  openInNewTab?: boolean;
};

type PersistedMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  kind:
    | "user-entry"
    | "assistant-text"
    | "analysis-card"
    | "clarification-card"
    | "artifact-card"
    | "profile-card"
    | "graph-card"
    | "task-status-card";
  payload:
    | UserEntryPayload
    | AssistantTextPayload
    | AnalysisCardPayload
    | ClarificationCardPayload
    | ArtifactCardPayload
    | ProfileCardPayload
    | GraphCardPayload
    | TaskStatusCardPayload;
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

// ─── Ontology-specific configs ───────────────────────────────────────

type OntologyConfig = {
  defaultAssistantId: string;
  suggestionCards: Array<{ title: string; description: string; prompt: string }>;
  landingTitle: string;
  landingDesc: string;
};

const ONTOLOGY_CONFIGS: Record<string, OntologyConfig> = {
  crm: {
    defaultAssistantId: "crm-copilot",
    suggestionCards: [
      {
        title: "上传客户录音",
        description: "将 m4a/mp3 音频作为附件发送",
        prompt: "我会上传一段拜访录音，请帮我分析并跟踪进度。",
      },
      {
        title: "继续补客户名",
        description: "补充客户名称后继续任务",
        prompt: "东港投资发展集团有限公司",
      },
      {
        title: "录入商机信息",
        description: "输入产品和金额",
        prompt: "轻云、融合中心，10万",
      },
    ],
    landingTitle: "AI原生CRM",
    landingDesc: "上传录音、补充客户名称、修正发言人并确认商机信息，系统会沿同一条对话自动推进。",
  },
};

const DEFAULT_CONFIG: OntologyConfig = {
  defaultAssistantId: "default-assistant",
  suggestionCards: [],
  landingTitle: "开始对话",
  landingDesc: "选择一个本体以开始使用专业对话功能。",
};

// ─── Utilities ───────────────────────────────────────────────────────

const ACTIVE_THREAD_STORAGE_KEY = "chat-active-thread-id-v1";
const DEFAULT_THREAD_TITLE = "新对话";

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

const decodeMaybeLatin1FileName = (input: string) => {
  try {
    const mojibakeLike = /[ÃÂäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(input);
    if (!mojibakeLike) return input;
    return decodeURIComponent(
      Array.from(input)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return input;
  }
};

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
    throw new Error((payload as { error?: string }).error || "Request failed");
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

  const payload = message.payload;
  const status =
    message.kind === "analysis-card"
      ? (payload as AnalysisCardPayload).status === "succeeded"
        ? { type: "complete" as const, reason: "stop" as const }
        : (payload as AnalysisCardPayload).status === "failed"
          ? {
              type: "incomplete" as const,
              reason: "error" as const,
              error: (payload as AnalysisCardPayload).error ?? "analysis failed",
            }
          : { type: "running" as const }
      : { type: "complete" as const, reason: "stop" as const };

  return {
    id: message.id,
    role: "assistant",
    createdAt,
    content: [{ type: "data", name: message.kind, data: payload }],
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

// ─── Sub-components ──────────────────────────────────────────────────

function Composer({
  draft,
  attachments,
  busy,
  onDraftChange,
  onSubmit,
  onKeyDown,
  onUploadClick,
  onRemoveAttachment,
}: {
  draft: string;
  attachments: PendingAttachment[];
  busy: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
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
                <div className="pending-chip-name">{decodeMaybeLatin1FileName(attachment.file.name)}</div>
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
        onKeyDown={onKeyDown}
        className="composer-input"
        placeholder="从任何想法开始... 例如：新增线索、推进商机，或上传录音后发送"
      />

      <div className="composer-actions">
        <div className="composer-hint-row">
          <button className="tool-btn" type="button" onClick={onUploadClick} disabled={busy}>
            上传文件
          </button>
          <span className="composer-shortcut">⌘ + Enter 发送</span>
        </div>
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
                <div className="message-attachment-name">{decodeMaybeLatin1FileName(attachment.fileName)}</div>
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
            <div className="analysis-card-file">{decodeMaybeLatin1FileName(payload.fileName)}</div>
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
          <a className="analysis-card-link" href={`/meeting-viewer/?task=${payload.taskId}`} target="_blank" rel="noreferrer">
            查看详情
          </a>
        ) : null}
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function ClarificationCard({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || {
    title: "",
    question: "",
    status: "pending",
  }) as ClarificationCardPayload;

  return (
    <article className="message-row assistant">
      <div className="detail-card">
        <div className="detail-card-header">
          <div className="detail-card-title">{payload.title}</div>
          <span className={`status-pill ${payload.status === "resolved" ? "succeeded" : "queued"}`}>
            {payload.status === "resolved" ? "已完成" : "待处理"}
          </span>
        </div>
        <div className="detail-card-body">{payload.question}</div>
        {payload.placeholder ? <div className="detail-card-subtle">输入示例：{payload.placeholder}</div> : null}
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function ArtifactCard({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || {
    title: "",
    fileName: "",
    downloadUrl: "#",
    status: "ready",
  }) as ArtifactCardPayload;

  return (
    <article className="message-row assistant">
      <div className="detail-card artifact-card">
        <div className="detail-card-header">
          <div>
            <div className="detail-card-title">{payload.title}</div>
            <div className="artifact-file-name">{decodeMaybeLatin1FileName(payload.fileName)}</div>
          </div>
          <span className={`status-pill ${payload.status === "ready" ? "succeeded" : "failed"}`}>
            {payload.status === "ready" ? "已生成" : "失败"}
          </span>
        </div>
        {payload.subtitle ? <div className="detail-card-subtle">{payload.subtitle}</div> : null}
        <a className="analysis-card-link" href={payload.downloadUrl}>
          下载 / 查看
        </a>
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function ProfileCard({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || {
    name: "",
    role: "",
    tags: [],
    traits: [],
    summary: "",
  }) as ProfileCardPayload;
  const chips = (payload.tags && payload.tags.length > 0 ? payload.tags : payload.traits) || [];

  return (
    <article className="message-row assistant">
      <div className="detail-card profile-card">
        <div className="detail-card-header">
          <div className="detail-card-title">{payload.name}</div>
          <span className="status-pill queued">联系人画像</span>
        </div>
        <div className="detail-card-body">{payload.role}</div>
        <div className="detail-card-subtle">{payload.summary}</div>
        {payload.focus ? <div className="people-focus">关注：{payload.focus}</div> : null}
        <div className="tag-list">
          {chips.map((tag) => (
            <span key={tag} className="tag-chip">
              {tag}
            </span>
          ))}
        </div>
        {payload.influence || payload.attitude ? (
          <div className="profile-meta-row">
            {payload.influence ? <span>影响力：{payload.influence}</span> : null}
            {payload.attitude ? <span>态度：{payload.attitude}</span> : null}
          </div>
        ) : null}
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function GraphCard({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || {
    title: "",
    summary: "",
    company: undefined,
    people: [],
    peopleRelations: [],
    visit: undefined,
    opportunity: null,
  }) as GraphCardPayload;

  const fallbackCompany: GraphCompany | undefined =
    payload.company ||
    (() => {
      const customerNode = payload.nodes?.find((node) => node.kind === "customer");
      if (!customerNode) return undefined;
      return {
        name: customerNode.label,
        industry: customerNode.meta?.行业,
        headquarters: customerNode.meta?.总部,
        founded: customerNode.meta?.成立时间,
        scale: customerNode.meta?.规模,
        revenue: customerNode.meta?.营收,
        businessType: customerNode.meta?.业态,
        businesses: [],
        characteristics: [],
        researchSummary: customerNode.meta?.研究,
      };
    })();

  const fallbackPeople: GraphPerson[] =
    payload.people && payload.people.length > 0
      ? payload.people
      : (payload.nodes || [])
          .filter((node) => node.kind === "contact")
          .map((node) => ({
            id: node.id,
            name: node.label,
            role: node.meta?.角色 || "客户侧关键参与人",
            traits: [],
            summary: node.meta?.画像 || "已生成联系人画像",
          }));

  const company = fallbackCompany;
  const people = fallbackPeople;
  const relations = payload.peopleRelations || [];

  return (
    <article className="message-row assistant">
      <div className="detail-card graph-card">
        <div className="detail-card-header">
          <div className="detail-card-title">{payload.title}</div>
          <span className="status-pill succeeded">已建立</span>
        </div>
        <div className="detail-card-body">{payload.summary}</div>
        <div className="business-graph-shell">
          <section className="company-portrait-card">
            <div className="portrait-kicker">企业画像</div>
            <h3>{company?.name || "客户"}</h3>
            <div className="portrait-meta-grid">
              {company?.businessType ? <div><span>业态</span><strong>{company.businessType}</strong></div> : null}
              {company?.industry ? <div><span>行业</span><strong>{company.industry}</strong></div> : null}
              {company?.headquarters ? <div><span>总部</span><strong>{company.headquarters}</strong></div> : null}
              {company?.founded ? <div><span>成立时间</span><strong>{company.founded}</strong></div> : null}
              {company?.scale ? <div><span>规模</span><strong>{company.scale}</strong></div> : null}
              {company?.revenue ? <div><span>营收 / 资产</span><strong>{company.revenue}</strong></div> : null}
            </div>
            {company?.researchSummary ? <p className="portrait-summary">{company.researchSummary}</p> : null}
            <div className="portrait-chip-group">
              {(company?.businesses || []).map((item) => (
                <span key={item} className="portrait-chip portrait-chip-business">{item}</span>
              ))}
            </div>
            <div className="portrait-chip-group">
              {(company?.characteristics || []).map((item) => (
                <span key={item} className="portrait-chip portrait-chip-trait">{item}</span>
              ))}
            </div>
          </section>

          <section className="people-portrait-section">
            <div className="portrait-kicker">人物画像</div>
            <div className="people-card-grid">
              {people.map((person) => (
                <div key={person.id} className="people-card">
                  <div className="people-card-top">
                    <div className="people-avatar">{person.name.slice(0, 1)}</div>
                    <div>
                      <div className="people-name">{person.name}</div>
                      <div className="people-role">{person.role}</div>
                    </div>
                  </div>
                  <div className="people-badges">
                    {person.influence ? <span className="mini-badge">影响力 {person.influence}</span> : null}
                    {person.attitude ? <span className="mini-badge">{person.attitude}</span> : null}
                  </div>
                  <div className="portrait-chip-group compact">
                    {person.traits.map((trait) => (
                      <span key={trait} className="portrait-chip portrait-chip-trait">
                        {trait}
                      </span>
                    ))}
                  </div>
                  {person.focus ? <div className="people-focus">关注：{person.focus}</div> : null}
                  <div className="people-summary">{person.summary}</div>
                </div>
              ))}
            </div>
          </section>

          {relations.length > 0 ? (
            <section className="people-relation-section">
              <div className="portrait-kicker">人物关系</div>
              <div className="relation-list">
                {relations.map((relation) => {
                  const from = people.find((item) => item.id === relation.from)?.name || relation.from;
                  const to = people.find((item) => item.id === relation.to)?.name || relation.to;
                  return (
                    <div key={relation.id} className="relation-card">
                      <div className="relation-main">
                        <strong>{from}</strong>
                        <span className="relation-arrow">↔</span>
                        <strong>{to}</strong>
                      </div>
                      <div className="relation-label">{relation.label}</div>
                      {relation.description ? <div className="relation-desc">{relation.description}</div> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {payload.opportunity ? (
            <section className="business-footer-strip">
              <div className="footer-card">
                <span>商机状态</span>
                <strong>{payload.opportunity.id}</strong>
                {payload.opportunity.summary ? <p>{payload.opportunity.summary}</p> : null}
              </div>
            </section>
          ) : null}
        </div>
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

function TaskStatusCard({ message }: { message: MessageState }) {
  const meta = getMessageMeta(message);
  const payload = (meta.payload || {
    title: "",
    body: "",
    status: "info",
  }) as TaskStatusCardPayload;

  return (
    <article className="message-row assistant">
      <div className={`detail-card task-status-card task-status-${payload.status}`}>
        <div className="detail-card-header">
          <div className="detail-card-title">{payload.title}</div>
        </div>
        <div className="detail-card-body">{payload.body}</div>
        {payload.actionUrl ? (
          <a
            className="analysis-card-link"
            href={payload.actionUrl}
            target={payload.openInNewTab ? "_blank" : undefined}
            rel={payload.openInNewTab ? "noreferrer" : undefined}
          >
            {payload.actionLabel || "查看详情"}
          </a>
        ) : null}
        <div className="message-time">{formatTime(message.createdAt.toISOString())}</div>
      </div>
    </article>
  );
}

// ─── Workspace UI (consumes runtime context) ────────────────────────

function WorkspaceUI({
  config,
  submitDraft,
}: {
  config: OntologyConfig;
  submitDraft: (input: string, attachments: PendingAttachment[]) => Promise<void>;
}) {
  const runtime = useAssistantRuntime();
  const threadsState = useAuiState((state) => state.threads);
  const messages = useAuiState((state) => state.thread.messages);
  const isEmpty = useAuiState((state) => state.thread.isEmpty);

  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [submitBusy, setSubmitBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageStageRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const activeThreadTitle = useMemo(() => {
    const activeId = threadsState.mainThreadId;
    const activeThread = threadsState.threadItems.find((item) => item.id === activeId);
    return activeThread?.title || config.landingTitle;
  }, [config.landingTitle, threadsState.mainThreadId, threadsState.threadItems]);

  // 滚动到底部
  useEffect(() => {
    if (messageStageRef.current && !isEmpty && autoScrollRef.current) {
      messageStageRef.current.scrollTop = messageStageRef.current.scrollHeight;
    }
  }, [messages, isEmpty]);

  const onMessageStageScroll = () => {
    if (!messageStageRef.current) return;
    const el = messageStageRef.current;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollRef.current = distanceToBottom < 80;
  };

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

  const onSubmitComposer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitBusy(true);
    try {
      autoScrollRef.current = true;
      await submitDraft(draft, pendingAttachments);
      setDraft("");
      setPendingAttachments([]);
    } finally {
      setSubmitBusy(false);
    }
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    if (!(event.metaKey || event.ctrlKey)) {
      return;
    }
    event.preventDefault();
    void onSubmitComposer(event as unknown as FormEvent<HTMLFormElement>);
  };

  return (
    <div className="chat-shell">
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        onChange={onFilesSelected}
      />

      <aside className="chat-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">AI</div>
          <div className="brand-meta">
            <div className="brand-name">AI原生CRM</div>
          </div>
        </div>

        <div className="sidebar-toolbar">
          <button
            type="button"
            className="sidebar-primary-btn"
            onClick={() => void runtime.threads.switchToNewThread()}
          >
            新建会话
          </button>
        </div>

        <div className="sidebar-history-title">历史对话</div>
        <div className="sidebar-thread-list">
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
                  <span className="thread-item-label">{item.title || DEFAULT_THREAD_TITLE}</span>
                  {threadsState.mainThreadId === threadId ? (
                    <span className="thread-item-badge">当前</span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-main-head">
          <div className="chat-main-title">{activeThreadTitle}</div>
        </header>

        {isEmpty ? (
          <section className="landing">
            <div className="landing-hero">
              <h1>有什么我能帮你的吗？</h1>
              <p>{config.landingDesc}</p>
            </div>
            <div className="landing-composer">
              <Composer
                draft={draft}
                attachments={pendingAttachments}
                busy={submitBusy}
                onDraftChange={setDraft}
                onSubmit={onSubmitComposer}
                onKeyDown={onComposerKeyDown}
                onUploadClick={() => fileInputRef.current?.click()}
                onRemoveAttachment={onRemoveAttachment}
              />
            </div>
            <div className="suggestion-chip-list">
              {config.suggestionCards.map((card) => (
                <button
                  key={card.title}
                  className="suggestion-chip"
                  type="button"
                  onClick={() => setDraft(card.prompt)}
                >
                  <span>{card.title}</span>
                  <small>{card.description}</small>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="conversation">
            <div className="message-stage" ref={messageStageRef} onScroll={onMessageStageScroll}>
              <div className="message-list">
                {messages.map((message) => {
                  const meta = getMessageMeta(message);
                  if (message.role === "user" && meta.kind === "user-entry") {
                    return <UserEntryMessageView key={message.id} message={message} />;
                  }
                  switch (meta.kind) {
                    case "analysis-card":
                      return <AnalysisCard key={message.id} message={message} />;
                    case "clarification-card":
                      return <ClarificationCard key={message.id} message={message} />;
                    case "artifact-card":
                      return <ArtifactCard key={message.id} message={message} />;
                    case "profile-card":
                      return <ProfileCard key={message.id} message={message} />;
                    case "graph-card":
                      return <GraphCard key={message.id} message={message} />;
                    case "task-status-card":
                      return <TaskStatusCard key={message.id} message={message} />;
                    default:
                      return <AssistantTextMessageView key={message.id} message={message} />;
                  }
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
                onKeyDown={onComposerKeyDown}
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

// ─── WorkspaceProvider (owns state + runtime, provides context) ──────

function WorkspaceProvider({
  ontologyId,
  config,
}: {
  ontologyId: string;
  config: OntologyConfig;
}) {
  const [activeAssistantId, setActiveAssistantId] = useState(config.defaultAssistantId || "");
  const [threads, setThreads] = useState<PersistedThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(undefined);
  const [persistedMessages, setPersistedMessages] = useState<PersistedMessage[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);

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
      setActiveAssistantId((preferredThread || payload.thread).assistantId || config.defaultAssistantId || "");
      window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
    } finally {
      setThreadLoading(false);
    }
  };

  const refreshSelectedThread = async (threadId: string) => {
    const payload = await fetchJson<ThreadDetailResponse>(`/api/chat/threads/${threadId}`);
    setPersistedMessages(payload.messages);
    setThreads((prev) => upsertThread(prev, payload.thread));
  };

  const switchToNewThread = async () => {
    setSelectedThreadId(undefined);
    setPersistedMessages([]);
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
  };

  const refreshThreads = async () => {
    const result = await fetchJson<ThreadListResponse>(`/api/chat/threads?ontology_id=${encodeURIComponent(ontologyId)}`);
    const nextThreads = sortThreads(result.threads || []);
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
  }, [ontologyId]);

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

  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshSelectedThread(selectedThreadId);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [selectedThreadId]);

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

  const runtimeInstance = useExternalStoreRuntime(runtimeStore);

  const submitDraft = async (input: string, attachments: PendingAttachment[]) => {
    const text = input.trim();
    if (!text && attachments.length === 0) {
      return;
    }

    let threadId = selectedThreadId;
    if (!threadId) {
      const created = await fetchJson<CreateThreadResponse>("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId: activeAssistantId, ontologyId }),
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
    setActiveAssistantId(response.thread.assistantId || activeAssistantId);
    window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, response.thread.id);
  };

  return (
    <AssistantRuntimeProvider runtime={runtimeInstance}>
      <WorkspaceUI
        config={config}
        submitDraft={submitDraft}
      />
    </AssistantRuntimeProvider>
  );
}

// ─── ChatWorkspace (entry) ──────────────────────────────────────────

export default function ChatWorkspace() {
  const { ontologyId } = useParams<{ ontologyId: string }>();
  const config = ONTOLOGY_CONFIGS[ontologyId || ""] || DEFAULT_CONFIG;

  if (!ontologyId) {
    return <div className="ontology-selector-page"><div className="ontology-selector-error">缺少本体参数</div></div>;
  }

  return <WorkspaceProvider ontologyId={ontologyId} config={config} />;
}
