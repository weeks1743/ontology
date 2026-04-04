// Shared types used by both API responses and internal logic

export interface OntologyShell {
  id: number;
  ontology_code: string;
  display_name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Enhanced Types for AI Semantic Reasoning
// Based on YAML_SEMANTIC_ASSESSMENT.md recommendations
// ============================================================================

export interface ObjectAttribute {
  name: string;
  displayName?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'reference' | 'array';
  description?: string;
  required?: boolean;
  enum_values?: string[];
  default_value?: string;
  // Enhanced fields
  examples?: string[];
  aliases?: string[];
  validation?: {
    min?: number;
    max?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
  };
}

// Enhanced lifecycle state with transition rules
export interface LifecycleState {
  state: string;
  allowed_transitions: string[];
  required_conditions?: string[]; // Rule codes that must pass
  available_behaviors?: string[]; // Behavior codes available in this state
  on_enter_events?: string[];
  on_exit_events?: string[];
}

export interface ObjectRelation {
  name: string;
  displayName?: string;
  target_object: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  description?: string;
  // Enhanced fields
  cardinality?: { min: number; max: number | null };
  ownership?: 'composition' | 'reference';
  cascade_delete?: boolean;
  inverse_relation?: string;
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
  // Enhanced fields
  aliases?: string[];
  nl_examples?: string[];
  negative_examples?: string[];
  disambiguation_notes?: string;
  lifecycle_enhanced?: LifecycleState[];
}

// Input schema for behaviors
export interface InputSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'object' | 'array';
  required: boolean;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
    enum_values?: string[];
  };
  default_value?: any;
}

// Result schema for behaviors
export interface ResultSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
}

// Precondition for behaviors
export interface Precondition {
  rule: string; // Rule code
  failure_action: 'block' | 'warn' | 'log';
}

// Postcondition for behaviors
export interface Postcondition {
  type: 'state_change' | 'event_emitted' | 'creates_object' | 'modifies_field';
  details: any;
}

// Side effect for behaviors
export interface SideEffect {
  type: 'modifies' | 'creates' | 'deletes';
  target: string;
  fields?: string[];
}

export interface BehaviorDraft {
  id: number;
  ontology_id: number;
  code: string;
  name: string;
  description: string;
  owner_object: string;
  trigger_type: 'USER_ACTION' | 'AI_OR_USER_ACTION' | 'SYSTEM_ACTION' | 'SYSTEM_OR_MANAGER_ACTION';
  required_inputs: string[];
  referenced_rules: string[];
  emits_events: string[];
  writeback_targets: string[];
  created_at: string;
  updated_at: string;
  // Enhanced fields
  aliases?: string[];
  nl_examples?: string[];
  inputs_schema?: InputSchema[];
  preconditions?: Precondition[];
  result_schema?: ResultSchema[];
  postconditions?: Postcondition[];
  side_effects?: SideEffect[];
}

// Structured expression for rules (AST-like)
export interface StructuredExpression {
  type: 'comparison' | 'logical_and' | 'logical_or' | 'logical_not' | 'is_null' | 'is_not_null' | 'in' | 'not_in';
  left?: string | StructuredExpression;
  operator?: '>=' | '<=' | '>' | '<' | '==' | '!=' | 'contains' | 'starts_with' | 'ends_with';
  right?: any | StructuredExpression;
  operands?: StructuredExpression[];
  field?: string;
  value?: any;
  values?: any[];
}

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
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalation_target: string;
  created_at: string;
  updated_at: string;
  // Enhanced fields
  input_context?: string[];
  expression_structured?: StructuredExpression;
  next_actions?: string[];
  failure_message_template?: string;
  constraint_type?: 'hard' | 'soft';
}

// Payload schema for events
export interface PayloadSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array';
  required: boolean;
  description?: string;
}

// Subscriber with priority and idempotency
export interface EventSubscriber {
  behavior: string;
  priority: number;
  idempotent: boolean;
}

// Propagation condition for events
export interface PropagationCondition {
  condition: string;
  action: 'propagate' | 'skip' | 'delay';
}

// Trace policy for events
export interface TracePolicy {
  retention_days: number;
  include_payload: boolean;
  trace_upstream: boolean;
}

// Causality for events
export interface EventCausality {
  triggers_after?: string[];
  blocks_until?: string[];
  triggers?: string[];
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
  // Enhanced fields
  payload_schema?: PayloadSchema[];
  propagation_conditions?: PropagationCondition[];
  triggered_behaviors?: string[];
  trace_policy?: TracePolicy;
  causality?: EventCausality;
}

export interface ScenarioStep {
  step: number;
  type?: 'action' | 'decision' | 'end' | 'error_handler';
  behavior?: string;
  event?: string;
  decision_gate?: string[];
  // Enhanced fields
  condition?: {
    rule: string;
    operator: 'passes' | 'fails';
  };
  if_true?: number[];
  if_false?: number[];
  on_success?: number[];
  on_failure?: number[];
  rollback_to?: number;
}

// Decision point for scenarios
export interface DecisionPoint {
  step: number;
  rule: string;
  description: string;
  if_true_path: string;
  if_false_path: string;
}

// Rollback/compensation for scenarios
export interface RollbackCompensation {
  trigger: 'on_failure' | 'on_timeout' | 'manual';
  actions: string[];
  description: string;
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
  // Enhanced fields
  start_conditions?: string[];
  decision_points_enhanced?: DecisionPoint[];
  rollback_compensation?: RollbackCompensation[];
  observability_metrics?: string[];
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  entity_type: string;
  entity_code: string;
  message: string;
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

export interface DeleteBlockResponse {
  blocked: true;
  references: BlockReference[];
}

export interface BlockReference {
  entity_type: string;
  entity_code: string;
  entity_name: string;
  reason: string;
}
