import { create } from 'zustand';
import { Skill, ExecutionLog, DatabaseStatus, Ontology } from '../types';
import { skillsApi, logsApi, databaseApi, ontologySkillsApi, ontologiesApi } from '../api/client';

interface AbilityStore {
  // 状态
  currentOntologyId: string | null;
  currentOntology: Ontology | null;
  ontologies: Ontology[];
  skills: Skill[];
  logs: ExecutionLog[];
  databaseStatus: DatabaseStatus | null;
  loading: boolean;
  error: string | null;

  // 本体操作
  fetchOntologies: () => Promise<void>;
  setCurrentOntologyId: (id: string) => Promise<void>;

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
  currentOntologyId: null,
  currentOntology: null,
  ontologies: [],
  skills: [],
  logs: [],
  databaseStatus: null,
  loading: false,
  error: null,

  fetchOntologies: async () => {
    set({ loading: true, error: null });
    try {
      const ontologies = await ontologiesApi.getAll();
      set({ ontologies, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setCurrentOntologyId: async (id: string) => {
    set({ loading: true, error: null, currentOntologyId: id });
    try {
      const ontology = await ontologiesApi.getById(id);
      set({ currentOntology: ontology, loading: false });
      // 设置后刷新技能和日志
      await get().fetchSkills();
      await get().fetchLogs();
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchSkills: async () => {
    const { currentOntologyId } = get();
    set({ loading: true, error: null });
    try {
      const skills = await skillsApi.getAll(currentOntologyId || undefined);
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
    const { currentOntologyId } = get();
    if (!currentOntologyId) {
      set({ error: 'No ontology selected' });
      return;
    }
    set({ loading: true, error: null });
    try {
      await ontologySkillsApi.deleteAll(currentOntologyId);
      // 删除后刷新技能列表
      await get().fetchSkills();
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchLogs: async (params) => {
    const { currentOntologyId } = get();
    if (!currentOntologyId) {
      set({ logs: [], loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const logs = await logsApi.getAll({ ...params, ontology_id: currentOntologyId });
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
