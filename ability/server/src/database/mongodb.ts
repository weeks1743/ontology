import { MongoClient, Db } from 'mongodb';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MongoConfig {
  connection_url: string;
  database_name: string;
  username?: string;
  password?: string;
}

class MongoDBClient {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoConfig;
  public status: 'online' | 'offline' = 'offline';
  public lastError: string | null = null;

  constructor() {
    // 读取配置文件
    const configPath = join(__dirname, '../../config/database.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const allConfig = JSON.parse(configFile);
    this.config = allConfig.mongodb;
  }

  async connect(): Promise<boolean> {
    try {
      // 构建连接 URL
      let url = this.config.connection_url;
      if (this.config.username && this.config.password) {
        const urlObj = new URL(url);
        urlObj.username = this.config.username;
        urlObj.password = this.config.password;
        url = urlObj.toString();
      }

      // 创建客户端
      this.client = new MongoClient(url, {
        serverSelectionTimeoutMS: 5000, // 5秒超时
        connectTimeoutMS: 5000,
      });

      // 连接
      await this.client.connect();
      this.db = this.client.db(this.config.database_name);

      // 测试连接
      await this.db.admin().ping();

      this.status = 'online';
      this.lastError = null;
      console.log('✅ MongoDB connected:', this.config.database_name);
      return true;
    } catch (error) {
      this.status = 'offline';
      this.lastError = (error as Error).message;
      console.log('❌ MongoDB connection failed:', this.lastError);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.status = 'offline';
    }
  }

  getDb(): Db | null {
    return this.db;
  }

  isOnline(): boolean {
    return this.status === 'online';
  }

  async healthCheck(): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    try {
      await this.db.admin().ping();
      this.status = 'online';
      this.lastError = null;
      return true;
    } catch (error) {
      this.status = 'offline';
      this.lastError = (error as Error).message;
      return false;
    }
  }

  // CRM 数据操作方法
  async insertLead(data: any): Promise<string | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const collection = this.db.collection('crm_leads');
      const result = await collection.insertOne({
        ...data,
        vector_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result.insertedId.toString();
    } catch (error) {
      console.error('MongoDB insertLead error:', error);
      return null;
    }
  }

  async insertOpportunity(data: any): Promise<string | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const collection = this.db.collection('crm_opportunities');
      const result = await collection.insertOne({
        ...data,
        vector_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result.insertedId.toString();
    } catch (error) {
      console.error('MongoDB insertOpportunity error:', error);
      return null;
    }
  }

  async insertCustomer(data: any): Promise<string | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const collection = this.db.collection('crm_customers');
      const result = await collection.insertOne({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result.insertedId.toString();
    } catch (error) {
      console.error('MongoDB insertCustomer error:', error);
      return null;
    }
  }

  async insertQuote(data: any): Promise<string | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const collection = this.db.collection('crm_quotes');
      const result = await collection.insertOne({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result.insertedId.toString();
    } catch (error) {
      console.error('MongoDB insertQuote error:', error);
      return null;
    }
  }

  async insertContact(data: any): Promise<string | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const collection = this.db.collection('crm_contacts');
      const result = await collection.insertOne({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return result.insertedId.toString();
    } catch (error) {
      console.error('MongoDB insertContact error:', error);
      return null;
    }
  }

  async updateDocument(collection: string, id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.db) {
      return false;
    }

    try {
      const coll = this.db.collection(collection);
      const result = await coll.updateOne(
        { _id: id as any },
        { $set: { ...data, updated_at: new Date().toISOString() } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('MongoDB updateDocument error:', error);
      return false;
    }
  }

  async updateByFilter(collection: string, filter: Record<string, any>, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.db) {
      return false;
    }

    try {
      const coll = this.db.collection(collection);
      const result = await coll.updateOne(
        filter,
        { $set: { ...data, updated_at: new Date().toISOString() } },
      );
      return result.modifiedCount > 0 || result.matchedCount > 0;
    } catch (error) {
      console.error('MongoDB updateByFilter error:', error);
      return false;
    }
  }

  // Generic insert for write-plan-executor
  async insertDocument(collection: string, data: any): Promise<string | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const coll = this.db.collection(collection);
      const doc = {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await coll.insertOne(doc);
      return result.insertedId.toString();
    } catch (error) {
      console.error('MongoDB insertDocument error:', error);
      return null;
    }
  }

  async findOne(collection: string, filter: Record<string, any>): Promise<any | null> {
    if (!this.isOnline() || !this.db) {
      return null;
    }

    try {
      const coll = this.db.collection(collection);
      return await coll.findOne(filter);
    } catch (error) {
      console.error('MongoDB findOne error:', error);
      return null;
    }
  }

  async findMany(
    collection: string,
    filter: Record<string, any>,
    options?: { sort?: Record<string, 1 | -1>; limit?: number }
  ): Promise<any[]> {
    if (!this.isOnline() || !this.db) {
      return [];
    }

    try {
      const coll = this.db.collection(collection);
      let cursor = coll.find(filter);
      if (options?.sort) cursor = cursor.sort(options.sort);
      if (options?.limit) cursor = cursor.limit(options.limit);
      return await cursor.toArray();
    } catch (error) {
      console.error('MongoDB findMany error:', error);
      return [];
    }
  }

  // Clear all collections for a specific ontology
  async clearOntologyCollections(ontologyId: string): Promise<{ collections: string[]; deletedCount: number }> {
    if (!this.isOnline() || !this.db) {
      return { collections: [], deletedCount: 0 };
    }

    try {
      const collections = await this.db.listCollections().toArray();
      const prefix = `${ontologyId}_`;
      const matchingCollections = collections
        .map(c => c.name)
        .filter(name => name.startsWith(prefix));

      let totalDeleted = 0;
      for (const collectionName of matchingCollections) {
        const coll = this.db.collection(collectionName);
        const result = await coll.deleteMany({});
        totalDeleted += result.deletedCount;
      }

      console.log(`✅ MongoDB cleared ${matchingCollections.length} collections (${totalDeleted} documents) for ontology: ${ontologyId}`);
      return { collections: matchingCollections, deletedCount: totalDeleted };
    } catch (error) {
      console.error('MongoDB clearOntologyCollections error:', error);
      return { collections: [], deletedCount: 0 };
    }
  }
}

// 单例实例
export const mongoClient = new MongoDBClient();
