import { create } from 'zustand';
import { Skill, ExecutionLog, DatabaseStatus, Ontology, SkillBuild, BuildReport, TestPlan } from '../types';
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

  // 构建相关
  builds: SkillBuild[];
  currentBuildReport: BuildReport | null;
  currentTestPlan: TestPlan | null;

  // 本体操作
  fetchOntologies: () => Promise<void>;
  setCurrentOntologyId: (id: string) => Promise<void>;

  // 技能操作
  fetchSkills: () => Promise<void>;
  executeSkill: (id: string, params: any) => Promise<void>;
  generateOntologySkills: (ontologyId: string) => Promise<void>;
  deleteAllOntologySkills: () => Promise<void>;

  // 构建操作
  triggerBuild: (ontologyId: string, forceFull?: boolean) => Promise<{ build_version: string } | null>;
  fetchBuilds: (ontologyId: string) => Promise<void>;
  fetchBuildReport: (buildVersion: string) => Promise<void>;
  fetchTestPlan: (buildVersion: string) => Promise<void>;

  // 日志操作
  fetchLogs: (params?: { skill_id?: string; status?: string; limit?: number }) => Promise<void>;

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
  builds: [],
  currentBuildReport: null,
  currentTestPlan: null,

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
      // 设置后刷新技能和日志（使用 ontology_code 而非数字 ID）
      await get().fetchSkills();
      await get().fetchLogs();
      await get().fetchBuilds(ontology.ontology_code);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchSkills: async () => {
    const { currentOntologyId, currentOntology } = get();
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    set({ loading: true, error: null });
    try {
      const skills = await skillsApi.getAll(ontologyCode || undefined);
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
    const { currentOntologyId, currentOntology } = get();
    const ontologyCode = currentOntology?.ontology_code || currentOntologyId;
    if (!ontologyCode) {
      set({ error: 'No ontology selected' });
      return;
    }
    set({ loading: true, error: null });
    try {
      await ontologySkillsApi.deleteAll(ontologyCode);
      // 删除后刷新技能列表
      await get().fetchSkills();
      await get().fetchBuilds(ontologyCode);
      set({ loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  triggerBuild: async (ontologyId: string, forceFull?: boolean) => {
    set({ loading: true, error: null });
    try {
      const result = await ontologySkillsApi.build(ontologyId, forceFull);
      await get().fetchSkills();
      await get().fetchBuilds(ontologyId);
      set({ loading: false });
      return { build_version: result.build_version };
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  fetchBuilds: async (ontologyId: string) => {
    try {
      const builds = await ontologySkillsApi.getBuilds(ontologyId);
      set({ builds });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  fetchBuildReport: async (buildVersion: string) => {
    set({ loading: true, error: null });
    try {
      const report = await ontologySkillsApi.getBuildReport(buildVersion);
      set({ currentBuildReport: report, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchTestPlan: async (buildVersion: string) => {
    set({ loading: true, error: null });
    try {
      const plan = await ontologySkillsApi.getTestPlan(buildVersion);
      set({ currentTestPlan: plan, loading: false });
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
