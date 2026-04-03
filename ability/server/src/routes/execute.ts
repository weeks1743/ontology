import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { ExecutionLog } from '../types.js';
import { skillExecutor } from '../engine/skill-executor.js';

const router = Router();

// 执行技能
router.post('/:id/execute', async (req, res) => {
  const startTime = Date.now();
  const skillId = req.params.id;
  const inputParams = req.body;

  try {
    // 获取技能信息
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // 执行技能
    const result = await skillExecutor.execute(skillId, inputParams);

    // 记录执行日志
    const logId = nanoid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO execution_logs (
        id, skill_id, skill_name, input_params, output_result, status,
        error_message, mongodb_status, neo4j_status, chroma_status,
        duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      skillId,
      (skill as any).name,
      JSON.stringify(inputParams),
      JSON.stringify(result.data || {}),
      result.success ? 'success' : 'error',
      result.error || null,
      result.mongodb_status,
      result.neo4j_status,
      result.chroma_status,
      result.duration_ms,
      now
    );

    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;

    // 记录错误日志
    const logId = nanoid();
    const now = new Date().toISOString();
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId);

    if (skill) {
      db.prepare(`
        INSERT INTO execution_logs (
          id, skill_id, skill_name, input_params, output_result, status,
          error_message, mongodb_status, neo4j_status, chroma_status,
          duration_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        skillId,
        (skill as any).name,
        JSON.stringify(inputParams),
        '{}',
        'error',
        (error as Error).message,
        'skipped',
        'skipped',
        'skipped',
        duration,
        now
      );
    }

    res.status(500).json({
      success: false,
      error: (error as Error).message,
      mongodb_status: 'skipped',
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: duration
    });
  }
});

export default router;
