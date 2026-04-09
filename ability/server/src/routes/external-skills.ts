import { Router } from 'express';
import {
  loadSkillConfig,
  updateSkillConfig,
  getSkillConfig,
  loadExternalSkills
} from '../engine/external-skills.js';
import { selectExternalSkill } from '../engine/external-skill-selector.js';

const router = Router();

// 获取所有技能配置
router.get('/config', (req, res) => {
  try {
    const config = loadSkillConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取单个技能配置
router.get('/config/:skillId', (req, res) => {
  try {
    const config = getSkillConfig(req.params.skillId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 更新单个技能配置
router.post('/config/:skillId', (req, res) => {
  try {
    const { skillId } = req.params;
    const config = req.body;

    updateSkillConfig(skillId, config);

    res.json({
      success: true,
      message: `Configuration updated for ${skillId}`
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 重新加载外部技能
router.post('/reload', async (req, res) => {
  try {
    const count = await loadExternalSkills();
    res.json({
      success: true,
      message: `Reloaded ${count} external skills`,
      count
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 选择外部技能
router.post('/select', (req, res) => {
  try {
    const { artifact_type } = req.body as { artifact_type?: string };
    res.json(selectExternalSkill({ artifact_type: artifact_type || 'operating_advice' }));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
