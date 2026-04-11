import { Share2, Zap, Bot, Workflow, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface LayerConfig {
  id: string;
  label: string;
  type: 'iframe' | 'placeholder';
  url?: string;
  color: string;
  icon: LucideIcon;
}

export const LAYERS: LayerConfig[] = [
  { id: 'ontology', label: '本体层', type: 'iframe', url: 'http://localhost:5173', color: '#634BFF', icon: Share2 },
  { id: 'ability', label: '能力层', type: 'iframe', url: 'http://localhost:5174', color: '#3B82F6', icon: Zap },
  { id: 'orchestration', label: '场景层', type: 'placeholder', color: '#F59E0B', icon: Workflow },
  { id: 'dialogue', label: '对话层', type: 'placeholder', color: '#EC4899', icon: MessageSquare },
];
