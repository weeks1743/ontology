import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { CHAT_DB_FILE } from "./paths.js";
import type {
  AudioAnalysisJob,
  ConversationTaskState,
  MessageKind,
  MessagePayload,
  PersistedMessage,
  PersistedThread,
} from "./types.js";

const DEFAULT_THREAD_TITLE = "新对话";

let db: Database.Database | null = null;

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getDb() {
  if (db) return db;
  mkdirSync(dirname(CHAT_DB_FILE), { recursive: true });
  db = new Database(CHAT_DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY,
      assistant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'regular',
      ontology_id TEXT NOT NULL DEFAULT 'crm',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meeting_speaker_aliases (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      raw_speaker TEXT NOT NULL,
      alias TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_profile_results (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      scenario TEXT NOT NULL,
      markdown TEXT NOT NULL,
      excluded_speakers TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_tasks (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      capability_code TEXT NOT NULL,
      graph_node TEXT,
      status TEXT NOT NULL,
      customer_name TEXT,
      customer_id TEXT,
      visit_record_id TEXT,
      tingwu_task_id TEXT,
      artifact_root TEXT NOT NULL,
      speaker_sync_status TEXT NOT NULL DEFAULT 'idle',
      opportunity_status TEXT NOT NULL DEFAULT 'idle',
      analysis_message_id TEXT,
      current_interrupt TEXT,
      interrupt_payload_json TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_audio_jobs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      status TEXT NOT NULL,
      output_task_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES chat_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES chat_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
      thread_id TEXT NOT NULL,
      checkpoint_ns TEXT NOT NULL DEFAULT '',
      checkpoint_id TEXT NOT NULL,
      checkpoint_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      parent_checkpoint_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
    );

    CREATE TABLE IF NOT EXISTS langgraph_writes (
      thread_id TEXT NOT NULL,
      checkpoint_ns TEXT NOT NULL DEFAULT '',
      checkpoint_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      write_idx INTEGER NOT NULL,
      channel TEXT NOT NULL,
      value_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, write_idx)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at
    ON chat_threads(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created_at
    ON chat_messages(thread_id, created_at, id);

    CREATE INDEX IF NOT EXISTS idx_chat_tasks_thread
    ON chat_tasks(thread_id, updated_at DESC);
  `);

  const threadColumns = database.prepare(`PRAGMA table_info(chat_threads)`).all() as Array<{ name: string }>;
  if (!threadColumns.some((column) => column.name === "ontology_id")) {
    database.exec(`ALTER TABLE chat_threads ADD COLUMN ontology_id TEXT NOT NULL DEFAULT 'crm'`);
  }
}

function threadRowToDto(row: any): PersistedThread {
  return {
    id: row.id,
    assistantId: row.assistant_id,
    title: row.title,
    status: row.status,
    ontologyId: row.ontology_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messageRowToDto(row: any): PersistedMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    kind: row.kind as MessageKind,
    payload: parseJson<MessagePayload>(row.payload_json, { text: "" } as MessagePayload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskRowToDto(row: any): ConversationTaskState {
  return {
    taskId: row.id,
    threadId: row.thread_id,
    capabilityCode: row.capability_code,
    graphNode: row.graph_node,
    status: row.status,
    customerName: row.customer_name,
    customerId: row.customer_id,
    visitRecordId: row.visit_record_id,
    tingwuTaskId: row.tingwu_task_id,
    artifactRoot: row.artifact_root,
    speakerSyncStatus: row.speaker_sync_status,
    opportunityStatus: row.opportunity_status,
    analysisMessageId: row.analysis_message_id,
    currentInterrupt: row.current_interrupt,
    interruptPayload: parseJson<Record<string, unknown> | null>(row.interrupt_payload_json, null),
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function audioJobRowToDto(row: any): AudioAnalysisJob {
  return {
    id: row.id,
    taskId: row.task_id,
    fileName: row.file_name,
    audioPath: row.audio_path,
    status: row.status,
    outputTaskId: row.output_task_id,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listThreads(ontologyId?: string) {
  const database = getDb();
  const rows = ontologyId
    ? database
        .prepare(
          `SELECT * FROM chat_threads WHERE status='regular' AND ontology_id = ? ORDER BY updated_at DESC, created_at DESC`,
        )
        .all(ontologyId)
    : database
        .prepare(`SELECT * FROM chat_threads WHERE status='regular' ORDER BY updated_at DESC, created_at DESC`)
        .all();
  return rows.map(threadRowToDto);
}

export function getThread(threadId: string) {
  const database = getDb();
  const threadRow = database.prepare(`SELECT * FROM chat_threads WHERE id = ?`).get(threadId);
  if (!threadRow) return null;
  const messages = database
    .prepare(`SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC, id ASC`)
    .all(threadId)
    .map(messageRowToDto);
  return {
    thread: threadRowToDto(threadRow),
    messages,
  };
}

export function createThread(params: { id: string; assistantId: string; ontologyId: string; title?: string }) {
  const database = getDb();
  const timestamp = nowIso();
  database
    .prepare(
      `INSERT INTO chat_threads (id, assistant_id, title, status, ontology_id, created_at, updated_at)
       VALUES (?, ?, ?, 'regular', ?, ?, ?)`,
    )
    .run(params.id, params.assistantId, params.title ?? DEFAULT_THREAD_TITLE, params.ontologyId, timestamp, timestamp);
  return getThread(params.id)?.thread ?? null;
}

export function touchThread(threadId: string) {
  const database = getDb();
  database.prepare(`UPDATE chat_threads SET updated_at = ? WHERE id = ?`).run(nowIso(), threadId);
}

export function updateThreadTitle(threadId: string, title: string) {
  const database = getDb();
  database.prepare(`UPDATE chat_threads SET title = ?, updated_at = ? WHERE id = ?`).run(title, nowIso(), threadId);
}

export function insertMessage(params: {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  kind: MessageKind;
  payload: MessagePayload;
}) {
  const database = getDb();
  const timestamp = nowIso();
  database
    .prepare(
      `INSERT INTO chat_messages (id, thread_id, role, kind, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(params.id, params.threadId, params.role, params.kind, JSON.stringify(params.payload), timestamp, timestamp);
  touchThread(params.threadId);
  const row = database.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(params.id);
  return messageRowToDto(row);
}

export function updateMessagePayload(threadId: string, messageId: string, payloadPatch: Record<string, unknown>) {
  const database = getDb();
  const row = database.prepare(`SELECT * FROM chat_messages WHERE id = ? AND thread_id = ?`).get(messageId, threadId) as any;
  if (!row) return null;
  const payload = parseJson<Record<string, unknown>>(row.payload_json, {});
  const nextPayload = { ...payload, ...payloadPatch };
  const timestamp = nowIso();
  database
    .prepare(`UPDATE chat_messages SET payload_json = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(nextPayload), timestamp, messageId);
  touchThread(threadId);
  const updated = database.prepare(`SELECT * FROM chat_messages WHERE id = ?`).get(messageId);
  return messageRowToDto(updated);
}

export function createTask(params: {
  id: string;
  threadId: string;
  capabilityCode: string;
  artifactRoot: string;
  status: ConversationTaskState["status"];
  analysisMessageId: string | null;
  payload?: Record<string, unknown>;
}) {
  const database = getDb();
  const timestamp = nowIso();
  database
    .prepare(
      `INSERT INTO chat_tasks (
        id, thread_id, capability_code, graph_node, status, artifact_root,
        analysis_message_id, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      params.threadId,
      params.capabilityCode,
      params.status,
      params.artifactRoot,
      params.analysisMessageId,
      JSON.stringify(params.payload ?? {}),
      timestamp,
      timestamp,
    );
  return getTask(params.id);
}

export function getTask(taskId: string) {
  const database = getDb();
  const row = database.prepare(`SELECT * FROM chat_tasks WHERE id = ?`).get(taskId);
  return row ? taskRowToDto(row) : null;
}

export function getLatestActiveTaskByThread(threadId: string) {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM chat_tasks
       WHERE thread_id = ? AND status NOT IN ('completed', 'failed')
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(threadId);
  return row ? taskRowToDto(row) : null;
}

export function getLatestTaskByThread(threadId: string) {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM chat_tasks WHERE thread_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(threadId) as any;
  return row ? taskRowToDto(row) : null;
}

export function getTaskByTingwuTaskId(tingwuTaskId: string) {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM chat_tasks WHERE tingwu_task_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .get(tingwuTaskId) as any;
  return row ? taskRowToDto(row) : null;
}

export function updateTask(taskId: string, patch: Partial<Omit<ConversationTaskState, "taskId" | "threadId" | "createdAt" | "updatedAt">>) {
  const database = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  const mapping: Record<string, string> = {
    capabilityCode: "capability_code",
    graphNode: "graph_node",
    status: "status",
    customerName: "customer_name",
    customerId: "customer_id",
    visitRecordId: "visit_record_id",
    tingwuTaskId: "tingwu_task_id",
    artifactRoot: "artifact_root",
    speakerSyncStatus: "speaker_sync_status",
    opportunityStatus: "opportunity_status",
    analysisMessageId: "analysis_message_id",
    currentInterrupt: "current_interrupt",
  };

  for (const [key, column] of Object.entries(mapping)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }

  if (patch.interruptPayload !== undefined) {
    fields.push(`interrupt_payload_json = ?`);
    values.push(patch.interruptPayload ? JSON.stringify(patch.interruptPayload) : null);
  }
  if (patch.payload !== undefined) {
    fields.push(`payload_json = ?`);
    values.push(JSON.stringify(patch.payload));
  }

  fields.push(`updated_at = ?`);
  values.push(nowIso(), taskId);
  database.prepare(`UPDATE chat_tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getTask(taskId);
}

export function createAudioJob(params: {
  id: string;
  taskId: string;
  fileName: string;
  audioPath: string;
  status: AudioAnalysisJob["status"];
}) {
  const database = getDb();
  const timestamp = nowIso();
  database
    .prepare(
      `INSERT INTO chat_audio_jobs (id, task_id, file_name, audio_path, status, output_task_id, error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    )
    .run(params.id, params.taskId, params.fileName, params.audioPath, params.status, timestamp, timestamp);
  return getAudioJob(params.id);
}

export function getAudioJob(jobId: string) {
  const database = getDb();
  const row = database.prepare(`SELECT * FROM chat_audio_jobs WHERE id = ?`).get(jobId);
  return row ? audioJobRowToDto(row) : null;
}

export function listAudioJobs() {
  const database = getDb();
  return database
    .prepare(`SELECT * FROM chat_audio_jobs ORDER BY updated_at DESC, created_at DESC`)
    .all()
    .map(audioJobRowToDto);
}

export function getAudioJobByTask(taskId: string) {
  const database = getDb();
  const row = database.prepare(`SELECT * FROM chat_audio_jobs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1`).get(taskId);
  return row ? audioJobRowToDto(row) : null;
}

export function updateAudioJob(jobId: string, patch: Partial<AudioAnalysisJob>) {
  const database = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  const mapping: Record<string, string> = {
    status: "status",
    outputTaskId: "output_task_id",
    error: "error",
  };
  for (const [key, column] of Object.entries(mapping)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push(`updated_at = ?`);
  values.push(nowIso(), jobId);
  database.prepare(`UPDATE chat_audio_jobs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAudioJob(jobId);
}

export function listArtifacts(taskId: string) {
  const database = getDb();
  return database
    .prepare(`SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY created_at ASC`)
    .all(taskId)
    .map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      artifactType: row.artifact_type,
      fileName: row.file_name,
      filePath: row.file_path,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

export function upsertArtifact(params: {
  id: string;
  taskId: string;
  artifactType: string;
  fileName: string;
  filePath: string;
  status: string;
}) {
  const database = getDb();
  const timestamp = nowIso();
  database
    .prepare(
      `INSERT INTO task_artifacts (id, task_id, artifact_type, file_name, file_path, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         file_name = excluded.file_name,
         file_path = excluded.file_path,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    )
    .run(params.id, params.taskId, params.artifactType, params.fileName, params.filePath, params.status, timestamp, timestamp);
}

export function getProfileResult(taskId: string, scenario = "crm_visit") {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM meeting_profile_results WHERE task_id = ? AND scenario = ?`)
    .get(taskId, scenario) as any;
  if (!row) return null;
  return {
    taskId,
    scenario,
    markdown: row.markdown,
    excludedSpeakers: parseJson<string[]>(row.excluded_speakers, []),
    createdAt: row.created_at,
  };
}

export function getSpeakerAliases(taskId: string) {
  const database = getDb();
  return database
    .prepare(`SELECT raw_speaker, alias, is_internal FROM meeting_speaker_aliases WHERE task_id = ? ORDER BY raw_speaker ASC`)
    .all(taskId)
    .map((row: any) => ({
      rawSpeaker: row.raw_speaker,
      alias: row.alias,
      isInternal: Boolean(row.is_internal),
    }));
}

export function deleteTaskCascade(taskId: string) {
  const database = getDb();
  database.prepare(`DELETE FROM chat_tasks WHERE id = ?`).run(taskId);
  database.prepare(`DELETE FROM task_artifacts WHERE task_id = ?`).run(taskId);
  database.prepare(`DELETE FROM chat_audio_jobs WHERE task_id = ?`).run(taskId);
  database.prepare(`DELETE FROM meeting_speaker_aliases WHERE task_id = ?`).run(taskId);
  database.prepare(`DELETE FROM meeting_profile_results WHERE task_id = ?`).run(taskId);
}

export function deleteThreadCascade(threadId: string) {
  const database = getDb();
  database.prepare(`DELETE FROM chat_threads WHERE id = ?`).run(threadId);
}

export function deleteThreadMessagesByKinds(threadId: string, kinds: MessageKind[]) {
  if (kinds.length === 0) return;
  const database = getDb();
  const placeholders = kinds.map(() => "?").join(", ");
  database.prepare(`DELETE FROM chat_messages WHERE thread_id = ? AND kind IN (${placeholders})`).run(threadId, ...kinds);
}
