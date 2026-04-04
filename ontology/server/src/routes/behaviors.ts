import { Router } from 'express';
import { db, parseRow } from '../db';
import { BehaviorDraft } from '../types';
import { checkBehaviorReferences, validateBehaviorRefs } from '../validators';

const router = Router({ mergeParams: true });
const JSON_FIELDS = ['required_inputs', 'referenced_rules', 'emits_events', 'writeback_targets'];

function parseBehavior(row: Record<string, unknown>): BehaviorDraft {
  return parseRow<BehaviorDraft>(row, JSON_FIELDS);
}

// GET /ontologies/:id/behaviors
router.get('/', (req: any, res) => {
  const rows = db.prepare(
    `SELECT * FROM ontology_behaviors WHERE ontology_id=? ORDER BY code`
  ).all(req.params.id) as Record<string, unknown>[];
  res.json(rows.map(parseBehavior));
});

// GET /ontologies/:id/behaviors/:code
router.get('/:code', (req: any, res) => {
  const row = db.prepare(
    `SELECT * FROM ontology_behaviors WHERE ontology_id=? AND code=?`
  ).get(req.params.id, req.params.code) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: 'Behavior not found' }); return; }
  res.json(parseBehavior(row));
});

// POST /ontologies/:id/behaviors
router.post('/', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const {
    code, name, description = '', owner_object, trigger_type = 'USER_ACTION',
    required_inputs = [], referenced_rules = [], emits_events = [], writeback_targets = []
  } = req.body as {
    code?: string; name?: string; description?: string; owner_object?: string;
    trigger_type?: string; required_inputs?: string[]; referenced_rules?: string[];
    emits_events?: string[]; writeback_targets?: string[];
  };

  if (!code || !name || !owner_object) {
    res.status(400).json({ error: 'code, name, and owner_object are required' });
    return;
  }

  const refErrors = validateBehaviorRefs(ontologyId, { owner_object, referenced_rules, emits_events });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  try {
    const result = db.prepare(
      `INSERT INTO ontology_behaviors (ontology_id, code, name, description, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ontologyId, code.trim(), name.trim(), description.trim(), owner_object,
      trigger_type, JSON.stringify(required_inputs), JSON.stringify(referenced_rules),
      JSON.stringify(emits_events), JSON.stringify(writeback_targets)
    );
    const created = db.prepare(`SELECT * FROM ontology_behaviors WHERE id=?`).get(result.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json(parseBehavior(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `code '${code}' already exists in this ontology` });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// PUT /ontologies/:id/behaviors/:code
router.put('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const existing = db.prepare(
    `SELECT * FROM ontology_behaviors WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Behavior not found' }); return; }

  const { name, description, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets } = req.body as {
    name?: string; description?: string; owner_object?: string; trigger_type?: string;
    required_inputs?: string[]; referenced_rules?: string[]; emits_events?: string[]; writeback_targets?: string[];
  };

  const updOwner = owner_object ?? existing['owner_object'] as string;
  const updRules = referenced_rules ?? JSON.parse(existing['referenced_rules'] as string || '[]');
  const updEmits = emits_events ?? JSON.parse(existing['emits_events'] as string || '[]');

  const refErrors = validateBehaviorRefs(ontologyId, { owner_object: updOwner, referenced_rules: updRules, emits_events: updEmits });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  db.prepare(
    `UPDATE ontology_behaviors SET name=?, description=?, owner_object=?, trigger_type=?, required_inputs=?, referenced_rules=?, emits_events=?, writeback_targets=?, updated_at=CURRENT_TIMESTAMP
     WHERE ontology_id=? AND code=?`
  ).run(
    name?.trim() ?? existing['name'], description?.trim() ?? existing['description'],
    updOwner, trigger_type ?? existing['trigger_type'],
    JSON.stringify(required_inputs ?? JSON.parse(existing['required_inputs'] as string || '[]')),
    JSON.stringify(updRules), JSON.stringify(updEmits),
    JSON.stringify(writeback_targets ?? JSON.parse(existing['writeback_targets'] as string || '[]')),
    ontologyId, req.params.code
  );

  const updated = db.prepare(
    `SELECT * FROM ontology_behaviors WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown>;
  res.json(parseBehavior(updated));
});

// DELETE /ontologies/:id/behaviors/:code
router.delete('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const code = req.params.code;

  const existing = db.prepare(
    `SELECT 1 FROM ontology_behaviors WHERE ontology_id=? AND code=?`
  ).get(ontologyId, code);
  if (!existing) { res.status(404).json({ error: 'Behavior not found' }); return; }

  const refs = checkBehaviorReferences(ontologyId, code);
  if (refs.length > 0) {
    res.status(409).json({ blocked: true, references: refs });
    return;
  }

  db.prepare(`DELETE FROM ontology_behaviors WHERE ontology_id=? AND code=?`).run(ontologyId, code);
  res.status(204).send();
});

export default router;
