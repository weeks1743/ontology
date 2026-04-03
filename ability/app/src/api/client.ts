import { Skill, ExecutionLog, DatabaseStatus, ExecutionResult } from '../types';

const API_BASE = '/api';

// 技能相关
export const skillsApi = {
  getAll: async (): Promise<Skill[]> => {
    const res = await fetch(`${API_BASE}/skills`);
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

  deleteAll: async (): Promise<{ success: boolean; deleted_count: number }> => {
    const res = await fetch(`${API_BASE}/ontology-skills/all`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete ontology skills');
    return res.json();
  },
};

// 执行日志相关
export const logsApi = {
  getAll: async (params?: { skill_id?: string; status?: string; limit?: number; offset?: number }): Promise<ExecutionLog[]> => {
    const query = new URLSearchParams();
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
