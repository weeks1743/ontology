import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultDbPath = join(__dirname, "../../data/scene.db");

export type SceneDb = Database.Database;

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function initSchema(db: SceneDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_ontologies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontology_id TEXT NOT NULL UNIQUE,
      ontology_name TEXT NOT NULL,
      selected_industry_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scene_industries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene_ontology_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      color TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (scene_ontology_id) REFERENCES scene_ontologies(id),
      UNIQUE(scene_ontology_id, code)
    );

    CREATE TABLE IF NOT EXISTS scene_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      industry_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      trigger_context TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (industry_id) REFERENCES scene_industries(id),
      UNIQUE(industry_id, code)
    );

    CREATE TABLE IF NOT EXISTS scene_content_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      prompt_template TEXT,
      example_content TEXT,
      display_order INTEGER DEFAULT 0,
      is_required INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES scene_scenarios(id),
      UNIQUE(scenario_id, code)
    );

    CREATE TABLE IF NOT EXISTS scene_skill_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      input_mapping TEXT,
      output_mapping TEXT,
      execution_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES scene_content_sections(id)
    );

    CREATE TABLE IF NOT EXISTS scene_test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scenario_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      mock_input TEXT,
      expected_sections TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id) REFERENCES scene_scenarios(id)
    );
  `);
}

export function createSceneDb(dbPath = process.env.SCENE_DB_PATH ?? defaultDbPath): SceneDb {
  ensureParentDir(dbPath);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  // Migrate: add selected_industry_code if missing
  const cols = db.pragma("table_info(scene_ontologies)") as { name: string }[];
  if (!cols.some(c => c.name === "selected_industry_code")) {
    db.exec("ALTER TABLE scene_ontologies ADD COLUMN selected_industry_code TEXT");
  }
  return db;
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}
