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

  // 迁移：扩展 skills 表新增列
  try {
    const columns = db.prepare('PRAGMA table_info(skills)').all() as any[];
    const colNames = columns.map(c => c.name);

    const newCols: [string, string][] = [
      ['skill_slug', 'TEXT'],
      ['display_name_zh', 'TEXT'],
      ['skill_type', "TEXT CHECK(skill_type IN ('behavior','scenario','query'))"],
      ['path', 'TEXT'],
      ['snapshot_hash', 'TEXT'],
      ['build_version', 'TEXT'],
      ['is_active', 'INTEGER DEFAULT 1'],
    ];

    for (const [col, def] of newCols) {
      if (!colNames.includes(col)) {
        db.exec(`ALTER TABLE skills ADD COLUMN ${col} ${def}`);
      }
    }
  } catch (error) {
    console.error('Error extending skills table:', error);
  }

  // 构建记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_builds (
      id TEXT PRIMARY KEY,
      ontology_id TEXT NOT NULL,
      build_version TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL,
      build_mode TEXT NOT NULL CHECK(build_mode IN ('full','incremental')),
      status TEXT NOT NULL CHECK(status IN ('success','failed','partial')),
      generated_count INTEGER DEFAULT 0,
      updated_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 构建报告表
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_build_reports (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      build_version TEXT NOT NULL,
      ontology_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // 测试方案表
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_test_plans (
      id TEXT PRIMARY KEY,
      build_version TEXT NOT NULL,
      ontology_id TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL,
      total_cases INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // 测试用例表
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_test_cases (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      skill_slug TEXT NOT NULL,
      case_code TEXT NOT NULL,
      case_name_zh TEXT NOT NULL,
      case_type TEXT NOT NULL CHECK(case_type IN ('positive','negative','rule_block','scenario')),
      description_zh TEXT,
      params TEXT NOT NULL,
      expected_result TEXT,
      db_assertions TEXT,
      sequence INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  // 客户经营建议产物表
  db.exec(`
    CREATE TABLE IF NOT EXISTS operating_advice_artifacts (
      id TEXT PRIMARY KEY,
      ontology_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT,
      round_no INTEGER NOT NULL,
      based_on_visit_record_ids TEXT NOT NULL,
      current_assessment TEXT NOT NULL,
      recommended_actions TEXT NOT NULL,
      evidence_summary TEXT NOT NULL,
      change_since_last_round TEXT,
      advice_markdown_path TEXT NOT NULL,
      advice_html_path TEXT,
      selected_external_skill_id TEXT,
      render_status TEXT NOT NULL CHECK(render_status IN ('success','partial','failed')),
      created_at TEXT NOT NULL
    )
  `);

  console.log('✅ Database initialized at:', dbPath);
}
