import yaml from 'js-yaml';
import { db, parseRow } from './db';
import { OntologyShell, YamlBundle, ValidationIssue } from './types';

const CRM_PROFILE = {
  domain: 'crm',
  version: '0.1.0-draft',
  positioning: 'CRM领域本体，管理从线索到回款的客户关系全生命周期',
  design_principles: [
    '以客户为中心的全生命周期管理',
    '数据驱动的销售过程优化',
    '规则引擎驱动的业务约束与合规',
    '事件驱动的跨对象协同',
  ],
  personas: ['销售代表', '销售经理', '客户服务团队', '运营管理员'],
  scope: {
    included: ['线索管理', '机会管理', '报价管理', '合同管理', '客户管理', '活动管理'],
    excluded: ['财务结算', '产品研发', 'ERP集成', '供应链管理'],
  },
};

function parseJson<T>(val: unknown, fallback: T): T {
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return (val as T) ?? fallback;
}

export function assembleYaml(ontologyId: number): YamlBundle {
  const ontology = db.prepare(
    `SELECT * FROM ontologies WHERE id=?`
  ).get(ontologyId) as OntologyShell | undefined;

  if (!ontology) throw new Error(`Ontology ${ontologyId} not found`);

  const rawObjects = db.prepare(
    `SELECT * FROM ontology_objects WHERE ontology_id=? ORDER BY code`
  ).all(ontologyId) as Record<string, unknown>[];

  const rawBehaviors = db.prepare(
    `SELECT * FROM ontology_behaviors WHERE ontology_id=? ORDER BY code`
  ).all(ontologyId) as Record<string, unknown>[];

  const rawRules = db.prepare(
    `SELECT * FROM ontology_rules WHERE ontology_id=? ORDER BY code`
  ).all(ontologyId) as Record<string, unknown>[];

  const rawEvents = db.prepare(
    `SELECT * FROM ontology_events WHERE ontology_id=? ORDER BY code`
  ).all(ontologyId) as Record<string, unknown>[];

  const rawScenarios = db.prepare(
    `SELECT * FROM ontology_scenarios WHERE ontology_id=? ORDER BY code`
  ).all(ontologyId) as Record<string, unknown>[];

  // ── model.yaml ──────────────────────────────────────────────────────────────
  const scenarioNames = rawScenarios.map((s) => s['name'] as string);
  const modelDoc = {
    ...CRM_PROFILE,
    ontology_code: ontology.ontology_code,
    display_name: ontology.display_name,
    description: ontology.description || '',
    primary_scenarios: scenarioNames,
    generated_at: new Date().toISOString(),
  };

  // ── objects.yaml ─────────────────────────────────────────────────────────────
  const objectsDoc = rawObjects.map((o) => {
    const attributes = parseJson<any[]>(o['attributes'], []);
    const relations = parseJson<any[]>(o['relations_detail'], []);
    const lifecycleEnhanced = parseJson<any[]>(o['lifecycle_enhanced'], null);
    const aliases = parseJson<string[]>(o['aliases'], []);
    const nlExamples = parseJson<string[]>(o['nl_examples'], []);
    const negativeExamples = parseJson<string[]>(o['negative_examples'], []);

    const result: any = {
      code: o['code'],
      name: o['name'],
      display_name: o['name'], // 中文显示名称
      description: o['description'] || '',
      // Use enhanced lifecycle if available, otherwise fall back to simple array
      lifecycle: lifecycleEnhanced || parseJson<string[]>(o['lifecycle'], []),
      attributes: attributes.map((attr: any) => ({
        name: attr.name,
        display_name: attr.displayName || attr.name, // 属性中文名称
        type: attr.type,
        description: attr.description || '',
        required: attr.required || false,
        ...(attr.enum_values && { enum_values: attr.enum_values }),
        ...(attr.default_value && { default_value: attr.default_value }),
        ...(attr.examples && { examples: attr.examples }),
        ...(attr.aliases && { aliases: attr.aliases }),
        ...(attr.validation && { validation: attr.validation }),
      })),
      relations: relations.map((rel: any) => ({
        name: rel.name,
        display_name: rel.displayName || rel.name, // 关系中文名称
        target_object: rel.target_object,
        type: rel.type,
        description: rel.description || '',
        ...(rel.cardinality && { cardinality: rel.cardinality }),
        ...(rel.ownership && { ownership: rel.ownership }),
        ...(rel.cascade_delete !== undefined && { cascade_delete: rel.cascade_delete }),
        ...(rel.inverse_relation && { inverse_relation: rel.inverse_relation }),
      })),
    };

    // Add enhanced fields if present
    if (aliases.length > 0) result.aliases = aliases;
    if (nlExamples.length > 0) result.nl_examples = nlExamples;
    if (negativeExamples.length > 0) result.negative_examples = negativeExamples;
    if (o['disambiguation_notes']) result.disambiguation_notes = o['disambiguation_notes'];

    return result;
  });

  // ── behaviors.yaml ───────────────────────────────────────────────────────────
  const behaviorsDoc = rawBehaviors.map((b) => {
    const ownerObj = rawObjects.find((o) => o['code'] === b['owner_object']);
    const triggerTypeLabels: Record<string, string> = {
      USER_ACTION: '用户操作',
      AI_OR_USER_ACTION: 'AI或用户操作',
      SYSTEM_ACTION: '系统操作',
      SYSTEM_OR_MANAGER_ACTION: '系统或管理员操作',
    };

    const aliases = parseJson<string[]>(b['aliases'], []);
    const nlExamples = parseJson<string[]>(b['nl_examples'], []);
    const inputsSchema = parseJson<any[]>(b['inputs_schema'], null);
    const preconditions = parseJson<any[]>(b['preconditions'], []);
    const resultSchema = parseJson<any[]>(b['result_schema'], null);
    const postconditions = parseJson<any[]>(b['postconditions'], []);
    const sideEffects = parseJson<any[]>(b['side_effects'], []);

    const result: any = {
      code: b['code'],
      name: b['name'],
      display_name: b['name'], // 中文显示名称
      description: b['description'] || '',
      owner_object: b['owner_object'],
      owner_object_name: ownerObj ? ownerObj['name'] : b['owner_object'], // 归属对象中文名
      trigger_type: b['trigger_type'],
      trigger_type_label: triggerTypeLabels[b['trigger_type'] as string] || b['trigger_type'], // 触发类型中文
      // Use inputs_schema if available, otherwise fall back to required_inputs
      ...(inputsSchema ? { inputs: inputsSchema } : { required_inputs: parseJson<string[]>(b['required_inputs'], []) }),
      referenced_rules: parseJson<string[]>(b['referenced_rules'], []),
      emits_events: parseJson<string[]>(b['emits_events'], []),
      writeback_targets: parseJson<string[]>(b['writeback_targets'], []),
    };

    // Add enhanced fields if present
    if (aliases.length > 0) result.aliases = aliases;
    if (nlExamples.length > 0) result.nl_examples = nlExamples;
    if (preconditions.length > 0) result.preconditions = preconditions;
    if (resultSchema) result.result_schema = resultSchema;
    if (postconditions.length > 0) result.postconditions = postconditions;
    if (sideEffects.length > 0) result.side_effects = sideEffects;

    return result;
  });

  // ── rules.yaml ───────────────────────────────────────────────────────────────
  const rulesDoc = rawRules.map((r) => {
    const severityLabels: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '严重',
    };

    const inputContext = parseJson<string[]>(r['input_context'], []);
    const expressionStructured = parseJson<any>(r['expression_structured'], null);
    const nextActions = parseJson<string[]>(r['next_actions'], []);

    const result: any = {
      code: r['code'],
      name: r['name'],
      display_name: r['name'], // 中文显示名称
      description: r['description'] || '',
      type: r['type'],
      applicable_objects: parseJson<string[]>(r['applicable_objects'], []),
      applicable_behaviors: parseJson<string[]>(r['applicable_behaviors'], []),
      // Use structured expression if available, otherwise fall back to string
      expression: expressionStructured || r['expression'] || '',
      failure_message: r['failure_message'] || '',
      severity: r['severity'],
      severity_label: severityLabels[r['severity'] as string] || r['severity'], // 严重度中文
      escalation_target: r['escalation_target'] || '',
    };

    // Add enhanced fields if present
    if (inputContext.length > 0) result.input_context = inputContext;
    if (nextActions.length > 0) result.next_actions = nextActions;
    if (r['failure_message_template']) result.failure_message_template = r['failure_message_template'];
    if (r['constraint_type']) result.constraint_type = r['constraint_type'];

    return result;
  });

  // ── events.yaml ──────────────────────────────────────────────────────────────
  const eventsDoc = rawEvents.map((e) => {
    const producerObj = rawObjects.find((o) => o['code'] === e['producer_object']);
    const producerBeh = rawBehaviors.find((b) => b['code'] === e['producer_behavior']);

    const payloadSchema = parseJson<any[]>(e['payload_schema'], []);
    const propagationConditions = parseJson<any[]>(e['propagation_conditions'], []);
    const triggeredBehaviors = parseJson<string[]>(e['triggered_behaviors'], []);
    const tracePolicy = parseJson<any>(e['trace_policy'], null);
    const causality = parseJson<any>(e['causality'], null);

    const result: any = {
      code: e['code'],
      name: e['name'],
      display_name: e['name'], // 中文显示名称
      description: e['description'] || '',
      producer_object: e['producer_object'],
      producer_object_name: producerObj ? producerObj['name'] : e['producer_object'], // 产生对象中文名
      producer_behavior: e['producer_behavior'],
      producer_behavior_name: producerBeh ? producerBeh['name'] : e['producer_behavior'], // 产生行为中文名
      subscribers: parseJson<string[]>(e['subscribers'], []),
      impacted_objects: parseJson<string[]>(e['impacted_objects'], []),
    };

    // Add enhanced fields if present
    if (payloadSchema.length > 0) result.payload_schema = payloadSchema;
    if (propagationConditions.length > 0) result.propagation_conditions = propagationConditions;
    if (triggeredBehaviors.length > 0) result.triggered_behaviors = triggeredBehaviors;
    if (tracePolicy) result.trace_policy = tracePolicy;
    if (causality) result.causality = causality;

    return result;
  });

  // ── scenarios.yaml ───────────────────────────────────────────────────────────
  const scenariosDoc = rawScenarios.map((s) => {
    const steps = parseJson<any[]>(s['steps'], []);
    const startConditions = parseJson<string[]>(s['start_conditions'], []);
    const decisionPointsEnhanced = parseJson<any[]>(s['decision_points_enhanced'], null);
    const rollbackCompensation = parseJson<any[]>(s['rollback_compensation'], []);
    const observabilityMetrics = parseJson<string[]>(s['observability_metrics'], []);

    // 为每个步骤添加中文名称和增强字段
    const enrichedSteps = steps.map((step: any) => {
      const enriched: any = { step: step.step };

      // Add type if present
      if (step.type) enriched.type = step.type;

      if (step.behavior) {
        const beh = rawBehaviors.find((b) => b['code'] === step.behavior);
        enriched.behavior = step.behavior;
        enriched.behavior_name = beh ? beh['name'] : step.behavior;
      }

      if (step.event) {
        const evt = rawEvents.find((e) => e['code'] === step.event);
        enriched.event = step.event;
        enriched.event_name = evt ? evt['name'] : step.event;
      }

      if (step.decision_gate) {
        enriched.decision_gate = step.decision_gate;
      }

      // Add enhanced fields if present
      if (step.condition) enriched.condition = step.condition;
      if (step.if_true) enriched.if_true = step.if_true;
      if (step.if_false) enriched.if_false = step.if_false;
      if (step.on_success) enriched.on_success = step.on_success;
      if (step.on_failure) enriched.on_failure = step.on_failure;
      if (step.rollback_to !== undefined) enriched.rollback_to = step.rollback_to;

      return enriched;
    });

    const result: any = {
      code: s['code'],
      name: s['name'],
      display_name: s['name'], // 中文显示名称
      description: s['description'] || '',
      business_goal: s['business_goal'] || '',
      involved_objects: parseJson<string[]>(s['involved_objects'], []),
      steps: enrichedSteps,
      success_criteria: parseJson<string[]>(s['success_criteria'], []),
    };

    // Add enhanced fields if present
    if (startConditions.length > 0) result.start_conditions = startConditions;
    if (decisionPointsEnhanced) result.decision_points = decisionPointsEnhanced;
    if (rollbackCompensation.length > 0) result.rollback_or_compensation = rollbackCompensation;
    if (observabilityMetrics.length > 0) result.observability_metrics = observabilityMetrics;

    return result;
  });

  return {
    model: yaml.dump(modelDoc, { lineWidth: 120 }),
    objects: yaml.dump(objectsDoc, { lineWidth: 120 }),
    behaviors: yaml.dump(behaviorsDoc, { lineWidth: 120 }),
    rules: yaml.dump(rulesDoc, { lineWidth: 120 }),
    events: yaml.dump(eventsDoc, { lineWidth: 120 }),
    scenarios: yaml.dump(scenariosDoc, { lineWidth: 120 }),
    generated_at: new Date().toISOString(),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateOntology(ontologyId: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const objects = db.prepare(
    `SELECT code, name FROM ontology_objects WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string }[];
  const objectCodes = new Set(objects.map((o) => o.code));

  const behaviors = db.prepare(
    `SELECT code, name, owner_object, referenced_rules, emits_events FROM ontology_behaviors WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; owner_object: string; referenced_rules: string; emits_events: string }[];
  const behaviorCodes = new Set(behaviors.map((b) => b.code));

  const rules = db.prepare(
    `SELECT code, name, applicable_objects, applicable_behaviors FROM ontology_rules WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; applicable_objects: string; applicable_behaviors: string }[];
  const ruleCodes = new Set(rules.map((r) => r.code));

  const events = db.prepare(
    `SELECT code, name, producer_object, producer_behavior, subscribers, impacted_objects FROM ontology_events WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; producer_object: string; producer_behavior: string; subscribers: string; impacted_objects: string }[];
  const eventCodes = new Set(events.map((e) => e.code));

  const scenarios = db.prepare(
    `SELECT code, name, involved_objects, steps FROM ontology_scenarios WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; involved_objects: string; steps: string }[];

  // Behaviors validation
  for (const b of behaviors) {
    if (!objectCodes.has(b.owner_object)) {
      issues.push({ level: 'error', entity_type: 'behavior', entity_code: b.code, message: `owner_object '${b.owner_object}' does not exist` });
    }
    const refs: string[] = JSON.parse(b.referenced_rules || '[]');
    for (const r of refs) {
      if (!ruleCodes.has(r)) {
        issues.push({ level: 'error', entity_type: 'behavior', entity_code: b.code, message: `referenced_rules: rule '${r}' not found` });
      }
    }
    const emits: string[] = JSON.parse(b.emits_events || '[]');
    for (const e of emits) {
      if (!eventCodes.has(e)) {
        issues.push({ level: 'error', entity_type: 'behavior', entity_code: b.code, message: `emits_events: event '${e}' not found` });
      }
    }
  }

  // Rules validation
  for (const r of rules) {
    const objs: string[] = JSON.parse(r.applicable_objects || '[]');
    for (const o of objs) {
      if (!objectCodes.has(o)) {
        issues.push({ level: 'error', entity_type: 'rule', entity_code: r.code, message: `applicable_objects: object '${o}' not found` });
      }
    }
    const behs: string[] = JSON.parse(r.applicable_behaviors || '[]');
    for (const b of behs) {
      if (!behaviorCodes.has(b)) {
        issues.push({ level: 'error', entity_type: 'rule', entity_code: r.code, message: `applicable_behaviors: behavior '${b}' not found` });
      }
    }
  }

  // Events validation
  for (const e of events) {
    if (!objectCodes.has(e.producer_object)) {
      issues.push({ level: 'error', entity_type: 'event', entity_code: e.code, message: `producer_object '${e.producer_object}' not found` });
    }
    if (!behaviorCodes.has(e.producer_behavior)) {
      issues.push({ level: 'error', entity_type: 'event', entity_code: e.code, message: `producer_behavior '${e.producer_behavior}' not found` });
    }
    const subs: string[] = JSON.parse(e.subscribers || '[]');
    for (const s of subs) {
      if (!behaviorCodes.has(s)) {
        issues.push({ level: 'error', entity_type: 'event', entity_code: e.code, message: `subscribers: behavior '${s}' not found` });
      }
    }
    const impacted: string[] = JSON.parse(e.impacted_objects || '[]');
    for (const o of impacted) {
      if (!objectCodes.has(o)) {
        issues.push({ level: 'error', entity_type: 'event', entity_code: e.code, message: `impacted_objects: object '${o}' not found` });
      }
    }
    if (subs.length === 0) {
      issues.push({ level: 'warning', entity_type: 'event', entity_code: e.code, message: `event has no subscribers` });
    }
  }

  // Scenarios validation
  for (const s of scenarios) {
    const invObjs: string[] = JSON.parse(s.involved_objects || '[]');
    for (const o of invObjs) {
      if (!objectCodes.has(o)) {
        issues.push({ level: 'error', entity_type: 'scenario', entity_code: s.code, message: `involved_objects: object '${o}' not found` });
      }
    }
    const steps = JSON.parse(s.steps || '[]') as { behavior?: string; event?: string }[];
    if (steps.length === 0) {
      issues.push({ level: 'warning', entity_type: 'scenario', entity_code: s.code, message: `scenario has no steps` });
    }
    for (const step of steps) {
      if (step.behavior && !behaviorCodes.has(step.behavior)) {
        issues.push({ level: 'error', entity_type: 'scenario', entity_code: s.code, message: `step behavior '${step.behavior}' not found` });
      }
      if (step.event && !eventCodes.has(step.event)) {
        issues.push({ level: 'error', entity_type: 'scenario', entity_code: s.code, message: `step event '${step.event}' not found` });
      }
    }
  }

  // Warnings: objects with no behaviors
  for (const o of objects) {
    const hasBeh = behaviors.some((b) => b.owner_object === o.code);
    if (!hasBeh) {
      issues.push({ level: 'warning', entity_type: 'object', entity_code: o.code, message: `object has no behaviors` });
    }
  }

  return issues;
}
