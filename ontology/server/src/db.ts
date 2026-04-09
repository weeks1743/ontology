import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'ontology.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ontologies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_code TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ontology_objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_id INTEGER NOT NULL REFERENCES ontologies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      lifecycle TEXT DEFAULT '[]',
      attributes TEXT DEFAULT '[]',
      relations_detail TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ontology_id, code)
    );

    CREATE TABLE IF NOT EXISTS ontology_behaviors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_id INTEGER NOT NULL REFERENCES ontologies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      owner_object TEXT NOT NULL,
      trigger_type TEXT NOT NULL DEFAULT 'USER_ACTION',
      required_inputs TEXT DEFAULT '[]',
      referenced_rules TEXT DEFAULT '[]',
      emits_events TEXT DEFAULT '[]',
      writeback_targets TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ontology_id, code)
    );

    CREATE TABLE IF NOT EXISTS ontology_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_id INTEGER NOT NULL REFERENCES ontologies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'validation',
      applicable_objects TEXT DEFAULT '[]',
      applicable_behaviors TEXT DEFAULT '[]',
      expression TEXT DEFAULT '',
      failure_message TEXT DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'medium',
      escalation_target TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ontology_id, code)
    );

    CREATE TABLE IF NOT EXISTS ontology_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_id INTEGER NOT NULL REFERENCES ontologies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      producer_object TEXT NOT NULL,
      producer_behavior TEXT NOT NULL,
      subscribers TEXT DEFAULT '[]',
      impacted_objects TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ontology_id, code)
    );

    CREATE TABLE IF NOT EXISTS ontology_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_id INTEGER NOT NULL REFERENCES ontologies(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      business_goal TEXT DEFAULT '',
      involved_objects TEXT DEFAULT '[]',
      steps TEXT DEFAULT '[]',
      success_criteria TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ontology_id, code)
    );
  `);

  // 兼容迁移：旧触发类型统一映射到新枚举
  db.exec(`
    UPDATE ontology_behaviors
    SET trigger_type = CASE
      WHEN trigger_type = 'AI_OR_USER_ACTION' THEN 'PERCEPTIVE'
      WHEN trigger_type IN ('USER_ACTION', 'SYSTEM_ACTION', 'SYSTEM_OR_MANAGER_ACTION') THEN 'TRANSACTIONAL'
      ELSE trigger_type
    END
    WHERE trigger_type IN ('USER_ACTION', 'AI_OR_USER_ACTION', 'SYSTEM_ACTION', 'SYSTEM_OR_MANAGER_ACTION')
  `);
}

// Helper to parse JSON columns
export function parseRow<T>(row: Record<string, unknown>, jsonFields: string[]): T {
  const result = { ...row };
  for (const field of jsonFields) {
    if (typeof result[field] === 'string') {
      try {
        result[field] = JSON.parse(result[field] as string);
      } catch {
        result[field] = [];
      }
    }
  }
  return result as T;
}
