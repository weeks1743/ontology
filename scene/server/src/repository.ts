import type { SceneDb } from "./db.js";
import { parseJson, stringifyJson } from "./db.js";

// Type definitions
export interface SceneOntology {
  id: number;
  ontology_id: string;
  ontology_name: string;
  created_at: string;
  updated_at: string;
}

export interface Industry {
  id: number;
  scene_ontology_id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: number;
  industry_id: number;
  code: string;
  name: string;
  description: string | null;
  trigger_context: Record<string, any> | null;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ContentSection {
  id: number;
  scenario_id: number;
  code: string;
  name: string;
  description: string | null;
  prompt_template: string | null;
  example_content: string | null;
  display_order: number;
  is_required: number;
  created_at: string;
  updated_at: string;
}

export interface SkillBinding {
  id: number;
  section_id: number;
  skill_id: string;
  skill_name: string;
  input_mapping: Record<string, any> | null;
  output_mapping: Record<string, any> | null;
  execution_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: number;
  scenario_id: number;
  name: string;
  description: string | null;
  mock_input: Record<string, any> | null;
  expected_sections: string[] | null;
  created_at: string;
}

// Ontology operations
export function getOntologies(db: SceneDb): SceneOntology[] {
  return db.prepare("SELECT * FROM scene_ontologies ORDER BY created_at DESC").all() as SceneOntology[];
}

export function getOntologyById(db: SceneDb, ontologyId: string): SceneOntology | null {
  return db.prepare("SELECT * FROM scene_ontologies WHERE ontology_id = ?").get(ontologyId) as SceneOntology | null;
}

export function createOntology(db: SceneDb, ontologyId: string, ontologyName: string): SceneOntology {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO scene_ontologies (ontology_id, ontology_name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(ontologyId, ontologyName, now, now);

  return getOntologyById(db, ontologyId)!;
}

export function ensureOntology(db: SceneDb, ontologyId: string, ontologyName: string): SceneOntology {
  const existing = getOntologyById(db, ontologyId);
  if (existing) return existing;
  return createOntology(db, ontologyId, ontologyName);
}

// Selected industry per ontology
export function getSelectedIndustryCode(db: SceneDb, ontologyId: string): string | null {
  const row = db.prepare("SELECT selected_industry_code FROM scene_ontologies WHERE ontology_id = ?").get(ontologyId) as { selected_industry_code: string | null } | undefined;
  return row?.selected_industry_code ?? null;
}

export function setSelectedIndustryCode(db: SceneDb, ontologyId: string, code: string): void {
  db.prepare("UPDATE scene_ontologies SET selected_industry_code = ?, updated_at = ? WHERE ontology_id = ?").run(code, new Date().toISOString(), ontologyId);
}

// Industry operations
export function getIndustries(db: SceneDb, sceneOntologyId: number): Industry[] {
  return db.prepare(`
    SELECT * FROM scene_industries
    WHERE scene_ontology_id = ?
    ORDER BY display_order, id
  `).all(sceneOntologyId) as Industry[];
}

export function getIndustryById(db: SceneDb, id: number): Industry | null {
  return db.prepare("SELECT * FROM scene_industries WHERE id = ?").get(id) as Industry | null;
}

export function createIndustry(db: SceneDb, data: Omit<Industry, 'id' | 'created_at' | 'updated_at'>): Industry {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO scene_industries
    (scene_ontology_id, code, name, description, icon, color, display_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.scene_ontology_id,
    data.code,
    data.name,
    data.description,
    data.icon,
    data.color,
    data.display_order,
    data.is_active,
    now,
    now
  );

  return getIndustryById(db, result.lastInsertRowid as number)!;
}

export function updateIndustry(db: SceneDb, id: number, data: Partial<Industry>): Industry {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
  if (data.icon !== undefined) { fields.push("icon = ?"); values.push(data.icon); }
  if (data.color !== undefined) { fields.push("color = ?"); values.push(data.color); }
  if (data.display_order !== undefined) { fields.push("display_order = ?"); values.push(data.display_order); }
  if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active); }

  fields.push("updated_at = ?");
  values.push(now, id);

  db.prepare(`UPDATE scene_industries SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getIndustryById(db, id)!;
}

export function deleteIndustry(db: SceneDb, id: number): void {
  db.prepare("DELETE FROM scene_industries WHERE id = ?").run(id);
}

// Scenario operations
export function getScenarios(db: SceneDb, industryId: number): Scenario[] {
  const rows = db.prepare(`
    SELECT * FROM scene_scenarios
    WHERE industry_id = ?
    ORDER BY display_order, id
  `).all(industryId) as any[];

  return rows.map(row => ({
    ...row,
    trigger_context: parseJson(row.trigger_context, null)
  }));
}

export function getScenarioById(db: SceneDb, id: number): Scenario | null {
  const row = db.prepare("SELECT * FROM scene_scenarios WHERE id = ?").get(id) as any;
  if (!row) return null;

  return {
    ...row,
    trigger_context: parseJson(row.trigger_context, null)
  };
}

export function getScenarioByCode(db: SceneDb, ontologyId: string, code: string): Scenario | null {
  const row = db.prepare(`
    SELECT sc.*
    FROM scene_scenarios sc
    JOIN scene_industries si ON si.id = sc.industry_id
    JOIN scene_ontologies so ON so.id = si.scene_ontology_id
    WHERE so.ontology_id = ? AND sc.code = ?
    LIMIT 1
  `).get(ontologyId, code) as any;
  if (!row) return null;

  return {
    ...row,
    trigger_context: parseJson(row.trigger_context, null),
  };
}

export function createScenario(db: SceneDb, data: Omit<Scenario, 'id' | 'created_at' | 'updated_at'>): Scenario {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO scene_scenarios
    (industry_id, code, name, description, trigger_context, display_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.industry_id,
    data.code,
    data.name,
    data.description,
    data.trigger_context ? stringifyJson(data.trigger_context) : null,
    data.display_order,
    data.is_active,
    now,
    now
  );

  return getScenarioById(db, result.lastInsertRowid as number)!;
}

export function updateScenario(db: SceneDb, id: number, data: Partial<Scenario>): Scenario {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
  if (data.trigger_context !== undefined) {
    fields.push("trigger_context = ?");
    values.push(data.trigger_context ? stringifyJson(data.trigger_context) : null);
  }
  if (data.display_order !== undefined) { fields.push("display_order = ?"); values.push(data.display_order); }
  if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active); }

  fields.push("updated_at = ?");
  values.push(now, id);

  db.prepare(`UPDATE scene_scenarios SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getScenarioById(db, id)!;
}

export function deleteScenario(db: SceneDb, id: number): void {
  db.prepare("DELETE FROM scene_scenarios WHERE id = ?").run(id);
}

// Content Section operations
export function getSections(db: SceneDb, scenarioId: number): ContentSection[] {
  return db.prepare(`
    SELECT * FROM scene_content_sections
    WHERE scenario_id = ?
    ORDER BY display_order, id
  `).all(scenarioId) as ContentSection[];
}

export function getSectionById(db: SceneDb, id: number): ContentSection | null {
  return db.prepare("SELECT * FROM scene_content_sections WHERE id = ?").get(id) as ContentSection | null;
}

export function createSection(db: SceneDb, data: Omit<ContentSection, 'id' | 'created_at' | 'updated_at'>): ContentSection {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO scene_content_sections
    (scenario_id, code, name, description, prompt_template, example_content, display_order, is_required, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.scenario_id,
    data.code,
    data.name,
    data.description,
    data.prompt_template,
    data.example_content,
    data.display_order,
    data.is_required,
    now,
    now
  );

  return getSectionById(db, result.lastInsertRowid as number)!;
}

export function updateSection(db: SceneDb, id: number, data: Partial<ContentSection>): ContentSection {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
  if (data.prompt_template !== undefined) { fields.push("prompt_template = ?"); values.push(data.prompt_template); }
  if (data.example_content !== undefined) { fields.push("example_content = ?"); values.push(data.example_content); }
  if (data.display_order !== undefined) { fields.push("display_order = ?"); values.push(data.display_order); }
  if (data.is_required !== undefined) { fields.push("is_required = ?"); values.push(data.is_required); }

  fields.push("updated_at = ?");
  values.push(now, id);

  db.prepare(`UPDATE scene_content_sections SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getSectionById(db, id)!;
}

export function deleteSection(db: SceneDb, id: number): void {
  db.prepare("DELETE FROM scene_content_sections WHERE id = ?").run(id);
}

// Skill Binding operations
export function getBindings(db: SceneDb, sectionId: number): SkillBinding[] {
  const rows = db.prepare(`
    SELECT * FROM scene_skill_bindings
    WHERE section_id = ?
    ORDER BY execution_order, id
  `).all(sectionId) as any[];

  return rows.map(row => ({
    ...row,
    input_mapping: parseJson(row.input_mapping, null),
    output_mapping: parseJson(row.output_mapping, null)
  }));
}

export function getBindingById(db: SceneDb, id: number): SkillBinding | null {
  const row = db.prepare("SELECT * FROM scene_skill_bindings WHERE id = ?").get(id) as any;
  if (!row) return null;

  return {
    ...row,
    input_mapping: parseJson(row.input_mapping, null),
    output_mapping: parseJson(row.output_mapping, null)
  };
}

export function createBinding(db: SceneDb, data: Omit<SkillBinding, 'id' | 'created_at' | 'updated_at'>): SkillBinding {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO scene_skill_bindings
    (section_id, skill_id, skill_name, input_mapping, output_mapping, execution_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.section_id,
    data.skill_id,
    data.skill_name,
    data.input_mapping ? stringifyJson(data.input_mapping) : null,
    data.output_mapping ? stringifyJson(data.output_mapping) : null,
    data.execution_order,
    data.is_active,
    now,
    now
  );

  return getBindingById(db, result.lastInsertRowid as number)!;
}

export function updateBinding(db: SceneDb, id: number, data: Partial<SkillBinding>): SkillBinding {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];

  if (data.skill_id !== undefined) { fields.push("skill_id = ?"); values.push(data.skill_id); }
  if (data.skill_name !== undefined) { fields.push("skill_name = ?"); values.push(data.skill_name); }
  if (data.input_mapping !== undefined) {
    fields.push("input_mapping = ?");
    values.push(data.input_mapping ? stringifyJson(data.input_mapping) : null);
  }
  if (data.output_mapping !== undefined) {
    fields.push("output_mapping = ?");
    values.push(data.output_mapping ? stringifyJson(data.output_mapping) : null);
  }
  if (data.execution_order !== undefined) { fields.push("execution_order = ?"); values.push(data.execution_order); }
  if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active); }

  fields.push("updated_at = ?");
  values.push(now, id);

  db.prepare(`UPDATE scene_skill_bindings SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getBindingById(db, id)!;
}

export function deleteBinding(db: SceneDb, id: number): void {
  db.prepare("DELETE FROM scene_skill_bindings WHERE id = ?").run(id);
}

// Test Case operations
export function getTestCases(db: SceneDb, scenarioId: number): TestCase[] {
  const rows = db.prepare(`
    SELECT * FROM scene_test_cases
    WHERE scenario_id = ?
    ORDER BY id
  `).all(scenarioId) as any[];

  return rows.map(row => ({
    ...row,
    mock_input: parseJson(row.mock_input, null),
    expected_sections: parseJson(row.expected_sections, null)
  }));
}

export function getTestCaseById(db: SceneDb, id: number): TestCase | null {
  const row = db.prepare("SELECT * FROM scene_test_cases WHERE id = ?").get(id) as any;
  if (!row) return null;

  return {
    ...row,
    mock_input: parseJson(row.mock_input, null),
    expected_sections: parseJson(row.expected_sections, null)
  };
}

export function createTestCase(db: SceneDb, data: Omit<TestCase, 'id' | 'created_at'>): TestCase {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO scene_test_cases
    (scenario_id, name, description, mock_input, expected_sections, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.scenario_id,
    data.name,
    data.description,
    data.mock_input ? stringifyJson(data.mock_input) : null,
    data.expected_sections ? stringifyJson(data.expected_sections) : null,
    now
  );

  return getTestCaseById(db, result.lastInsertRowid as number)!;
}

export function runTestCase(db: SceneDb, id: number): any {
  const testCase = getTestCaseById(db, id);
  if (!testCase) throw new Error("Test case not found");

  const scenario = getScenarioById(db, testCase.scenario_id);
  if (!scenario) throw new Error("Scenario not found");

  const sections = getSections(db, testCase.scenario_id);

  // Mock execution result
  return {
    test_case_id: id,
    test_case_name: testCase.name,
    scenario_name: scenario.name,
    status: "success",
    executed_at: new Date().toISOString(),
    sections_generated: sections.map(section => ({
      section_code: section.code,
      section_name: section.name,
      content: section.example_content || `Mock content for ${section.name}`,
      bindings_executed: getBindings(db, section.id).map(binding => ({
        skill_id: binding.skill_id,
        skill_name: binding.skill_name,
        status: "success"
      }))
    })),
    mock_input: testCase.mock_input
  };
}
