// write-plan-executor.ts
// 按 manifest write_plan DSL 执行三库写入

import { nanoid } from 'nanoid';
import { mongoClient, neo4jClient, chromaClient } from '../database/index.js';
import { WritePlan, MongoWriteOp, Neo4jWriteOp, ChromaWriteOp } from '../types/manifest.js';

export interface WritePlanResult {
  mongodb_status: 'ok' | 'error' | 'skipped';
  neo4j_status: 'ok' | 'error' | 'skipped';
  chroma_status: 'ok' | 'error' | 'skipped';
  result_context: Record<string, any>;
  errors: string[];
}

export class WritePlanExecutor {
  /**
   * 递归替换模板变量 $input.xxx, $reads.xxx, $result.xxx, $steps.N.output.xxx
   */
  interpolate(template: any, context: Record<string, any>): any {
    if (typeof template === 'string') {
      // Simple single reference: "$input.foo" → context.input.foo
      if (template.startsWith('$')) {
        const path = template.slice(1).split('.');
        let val: any = context;
        for (const key of path) {
          val = val?.[key];
          if (val === undefined) return template; // keep original if not found
        }
        return val;
      }
      // String interpolation: "prefix_{{$result.id}}_suffix"
      return template.replace(/\{\{([^}]+)\}\}/g, (_match, expr) => {
        const path = expr.trim().replace(/^\$/, '').split('.');
        let val: any = context;
        for (const key of path) val = val?.[key];
        return val !== undefined ? String(val) : expr;
      });
    }

    if (Array.isArray(template)) {
      return template.map(item => this.interpolate(item, context));
    }

    if (template !== null && typeof template === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.interpolate(value, context);
      }
      return result;
    }

    return template;
  }

  async executeWritePlan(
    writePlan: WritePlan,
    context: Record<string, any>
  ): Promise<WritePlanResult> {
    const resultCtx = { ...context, result: { ...context.result } };
    const errors: string[] = [];

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let neo4jStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let chromaStatus: 'ok' | 'error' | 'skipped' = 'skipped';

    // 1. MongoDB (required)
    if (writePlan.mongodb.required && writePlan.mongodb.ops.length > 0) {
      if (mongoClient.isOnline()) {
        try {
          for (const op of writePlan.mongodb.ops) {
            await this.executeMongoOp(op, resultCtx);
          }
          mongoStatus = 'ok';
        } catch (err) {
          errors.push(`MongoDB: ${(err as Error).message}`);
          mongoStatus = 'error';
        }
      } else {
        mongoStatus = 'skipped';
      }
    }

    // 2. Neo4j (required)
    if (writePlan.neo4j.required && writePlan.neo4j.ops.length > 0) {
      if (neo4jClient.isOnline()) {
        try {
          for (const op of writePlan.neo4j.ops) {
            await this.executeNeo4jOp(op, resultCtx);
          }
          neo4jStatus = 'ok';
        } catch (err) {
          errors.push(`Neo4j: ${(err as Error).message}`);
          neo4jStatus = 'error';
        }
      } else {
        neo4jStatus = 'skipped';
      }
    }

    // 3. Chroma (optional - failure doesn't block)
    if (writePlan.chroma.ops.length > 0) {
      if (chromaClient.isOnline()) {
        try {
          for (const op of writePlan.chroma.ops) {
            await this.executeChromaOp(op, resultCtx);
          }
          chromaStatus = 'ok';
        } catch (err) {
          errors.push(`Chroma (non-blocking): ${(err as Error).message}`);
          chromaStatus = 'error'; // degraded, not blocking
        }
      } else {
        chromaStatus = 'skipped';
      }
    }

    return {
      mongodb_status: mongoStatus,
      neo4j_status: neo4jStatus,
      chroma_status: chromaStatus,
      result_context: resultCtx.result,
      errors,
    };
  }

  private async executeMongoOp(op: MongoWriteOp, ctx: Record<string, any>): Promise<void> {
    const collection = this.interpolate(op.collection, ctx) as string;

    if (op.op === 'insert') {
      const generatedId = nanoid();
      ctx.result.generated_id = generatedId;

      const document = this.interpolate(op.document || {}, ctx);
      if (!document.id) document.id = generatedId;

      await mongoClient.insertDocument(collection, document);

      if (op.alias) {
        ctx.result[op.alias] = document.id || generatedId;
      }
    } else if (op.op === 'update') {
      const filter = this.interpolate(op.filter || {}, ctx);
      const update = this.interpolate(op.update || {}, ctx);
      await mongoClient.updateDocument(collection, filter.id || Object.values(filter)[0], update);
    } else if (op.op === 'upsert') {
      const filter = this.interpolate(op.filter || {}, ctx);
      const document = this.interpolate(op.document || {}, ctx);
      await mongoClient.insertDocument(collection, { ...filter, ...document });
    }
  }

  private async executeNeo4jOp(op: Neo4jWriteOp, ctx: Record<string, any>): Promise<void> {
    if (op.op === 'upsert_node') {
      const label = this.interpolate(op.label, ctx) as string;
      const props = this.interpolate(op.properties || {}, ctx);
      const nodeId = props.id || nanoid();

      await neo4jClient.upsertNode(label, nodeId, props);

      if (op.alias) {
        ctx.result[op.alias] = nodeId;
      }
    } else if (op.op === 'upsert_edge') {
      const fromLabel = this.interpolate(op.from_label, ctx) as string;
      const fromId = this.interpolate(op.from_id, ctx) as string;
      const toLabel = this.interpolate(op.to_label, ctx) as string;
      const toId = this.interpolate(op.to_id, ctx) as string;
      const relationship = this.interpolate(op.relationship, ctx) as string;

      if (fromId && toId) {
        await neo4jClient.createRelationship(fromId, fromLabel, toId, toLabel, relationship);
      }
    } else if (op.op === 'update_node') {
      const label = this.interpolate(op.label, ctx) as string;
      const props = this.interpolate(op.properties || {}, ctx);
      if (props.id) {
        await neo4jClient.upsertNode(label, props.id, props);
      }
    }
  }

  private async executeChromaOp(op: ChromaWriteOp, ctx: Record<string, any>): Promise<void> {
    const collection = this.interpolate(op.collection, ctx) as string;
    const id = this.interpolate(op.id, ctx) as string;

    if (op.op === 'upsert' && op.document) {
      const document = this.interpolate(op.document, ctx) as string;
      const metadata = this.interpolate(op.metadata || {}, ctx);
      await chromaClient.upsertDocument(collection, id, document, metadata);
    }
  }
}

export const writePlanExecutor = new WritePlanExecutor();
