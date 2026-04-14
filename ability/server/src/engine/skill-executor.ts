// 技能执行引擎（元驱动重构版）
// 从 manifest.json 读取配置，通过 write_plan_executor 执行三库写入

import { nanoid } from 'nanoid';
import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db.js';
import { ruleValidator } from './rule-validator.js';
import { executeExternalSkill } from './external-skills.js';
import { writePlanExecutor } from './write-plan-executor.js';
import { ExecutionResult } from '../types.js';
import { BehaviorManifest, ScenarioManifest } from '../types/manifest.js';
import { analyzeVisitRecord, createOpportunity, createVisitRecord, generateOperatingAdvice } from './operating-advice.js';
import { eventBus } from './event-bus.js';

export class RuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleViolationError';
  }
}

export class SkillExecutor {
  async execute(skillId: string, params: any): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Hardcoded behaviors (not in DB skills table)
      if (skillId.startsWith('hardcoded.')) {
        return await this.executeHardcoded(skillId, params, startTime);
      }

      // External skills route
      if (skillId.startsWith('ext.')) {
        return await this.executeExternal(skillId, params, startTime);
      }

      // Ontology skills: look up manifest from DB path
      const skillRow = db.prepare(
        `SELECT path, skill_type, name FROM skills WHERE id=?`
      ).get(skillId) as any;

      if (skillRow?.path) {
        // New manifest-driven skill
        return await this.executeFromManifest(skillRow, params, startTime);
      }

      // Fallback: unknown skill
      throw new Error(`Unknown skill: ${skillId}`);
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async executeHardcoded(skillId: string, params: any, startTime: number): Promise<ExecutionResult> {
    const chainId = params?.chain_id || nanoid(10);
    const ontologyId = params?.ontology_id || 'crm';
    const handlers: Record<string, (p: any) => Promise<any>> = {
      'hardcoded.visit_record.create_from_markdown': (p) => createVisitRecord(p, ontologyId),
      'hardcoded.visit_record.analyze': (p) => analyzeVisitRecord(p, ontologyId),
      'hardcoded.customer.generate_operating_advice': (p) => generateOperatingAdvice(p, ontologyId),
    };

    const handler = handlers[skillId];
    if (!handler) {
      throw new Error(`Unknown hardcoded skill: ${skillId}`);
    }

    const data = await handler(params);

    // Emit events to continue the chain (same as executeCustomBehavior)
    if (skillId === 'hardcoded.visit_record.create_from_markdown' && data?.visit_record_id) {
      eventBus.emitEvent('visit_record.created', {
        visit_record_id: data.visit_record_id,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
      }, skillId, { chainId, depth: 0, ontologyId }).catch(e => console.error('[skill-executor] event emit error:', e));
    }

    if (skillId === 'hardcoded.visit_record.analyze' && data?.visit_record_id) {
      try {
        const { mongoClient } = await import('../database/index.js');
        const visitCollection = `${ontologyId}_visit_records`;
        const visitRecord = await mongoClient.findOne(visitCollection, { id: data.visit_record_id });
        if (visitRecord) {
          eventBus.emitEvent('visit_record.analyzed', {
            visit_record_id: data.visit_record_id,
            customer_id: visitRecord.customer_id,
            visit_record_ids: [data.visit_record_id],
          }, skillId, { chainId, depth: 0, ontologyId }).catch(e => console.error('[skill-executor] event emit error:', e));
        }
      } catch (e) {
        console.warn('[skill-executor] Failed to emit visit_record.analyzed:', (e as Error).message);
      }
    }

    return {
      success: true,
      data: { ...data, chain_id: chainId },
      mongodb_status: 'ok',
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  private async executeExternal(skillId: string, params: any, startTime: number): Promise<ExecutionResult> {
    try {
      const result = await executeExternalSkill(skillId, params);
      return {
        success: result.success || false,
        data: result,
        error: result.error,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async executeFromManifest(
    skillRow: { path: string; skill_type: string; name: string },
    params: any,
    startTime: number
  ): Promise<ExecutionResult> {
    const manifestPath = join(skillRow.path, 'manifest.json');

    let manifest: BehaviorManifest | ScenarioManifest;
    try {
      const raw = readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
    } catch {
      throw new Error(`Cannot read manifest at ${manifestPath}`);
    }

    if (manifest.skill_type === 'behavior') {
      return await this.executeBehaviorSkill(manifest as BehaviorManifest, params, startTime);
    } else if (manifest.skill_type === 'scenario') {
      return await this.executeScenarioSkill(manifest as ScenarioManifest, params, startTime);
    } else {
      throw new Error(`Unknown skill_type: ${(manifest as any).skill_type}`);
    }
  }

  // 11-step behavior skill execution
  private async executeBehaviorSkill(
    manifest: BehaviorManifest,
    params: any,
    startTime: number
  ): Promise<ExecutionResult> {
    if (manifest.behavior_code === 'VisitRecord.CreateFromMarkdown') {
      return this.executeCustomBehavior(manifest, params, startTime, () => createVisitRecord(params, manifest.ontology_id));
    }

    if (manifest.behavior_code === 'VisitRecord.Analyze') {
      return this.executeCustomBehavior(manifest, params, startTime, () => analyzeVisitRecord(params, manifest.ontology_id));
    }

    if (manifest.behavior_code === 'Customer.GenerateOperatingAdvice') {
      return this.executeCustomBehavior(manifest, params, startTime, () => generateOperatingAdvice(params, manifest.ontology_id));
    }

    if (manifest.behavior_code === 'Opportunity.Create') {
      return this.executeCustomBehavior(manifest, params, startTime, () => createOpportunity(params, manifest.ontology_id));
    }

    const context: Record<string, any> = { input: params, reads: {}, result: {} };

    // Step 1: normalize_input — check required fields
    const requiredFields = manifest.input_schema
      .filter(f => f.required)
      .map(f => f.name);

    const inputValidation = ruleValidator.validateRequiredFields(params, requiredFields);
    if (!inputValidation.passed) {
      return {
        success: false,
        error: inputValidation.failedRules.map(r => r.message).join('; '),
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    // Step 2: read_context — load existing entities for update/convert operations
    // (skipping DB reads in this implementation; data is passed via params)

    // Step 3: object_preconditions — check state conditions
    // (skipped for now; preconditions are defined but not evaluated without DB reads)

    // Step 4: rule_bindings — evaluate each rule
    for (const rb of manifest.rule_bindings) {
      try {
        const passed = ruleValidator.evaluateExpression(rb.expression, params);
        if (!passed) {
          return {
            success: false,
            error: rb.failure_message_zh,
            mongodb_status: 'skipped',
            neo4j_status: 'skipped',
            chroma_status: 'skipped',
            duration_ms: Date.now() - startTime,
          };
        }
      } catch (err) {
        // If expression evaluation fails, apply structured evaluation
        const structuredPassed = ruleValidator.evaluateStructuredExpression(rb.expression, params);
        if (!structuredPassed) {
          return {
            success: false,
            error: rb.failure_message_zh,
            mongodb_status: 'skipped',
            neo4j_status: 'skipped',
            chroma_status: 'skipped',
            duration_ms: Date.now() - startTime,
          };
        }
      }
    }

    // Steps 6-8: write_plan_executor.executeWritePlan()
    const writeResult = await writePlanExecutor.executeWritePlan(manifest.write_plan, context);

    // Step 9: emit_events (real event bus dispatch)
    const chainId = nanoid(10);
    const emittedEvents: string[] = [];
    for (const eb of manifest.event_bindings) {
      emittedEvents.push(eb.event_code);
      eventBus.emitEvent(eb.event_code, context.input || params, manifest.full_id, { chainId, depth: 0, ontologyId: manifest.ontology_id }).catch(e => console.error('[skill-executor] event emit error:', e));
    }

    // Step 10: render_output
    const outputMessage = manifest.success_template_zh
      .replace('{{summary}}', JSON.stringify(writeResult.result_context));

    // Step 11: audit_log
    const logId = nanoid();
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO execution_logs
          (id, skill_id, skill_name, input_params, output_result,
           status, error_message, mongodb_status, neo4j_status, chroma_status, duration_ms, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        logId,
        manifest.full_id,
        manifest.behavior_name_zh,
        JSON.stringify(params),
        JSON.stringify({ message: outputMessage, result_context: writeResult.result_context, emitted_events: emittedEvents }),
        writeResult.errors.length === 0 ? 'success' : 'partial',
        writeResult.errors.length > 0 ? writeResult.errors.join('; ') : null,
        writeResult.mongodb_status,
        writeResult.neo4j_status,
        writeResult.chroma_status,
        Date.now() - startTime,
        now
      );
    } catch (logErr) {
      console.error('Failed to write execution log:', logErr);
    }

    return {
      success: true,
      data: {
        message: outputMessage,
        result: writeResult.result_context,
        emitted_events: emittedEvents,
        chain_id: chainId,
      },
      mongodb_status: writeResult.mongodb_status,
      neo4j_status: writeResult.neo4j_status,
      chroma_status: writeResult.chroma_status,
      duration_ms: Date.now() - startTime,
    };
  }

  private async executeCustomBehavior(
    manifest: BehaviorManifest,
    params: any,
    startTime: number,
    handler: () => Promise<any>
  ): Promise<ExecutionResult> {
    // Reuse chain_id from event bus payload, or generate new one for direct invocations
    const chainId = params?.chain_id || nanoid(10);
    try {
      const data = await handler();
      await this.writeExecutionLog(
        manifest.full_id,
        manifest.behavior_name_zh,
        params,
        data,
        'success',
        null,
        Date.now() - startTime
      );

      // Emit events for CRM custom behaviors
      if (manifest.behavior_code === 'VisitRecord.CreateFromMarkdown' && data?.visit_record_id) {
        eventBus.emitEvent('visit_record.created', {
          visit_record_id: data.visit_record_id,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
        }, manifest.full_id, { chainId, depth: 0, ontologyId: manifest.ontology_id }).catch(e => console.error('[skill-executor] event emit error:', e));
      }

      if (manifest.behavior_code === 'VisitRecord.Analyze' && data?.visit_record_id) {
        // Load customer_id from the visit record
        try {
          const { mongoClient } = await import('../database/index.js');
          const visitCollection = `${manifest.ontology_id}_visit_records`;
          const visitRecord = await mongoClient.findOne(visitCollection, { id: data.visit_record_id });
          if (visitRecord) {
            eventBus.emitEvent('visit_record.analyzed', {
              visit_record_id: data.visit_record_id,
              customer_id: visitRecord.customer_id,
              visit_record_ids: [data.visit_record_id],
            }, manifest.full_id, { chainId, depth: 0, ontologyId: manifest.ontology_id }).catch(e => console.error('[skill-executor] event emit error:', e));
          }
        } catch {}
      }

      return {
        success: true,
        data: { ...data, chain_id: chainId },
        mongodb_status: 'ok',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      await this.writeExecutionLog(
        manifest.full_id,
        manifest.behavior_name_zh,
        params,
        null,
        'error',
        (error as Error).message,
        Date.now() - startTime
      );

      return {
        success: false,
        error: (error as Error).message,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async writeExecutionLog(
    skillId: string,
    skillName: string,
    inputParams: any,
    outputResult: any,
    status: 'success' | 'error' | 'partial',
    errorMessage: string | null,
    durationMs: number
  ) {
    const logId = nanoid();
    const now = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO execution_logs
          (id, skill_id, skill_name, input_params, output_result,
           status, error_message, mongodb_status, neo4j_status, chroma_status, duration_ms, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        logId,
        skillId,
        skillName,
        JSON.stringify(inputParams),
        JSON.stringify(outputResult || {}),
        status,
        errorMessage,
        status === 'success' ? 'ok' : 'skipped',
        'skipped',
        'skipped',
        durationMs,
        now
      );
    } catch (logErr) {
      console.error('Failed to write execution log:', logErr);
    }
  }

  // 8-step scenario skill execution
  private async executeScenarioSkill(
    manifest: ScenarioManifest,
    params: any,
    startTime: number
  ): Promise<ExecutionResult> {
    // Step 1: check_entry_conditions (pass for now)

    const stepResults: any[] = [];
    let allSuccess = true;

    // Steps 2-7: execute each behavior skill in sequence
    for (const step of manifest.steps) {
      if (!step.behavior_code) continue;

      const behaviorSkillRow = db.prepare(
        `SELECT id, path, skill_type, name FROM skills WHERE id=?`
      ).get(step.behavior_skill_full_id) as any;

      if (!behaviorSkillRow) {
        console.warn(`[scenario] Step ${step.step}: skill not found: ${step.behavior_skill_full_id}`);
        stepResults.push({ step: step.step, success: false, error: 'Skill not found' });
        if (manifest.failure_strategy === 'abort') {
          allSuccess = false;
          break;
        }
        continue;
      }

      try {
        const stepResult = await this.executeFromManifest(behaviorSkillRow, params, Date.now());
        stepResults.push({ step: step.step, success: stepResult.success, data: stepResult.data, error: stepResult.error });

        if (!stepResult.success && manifest.failure_strategy === 'abort') {
          allSuccess = false;
          break;
        }
      } catch (err) {
        stepResults.push({ step: step.step, success: false, error: (err as Error).message });
        if (manifest.failure_strategy === 'abort') {
          allSuccess = false;
          break;
        }
      }
    }

    // Step 8: render_summary
    const summary = `${manifest.scenario_name_zh} 场景完成，共执行 ${stepResults.length} 步`;

    return {
      success: allSuccess,
      data: {
        scenario: manifest.scenario_code,
        steps_executed: stepResults.length,
        step_results: stepResults,
        summary,
      },
      mongodb_status: 'ok',
      neo4j_status: 'ok',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }
}

export const skillExecutor = new SkillExecutor();
