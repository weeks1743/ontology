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
  const objectsDoc = rawObjects.map((o) => ({
    code: o['code'],
    name: o['name'],
    description: o['description'] || '',
    lifecycle: parseJson<string[]>(o['lifecycle'], []),
    attributes: parseJson<unknown[]>(o['attributes'], []),
    relations_detail: parseJson<unknown[]>(o['relations_detail'], []),
  }));

  // ── behaviors.yaml ───────────────────────────────────────────────────────────
  const behaviorsDoc = rawBehaviors.map((b) => ({
    code: b['code'],
    name: b['name'],
    description: b['description'] || '',
    owner_object: b['owner_object'],
    trigger_type: b['trigger_type'],
    required_inputs: parseJson<string[]>(b['required_inputs'], []),
    referenced_rules: parseJson<string[]>(b['referenced_rules'], []),
    emits_events: parseJson<string[]>(b['emits_events'], []),
    writeback_targets: parseJson<string[]>(b['writeback_targets'], []),
  }));

  // ── rules.yaml ───────────────────────────────────────────────────────────────
  const rulesDoc = rawRules.map((r) => ({
    code: r['code'],
    name: r['name'],
    description: r['description'] || '',
    type: r['type'],
    applicable_objects: parseJson<string[]>(r['applicable_objects'], []),
    applicable_behaviors: parseJson<string[]>(r['applicable_behaviors'], []),
    expression: r['expression'] || '',
    failure_message: r['failure_message'] || '',
    severity: r['severity'],
    escalation_target: r['escalation_target'] || '',
  }));

  // ── events.yaml ──────────────────────────────────────────────────────────────
  const eventsDoc = rawEvents.map((e) => ({
    code: e['code'],
    name: e['name'],
    description: e['description'] || '',
    producer_object: e['producer_object'],
    producer_behavior: e['producer_behavior'],
    subscribers: parseJson<string[]>(e['subscribers'], []),
    impacted_objects: parseJson<string[]>(e['impacted_objects'], []),
  }));

  // ── scenarios.yaml ───────────────────────────────────────────────────────────
  const scenariosDoc = rawScenarios.map((s) => ({
    code: s['code'],
    name: s['name'],
    description: s['description'] || '',
    business_goal: s['business_goal'] || '',
    involved_objects: parseJson<string[]>(s['involved_objects'], []),
    steps: parseJson<unknown[]>(s['steps'], []),
    success_criteria: parseJson<string[]>(s['success_criteria'], []),
  }));

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
