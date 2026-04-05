import { Router } from 'express';
import { createHash } from 'crypto';
import { db } from '../db';
import { validateOntology } from '../yaml-assembler';

const router = Router({ mergeParams: true });

function parseJson<T>(val: unknown, fallback: T): T {
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return (val as T) ?? fallback;
}

// GET /api/ontologies/:id/definition-snapshot
router.get('/', (req, res) => {
  try {
    const id = (req.params as any).id as string;

    // Support lookup by both integer ID and ontology_code
    const isNumeric = /^\d+$/.test(id);
    const ontology = isNumeric
      ? (db.prepare(`SELECT * FROM ontologies WHERE id=?`).get(Number(id)) as any)
      : (db.prepare(`SELECT * FROM ontologies WHERE ontology_code=?`).get(id) as any);

    if (!ontology) {
      return res.status(404).json({ error: `Ontology '${id}' not found` });
    }

    const ontologyId = ontology.id as number;

    // Parallel queries for all 5 entity types
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

    // Build code sets for ref resolution
    const objectCodes = new Set(rawObjects.map(o => o['code'] as string));
    const behaviorCodes = new Set(rawBehaviors.map(b => b['code'] as string));
    const ruleCodes = new Set(rawRules.map(r => r['code'] as string));
    const eventCodes = new Set(rawEvents.map(e => e['code'] as string));

    // Parse objects
    const objects = rawObjects.map(o => ({
      id: o['id'],
      ontology_id: o['ontology_id'],
      code: o['code'],
      name: o['name'],
      description: o['description'] || '',
      lifecycle: parseJson(o['lifecycle'], []),
      lifecycle_enhanced: parseJson(o['lifecycle_enhanced'], null),
      attributes: parseJson(o['attributes'], []),
      relations_detail: parseJson(o['relations_detail'], []),
      aliases: parseJson(o['aliases'], []),
      nl_examples: parseJson(o['nl_examples'], []),
      negative_examples: parseJson(o['negative_examples'], []),
      disambiguation_notes: o['disambiguation_notes'] || null,
      created_at: o['created_at'],
      updated_at: o['updated_at'],
    }));

    // Parse behaviors with resolved refs
    const behaviors = rawBehaviors.map(b => ({
      id: b['id'],
      ontology_id: b['ontology_id'],
      code: b['code'],
      name: b['name'],
      description: b['description'] || '',
      owner_object: b['owner_object'],
      trigger_type: b['trigger_type'],
      required_inputs: parseJson(b['required_inputs'], []),
      inputs_schema: parseJson(b['inputs_schema'], null),
      referenced_rules: parseJson(b['referenced_rules'], []),
      emits_events: parseJson(b['emits_events'], []),
      writeback_targets: parseJson(b['writeback_targets'], []),
      preconditions: parseJson(b['preconditions'], []),
      result_schema: parseJson(b['result_schema'], null),
      postconditions: parseJson(b['postconditions'], []),
      side_effects: parseJson(b['side_effects'], []),
      aliases: parseJson(b['aliases'], []),
      nl_examples: parseJson(b['nl_examples'], []),
      created_at: b['created_at'],
      updated_at: b['updated_at'],
      // resolved
      owner_object_exists: objectCodes.has(b['owner_object'] as string),
    }));

    // Parse rules
    const rules = rawRules.map(r => ({
      id: r['id'],
      ontology_id: r['ontology_id'],
      code: r['code'],
      name: r['name'],
      description: r['description'] || '',
      type: r['type'],
      applicable_objects: parseJson(r['applicable_objects'], []),
      applicable_behaviors: parseJson(r['applicable_behaviors'], []),
      expression: r['expression'] || '',
      expression_structured: parseJson(r['expression_structured'], null),
      failure_message: r['failure_message'] || '',
      failure_message_template: r['failure_message_template'] || null,
      severity: r['severity'],
      escalation_target: r['escalation_target'] || '',
      constraint_type: r['constraint_type'] || null,
      input_context: parseJson(r['input_context'], []),
      next_actions: parseJson(r['next_actions'], []),
      created_at: r['created_at'],
      updated_at: r['updated_at'],
    }));

    // Parse events with resolved refs
    const events = rawEvents.map(e => ({
      id: e['id'],
      ontology_id: e['ontology_id'],
      code: e['code'],
      name: e['name'],
      description: e['description'] || '',
      producer_object: e['producer_object'],
      producer_behavior: e['producer_behavior'],
      subscribers: parseJson(e['subscribers'], []),
      impacted_objects: parseJson(e['impacted_objects'], []),
      payload_schema: parseJson(e['payload_schema'], []),
      propagation_conditions: parseJson(e['propagation_conditions'], []),
      triggered_behaviors: parseJson(e['triggered_behaviors'], []),
      trace_policy: parseJson(e['trace_policy'], null),
      causality: parseJson(e['causality'], null),
      created_at: e['created_at'],
      updated_at: e['updated_at'],
      // resolved
      producer_object_exists: objectCodes.has(e['producer_object'] as string),
      producer_behavior_exists: behaviorCodes.has(e['producer_behavior'] as string),
    }));

    // Parse scenarios
    const scenarios = rawScenarios.map(s => ({
      id: s['id'],
      ontology_id: s['ontology_id'],
      code: s['code'],
      name: s['name'],
      description: s['description'] || '',
      business_goal: s['business_goal'] || '',
      involved_objects: parseJson(s['involved_objects'], []),
      steps: parseJson(s['steps'], []),
      success_criteria: parseJson(s['success_criteria'], []),
      start_conditions: parseJson(s['start_conditions'], []),
      decision_points_enhanced: parseJson(s['decision_points_enhanced'], null),
      rollback_compensation: parseJson(s['rollback_compensation'], []),
      observability_metrics: parseJson(s['observability_metrics'], []),
      created_at: s['created_at'],
      updated_at: s['updated_at'],
    }));

    // Validation
    const allIssues = validateOntology(ontologyId);
    const errors = allIssues.filter(i => i.level === 'error');
    const warnings = allIssues.filter(i => i.level === 'warning');

    // Source fingerprint: max(updated_at) per table
    const maxTimes = [
      (db.prepare('SELECT MAX(updated_at) AS t FROM ontologies WHERE id=?').get(ontologyId) as any)?.t || '',
      (db.prepare('SELECT MAX(updated_at) AS t FROM ontology_objects WHERE ontology_id=?').get(ontologyId) as any)?.t || '',
      (db.prepare('SELECT MAX(updated_at) AS t FROM ontology_behaviors WHERE ontology_id=?').get(ontologyId) as any)?.t || '',
      (db.prepare('SELECT MAX(updated_at) AS t FROM ontology_rules WHERE ontology_id=?').get(ontologyId) as any)?.t || '',
      (db.prepare('SELECT MAX(updated_at) AS t FROM ontology_events WHERE ontology_id=?').get(ontologyId) as any)?.t || '',
      (db.prepare('SELECT MAX(updated_at) AS t FROM ontology_scenarios WHERE ontology_id=?').get(ontologyId) as any)?.t || '',
    ];
    const source_fingerprint = createHash('sha256').update(maxTimes.join('|')).digest('hex');

    const generated_at = new Date().toISOString();

    // Build the snapshot (without generated_at for hash computation)
    const snapshotData = {
      schema_version: '1.0' as const,
      ontology: {
        id: ontology.id,
        ontology_code: ontology.ontology_code,
        display_name: ontology.display_name,
        description: ontology.description || '',
        created_at: ontology.created_at,
        updated_at: ontology.updated_at,
      },
      objects,
      behaviors,
      rules,
      events,
      scenarios,
      validation: { errors, warnings },
      build_hints: {
        has_errors: errors.length > 0,
        behavior_count: behaviors.length,
        scenario_count: scenarios.length,
        object_count: objects.length,
      },
      source_fingerprint,
    };

    // Compute snapshot_hash from canonical JSON (without generated_at)
    const snapshot_hash = createHash('sha256')
      .update(JSON.stringify(snapshotData))
      .digest('hex');

    const fullSnapshot = {
      ...snapshotData,
      snapshot_hash,
      generated_at,
    };

    res.json(fullSnapshot);
  } catch (error) {
    console.error('Error generating definition snapshot:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
