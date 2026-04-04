import { Router } from 'express';
import { db, parseRow } from '../db';
import { ScenarioDraft } from '../types';
import { validateScenarioRefs } from '../validators';

const router = Router({ mergeParams: true });
const JSON_FIELDS = ['involved_objects', 'steps', 'success_criteria'];

function parseScenario(row: Record<string, unknown>): ScenarioDraft {
  return parseRow<ScenarioDraft>(row, JSON_FIELDS);
}

// GET /ontologies/:id/scenarios
router.get('/', (req: any, res) => {
  const rows = db.prepare(
    `SELECT * FROM ontology_scenarios WHERE ontology_id=? ORDER BY code`
  ).all(req.params.id) as Record<string, unknown>[];
  res.json(rows.map(parseScenario));
});

// GET /ontologies/:id/scenarios/:code
router.get('/:code', (req: any, res) => {
  const row = db.prepare(
    `SELECT * FROM ontology_scenarios WHERE ontology_id=? AND code=?`
  ).get(req.params.id, req.params.code) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: 'Scenario not found' }); return; }
  res.json(parseScenario(row));
});

// POST /ontologies/:id/scenarios
router.post('/', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const {
    code, name, description = '', business_goal = '',
    involved_objects = [], steps = [], success_criteria = []
  } = req.body as {
    code?: string; name?: string; description?: string; business_goal?: string;
    involved_objects?: string[]; steps?: { step: number; behavior?: string; event?: string; decision_gate?: string[] }[];
    success_criteria?: string[];
  };

  if (!code || !name) { res.status(400).json({ error: 'code and name are required' }); return; }

  const refErrors = validateScenarioRefs(ontologyId, { involved_objects, steps });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  try {
    const result = db.prepare(
      `INSERT INTO ontology_scenarios (ontology_id, code, name, description, business_goal, involved_objects, steps, success_criteria)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ontologyId, code.trim(), name.trim(), description.trim(), business_goal.trim(),
      JSON.stringify(involved_objects), JSON.stringify(steps), JSON.stringify(success_criteria)
    );
    const created = db.prepare(`SELECT * FROM ontology_scenarios WHERE id=?`).get(result.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json(parseScenario(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `code '${code}' already exists in this ontology` });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// PUT /ontologies/:id/scenarios/:code
router.put('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const existing = db.prepare(
    `SELECT * FROM ontology_scenarios WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Scenario not found' }); return; }

  const { name, description, business_goal, involved_objects, steps, success_criteria } = req.body as {
    name?: string; description?: string; business_goal?: string;
    involved_objects?: string[]; steps?: { step: number; behavior?: string; event?: string; decision_gate?: string[] }[];
    success_criteria?: string[];
  };

  const updObjs = involved_objects ?? JSON.parse(existing['involved_objects'] as string || '[]');
  const updSteps = steps ?? JSON.parse(existing['steps'] as string || '[]');

  const refErrors = validateScenarioRefs(ontologyId, { involved_objects: updObjs, steps: updSteps });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  db.prepare(
    `UPDATE ontology_scenarios SET name=?, description=?, business_goal=?, involved_objects=?, steps=?, success_criteria=?, updated_at=CURRENT_TIMESTAMP
     WHERE ontology_id=? AND code=?`
  ).run(
    name?.trim() ?? existing['name'], description?.trim() ?? existing['description'],
    business_goal?.trim() ?? existing['business_goal'],
    JSON.stringify(updObjs), JSON.stringify(updSteps),
    JSON.stringify(success_criteria ?? JSON.parse(existing['success_criteria'] as string || '[]')),
    ontologyId, req.params.code
  );

  const updated = db.prepare(
    `SELECT * FROM ontology_scenarios WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown>;
  res.json(parseScenario(updated));
});

// DELETE /ontologies/:id/scenarios/:code
router.delete('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const code = req.params.code;

  const existing = db.prepare(
    `SELECT 1 FROM ontology_scenarios WHERE ontology_id=? AND code=?`
  ).get(ontologyId, code);
  if (!existing) { res.status(404).json({ error: 'Scenario not found' }); return; }

  // Scenarios have no external dependencies that block deletion per spec
  db.prepare(`DELETE FROM ontology_scenarios WHERE ontology_id=? AND code=?`).run(ontologyId, code);
  res.status(204).send();
});

export default router;
