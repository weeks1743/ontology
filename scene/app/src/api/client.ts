// Type definitions matching backend
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

export interface TestRunResult {
  test_case_id: number;
  sections_generated: Array<{
    section_code: string;
    section_name: string;
    content: string;
    skill_used: string;
  }>;
  execution_time_ms: number;
  success: boolean;
}

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Ontology API
export const ontologyApi = {
  list: () => fetchJson<SceneOntology[]>('/ontologies'),

  create: (data: { ontology_id: string; ontology_name: string }) =>
    fetchJson<SceneOntology>('/ontologies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => fetchJson<SceneOntology>(`/ontologies/${id}`),

  getSelectedIndustry: (ontologyId: string) =>
    fetchJson<{ selected_industry_code: string | null }>(`/ontologies/${ontologyId}/selected-industry`),

  setSelectedIndustry: (ontologyId: string, code: string) =>
    fetchJson<{ ok: boolean }>(`/ontologies/${ontologyId}/selected-industry`, {
      method: 'PUT',
      body: JSON.stringify({ code }),
    }),
};

// Industry API
export const industryApi = {
  list: (ontologyId: string) =>
    fetchJson<Industry[]>(`/ontologies/${ontologyId}/industries`),

  create: (ontologyId: string, data: Partial<Industry>) =>
    fetchJson<Industry>(`/ontologies/${ontologyId}/industries`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number) => fetchJson<Industry>(`/industries/${id}`),

  update: (id: number, data: Partial<Industry>) =>
    fetchJson<Industry>(`/industries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/industries/${id}`, {
      method: 'DELETE',
    }),
};

// Scenario API
export const scenarioApi = {
  list: (industryId: number) =>
    fetchJson<Scenario[]>(`/industries/${industryId}/scenarios`),

  create: (industryId: number, data: Partial<Scenario>) =>
    fetchJson<Scenario>(`/industries/${industryId}/scenarios`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number) => fetchJson<Scenario>(`/scenarios/${id}`),

  update: (id: number, data: Partial<Scenario>) =>
    fetchJson<Scenario>(`/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/scenarios/${id}`, {
      method: 'DELETE',
    }),
};

// Section API
export const sectionApi = {
  list: (scenarioId: number) =>
    fetchJson<ContentSection[]>(`/scenarios/${scenarioId}/sections`),

  create: (scenarioId: number, data: Partial<ContentSection>) =>
    fetchJson<ContentSection>(`/scenarios/${scenarioId}/sections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number) => fetchJson<ContentSection>(`/sections/${id}`),

  update: (id: number, data: Partial<ContentSection>) =>
    fetchJson<ContentSection>(`/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/sections/${id}`, {
      method: 'DELETE',
    }),
};

// Binding API
export const bindingApi = {
  list: (sectionId: number) =>
    fetchJson<SkillBinding[]>(`/sections/${sectionId}/bindings`),

  create: (sectionId: number, data: Partial<SkillBinding>) =>
    fetchJson<SkillBinding>(`/sections/${sectionId}/bindings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: number) => fetchJson<SkillBinding>(`/bindings/${id}`),

  update: (id: number, data: Partial<SkillBinding>) =>
    fetchJson<SkillBinding>(`/bindings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/bindings/${id}`, {
      method: 'DELETE',
    }),
};

// Test Case API
export const testCaseApi = {
  list: (scenarioId: number) =>
    fetchJson<TestCase[]>(`/scenarios/${scenarioId}/test-cases`),

  create: (scenarioId: number, data: Partial<TestCase>) =>
    fetchJson<TestCase>(`/scenarios/${scenarioId}/test-cases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  run: (id: number) =>
    fetchJson<TestRunResult>(`/test-cases/${id}/run`, {
      method: 'POST',
    }),
};

// Ontology Behavior API (proxied via /ability-api → localhost:3002)
const ABILITY_API_BASE = '/ability-api';

async function fetchAbilityJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${ABILITY_API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export interface OntologyBehavior {
  skill_id: string;
  behavior_code: string;
  behavior_name_zh: string;
  owner_object: string;
  trigger_type: string;
  description: string;
}

export interface ExternalSkill {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  metadata: { emoji?: string; when_to_use?: string; [k: string]: unknown };
}

export const behaviorApi = {
  /** List PERCEPTIVE (logical) behaviors for an ontology */
  listLogical: (ontologyId: string) =>
    fetchAbilityJson<OntologyBehavior[]>(`/ontology-skills/${ontologyId}/behaviors?trigger_type=PERCEPTIVE`),

  /** List external skills from the ability server */
  listExternal: () =>
    fetchAbilityJson<ExternalSkill[]>('/skills').then(list =>
      list.filter(s => s.category === 'external'),
    ),
};
