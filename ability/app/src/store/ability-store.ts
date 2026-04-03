import { create } from 'zustand';
import { Skill, ExecutionLog, DatabaseStatus } from '../types';
import { skillsApi, logsApi, databaseApi, ontologySkillsApi } from '../api/client';

interface AbilityStore {
  // 状态
  skills: Skill[];
  logs: ExecutionLog[];
  databaseStatus: DatabaseStatus | null;
  loading: boolean;
  error: string | null;

  // 技能操作
  fetchSkills: () => Promise<void>;
  executeSkill: (id: string, params: any) => Promise<void>;
  generateOntologySkills: (ontologyId: string) => Promise<void>;
  deleteAllOntologySkills: () => Promise<void>;

  // 日志操作
  fetchLogs: (params?: { skill_id?: string; status?: string }) => Promise<void>;

  // 数据库操作
  fetchDatabaseStatus: () => Promise<void>;
}

export const useAbilityStore = create<AbilityStore>((set, get) => ({
  skills: [],
  logs: [],
  databaseStatus: null,
  loading: false,
  error: null,

  fetchSkills: async () => {
    set({ loading: true, error: null });
    try {
      const skills = await skillsApi.getAll();
      set({ skills, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  executeSkill: async (id: string, params: any) => {
    set({ loading: true, error: null });
    try {
      await skillsApi.execute(id, params);
      // 执行后刷新日志
      await get().fetchLogs();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  generateOntologySkills: async (ontologyId: string) => {
    set({ loading: true, error: null });
    try {
      await ontologySkillsApi.generate(ontologyId);
      // 生成后刷新技能列表
      await get().fetchSkills();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  deleteAllOntologySkills: async () => {
    set({ loading: true, error: null });
    try {
      await ontologySkillsApi.deleteAll();
      // 删除后刷新技能列表
      await get().fetchSkills();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchLogs: async (params) => {
    set({ loading: true, error: null });
    try {
      const logs = await logsApi.getAll(params);
      set({ logs, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchDatabaseStatus: async () => {
    try {
      const status = await databaseApi.getStatus();
      set({ databaseStatus: status });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
