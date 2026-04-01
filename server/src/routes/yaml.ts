import { Router } from 'express';
import { assembleYaml } from '../yaml-assembler';

const router = Router({ mergeParams: true });

// GET /ontologies/:id/yaml
router.get('/', (req: any, res) => {
  try {
    const bundle = assembleYaml(Number(req.params.id));
    res.json(bundle);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

export default router;
