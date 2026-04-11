import { Skill, ExecutionLog, DatabaseStatus, ExecutionResult, Ontology } from '../types';

const API_BASE = '/api';

// 本体相关（代理主系统 API）
export const ontologiesApi = {
  getAll: async (): Promise<Ontology[]> => {
    const res = await fetch(`${API_BASE}/ontologies`);
    if (!res.ok) throw new Error('Failed to fetch ontologies');
    return res.json();
  },

  getById: async (id: string): Promise<Ontology> => {
    const res = await fetch(`${API_BASE}/ontologies/${id}`);
    if (!res.ok) throw new Error('Failed to fetch ontology');
    return res.json();
  },
};

// 技能相关
export const skillsApi = {
  getAll: async (ontologyId?: string): Promise<Skill[]> => {
    const query = ontologyId ? `?ontology_id=${ontologyId}` : '';
    const res = await fetch(`${API_BASE}/skills${query}`);
    if (!res.ok) throw new Error('Failed to fetch skills');
    return res.json();
  },

  getById: async (id: string): Promise<Skill> => {
    const res = await fetch(`${API_BASE}/skills/${id}`);
    if (!res.ok) throw new Error('Failed to fetch skill');
    return res.json();
  },

  create: async (skill: Omit<Skill, 'created_at' | 'updated_at'>): Promise<Skill> => {
    const res = await fetch(`${API_BASE}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    });
    if (!res.ok) throw new Error('Failed to create skill');
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/skills/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete skill');
  },

  execute: async (id: string, params: any): Promise<ExecutionResult> => {
    const res = await fetch(`${API_BASE}/skills/${id}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to execute skill');
    return res.json();
  },
};

// 本体技能相关
export const ontologySkillsApi = {
  generate: async (ontologyId: string): Promise<{ success: boolean; generated_count: number }> => {
    const res = await fetch(`${API_BASE}/ontology-skills/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ontology_id: ontologyId }),
    });
    if (!res.ok) throw new Error('Failed to generate ontology skills');
    return res.json();
  },

  build: async (ontologyId: string, forceFull?: boolean): Promise<{
    success: boolean; build_version: string; build_id: string;
    build_mode: string; generated_count: number; updated_count: number;
    skipped_count: number; test_cases_count: number;
  }> => {
    const res = await fetch(`${API_BASE}/ontology-skills/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ontology_id: ontologyId, force_full: forceFull }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to trigger build');
    }
    return res.json();
  },

  deleteAll: async (ontologyId: string): Promise<{ success: boolean; deleted_count: number }> => {
    const res = await fetch(`${API_BASE}/ontology-skills/all?ontology_id=${ontologyId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete ontology skills');
    return res.json();
  },

  getBuilds: async (ontologyId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/ontology-skills/builds/${ontologyId}`);
    if (!res.ok) throw new Error('Failed to fetch builds');
    return res.json();
  },

  getBuildReport: async (buildVersion: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/ontology-skills/builds/${buildVersion}/report`);
    if (!res.ok) throw new Error('Failed to fetch build report');
    return res.json();
  },

  getTestPlan: async (buildVersion: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/ontology-skills/builds/${buildVersion}/test-plan`);
    if (!res.ok) throw new Error('Failed to fetch test plan');
    return res.json();
  },

  executeSkill: async (skillId: string, params: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/ontology-skills/${skillId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to execute skill');
    return res.json();
  },

  clearData: async (ontologyId: string): Promise<{
    success: boolean;
    ontology_id: string;
    cleared: {
      mongodb: { collections: string[]; documents_deleted: number };
      neo4j: { nodes_deleted: number; relationships_deleted: number };
      chroma: { collections: string[]; documents_deleted: number };
    };
  }> => {
    const res = await fetch(`${API_BASE}/ontology-skills/clear-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ontology_id: ontologyId }),
    });
    if (!res.ok) throw new Error('Failed to clear data');
    return res.json();
  },

  clearRuntimeData: async (ontologyId: string): Promise<{
    success: boolean;
    ontology_id: string;
    cleared: {
      visit_records: number;
      advice_artifacts: number;
      event_bus_logs: number;
    };
  }> => {
    const res = await fetch(`${API_BASE}/ontology-skills/clear-runtime-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ontology_id: ontologyId }),
    });
    if (!res.ok) throw new Error('Failed to clear runtime data');
    return res.json();
  },
};

// 执行日志相关
export const logsApi = {
  getAll: async (params?: { ontology_id?: string; skill_id?: string; status?: string; limit?: number; offset?: number }): Promise<ExecutionLog[]> => {
    const query = new URLSearchParams();
    if (params?.ontology_id) query.set('ontology_id', params.ontology_id);
    if (params?.skill_id) query.set('skill_id', params.skill_id);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const res = await fetch(`${API_BASE}/logs?${query}`);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  getById: async (id: string): Promise<ExecutionLog> => {
    const res = await fetch(`${API_BASE}/logs/${id}`);
    if (!res.ok) throw new Error('Failed to fetch log');
    return res.json();
  },
};

// 数据库相关
export const databaseApi = {
  getStatus: async (): Promise<DatabaseStatus> => {
    const res = await fetch(`${API_BASE}/database/status`);
    if (!res.ok) throw new Error('Failed to fetch database status');
    return res.json();
  },

  updateConfig: async (config: { db_type: string; connection_url: string; username?: string; password?: string; database_name?: string }): Promise<void> => {
    const res = await fetch(`${API_BASE}/database/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update database config');
  },
};

// Mock Data API
export const mockDataApi = {
  init: async (): Promise<{ success: boolean; counts: any }> => {
    const res = await fetch(`${API_BASE}/mock-data/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to initialize mock data');
    return res.json();
  },

  getCustomers: async (): Promise<{ customers: any[] }> => {
    const res = await fetch(`${API_BASE}/mock-data/customers`);
    if (!res.ok) throw new Error('Failed to fetch mock customers');
    return res.json();
  },

  getCustomerContext: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/mock-data/customers/${id}/context`);
    if (!res.ok) throw new Error('Failed to fetch customer context');
    return res.json();
  },

  getCustomerAdvice: async (id: string): Promise<{ artifacts: any[] }> => {
    const res = await fetch(`${API_BASE}/mock-data/customers/${id}/advice`);
    if (!res.ok) throw new Error('Failed to fetch customer advice');
    return res.json();
  },

  getVisitRecord: async (id: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/mock-data/visit-records/${id}`);
    if (!res.ok) throw new Error('Failed to fetch visit record');
    return res.json();
  },

  analyzeProfile: async (payload: {
    scenario: 'interview' | 'crm_visit';
    transcript: string;
    speaker_aliases?: Record<string, string>;
    customer_id?: string;
    customer_name?: string;
    visit_record_id?: string;
    visit_title?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_BASE}/mock-data/profile-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to analyze profile');
    return res.json();
  },
};

// Event Bus API
export const eventBusApi = {
  getChainLogs: async (chainId: string): Promise<{ chain_id: string; logs: any[] }> => {
    const res = await fetch(`${API_BASE}/event-bus/chain/${chainId}`);
    if (!res.ok) throw new Error('Failed to fetch chain logs');
    return res.json();
  },
};
