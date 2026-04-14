export type ThreadStatus = "regular" | "archived";

export type JobStatus = "queued" | "analyzing" | "succeeded" | "failed";

export type ConversationTaskStatus =
  | "queued"
  | "analyzing_audio"
  | "waiting_customer_name"
  | "running"
  | "waiting_speaker_fix"
  | "waiting_opportunity_confirmation"
  | "completed"
  | "failed";

export type MessageKind =
  | "user-entry"
  | "assistant-text"
  | "analysis-card"
  | "clarification-card"
  | "artifact-card"
  | "profile-card"
  | "graph-card"
  | "task-status-card";

export type PersistedThread = {
  id: string;
  assistantId: string;
  title: string;
  status: ThreadStatus;
  ontologyId: string;
  createdAt: string;
  updatedAt: string;
};

export type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type UserEntryPayload = {
  text: string;
  attachments: MessageAttachment[];
};

export type AssistantTextPayload = {
  text: string;
};

export type AnalysisCardPayload = {
  fileName: string;
  status: JobStatus;
  jobId: string | null;
  taskId: string | null;
  error: string | null;
};

export type ClarificationCardPayload = {
  taskId: string;
  stepCode: "wait_customer_name" | "wait_opportunity_confirmation";
  title: string;
  question: string;
  placeholder?: string;
  status: "pending" | "resolved";
};

export type ArtifactCardPayload = {
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

export type ProfileCardPayload = {
  taskId: string;
  profileId: string;
  name: string;
  role: string;
  influence?: string;
  attitude?: string;
  tags: string[];
  summary: string;
};

export type GraphNodePayload = {
  id: string;
  label: string;
  kind: "customer" | "visit_record" | "contact" | "opportunity";
  meta?: Record<string, string>;
};

export type GraphEdgePayload = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type GraphCardPayload = {
  taskId: string;
  title: string;
  summary: string;
  nodes?: GraphNodePayload[];
  edges?: GraphEdgePayload[];
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
  opportunity?: {
    id: string;
    summary?: string;
  } | null;
};

export type TaskStatusCardPayload = {
  taskId: string;
  title: string;
  status: "info" | "success" | "warning" | "error";
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  openInNewTab?: boolean;
};

export type MessagePayload =
  | UserEntryPayload
  | AssistantTextPayload
  | AnalysisCardPayload
  | ClarificationCardPayload
  | ArtifactCardPayload
  | ProfileCardPayload
  | GraphCardPayload
  | TaskStatusCardPayload;

export type PersistedMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  kind: MessageKind;
  payload: MessagePayload;
  createdAt: string;
  updatedAt: string;
};

export type ConversationTaskState = {
  taskId: string;
  threadId: string;
  capabilityCode: string;
  graphNode: string | null;
  status: ConversationTaskStatus;
  customerName: string | null;
  customerId: string | null;
  visitRecordId: string | null;
  tingwuTaskId: string | null;
  artifactRoot: string;
  speakerSyncStatus: "idle" | "pending" | "completed";
  opportunityStatus: "idle" | "pending" | "completed";
  analysisMessageId: string | null;
  currentInterrupt: string | null;
  interruptPayload: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AudioAnalysisJob = {
  id: string;
  taskId: string;
  fileName: string;
  audioPath: string;
  status: JobStatus;
  outputTaskId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
