import { BaseCheckpointSaver, copyCheckpoint } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";

import { getDb } from "./db.js";

function checkpointIdFromConfig(config: RunnableConfig) {
  return config.configurable?.checkpoint_id as string | undefined;
}

function checkpointNsFromConfig(config: RunnableConfig) {
  return (config.configurable?.checkpoint_ns as string | undefined) ?? "";
}

function threadIdFromConfig(config: RunnableConfig) {
  return config.configurable?.thread_id as string | undefined;
}

function writeIndexForChannel(channel: string, idx: number) {
  return channel === "__resume__" ? -1 : idx;
}

export class SqliteSaver extends BaseCheckpointSaver {
  async getTuple(config: RunnableConfig): Promise<any> {
    const database = getDb();
    const threadId = threadIdFromConfig(config);
    const checkpointNs = checkpointNsFromConfig(config);
    if (!threadId) return undefined;

    const checkpointId = checkpointIdFromConfig(config);
    const row = (checkpointId
      ? database
          .prepare(
            `SELECT * FROM langgraph_checkpoints WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?`,
          )
          .get(threadId, checkpointNs, checkpointId)
      : database
          .prepare(
            `SELECT * FROM langgraph_checkpoints WHERE thread_id = ? AND checkpoint_ns = ? ORDER BY checkpoint_id DESC LIMIT 1`,
          )
          .get(threadId, checkpointNs)) as any;
    if (!row) return undefined;

    const writes = database
      .prepare(
        `SELECT * FROM langgraph_writes
         WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?
         ORDER BY write_idx ASC, created_at ASC`,
      )
      .all(threadId, checkpointNs, row.checkpoint_id)
      .map((write: any) => [write.task_id, write.channel, JSON.parse(write.value_json)] as [string, string, unknown]);

    const tuple: any = {
      config: {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint: JSON.parse(row.checkpoint_json),
      metadata: JSON.parse(row.metadata_json),
      pendingWrites: writes,
    };
    if (row.parent_checkpoint_id) {
      tuple.parentConfig = {
        configurable: {
          thread_id: threadId,
          checkpoint_ns: checkpointNs,
          checkpoint_id: row.parent_checkpoint_id,
        },
      };
    }
    return tuple;
  }

  async *list(config: RunnableConfig, options?: { before?: RunnableConfig; limit?: number; filter?: Record<string, unknown> }) {
    const database = getDb();
    const threadId = threadIdFromConfig(config);
    const checkpointNs = checkpointNsFromConfig(config);
    const beforeCheckpointId = options?.before ? checkpointIdFromConfig(options.before) : undefined;

    let sql =
      `SELECT * FROM langgraph_checkpoints WHERE 1=1` +
      (threadId ? ` AND thread_id = ?` : ``) +
      ` AND checkpoint_ns = ?` +
      (beforeCheckpointId ? ` AND checkpoint_id < ?` : ``) +
      ` ORDER BY checkpoint_id DESC`;
    if (options?.limit) {
      sql += ` LIMIT ${Number(options.limit)}`;
    }

    const values: unknown[] = [];
    if (threadId) values.push(threadId);
    values.push(checkpointNs);
    if (beforeCheckpointId) values.push(beforeCheckpointId);

    const rows = database.prepare(sql).all(...values) as any[];
    for (const row of rows) {
      const metadata = JSON.parse(row.metadata_json);
      if (
        options?.filter &&
        !Object.entries(options.filter).every(([key, value]) => (metadata as Record<string, unknown>)[key] === value)
      ) {
        continue;
      }
      const tuple = await this.getTuple({
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      });
      if (tuple) {
        yield tuple;
      }
    }
  }

  async put(config: RunnableConfig, checkpoint: any, metadata: Record<string, unknown>) {
    const database = getDb();
    const threadId = threadIdFromConfig(config);
    const checkpointNs = checkpointNsFromConfig(config);
    if (!threadId) {
      throw new Error(`Failed to put checkpoint. Missing configurable.thread_id`);
    }

    const prepared = copyCheckpoint(checkpoint);
    const timestamp = new Date().toISOString();
    database
      .prepare(
        `INSERT OR REPLACE INTO langgraph_checkpoints (
          thread_id, checkpoint_ns, checkpoint_id, checkpoint_json, metadata_json, parent_checkpoint_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        threadId,
        checkpointNs,
        prepared.id,
        JSON.stringify(prepared),
        JSON.stringify(metadata),
        checkpointIdFromConfig(config) ?? null,
        timestamp,
      );
    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: prepared.id,
      },
    };
  }

  async putWrites(config: RunnableConfig, writes: [string, unknown][], taskId: string) {
    const database = getDb();
    const threadId = threadIdFromConfig(config);
    const checkpointNs = checkpointNsFromConfig(config);
    const checkpointId = checkpointIdFromConfig(config);
    if (!threadId || !checkpointId) {
      throw new Error(`Failed to put writes. Missing configurable.thread_id or checkpoint_id`);
    }

    const timestamp = new Date().toISOString();
    const statement = database.prepare(
      `INSERT OR IGNORE INTO langgraph_writes (
        thread_id, checkpoint_ns, checkpoint_id, task_id, write_idx, channel, value_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    writes.forEach(([channel, value], idx) => {
      statement.run(
        threadId,
        checkpointNs,
        checkpointId,
        taskId,
        writeIndexForChannel(channel, idx),
        channel,
        JSON.stringify(value),
        timestamp,
      );
    });
  }

  async deleteThread(threadId: string) {
    const database = getDb();
    database.prepare(`DELETE FROM langgraph_checkpoints WHERE thread_id = ?`).run(threadId);
    database.prepare(`DELETE FROM langgraph_writes WHERE thread_id = ?`).run(threadId);
  }
}
