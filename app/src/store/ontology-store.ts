import { create } from 'zustand';
import { api } from '../api';
import type {
  OntologyShell, ObjectDraft, BehaviorDraft, RuleDraft,
  EventDraft, ScenarioDraft, TabKey, SelectedEntity
} from '../types/ontology';

interface OntologyStore {
  // ── Ontology list ────────────────────────────────────────────────────────
  ontologies: OntologyShell[];
  loadOntologies: () => Promise<void>;
  createOntology: (body: { ontology_code: string; display_name: string; description?: string }) => Promise<OntologyShell>;

  // ── Current workspace ────────────────────────────────────────────────────
  currentOntologyId: number | null;
  setCurrentOntology: (id: number) => void;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;

  // ── Right panel selection ────────────────────────────────────────────────
  selectedEntity: SelectedEntity | null;
  rightPanelOpen: boolean;
  selectEntity: (entity: SelectedEntity | null) => void;
  closeRightPanel: () => void;

  // ── Entity data ──────────────────────────────────────────────────────────
  objects: ObjectDraft[];
  behaviors: BehaviorDraft[];
  rules: RuleDraft[];
  events: EventDraft[];
  scenarios: ScenarioDraft[];

  // ── Loading entity data ──────────────────────────────────────────────────
  loadAll: (ontologyId: number) => Promise<void>;
  loadObjects: (ontologyId: number) => Promise<void>;
  loadBehaviors: (ontologyId: number) => Promise<void>;
  loadRules: (ontologyId: number) => Promise<void>;
  loadEvents: (ontologyId: number) => Promise<void>;
  loadScenarios: (ontologyId: number) => Promise<void>;
}

export const useOntologyStore = create<OntologyStore>((set) => ({
  ontologies: [],
  currentOntologyId: null,
  activeTab: 'topology',
  selectedEntity: null,
  rightPanelOpen: false,
  objects: [],
  behaviors: [],
  rules: [],
  events: [],
  scenarios: [],

  loadOntologies: async () => {
    const ontologies = await api.ontologies.list();
    set({ ontologies });
  },

  createOntology: async (body) => {
    const ontology = await api.ontologies.create(body);
    set((s) => ({ ontologies: [ontology, ...s.ontologies] }));
    return ontology;
  },

  setCurrentOntology: (id) => {
    set({ currentOntologyId: id, activeTab: 'topology', selectedEntity: null, rightPanelOpen: false });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  selectEntity: (entity) => set({ selectedEntity: entity, rightPanelOpen: entity !== null }),

  closeRightPanel: () => set({ selectedEntity: null, rightPanelOpen: false }),

  loadAll: async (ontologyId) => {
    const [objects, behaviors, rules, events, scenarios] = await Promise.all([
      api.objects.list(ontologyId),
      api.behaviors.list(ontologyId),
      api.rules.list(ontologyId),
      api.events.list(ontologyId),
      api.scenarios.list(ontologyId),
    ]);
    set({ objects, behaviors, rules, events, scenarios });
  },

  loadObjects: async (ontologyId) => {
    const objects = await api.objects.list(ontologyId);
    set({ objects });
  },

  loadBehaviors: async (ontologyId) => {
    const behaviors = await api.behaviors.list(ontologyId);
    set({ behaviors });
  },

  loadRules: async (ontologyId) => {
    const rules = await api.rules.list(ontologyId);
    set({ rules });
  },

  loadEvents: async (ontologyId) => {
    const events = await api.events.list(ontologyId);
    set({ events });
  },

  loadScenarios: async (ontologyId) => {
    const scenarios = await api.scenarios.list(ontologyId);
    set({ scenarios });
  },
}));
