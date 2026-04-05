// 技能定义
export interface Skill {
  id: string;
  name: string;
  display_name?: string; // 中文显示名称
  description: string;
  category: 'ontology' | 'external';
  source: string;
  ontology_id?: string; // 关联的本体 ID
  skill_type?: 'behavior' | 'scenario' | 'query'; // 技能类型
  skill_slug?: string;
  build_version?: string;
  metadata: {
    emoji?: string;
    requires?: {
      bins?: string[];
      env?: string[];
    };
  };
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 本体定义
export interface Ontology {
  id: number; // 主系统返回的是数字 ID
  ontology_code: string;
  display_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// 执行日志
export interface ExecutionLog {
  id: string;
  skill_id: string;
  skill_name: string;
  input_params: any;
  output_result: any;
  status: 'success' | 'error' | 'partial';
  error_message?: string;
  mongodb_status: 'ok' | 'error' | 'skipped';
  neo4j_status: 'ok' | 'error' | 'skipped';
  chroma_status: 'ok' | 'error' | 'skipped';
  duration_ms: number;
  created_at: string;
}

// 数据库状态
export interface DatabaseStatus {
  mongodb: { status: 'online' | 'offline'; last_check: string };
  neo4j: { status: 'online' | 'offline'; last_check: string };
  chromadb: { status: 'online' | 'offline'; last_check: string };
}

// 执行结果
export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  mongodb_status: 'ok' | 'error' | 'skipped';
  neo4j_status: 'ok' | 'error' | 'skipped';
  chroma_status: 'ok' | 'error' | 'skipped';
  duration_ms: number;
}

// 构建记录
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
  skill_count?: number;
}

// 构建报告
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

// 测试方案
export interface TestPlan {
  id: string;
  build_version: string;
  ontology_id: string;
  snapshot_hash: string;
  total_cases: number;
  created_at: string;
  cases?: TestCase[];
}

// 测试用例
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
  sequence: number;
  created_at: string;
  // runtime fields
  status?: 'pending' | 'running' | 'passed' | 'failed';
  actualResult?: any;
  error?: string;
  duration?: number;
  progress?: string;
}
