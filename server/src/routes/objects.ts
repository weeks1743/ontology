import { Router } from 'express';
import { db, parseRow } from '../db';
import { ObjectDraft } from '../types';
import { checkObjectReferences } from '../validators';

const router = Router({ mergeParams: true });

const JSON_FIELDS = ['lifecycle', 'attributes', 'relations_detail'];

function parseObject(row: Record<string, unknown>): ObjectDraft {
  return parseRow<ObjectDraft>(row, JSON_FIELDS);
}

// GET /ontologies/:id/objects
router.get('/', (req: any, res) => {
  const rows = db.prepare(
    `SELECT * FROM ontology_objects WHERE ontology_id=? ORDER BY code`
  ).all(req.params.id) as Record<string, unknown>[];
  res.json(rows.map(parseObject));
});

// GET /ontologies/:id/objects/:code
router.get('/:code', (req: any, res) => {
  const row = db.prepare(
    `SELECT * FROM ontology_objects WHERE ontology_id=? AND code=?`
  ).get(req.params.id, req.params.code) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ error: 'Object not found' }); return; }
  res.json(parseObject(row));
});

// POST /ontologies/:id/objects
router.post('/', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const { code, name, description = '', lifecycle = [], attributes = [], relations_detail = [] } = req.body as {
    code?: string; name?: string; description?: string;
    lifecycle?: string[]; attributes?: unknown[]; relations_detail?: unknown[];
  };

  if (!code || !name) { res.status(400).json({ error: 'code and name are required' }); return; }

  // Validate relations_detail target_object references
  const relErrors: string[] = [];
  for (const rel of relations_detail as { target_object?: string }[]) {
    if (rel.target_object) {
      const exists = db.prepare(
        `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
      ).get(ontologyId, rel.target_object);
      if (!exists) relErrors.push(`relations_detail: target_object '${rel.target_object}' does not exist`);
    }
  }
  if (relErrors.length > 0) { res.status(422).json({ errors: relErrors }); return; }

  try {
    const stmt = db.prepare(
      `INSERT INTO ontology_objects (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      ontologyId, code.trim(), name.trim(), description.trim(),
      JSON.stringify(lifecycle), JSON.stringify(attributes), JSON.stringify(relations_detail)
    );
    const created = db.prepare(`SELECT * FROM ontology_objects WHERE id=?`).get(result.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json(parseObject(created));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `code '${code}' already exists in this ontology` });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// PUT /ontologies/:id/objects/:code
router.put('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const existing = db.prepare(
    `SELECT * FROM ontology_objects WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown> | undefined;
  if (!existing) { res.status(404).json({ error: 'Object not found' }); return; }

  const { name, description, lifecycle, attributes, relations_detail } = req.body as {
    name?: string; description?: string;
    lifecycle?: string[]; attributes?: unknown[]; relations_detail?: unknown[];
  };

  const updName = name?.trim() ?? existing['name'];
  const updDesc = description !== undefined ? description.trim() : existing['description'];
  const updLifecycle = lifecycle !== undefined ? JSON.stringify(lifecycle) : existing['lifecycle'];
  const updAttributes = attributes !== undefined ? JSON.stringify(attributes) : existing['attributes'];
  const updRelations = relations_detail !== undefined ? JSON.stringify(relations_detail) : existing['relations_detail'];

  // Validate relations_detail target_object references
  if (relations_detail !== undefined) {
    const relErrors: string[] = [];
    for (const rel of relations_detail as { target_object?: string }[]) {
      if (rel.target_object && rel.target_object !== req.params.code) {
        const exists = db.prepare(
          `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
        ).get(ontologyId, rel.target_object);
        if (!exists) relErrors.push(`relations_detail: target_object '${rel.target_object}' does not exist`);
      }
    }
    if (relErrors.length > 0) { res.status(422).json({ errors: relErrors }); return; }
  }

  db.prepare(
    `UPDATE ontology_objects SET name=?, description=?, lifecycle=?, attributes=?, relations_detail=?, updated_at=CURRENT_TIMESTAMP
     WHERE ontology_id=? AND code=?`
  ).run(updName, updDesc, updLifecycle, updAttributes, updRelations, ontologyId, req.params.code);

  const updated = db.prepare(
    `SELECT * FROM ontology_objects WHERE ontology_id=? AND code=?`
  ).get(ontologyId, req.params.code) as Record<string, unknown>;
  res.json(parseObject(updated));
});

// DELETE /ontologies/:id/objects/:code
router.delete('/:code', (req: any, res) => {
  const ontologyId = Number(req.params.id);
  const code = req.params.code;

  const existing = db.prepare(
    `SELECT 1 FROM ontology_objects WHERE ontology_id=? AND code=?`
  ).get(ontologyId, code);
  if (!existing) { res.status(404).json({ error: 'Object not found' }); return; }

  const refs = checkObjectReferences(ontologyId, code);
  if (refs.length > 0) {
    res.status(409).json({ blocked: true, references: refs });
    return;
  }

  db.prepare(`DELETE FROM ontology_objects WHERE ontology_id=? AND code=?`).run(ontologyId, code);
  res.status(204).send();
});

export default router;
