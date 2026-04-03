import { Router } from 'express';
import { db } from '../db.js';
import { skillGenerator } from '../engine/skill-generator.js';

const router = Router();

// 生成本体技能
router.post('/generate', async (req, res) => {
  try {
    const { ontology_id } = req.body;

    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    // 调用技能生成器
    const generatedCount = await skillGenerator.generateAll(ontology_id);

    res.json({
      success: true,
      message: `Successfully generated ${generatedCount} ontology skills`,
      generated_count: generatedCount
    });
  } catch (error) {
    console.error('Error generating ontology skills:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 删除所有本体技能
router.delete('/all', (req, res) => {
  try {
    const result = db.prepare("DELETE FROM skills WHERE category = 'ontology'").run();
    res.json({ success: true, deleted_count: result.changes });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
