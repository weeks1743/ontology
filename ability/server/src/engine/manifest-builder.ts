// manifest-builder.ts
// 从快照动态构建 BehaviorManifest 和 ScenarioManifest

import {
  BehaviorManifest,
  ScenarioManifest,
  InputField,
  RuleBinding,
  EventBinding,
  ReadContext,
  ScenarioStep,
} from '../types/manifest.js';
import { DefinitionSnapshot, SnapshotBehavior, SnapshotScenario } from '../types/snapshot.js';
import { buildWritePlan } from './write-plan-builder.js';

// Convert "Lead.ConvertToOpportunity" -> "lead_convert_to_opportunity"
export function behaviorToSlug(behaviorCode: string): string {
  const [obj, action] = behaviorCode.split('.');
  if (!action) return behaviorCode.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const objPart = obj.toLowerCase();
  const actionPart = action.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  return `${objPart}_${actionPart}`;
}

// Convert "SomeName.WithParts" -> "some_name_with_parts"
export function scenarioToSlug(scenarioCode: string): string {
  return scenarioCode
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

export function buildBehaviorManifest(
  behavior: SnapshotBehavior,
  snapshot: DefinitionSnapshot,
  buildVersion: string,
  ontologyId: string
): BehaviorManifest {
  const slug = behaviorToSlug(behavior.code);
  const fullId = `ont.${ontologyId}.${slug}`;

  const ownerObject = snapshot.objects.find(o => o.code === behavior.owner_object);

  // Build input_schema
  let inputSchema: InputField[];
  if (behavior.inputs_schema && behavior.inputs_schema.length > 0) {
    inputSchema = behavior.inputs_schema.map((f: any) => ({
      name: f.name,
      display_name_zh: f.description || f.name,
      type: f.type || 'string',
      required: f.required ?? false,
      description: f.description,
      enum_values: f.validation?.enum_values || f.enum_values,
      default_value: f.default_value,
    }));
  } else if (ownerObject?.attributes && ownerObject.attributes.length > 0) {
    // Infer from object attributes
    inputSchema = ownerObject.attributes
      .filter((a: any) => a.required)
      .map((a: any) => ({
        name: a.name,
        display_name_zh: a.displayName || a.name,
        type: a.type || 'string',
        required: true,
        description: a.description,
        enum_values: a.enum_values,
        default_value: a.default_value,
      }));
  } else {
    inputSchema = [];
  }

  // Build rule bindings
  const ruleBindings: RuleBinding[] = behavior.referenced_rules
    .map(ruleCode => {
      const rule = snapshot.rules.find(r => r.code === ruleCode);
      if (!rule) return null;
      return {
        rule_code: rule.code,
        rule_name_zh: rule.name,
        expression: rule.expression_structured || rule.expression,
        failure_message_zh: rule.failure_message,
        severity: rule.severity,
      };
    })
    .filter(Boolean) as RuleBinding[];

  // Build event bindings
  const eventBindings: EventBinding[] = behavior.emits_events
    .map(eventCode => {
      const event = snapshot.events.find(e => e.code === eventCode);
      if (!event) return null;
      return {
        event_code: event.code,
        event_name_zh: event.name,
        trigger: 'on_success' as const,
      };
    })
    .filter(Boolean) as EventBinding[];

  // Build reads context (for update/convert operations)
  const reads: ReadContext[] = [];
  const behaviorOp = behavior.code.toLowerCase();
  if (!behaviorOp.includes('create') && ownerObject) {
    const idField = `${behavior.owner_object.toLowerCase()}_id`;
    const hasIdInput = inputSchema.some(f => f.name === idField);
    if (hasIdInput) {
      reads.push({
        alias: `existing_${behavior.owner_object.toLowerCase()}`,
        collection: `crm_${behavior.owner_object.toLowerCase()}s`,
        filter: { id: `$input.${idField}` },
        required: true,
        description_zh: `读取现有 ${behavior.owner_object} 数据`,
      });
    }
  }

  // Build write plan
  const writePlan = buildWritePlan(behavior, ownerObject, ontologyId);

  // Templates
  const successTemplate = `${behavior.name}成功：操作已完成`;
  const failureTemplate = `${behavior.name}失败：{{error_message}}`;

  return {
    skill_id: `ont.${ontologyId}.${slug}`,
    skill_slug: slug,
    full_id: fullId,
    skill_type: 'behavior',
    build_version: buildVersion,
    snapshot_hash: snapshot.snapshot_hash,
    ontology_id: ontologyId,
    behavior_code: behavior.code,
    behavior_name_zh: behavior.name,
    owner_object: behavior.owner_object,
    trigger_type: behavior.trigger_type,
    input_schema: inputSchema,
    result_schema: behavior.result_schema || undefined,
    reads,
    object_preconditions: [],
    rule_bindings: ruleBindings,
    write_plan: writePlan,
    event_bindings: eventBindings,
    success_template_zh: successTemplate,
    failure_template_zh: failureTemplate,
    generated_at: new Date().toISOString(),
  };
}

export function buildScenarioManifest(
  scenario: SnapshotScenario,
  snapshot: DefinitionSnapshot,
  buildVersion: string,
  ontologyId: string
): ScenarioManifest {
  const slug = scenarioToSlug(scenario.code);
  const fullId = `ont.${ontologyId}.scenario_${slug}`;

  const steps: ScenarioStep[] = scenario.steps
    .filter(step => step.behavior)
    .map(step => {
      const behavior = snapshot.behaviors.find(b => b.code === step.behavior);
      const behaviorSlug = behavior ? behaviorToSlug(behavior.code) : step.behavior || '';
      return {
        step: step.step,
        behavior_skill_full_id: `ont.${ontologyId}.${behaviorSlug}`,
        behavior_code: step.behavior || '',
        behavior_name_zh: behavior?.name || step.behavior || '',
        type: step.type,
        condition: step.condition ? JSON.stringify(step.condition) : undefined,
        if_true: step.if_true ? JSON.stringify(step.if_true) : undefined,
        if_false: step.if_false ? JSON.stringify(step.if_false) : undefined,
        on_failure: step.on_failure ? JSON.stringify(step.on_failure) : undefined,
      };
    });

  return {
    skill_id: `ont.${ontologyId}.scenario_${slug}`,
    skill_slug: `scenario_${slug}`,
    full_id: fullId,
    skill_type: 'scenario',
    build_version: buildVersion,
    snapshot_hash: snapshot.snapshot_hash,
    ontology_id: ontologyId,
    scenario_code: scenario.code,
    scenario_name_zh: scenario.name,
    business_goal: scenario.business_goal,
    involved_objects: scenario.involved_objects,
    steps,
    entry_conditions: scenario.start_conditions || [],
    completion_criteria: scenario.success_criteria,
    failure_strategy: 'abort',
    success_summary_template_zh: `场景 ${scenario.name} 完成：{{summary}}`,
    generated_at: new Date().toISOString(),
  };
}
