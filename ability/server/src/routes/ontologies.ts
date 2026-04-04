import { Router } from 'express';
const router = Router();

// 本体系统 API 地址
const ONTOLOGY_API_URL = 'http://localhost:3001';

// 获取所有本体列表
router.get('/', async (req, res) => {
  try {
    const response = await fetch(`${ONTOLOGY_API_URL}/api/ontologies`);
    if (!response.ok) {
      throw new Error(`Ontology API returned ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching ontologies:', error);
    res.status(500).json({ error: 'Failed to fetch ontologies from main system' });
  }
});

// 获取单个本体详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`${ONTOLOGY_API_URL}/api/ontologies/${id}`);
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Ontology not found' });
      }
      throw new Error(`Ontology API returned ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching ontology:', error);
    res.status(500).json({ error: 'Failed to fetch ontology from main system' });
  }
});

export default router;