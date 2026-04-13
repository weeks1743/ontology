import { create } from 'zustand';
import type {
  SceneOntology,
  Industry,
  Scenario,
  TestCase,
  TestRunResult,
} from '../api/client';
import {
  ontologyApi,
  industryApi,
  scenarioApi,
  testCaseApi,
} from '../api/client';

export type NavKey = 'scene-config' | 'capability';

type SceneStore = {
  // Data
  ontologies: SceneOntology[];
  currentOntology: SceneOntology | null;
  industries: Industry[];
  scenarios: Scenario[];
  testCases: TestCase[];

  // UI State
  activeNav: NavKey;
  selectedIndustry: Industry | null;
  showIndustryModal: boolean;

  // Loading states
  loading: boolean;
  error: string | null;

  // Test execution
  testRunning: boolean;
  lastTestResult: TestRunResult | null;

  // Actions
  loadOntologies: () => Promise<void>;
  loadWorkspace: (ontologyId: string) => Promise<void>;
  setActiveNav: (nav: NavKey) => void;
  selectIndustry: (industry: Industry | null) => Promise<void>;
  setShowIndustryModal: (show: boolean) => void;

  // CRUD
  createIndustry: (ontologyId: string, data: Partial<Industry>) => Promise<void>;
  deleteIndustry: (id: number) => Promise<void>;
  createScenario: (industryId: number, data: Partial<Scenario>) => Promise<void>;
  deleteScenario: (id: number) => Promise<void>;
  createTestCase: (scenarioId: number, data: Partial<TestCase>) => Promise<void>;
  runTestCase: (id: number) => Promise<void>;
};

export const useSceneStore = create<SceneStore>((set, get) => ({
  ontologies: [],
  currentOntology: null,
  industries: [],
  scenarios: [],
  testCases: [],

  activeNav: 'scene-config' as NavKey,
  selectedIndustry: null,
  showIndustryModal: true,

  loading: false,
  error: null,
  testRunning: false,
  lastTestResult: null,

  loadOntologies: async () => {
    set({ loading: true, error: null });
    try {
      const ontologies = await ontologyApi.list();
      set({ ontologies, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadWorkspace: async (ontologyId: string) => {
    set({ loading: true, error: null });
    try {
      const ontology = await ontologyApi.get(ontologyId);
      const industries = await industryApi.list(ontologyId);

      // Auto-select industry: single industry or DB-saved choice
      let autoIndustry: Industry | null = null;
      if (industries.length === 1) {
        autoIndustry = industries[0];
      } else {
        try {
          const { selected_industry_code } = await ontologyApi.getSelectedIndustry(ontologyId);
          if (selected_industry_code) {
            autoIndustry = industries.find(i => i.code === selected_industry_code) ?? null;
          }
        } catch { /* ignore */ }
      }

      if (autoIndustry) {
        const scenarios = await scenarioApi.list(autoIndustry.id);
        const allTestCases = (await Promise.all(
          scenarios.map(s => testCaseApi.list(s.id))
        )).flat();
        set({
          currentOntology: ontology,
          industries,
          selectedIndustry: autoIndustry,
          showIndustryModal: false,
          scenarios,
          testCases: allTestCases,
          loading: false,
          activeNav: 'scene-config' as NavKey,
        });
      } else {
        set({
          currentOntology: ontology,
          industries,
          loading: false,
          activeNav: 'scene-config' as NavKey,
          selectedIndustry: null,
          showIndustryModal: true,
          scenarios: [],
          testCases: [],
        });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setActiveNav: (nav) => set({ activeNav: nav }),
  setShowIndustryModal: (show) => set({ showIndustryModal: show }),

  selectIndustry: async (industry) => {
    if (industry) {
      // Persist selection to DB
      const oid = get().currentOntology?.ontology_id;
      if (oid) {
        try { await ontologyApi.setSelectedIndustry(oid, industry.code); } catch { /* ignore */ }
      }

      const scenarios = await scenarioApi.list(industry.id);
      const allTestCases = (await Promise.all(
        scenarios.map(s => testCaseApi.list(s.id))
      )).flat();
      set({
        selectedIndustry: industry,
        scenarios,
        testCases: allTestCases,
        showIndustryModal: false,
        activeNav: 'scene-config' as NavKey,
      });
    } else {
      set({ selectedIndustry: null, scenarios: [], testCases: [] });
    }
  },

  createIndustry: async (ontologyId, data) => {
    try { await industryApi.create(ontologyId, data); await get().loadWorkspace(ontologyId); }
    catch (error) { set({ error: (error as Error).message }); throw error; }
  },

  deleteIndustry: async (id) => {
    try { await industryApi.delete(id); const oid = get().currentOntology?.ontology_id; if (oid) await get().loadWorkspace(oid); }
    catch (error) { set({ error: (error as Error).message }); throw error; }
  },

  createScenario: async (industryId, data) => {
    try { await scenarioApi.create(industryId, data); const scenarios = await scenarioApi.list(industryId); set({ scenarios }); }
    catch (error) { set({ error: (error as Error).message }); throw error; }
  },

  deleteScenario: async (id) => {
    try { await scenarioApi.delete(id); const industry = get().selectedIndustry; if (industry) { const scenarios = await scenarioApi.list(industry.id); set({ scenarios }); } }
    catch (error) { set({ error: (error as Error).message }); throw error; }
  },

  createTestCase: async (scenarioId, data) => {
    try { await testCaseApi.create(scenarioId, data); const testCases = await testCaseApi.list(scenarioId); set({ testCases }); }
    catch (error) { set({ error: (error as Error).message }); throw error; }
  },

  runTestCase: async (id) => {
    set({ testRunning: true, error: null });
    try { const result = await testCaseApi.run(id); set({ testRunning: false, lastTestResult: result }); }
    catch (error) { set({ testRunning: false, error: (error as Error).message }); throw error; }
  },
}));
