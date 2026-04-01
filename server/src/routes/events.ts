import { Router } from 'express';
import { db, parseRow } from '../db';
import { EventDraft } from '../types';
import { checkEventReferences, validateEventRefs } from '../validators';

const router = Router({ mergeParams: true });
const JSON_FIELDS = ['subscribers', 'impacted_objects'];

function parseEvent(row: Record<string, unknown>): EventDraft {
  return parseRow<EventDraft>(row, JSON_FIELDS);
}

// GET /ontologies/:id/events
router.get('/', (req: any, res) => {
  const rows = db.prepare(
    `SELECT * FROM ontology_events WHERE ontology_id=? ORDER BY code`
  ).all(req.params.id) as Record<string, unknown>[];
  res.json(rows.map(parseEvent));
});

// GET /ontologies/:id/events/:code
router.get('/:code', (req: any, res) => {
  const row = db.prepare(
    `SELECT * FROM ontology_events WHERE ontology_id=? AND code=?`
  ).get(req.params.id, req.params.code) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: 'Event not found' }); return; }
  res.json(parseEvent(row));
});

// POST /ontologies/:id/events
router.post('/', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const {
    code, name, description = '', producer_object, producer_behavior,
    subscribers = [], impacted_objects = []
  } = req.body as {
    code?: string; name?: string; description?: string;
    producer_object?: string; producer_behavior?: string;
    subscribers?: string[]; impacted_objects?: string[];
  };

  if (!code || !name || !producer_object || !producer_behavior) {
    res.status(400).json({ error: 'code, name, producer_object, and producer_behavior are required' });
    return;
  }

  const refErrors = validateEventRefs(ontologyId, { producer_object, producer_behavior, subscribers, impacted_objects });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  try {
    const result = db.prepare(
      `INSERT INTO ontology_events (ontology_id, code, name, description, producer_object, producer_behavior, subscribers, impacted_objects)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ontologyId, code.trim(), name.trim(), description.trim(),
      producer_object, producer_behavior,
      JSON.stringify(subscribers), JSON.stringify(impacted_objects)
    );
    const created = db.prepare(`SELECT * FROM ontology_events WHERE id=?`).get(result.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json(parseEvent(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `code '${code}' already exists in this ontology` });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// PUT /ontologies/:id/events/:code
router.put('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const existing = db.prepare(
    `SELECT * FROM ontology_events WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }

  const { name, description, producer_object, producer_behavior, subscribers, impacted_objects } = req.body as {
    name?: string; description?: string; producer_object?: string; producer_behavior?: string;
    subscribers?: string[]; impacted_objects?: string[];
  };

  const updProducerObj = producer_object ?? existing['producer_object'] as string;
  const updProducerBeh = producer_behavior ?? existing['producer_behavior'] as string;
  const updSubs = subscribers ?? JSON.parse(existing['subscribers'] as string || '[]');
  const updImpacted = impacted_objects ?? JSON.parse(existing['impacted_objects'] as string || '[]');

  const refErrors = validateEventRefs(ontologyId, {
    producer_object: updProducerObj, producer_behavior: updProducerBeh,
    subscribers: updSubs, impacted_objects: updImpacted
  });
  if (refErrors.length > 0) { res.status(422).json({ errors: refErrors }); return; }

  db.prepare(
    `UPDATE ontology_events SET name=?, description=?, producer_object=?, producer_behavior=?, subscribers=?, impacted_objects=?, updated_at=CURRENT_TIMESTAMP
     WHERE ontology_id=? AND code=?`
  ).run(
    name?.trim() ?? existing['name'], description?.trim() ?? existing['description'],
    updProducerObj, updProducerBeh, JSON.stringify(updSubs), JSON.stringify(updImpacted),
    ontologyId, req.params.code
  );

  const updated = db.prepare(
    `SELECT * FROM ontology_events WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown>;
  res.json(parseEvent(updated));
});

// DELETE /ontologies/:id/events/:code
router.delete('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const code = req.params.code;

  const existing = db.prepare(
    `SELECT 1 FROM ontology_events WHERE ontology_id=? AND code=?`
  ).get(ontologyId, code);
  if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }

  const refs = checkEventReferences(ontologyId, code);
  if (refs.length > 0) {
    res.status(409).json({ blocked: true, references: refs });
    return;
  }

  db.prepare(`DELETE FROM ontology_events WHERE ontology_id=? AND code=?`).run(ontologyId, code);
  res.status(204).send();
});

export default router;
