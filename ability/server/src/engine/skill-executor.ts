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

    // Step 9: emit_events (record to execution_logs; no real event bus)
    const emittedEvents = manifest.event_bindings.map(eb => eb.event_code);

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
      },
      mongodb_status: writeResult.mongodb_status,
      neo4j_status: writeResult.neo4j_status,
      chroma_status: writeResult.chroma_status,
      duration_ms: Date.now() - startTime,
    };
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
