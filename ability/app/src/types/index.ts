// 技能定义
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'ontology' | 'external';
  source: string;
  ontology_id?: string; // 关联的本体 ID
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
