import neo4j, { Driver, Session } from 'neo4j-driver';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Neo4jConfig {
  connection_url: string;
  username: string;
  password: string;
}

class Neo4jClient {
  private driver: Driver | null = null;
  private config: Neo4jConfig;
  public status: 'online' | 'offline' = 'offline';
  public lastError: string | null = null;

  constructor() {
    // 读取配置文件
    const configPath = join(__dirname, '../../config/database.json');
    const configFile = readFileSync(configPath, 'utf-8');
    const allConfig = JSON.parse(configFile);
    this.config = allConfig.neo4j;
  }

  async connect(): Promise<boolean> {
    try {
      this.driver = neo4j.driver(
        this.config.connection_url,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          connectionTimeout: 5000,
          maxConnectionLifetime: 3600000,
        }
      );

      // 测试连接
      await this.driver.verifyConnectivity();

      this.status = 'online';
      this.lastError = null;
      console.log('✅ Neo4j connected:', this.config.connection_url);
      return true;
    } catch (error) {
      this.status = 'offline';
      this.lastError = (error as Error).message;
      console.log('❌ Neo4j connection failed:', this.lastError);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.status = 'offline';
    }
  }

  getDriver(): Driver | null {
    return this.driver;
  }

  isOnline(): boolean {
    return this.status === 'online';
  }

  async healthCheck(): Promise<boolean> {
    if (!this.driver) {
      return false;
    }

    try {
      await this.driver.verifyConnectivity();
      this.status = 'online';
      this.lastError = null;
      return true;
    } catch (error) {
      this.status = 'offline';
      this.lastError = (error as Error).message;
      return false;
    }
  }

  // CRM 图操作方法
  async createCustomerNode(id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.driver) {
      return false;
    }

    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (c:Customer {id: $id, name: $name, industry: $industry, created_at: $created_at})`,
        {
          id,
          name: data.name || '',
          industry: data.industry || '',
          created_at: new Date().toISOString(),
        }
      );
      return true;
    } catch (error) {
      console.error('Neo4j createCustomerNode error:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  async createLeadNode(id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.driver) {
      return false;
    }

    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (l:Lead {id: $id, title: $title, phone: $phone, status: $status, created_at: $created_at})`,
        {
          id,
          title: data.title || '',
          phone: data.phone || '',
          status: data.status || 'new',
          created_at: new Date().toISOString(),
        }
      );
      return true;
    } catch (error) {
      console.error('Neo4j createLeadNode error:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  async createOpportunityNode(id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.driver) {
      return false;
    }

    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (o:Opportunity {id: $id, title: $title, amount: $amount, stage: $stage, created_at: $created_at})`,
        {
          id,
          title: data.title || '',
          amount: data.amount || 0,
          stage: data.stage || 'qualification',
          created_at: new Date().toISOString(),
        }
      );
      return true;
    } catch (error) {
      console.error('Neo4j createOpportunityNode error:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  async createQuoteNode(id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.driver) {
      return false;
    }

    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (q:Quote {id: $id, amount: $amount, status: $status, created_at: $created_at})`,
        {
          id,
          amount: data.amount || 0,
          status: data.status || 'draft',
          created_at: new Date().toISOString(),
        }
      );
      return true;
    } catch (error) {
      console.error('Neo4j createQuoteNode error:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  async createContactNode(id: string, data: any): Promise<boolean> {
    if (!this.isOnline() || !this.driver) {
      return false;
    }

    const session = this.driver.session();
    try {
      await session.run(
        `CREATE (c:Contact {id: $id, name: $name, phone: $phone, email: $email, created_at: $created_at})`,
        {
          id,
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          created_at: new Date().toISOString(),
        }
      );
      return true;
    } catch (error) {
      console.error('Neo4j createContactNode error:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  // 创建关系
  async createRelationship(fromId: string, fromLabel: string, toId: string, toLabel: string, relType: string): Promise<boolean> {
    if (!this.isOnline() || !this.driver) {
      return false;
    }

    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (a:${fromLabel} {id: $fromId}), (b:${toLabel} {id: $toId})
         CREATE (a)-[r:${relType} {created_at: $created_at}]->(b)`,
        {
          fromId,
          toId,
          created_at: new Date().toISOString(),
        }
      );
      return true;
    } catch (error) {
      console.error('Neo4j createRelationship error:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  // 图查询：获取完整销售链路
  async getFullSalesPath(opportunityId: string): Promise<any> {
    if (!this.isOnline() || !this.driver) {
      return null;
    }

    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH path = (o:Opportunity {id: $opportunityId})<-[:CONVERTED_TO*0..]-(l:Lead)-[:BELONGS_TO_CUSTOMER]->(c:Customer)
         RETURN path`,
        { opportunityId }
      );

      return result.records.map(record => record.get('path'));
    } catch (error) {
      console.error('Neo4j getFullSalesPath error:', error);
      return null;
    } finally {
      await session.close();
    }
  }
}

// 单例实例
export const neo4jClient = new Neo4jClient();
