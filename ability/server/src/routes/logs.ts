import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// 获取执行日志（按 ontology_id 过滤）
router.get('/', (req, res) => {
  try {
    const { ontology_id, skill_id, status, limit = '50', offset = '0' } = req.query;

    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    // 通过 JOIN skills 表获取对应 ontology_id 的日志
    let query = `
      SELECT el.* FROM execution_logs el
      JOIN skills s ON el.skill_id = s.id
      WHERE s.ontology_id = ? OR s.category = 'external'
    `;
    const params: any[] = [ontology_id];

    if (skill_id) {
      query += ' AND el.skill_id = ?';
      params.push(skill_id);
    }

    if (status) {
      query += ' AND el.status = ?';
      params.push(status);
    }

    query += ' ORDER BY el.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const logs = db.prepare(query).all(...params);
    const parsed = logs.map(log => ({
      ...log,
      input_params: JSON.parse((log as any).input_params),
      output_result: JSON.parse((log as any).output_result),
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取单条日志
router.get('/:id', (req, res) => {
  try {
    const log = db.prepare('SELECT * FROM execution_logs WHERE id = ?').get(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    const parsed = {
      ...log,
      input_params: JSON.parse((log as any).input_params),
      output_result: JSON.parse((log as any).output_result),
    };

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
