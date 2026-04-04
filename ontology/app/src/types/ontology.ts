// ── Draft Types for Ontology Management System ──

export interface OntologyShell {
  id: number;
  ontology_code: string;
  display_name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ObjectAttribute {
  name: string;
  displayName?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'reference' | 'array';
  description?: string;
  required?: boolean;
  enum_values?: string[];
  default_value?: string;
}

export interface ObjectRelation {
  name: string;
  displayName?: string;
  target_object: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  description?: string;
}

export interface ObjectDraft {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  lifecycle: string[];
  attributes: ObjectAttribute[];
  relations_detail: ObjectRelation[];
  created_at: string;
  updated_at: string;
}

export type TriggerType = 'USER_ACTION' | 'AI_OR_USER_ACTION' | 'SYSTEM_ACTION' | 'SYSTEM_OR_MANAGER_ACTION';

export interface BehaviorDraft {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  owner_object: string;
  trigger_type: TriggerType;
  required_inputs: string[];
  referenced_rules: string[];
  emits_events: string[];
  writeback_targets: string[];
  created_at: string;
  updated_at: string;
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RuleDraft {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  type: string;
  applicable_objects: string[];
  applicable_behaviors: string[];
  expression: string;
  failure_message: string;
  severity: SeverityLevel;
  escalation_target: string;
  created_at: string;
  updated_at: string;
}

export interface EventDraft {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  producer_object: string;
  producer_behavior: string;
  subscribers: string[];
  impacted_objects: string[];
  created_at: string;
  updated_at: string;
}

export interface ScenarioStep {
  step: number;
  behavior?: string;
  event?: string;
  decision_gate?: string[];
}

export interface ScenarioDraft {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  business_goal: string;
  involved_objects: string[];
  steps: ScenarioStep[];
  success_criteria: string[];
  created_at: string;
  updated_at: string;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  entity_type: string;
  entity_code: string;
  message: string;
}

export interface ValidationResult {
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
}

export interface YamlBundle {
  model: string;
  objects: string;
  behaviors: string;
  rules: string;
  events: string;
  scenarios: string;
  generated_at: string;
}

export interface BlockReference {
  entity_type: string;
  entity_code: string;
  entity_name: string;
  reason: string;
}

export interface DeleteBlockError {
  blocked: true;
  references: BlockReference[];
}

export type TabKey = 'topology' | 'objects' | 'behaviors' | 'rules' | 'events' | 'scenarios' | 'yaml';

export type EntityType = 'object' | 'behavior' | 'rule' | 'event' | 'scenario';

export interface SelectedEntity {
  type: EntityType;
  code: string;
}
