import { mongoClient } from './mongodb.js';
import { neo4jClient } from './neo4j.js';
import { chromaClient } from './chroma.js';

// 数据库状态接口
export interface DatabaseStatus {
  mongodb: {
    status: 'online' | 'offline';
    last_check: string;
    error?: string;
  };
  neo4j: {
    status: 'online' | 'offline';
    last_check: string;
    error?: string;
  };
  chromadb: {
    status: 'online' | 'offline';
    last_check: string;
    error?: string;
  };
}

// 初始化所有数据库连接
export async function initializeDatabases(): Promise<void> {
  console.log('🔌 Initializing database connections...');

  // 并行尝试连接所有数据库（软依赖设计）
  await Promise.allSettled([
    mongoClient.connect(),
    neo4jClient.connect(),
    chromaClient.connect(),
  ]);

  console.log('✅ Database initialization complete');
  console.log(`   MongoDB: ${mongoClient.status}`);
  console.log(`   Neo4j: ${neo4jClient.status}`);
  console.log(`   ChromaDB: ${chromaClient.status}`);
}

// 获取所有数据库状态
export function getDatabaseStatus(): DatabaseStatus {
  const now = new Date().toISOString();

  return {
    mongodb: {
      status: mongoClient.status,
      last_check: now,
      error: mongoClient.lastError || undefined,
    },
    neo4j: {
      status: neo4jClient.status,
      last_check: now,
      error: neo4jClient.lastError || undefined,
    },
    chromadb: {
      status: chromaClient.status,
      last_check: now,
      error: chromaClient.lastError || undefined,
    },
  };
}

// 健康检查所有数据库
export async function healthCheckAll(): Promise<DatabaseStatus> {
  await Promise.allSettled([
    mongoClient.healthCheck(),
    neo4jClient.healthCheck(),
    chromaClient.healthCheck(),
  ]);

  return getDatabaseStatus();
}

// 断开所有数据库连接
export async function disconnectAll(): Promise<void> {
  await Promise.allSettled([
    mongoClient.disconnect(),
    neo4jClient.disconnect(),
    chromaClient.disconnect(),
  ]);
}

// 导出客户端实例
export { mongoClient, neo4jClient, chromaClient };
