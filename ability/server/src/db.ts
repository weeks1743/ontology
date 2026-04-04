import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../data/ability.db');
export const db = new Database(dbPath);

// 初始化数据库表
export function initDatabase() {
  // 技能表（先创建基础表结构，不包含 ontology_id）
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

  // 数据迁移：检查并添加 ontology_id 列（如果表已存在但没有此列）
  try {
    const columns = db.prepare('PRAGMA table_info(skills)').all() as any[];
    const hasOntologyId = columns.some(col => col.name === 'ontology_id');

    if (!hasOntologyId) {
      console.log('🔄 Adding ontology_id column to existing skills table...');
      db.exec('ALTER TABLE skills ADD COLUMN ontology_id TEXT');
      console.log('✅ Added ontology_id column to skills table');
    }

    // 创建索引（确保列已存在）
    db.exec('CREATE INDEX IF NOT EXISTS idx_skills_ontology_id ON skills(ontology_id)');
  } catch (error) {
    console.error('Error adding ontology_id column:', error);
  }

  // 运行迁移：将现有 ontology 技能关联到 crm-v1
  try {
    const result = db.prepare(`
      UPDATE skills
      SET ontology_id = 'crm-v1'
      WHERE category = 'ontology' AND ontology_id IS NULL
    `).run();
    if (result.changes > 0) {
      console.log(`✅ Migrated ${result.changes} ontology skills to crm-v1`);
    }
  } catch (error) {
    console.error('Error migrating ontology_id:', error);
  }

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
