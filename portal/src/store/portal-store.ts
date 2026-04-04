import { create } from 'zustand';

interface PortalState {
  activeLayer: string;
  setActiveLayer: (id: string) => void;
}

export const usePortalStore = create<PortalState>((set) => ({
  activeLayer: 'ontology',
  setActiveLayer: (id) => set({ activeLayer: id }),
}));
