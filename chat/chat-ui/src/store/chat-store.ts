import { create } from 'zustand';

export interface OntologyOption {
  id: string;
  ontology_code: string;
  display_name: string;
  description?: string;
}

interface ChatStore {
  ontologies: OntologyOption[];
  currentOntology: OntologyOption | null;
  loading: boolean;
  error: string | null;

  fetchOntologies: () => Promise<void>;
  setCurrentOntology: (ontology: OntologyOption | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  ontologies: [],
  currentOntology: null,
  loading: false,
  error: null,

  fetchOntologies: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/ontologies');
      if (!res.ok) throw new Error('Failed to fetch ontologies');
      const ontologies = await res.json();
      set({ ontologies, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  setCurrentOntology: (ontology) => {
    set({ currentOntology: ontology });
  },
}));
