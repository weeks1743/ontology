import { db } from './db';
import { BlockReference } from './types';

const OBJ_FIELDS = ['lifecycle', 'attributes', 'relations_detail'];
const BEH_FIELDS = ['required_inputs', 'referenced_rules', 'emits_events', 'writeback_targets'];
const RULE_FIELDS = ['applicable_objects', 'applicable_behaviors'];
const EVT_FIELDS = ['subscribers', 'impacted_objects'];
const SCN_FIELDS = ['involved_objects', 'steps', 'success_criteria'];

// ─── Object references check ─────────────────────────────────────────────────

export function checkObjectReferences(ontologyId: number, objectCode: string): BlockReference[] {
  const refs: BlockReference[] = [];

  // behaviors.owner_object
  const behs = db.prepare(
    `SELECT code, name FROM ontology_behaviors WHERE ontology_id=? AND owner_object=?`
  ).all(ontologyId, objectCode) as { code: string; name: string }[];
  for (const b of behs) {
    refs.push({ entity_type: 'behavior', entity_code: b.code, entity_name: b.name, reason: `owner_object` });
  }

  // rules.applicable_objects
  const rules = db.prepare(
    `SELECT code, name, applicable_objects FROM ontology_rules WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; applicable_objects: string }[];
  for (const r of rules) {
    const arr: string[] = JSON.parse(r.applicable_objects || '[]');
    if (arr.includes(objectCode)) {
      refs.push({ entity_type: 'rule', entity_code: r.code, entity_name: r.name, reason: `applicable_objects` });
    }
  }

  // events.producer_object or impacted_objects
  const evts = db.prepare(
    `SELECT code, name, producer_object, impacted_objects FROM ontology_events WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; producer_object: string; impacted_objects: string }[];
  for (const e of evts) {
    if (e.producer_object === objectCode) {
      refs.push({ entity_type: 'event', entity_code: e.code, entity_name: e.name, reason: `producer_object` });
    }
    const impacted: string[] = JSON.parse(e.impacted_objects || '[]');
    if (impacted.includes(objectCode)) {
      refs.push({ entity_type: 'event', entity_code: e.code, entity_name: e.name, reason: `impacted_objects` });
    }
  }

  // scenarios.involved_objects
  const scns = db.prepare(
    `SELECT code, name, involved_objects FROM ontology_scenarios WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; involved_objects: string }[];
  for (const s of scns) {
    const arr: string[] = JSON.parse(s.involved_objects || '[]');
    if (arr.includes(objectCode)) {
      refs.push({ entity_type: 'scenario', entity_code: s.code, entity_name: s.name, reason: `involved_objects` });
    }
  }

  // other objects' relations_detail.target_object
  const otherObjs = db.prepare(
    `SELECT code, name, relations_detail FROM ontology_objects WHERE ontology_id=? AND code!=?`
  ).all(ontologyId, objectCode) as { code: string; name: string; relations_detail: string }[];
  for (const o of otherObjs) {
    const rels = JSON.parse(o.relations_detail || '[]') as { target_object?: string }[];
    if (rels.some(r => r.target_object === objectCode)) {
      refs.push({ entity_type: 'object', entity_code: o.code, entity_name: o.name, reason: `relations_detail.target_object` });
    }
  }

  return refs;
}

// ─── Rule references check ────────────────────────────────────────────────────

export function checkRuleReferences(ontologyId: number, ruleCode: string): BlockReference[] {
  const refs: BlockReference[] = [];

  // behaviors.referenced_rules
  const behs = db.prepare(
    `SELECT code, name, referenced_rules FROM ontology_behaviors WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; referenced_rules: string }[];
  for (const b of behs) {
    const arr: string[] = JSON.parse(b.referenced_rules || '[]');
    if (arr.includes(ruleCode)) {
      refs.push({ entity_type: 'behavior', entity_code: b.code, entity_name: b.name, reason: `referenced_rules` });
    }
  }

  return refs;
}

// ─── Event references check ───────────────────────────────────────────────────

export function checkEventReferences(ontologyId: number, eventCode: string): BlockReference[] {
  const refs: BlockReference[] = [];

  // behaviors.emits_events
  const behs = db.prepare(
    `SELECT code, name, emits_events FROM ontology_behaviors WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; emits_events: string }[];
  for (const b of behs) {
    const arr: string[] = JSON.parse(b.emits_events || '[]');
    if (arr.includes(eventCode)) {
      refs.push({ entity_type: 'behavior', entity_code: b.code, entity_name: b.name, reason: `emits_events` });
    }
  }

  // scenarios.steps[].event
  const scns = db.prepare(
    `SELECT code, name, steps FROM ontology_scenarios WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; steps: string }[];
  for (const s of scns) {
    const steps = JSON.parse(s.steps || '[]') as { event?: string }[];
    if (steps.some(st => st.event === eventCode)) {
      refs.push({ entity_type: 'scenario', entity_code: s.code, entity_name: s.name, reason: `steps[].event` });
    }
  }

  return refs;
}

// ─── Behavior references check ────────────────────────────────────────────────

export function checkBehaviorReferences(ontologyId: number, behaviorCode: string): BlockReference[] {
  const refs: BlockReference[] = [];

  // events.producer_behavior or subscribers
  const evts = db.prepare(
    `SELECT code, name, producer_behavior, subscribers FROM ontology_events WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; producer_behavior: string; subscribers: string }[];
  for (const e of evts) {
    if (e.producer_behavior === behaviorCode) {
      refs.push({ entity_type: 'event', entity_code: e.code, entity_name: e.name, reason: `producer_behavior` });
    }
    const subs: string[] = JSON.parse(e.subscribers || '[]');
    if (subs.includes(behaviorCode)) {
      refs.push({ entity_type: 'event', entity_code: e.code, entity_name: e.name, reason: `subscribers` });
    }
  }

  // rules.applicable_behaviors
  const rules = db.prepare(
    `SELECT code, name, applicable_behaviors FROM ontology_rules WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; applicable_behaviors: string }[];
  for (const r of rules) {
    const arr: string[] = JSON.parse(r.applicable_behaviors || '[]');
    if (arr.includes(behaviorCode)) {
      refs.push({ entity_type: 'rule', entity_code: r.code, entity_name: r.name, reason: `applicable_behaviors` });
    }
  }

  // scenarios.steps[].behavior
  const scns = db.prepare(
    `SELECT code, name, steps FROM ontology_scenarios WHERE ontology_id=?`
  ).all(ontologyId) as { code: string; name: string; steps: string }[];
  for (const s of scns) {
    const steps = JSON.parse(s.steps || '[]') as { behavior?: string }[];
    if (steps.some(st => st.behavior === behaviorCode)) {
      refs.push({ entity_type: 'scenario', entity_code: s.code, entity_name: s.name, reason: `steps[].behavior` });
    }
  }

  return refs;
}

// ──��� Reference validation on create/update ───────────────────────────────────

export function validateBehaviorRefs(
  ontologyId: number,
  data: { owner_object: string; referenced_rules: string[]; emits_events: string[] }
): string[] {
  const errors: string[] = [];

  const objExists = db.prepare(
    `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
  ).get(ontologyId, data.owner_object);
  if (!objExists) errors.push(`owner_object '${data.owner_object}' does not exist`);

  for (const r of data.referenced_rules) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_rules WHERE ontology_id=? AND code=?`
    ).get(ontologyId, r);
    if (!exists) errors.push(`referenced_rules: rule '${r}' does not exist`);
  }

  for (const e of data.emits_events) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_events WHERE ontology_id=? AND code=?`
    ).get(ontologyId, e);
    if (!exists) errors.push(`emits_events: event '${e}' does not exist`);
  }

  return errors;
}

export function validateRuleRefs(
  ontologyId: number,
  data: { applicable_objects: string[]; applicable_behaviors: string[] }
): string[] {
  const errors: string[] = [];

  for (const o of data.applicable_objects) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
    ).get(ontologyId, o);
    if (!exists) errors.push(`applicable_objects: object '${o}' does not exist`);
  }

  for (const b of data.applicable_behaviors) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_behaviors WHERE ontology_id=? AND code=?`
    ).get(ontologyId, b);
    if (!exists) errors.push(`applicable_behaviors: behavior '${b}' does not exist`);
  }

  return errors;
}

export function validateEventRefs(
  ontologyId: number,
  data: { producer_object: string; producer_behavior: string; subscribers: string[]; impacted_objects: string[] }
): string[] {
  const errors: string[] = [];

  const objExists = db.prepare(
    `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
  ).get(ontologyId, data.producer_object);
  if (!objExists) errors.push(`producer_object '${data.producer_object}' does not exist`);

  const behExists = db.prepare(
    `SELECT 1 FROM ontology_behaviors WHERE ontology_id=? AND code=?`
  ).get(ontologyId, data.producer_behavior);
  if (!behExists) errors.push(`producer_behavior '${data.producer_behavior}' does not exist`);

  for (const s of data.subscribers) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_behaviors WHERE ontology_id=? AND code=?`
    ).get(ontologyId, s);
    if (!exists) errors.push(`subscribers: behavior '${s}' does not exist`);
  }

  for (const o of data.impacted_objects) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
    ).get(ontologyId, o);
    if (!exists) errors.push(`impacted_objects: object '${o}' does not exist`);
  }

  return errors;
}

export function validateScenarioRefs(
  ontologyId: number,
  data: { involved_objects: string[]; steps: { behavior?: string; event?: string }[] }
): string[] {
  const errors: string[] = [];

  for (const o of data.involved_objects) {
    const exists = db.prepare(
      `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
    ).get(ontologyId, o);
    if (!exists) errors.push(`involved_objects: object '${o}' does not exist`);
  }

  for (const step of data.steps) {
    if (step.behavior) {
      const exists = db.prepare(
        `SELECT 1 FROM ontology_behaviors WHERE ontology_id=? AND code=?`
      ).get(ontologyId, step.behavior);
      if (!exists) errors.push(`step behavior '${step.behavior}' does not exist`);
    }
    if (step.event) {
      const exists = db.prepare(
        `SELECT 1 FROM ontology_events WHERE ontology_id=? AND code=?`
      ).get(ontologyId, step.event);
      if (!exists) errors.push(`step event '${step.event}' does not exist`);
    }
  }

  return errors;
}
