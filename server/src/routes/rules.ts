import { Router } from 'express';
import { db, parseRow } from '../db';
import { RuleDraft } from '../types';
import { checkRuleReferences, validateRuleRefs } from '../validators';

const router = Router({ mergeParams: true });
const JSON_FIELDS = ['applicable_objects', 'applicable_behaviors'];

function parseRule(row: Record<string, unknown>): RuleDraft {
  return parseRow<RuleDraft>(row, JSON_FIELDS);
}

// GET /ontologies/:id/rules
router.get('/', (req: any, res) => {
  const rows = db.prepare(
    `SELECT * FROM ontology_rules WHERE ontology_id=? ORDER BY code`
  ).all(req.params.id) as Record<string, unknown>[];
  res.json(rows.map(parseRule));
});

// GET /ontologies/:id/rules/:code
router.get('/:code', (req: any, res) => {
  const row = db.prepare(
    `SELECT * FROM ontology_rules WHERE ontology_id=? AND code=?`
  ).get(req.params.id, req.params.code) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: 'Rule not found' }); return; }
  res.json(parseRule(row));
});

// POST /ontologies/:id/rules
router.post('/', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const {
    code, name, description = '', type = 'validation',
    applicable_objects = [], applicable_behaviors = [],
    expression = '', failure_message = '', severity = 'medium', escalation_target = ''
  } = req.body as {
    code?: string; name?: string; description?: string; type?: string;
    applicable_objects?: string[]; applicable_behaviors?: string[];
    expression?: string; failure_message?: string; severity?: string; escalation_target?: string;
  };

  if (!code || !name) { res.status(400).json({ error: 'code and name are required' }); return; }

  const refErrors = validateRuleRefs(ontologyId, { applicable_objects, applicable_behaviors });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  try {
    const result = db.prepare(
      `INSERT INTO ontology_rules (ontology_id, code, name, description, type, applicable_objects, applicable_behaviors, expression, failure_message, severity, escalation_target)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ontologyId, code.trim(), name.trim(), description.trim(), type,
      JSON.stringify(applicable_objects), JSON.stringify(applicable_behaviors),
      expression, failure_message, severity, escalation_target
    );
    const created = db.prepare(`SELECT * FROM ontology_rules WHERE id=?`).get(result.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json(parseRule(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `code '${code}' already exists in this ontology` });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// PUT /ontologies/:id/rules/:code
router.put('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const existing = db.prepare(
    `SELECT * FROM ontology_rules WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Rule not found' }); return; }

  const { name, description, type, applicable_objects, applicable_behaviors, expression, failure_message, severity, escalation_target } = req.body as {
    name?: string; description?: string; type?: string;
    applicable_objects?: string[]; applicable_behaviors?: string[];
    expression?: string; failure_message?: string; severity?: string; escalation_target?: string;
  };

  const updObjs = applicable_objects ?? JSON.parse(existing['applicable_objects'] as string || '[]');
  const updBehs = applicable_behaviors ?? JSON.parse(existing['applicable_behaviors'] as string || '[]');

  const refErrors = validateRuleRefs(ontologyId, { applicable_objects: updObjs, applicable_behaviors: updBehs });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  db.prepare(
    `UPDATE ontology_rules SET name=?, description=?, type=?, applicable_objects=?, applicable_behaviors=?, expression=?, failure_message=?, severity=?, escalation_target=?, updated_at=CURRENT_TIMESTAMP
     WHERE ontology_id=? AND code=?`
  ).run(
    name?.trim() ?? existing['name'], description?.trim() ?? existing['description'],
    type ?? existing['type'], JSON.stringify(updObjs), JSON.stringify(updBehs),
    expression ?? existing['expression'], failure_message ?? existing['failure_message'],
    severity ?? existing['severity'], escalation_target ?? existing['escalation_target'],
    ontologyId, req.params.code
  );

  const updated = db.prepare(
    `SELECT * FROM ontology_rules WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown>;
  res.json(parseRule(updated));
});

// DELETE /ontologies/:id/rules/:code
router.delete('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const code = req.params.code;

  const existing = db.prepare(
    `SELECT 1 FROM ontology_rules WHERE ontology_id=? AND code=?`
  ).get(ontologyId, code);
  if (!existing) { res.status(404).json({ error: 'Rule not found' }); return; }

  const refs = checkRuleReferences(ontologyId, code);
  if (refs.length > 0) {
    res.status(409).json({ blocked: true, references: refs });
    return;
  }

  db.prepare(`DELETE FROM ontology_rules WHERE ontology_id=? AND code=?`).run(ontologyId, code);
  res.status(204).send();
});

export default router;
