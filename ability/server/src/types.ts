// 技能定义
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'ontology' | 'external';
  source: string; // 'generated' | 'clawhub' | 'github'
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

// 执行日志
export interface ExecutionLog {
  id: string;
  skill_id: string;
  skill_name: string;
  input_params: string; // JSON string
  output_result: string; // JSON string
  status: 'success' | 'error' | 'partial';
  error_message?: string;
  mongodb_status: 'ok' | 'error' | 'skipped';
  neo4j_status: 'ok' | 'error' | 'skipped';
  chroma_status: 'ok' | 'error' | 'skipped';
  duration_ms: number;
  created_at: string;
}

// 数据库配置
export interface DbConfig {
  id: string;
  db_type: 'mongodb' | 'neo4j' | 'chromadb';
  connection_url: string;
  username?: string;
  password?: string;
  database_name?: string;
  status: 'online' | 'offline';
  last_check: string;
}

// 技能执行结果
export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  mongodb_status: 'ok' | 'error' | 'skipped';
  neo4j_status: 'ok' | 'error' | 'skipped';
  chroma_status: 'ok' | 'error' | 'skipped';
  duration_ms: number;
}
