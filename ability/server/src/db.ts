import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../data/ability.db');
export const db = new Database(dbPath);

// 初始化数据库表
export function initDatabase() {
  // 技能表
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('ontology', 'external')),
      source TEXT NOT NULL,
      metadata TEXT NOT NULL,
      input_schema TEXT,
      output_schema TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 执行日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      input_params TEXT NOT NULL,
      output_result TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('success', 'error', 'partial')),
      error_message TEXT,
      mongodb_status TEXT NOT NULL CHECK(mongodb_status IN ('ok', 'error', 'skipped')),
      neo4j_status TEXT NOT NULL CHECK(neo4j_status IN ('ok', 'error', 'skipped')),
      chroma_status TEXT NOT NULL CHECK(chroma_status IN ('ok', 'error', 'skipped')),
      duration_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
  `);

  // 数据库配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_configs (
      id TEXT PRIMARY KEY,
      db_type TEXT NOT NULL CHECK(db_type IN ('mongodb', 'neo4j', 'chromadb')),
      connection_url TEXT NOT NULL,
      username TEXT,
      password TEXT,
      database_name TEXT,
      status TEXT NOT NULL CHECK(status IN ('online', 'offline')),
      last_check TEXT NOT NULL
    )
  `);

  console.log('✅ Database initialized at:', dbPath);
}
