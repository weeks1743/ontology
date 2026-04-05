// Manifest 类型定义

export interface InputField {
  name: string;
  display_name_zh: string;
  type: string;
  required: boolean;
  description?: string;
  enum_values?: string[];
  default_value?: any;
}

export interface MongoWriteOp {
  op: 'insert' | 'update' | 'upsert' | 'delete';
  collection: string;
  alias?: string;
  document?: Record<string, any>;
  filter?: Record<string, any>;
  update?: Record<string, any>;
}

export interface Neo4jWriteOp {
  op: 'upsert_node' | 'upsert_edge' | 'update_node' | 'delete_edge';
  label?: string;
  id_field?: string;
  properties?: Record<string, any>;
  // for edges
  from_label?: string;
  from_id?: any;
  to_label?: string;
  to_id?: any;
  relationship?: string;
  edge_properties?: Record<string, any>;
  alias?: string;
}

export interface ChromaWriteOp {
  op: 'upsert' | 'delete';
  collection: string;
  id: any;
  document?: string;
  metadata?: Record<string, any>;
}

export interface WritePlan {
  mongodb: {
    required: boolean;
    ops: MongoWriteOp[];
  };
  neo4j: {
    required: boolean;
    ops: Neo4jWriteOp[];
  };
  chroma: {
    required: boolean;
    ops: ChromaWriteOp[];
  };
}

export interface RuleBinding {
  rule_code: string;
  rule_name_zh: string;
  expression: any;
  failure_message_zh: string;
  severity: string;
}

export interface EventBinding {
  event_code: string;
  event_name_zh: string;
  trigger: 'on_success';
}

export interface ReadContext {
  alias: string;
  collection: string;
  filter: Record<string, any>;
  required: boolean;
  description_zh: string;
}

export interface BehaviorManifest {
  // 基础信息
  skill_id: string;
  skill_slug: string;
  full_id: string;
  skill_type: 'behavior';
  build_version: string;
  snapshot_hash: string;

  // 本体映射
  ontology_id: string;
  behavior_code: string;
  behavior_name_zh: string;
  owner_object: string;
  trigger_type: string;

  // 输入输出
  input_schema: InputField[];
  result_schema?: any[];

  // 读取上下文
  reads: ReadContext[];

  // 前置约束
  object_preconditions: Array<{
    object: string;
    field: string;
    operator: string;
    value: any;
    message_zh: string;
  }>;

  // 规则绑定
  rule_bindings: RuleBinding[];

  // write plan
  write_plan: WritePlan;

  // 事件绑定
  event_bindings: EventBinding[];

  // 用户输出模板
  success_template_zh: string;
  failure_template_zh: string;

  // 生成元数据
  generated_at: string;
}

export interface ScenarioStep {
  step: number;
  behavior_skill_full_id: string;
  behavior_code: string;
  behavior_name_zh: string;
  type?: string;
  condition?: string;
  if_true?: string;
  if_false?: string;
  on_failure?: string;
}

export interface ScenarioManifest {
  // 基础信息
  skill_id: string;
  skill_slug: string;
  full_id: string;
  skill_type: 'scenario';
  build_version: string;
  snapshot_hash: string;

  // 本体映射
  ontology_id: string;
  scenario_code: string;
  scenario_name_zh: string;
  business_goal: string;
  involved_objects: string[];

  // 步骤编排
  steps: ScenarioStep[];

  // 入口/完成条件
  entry_conditions: string[];
  completion_criteria: string[];

  // 失败策略
  failure_strategy: 'abort' | 'continue' | 'rollback';

  // 用户输出模板
  success_summary_template_zh: string;

  // 生成元数据
  generated_at: string;
}

// DB 存储类型
export interface SkillBuild {
  id: string;
  ontology_id: string;
  build_version: string;
  snapshot_hash: string;
  build_mode: 'full' | 'incremental';
  status: 'success' | 'failed' | 'partial';
  generated_count: number;
  updated_count: number;
  skipped_count: number;
  error_message?: string;
  started_at: string;
  finished_at?: string;
  created_at: string;
}

export interface BuildReport {
  build_id: string;
  build_version: string;
  ontology_id: string;
  summary: {
    status: string;
    build_mode: string;
    duration_ms: number;
    snapshot_hash: string;
    generated_at: string;
  };
  input_snapshot: {
    objects: number;
    behaviors: number;
    rules: number;
    events: number;
    scenarios: number;
    validation_errors: number;
    validation_warnings: number;
  };
  skill_results: {
    behavior_skills: number;
    scenario_skills: number;
    query_skills: number;
    total: number;
    new_skills: string[];
    updated_skills: string[];
    skipped_skills: string[];
  };
  skill_details: Array<{
    skill_id: string;
    skill_slug: string;
    skill_type: string;
    action: 'generated' | 'updated' | 'skipped';
    behavior_code?: string;
    scenario_code?: string;
  }>;
  test_plan_summary: {
    total_cases: number;
    positive_cases: number;
    rule_block_cases: number;
    scenario_cases: number;
  };
}

export interface TestPlan {
  id: string;
  build_version: string;
  ontology_id: string;
  snapshot_hash: string;
  total_cases: number;
  created_at: string;
  cases?: TestCase[];
}

export interface TestCase {
  id: string;
  plan_id: string;
  skill_id: string;
  skill_slug: string;
  case_code: string;
  case_name_zh: string;
  case_type: 'positive' | 'negative' | 'rule_block' | 'scenario';
  description_zh?: string;
  params: any;
  expected_result?: any;
  db_assertions?: any;
  sequence: number;
  created_at: string;
}
