// 本体定义快照类型

export interface SnapshotObject {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  lifecycle: any[];
  attributes: SnapshotAttribute[];
  relations_detail: SnapshotRelation[];
  aliases?: string[];
  nl_examples?: string[];
  negative_examples?: string[];
  disambiguation_notes?: string;
  lifecycle_enhanced?: any[];
  created_at: string;
  updated_at: string;
}

export interface SnapshotAttribute {
  name: string;
  displayName?: string;
  type: string;
  description?: string;
  required: boolean;
  enum_values?: string[];
  default_value?: any;
  examples?: string[];
  aliases?: string[];
  validation?: any;
}

export interface SnapshotRelation {
  name: string;
  displayName?: string;
  target_object: string;
  type: string;
  description?: string;
  cardinality?: string;
  ownership?: string;
  cascade_delete?: boolean;
  inverse_relation?: string;
}

export interface SnapshotBehavior {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  owner_object: string;
  trigger_type: string;
  required_inputs: string[];
  inputs_schema?: any[];
  referenced_rules: string[];
  emits_events: string[];
  writeback_targets: string[];
  preconditions?: any[];
  result_schema?: any[];
  postconditions?: any[];
  side_effects?: any[];
  aliases?: string[];
  nl_examples?: string[];
  created_at: string;
  updated_at: string;
  // resolved refs
  owner_object_exists?: boolean;
}

export interface SnapshotRule {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  type: string;
  applicable_objects: string[];
  applicable_behaviors: string[];
  expression: string;
  expression_structured?: any;
  failure_message: string;
  failure_message_template?: string;
  severity: string;
  escalation_target?: string;
  constraint_type?: string;
  input_context?: string[];
  next_actions?: string[];
  created_at: string;
  updated_at: string;
}

export interface SnapshotEvent {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  producer_object: string;
  producer_behavior: string;
  subscribers: string[];
  impacted_objects: string[];
  payload_schema?: any[];
  propagation_conditions?: any[];
  triggered_behaviors?: string[];
  trace_policy?: any;
  causality?: any;
  created_at: string;
  updated_at: string;
  producer_object_exists?: boolean;
  producer_behavior_exists?: boolean;
}

export interface SnapshotScenario {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  business_goal: string;
  involved_objects: string[];
  steps: SnapshotStep[];
  success_criteria: string[];
  start_conditions?: string[];
  decision_points_enhanced?: any[];
  rollback_compensation?: any[];
  observability_metrics?: string[];
  created_at: string;
  updated_at: string;
}

export interface SnapshotStep {
  step: number;
  type?: string;
  behavior?: string;
  event?: string;
  decision_gate?: string;
  condition?: string;
  if_true?: string;
  if_false?: string;
  on_success?: string;
  on_failure?: string;
  rollback_to?: number;
}

export interface SnapshotValidation {
  errors: SnapshotValidationIssue[];
  warnings: SnapshotValidationIssue[];
}

export interface SnapshotValidationIssue {
  level: 'error' | 'warning';
  entity_type: string;
  entity_code: string;
  message: string;
}

export interface DefinitionSnapshot {
  schema_version: '1.0';
  ontology: {
    id: number;
    ontology_code: string;
    display_name: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  objects: SnapshotObject[];
  behaviors: SnapshotBehavior[];
  rules: SnapshotRule[];
  events: SnapshotEvent[];
  scenarios: SnapshotScenario[];
  validation: SnapshotValidation;
  build_hints: {
    has_errors: boolean;
    behavior_count: number;
    scenario_count: number;
    object_count: number;
  };
  source_fingerprint: string;
  snapshot_hash: string;
  generated_at: string;
}
