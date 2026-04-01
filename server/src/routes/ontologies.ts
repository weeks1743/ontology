import { Router } from 'express';
import { db } from '../db';
import { OntologyShell } from '../types';

const router = Router();

// GET /ontologies
router.get('/', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM ontologies ORDER BY created_at DESC`).all() as OntologyShell[];
  res.json(rows);
});

// POST /ontologies
router.post('/', (req, res) => {
  const { ontology_code, display_name, description = '' } = req.body as {
    ontology_code?: string;
    display_name?: string;
    description?: string;
  };

  if (!ontology_code || !display_name) {
    res.status(400).json({ error: 'ontology_code and display_name are required' });
    return;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(ontology_code)) {
    res.status(400).json({ error: 'ontology_code must start with a letter and contain only letters, numbers, underscores, hyphens' });
    return;
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO ontologies (ontology_code, display_name, description) VALUES (?, ?, ?)`
    );
    const result = stmt.run(ontology_code, display_name.trim(), description?.trim() || '');
    const created = db.prepare(`SELECT * FROM ontologies WHERE id=?`).get(result.lastInsertRowid) as OntologyShell;
    res.status(201).json(created);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `ontology_code '${ontology_code}' already exists` });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /ontologies/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM ontologies WHERE id=?`).get(req.params['id']) as OntologyShell | undefined;
  if (!row) {
    res.status(404).json({ error: 'Ontology not found' });
    return;
  }
  res.json(row);
});

export default router;
