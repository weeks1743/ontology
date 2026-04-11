import { ChromaClient, Collection } from 'chromadb';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ChromaConfig {
  connection_url: string;
  collection_name: string;
}

// Simple local embedding function — deterministic hash-based vectors, no network needed
const LocalEmbeddingFunction = {
  generate: async (texts: string[]): Promise<number[][]> => {
    return texts.map(text => {
      const hash = createHash('sha256').update(text).digest();
      const vector: number[] = [];
      for (let i = 0; i < 384; i++) {
        vector.push((hash[i % hash.length] / 128) - 1);
      }
      return vector;
    });
  },
};

class ChromaDBClient {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private config: ChromaConfig;
  public status: 'online' | 'offline' = 'offline';
  public lastError: string | null = null;

  constructor() {
    // 读取配置文件
    const configPath = join(__dirname, '../../config/database.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const allConfig = JSON.parse(configFile);
    this.config = allConfig.chromadb;
  }

  async connect(): Promise<boolean> {
    try {
      // 创建客户端
      this.client = new ChromaClient({
        path: this.config.connection_url,
      });

      // 测试连接
      await this.client.heartbeat();

      // 获取或创建集合
      try {
        this.collection = await this.client.getCollection({
          name: this.config.collection_name,
          embeddingFunction: LocalEmbeddingFunction,
        });
      } catch {
        // 集合不存在，创建新集合
        this.collection = await this.client.createCollection({
          name: this.config.collection_name,
          metadata: { description: 'CRM opportunities for semantic search' },
          embeddingFunction: LocalEmbeddingFunction,
        });
      }

      this.status = 'online';
      this.lastError = null;
      console.log('✅ ChromaDB connected:', this.config.collection_name);
      return true;
    } catch (error) {
      this.status = 'offline';
      this.lastError = (error as Error).message;
      console.log('❌ ChromaDB connection failed:', this.lastError);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.collection = null;
    this.status = 'offline';
  }

  getClient(): ChromaClient | null {
    return this.client;
  }

  getCollection(): Collection | null {
    return this.collection;
  }

  isOnline(): boolean {
    return this.status === 'online';
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.heartbeat();
      this.status = 'online';
      this.lastError = null;
      return true;
    } catch (error) {
      this.status = 'offline';
      this.lastError = (error as Error).message;
      return false;
    }
  }

  // 向量化商机数据
  async addOpportunity(id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.collection) {
      return false;
    }

    try {
      // 构建文档文本（用于向量化）
      const document = `
        标题: ${data.title || ''}
        金额: ${data.amount || 0}
        阶段: ${data.stage || ''}
        描述: ${data.description || ''}
        客户: ${data.customer_name || ''}
        行业: ${data.industry || ''}
      `.trim();

      // 添加到集合
      await this.collection.add({
        ids: [id],
        documents: [document],
        metadatas: [{
          title: data.title || '',
          amount: data.amount || 0,
          stage: data.stage || '',
          customer_name: data.customer_name || '',
          industry: data.industry || '',
          created_at: new Date().toISOString(),
        }],
      });

      return true;
    } catch (error) {
      console.error('ChromaDB addOpportunity error:', error);
      return false;
    }
  }

  // 语义搜索相似商机
  async searchSimilarOpportunities(query: string, limit: number = 5): Promise<any> {
    if (!this.isOnline() || !this.collection) {
      return null;
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
      });

      return {
        ids: results.ids[0],
        documents: results.documents[0],
        metadatas: results.metadatas[0],
        distances: results.distances?.[0] || [],
      };
    } catch (error) {
      console.error('ChromaDB searchSimilarOpportunities error:', error);
      return null;
    }
  }

  // Generic upsert document for write-plan-executor
  async upsertDocument(collectionName: string, id: string, document: string, metadata: Record<string, any> = {}): Promise<boolean> {
    if (!this.isOnline() || !this.client) {
      return false;
    }

    try {
      let coll: Collection;
      try {
        coll = await this.client.getCollection({ name: collectionName, embeddingFunction: LocalEmbeddingFunction });
      } catch {
        coll = await this.client.createCollection({ name: collectionName, embeddingFunction: LocalEmbeddingFunction });
      }

      await coll.upsert({
        ids: [id],
        documents: [document],
        metadatas: [{ ...metadata, updated_at: new Date().toISOString() }],
      });

      return true;
    } catch (error) {
      console.error('ChromaDB upsertDocument error:', error);
      return false;
    }
  }

  // 批量向量化待处理的商机
  async batchVectorize(opportunities: Array<{ id: string; data: any }>): Promise<number> {
    if (!this.isOnline() || !this.collection) {
      return 0;
    }

    try {
      const ids = opportunities.map(o => o.id);
      const documents = opportunities.map(o => {
        const data = o.data;
        return `
          标题: ${data.title || ''}
          金额: ${data.amount || 0}
          阶段: ${data.stage || ''}
          描述: ${data.description || ''}
          客户: ${data.customer_name || ''}
          行业: ${data.industry || ''}
        `.trim();
      });
      const metadatas = opportunities.map(o => ({
        title: o.data.title || '',
        amount: o.data.amount || 0,
        stage: o.data.stage || '',
        customer_name: o.data.customer_name || '',
        industry: o.data.industry || '',
        created_at: new Date().toISOString(),
      }));

      await this.collection.add({
        ids,
        documents,
        metadatas,
      });

      return opportunities.length;
    } catch (error) {
      console.error('ChromaDB batchVectorize error:', error);
      return 0;
    }
  }

  // Clear all collections for a specific ontology
  async clearOntologyCollections(ontologyId: string): Promise<{ collections: string[]; deletedCount: number }> {
    if (!this.isOnline() || !this.client) {
      return { collections: [], deletedCount: 0 };
    }

    try {
      const collections = await this.client.listCollections();
      const prefix = `${ontologyId}_`;
      const matchingCollections = collections.filter(c => c.name.startsWith(prefix));

      let totalDeleted = 0;
      for (const coll of matchingCollections) {
        // Get collection to count documents
        const collection = await this.client.getCollection({ name: coll.name });
        const existingDocs = await collection.get();
        const count = existingDocs.ids?.length || 0;

        // Delete the collection
        await this.client.deleteCollection({ name: coll.name });
        totalDeleted += count;
      }

      console.log(`✅ ChromaDB cleared ${matchingCollections.length} collections (${totalDeleted} documents) for ontology: ${ontologyId}`);
      return { collections: matchingCollections.map(c => c.name), deletedCount: totalDeleted };
    } catch (error) {
      console.error('ChromaDB clearOntologyCollections error:', error);
      return { collections: [], deletedCount: 0 };
    }
  }
}

// 单例实例
export const chromaClient = new ChromaDBClient();
