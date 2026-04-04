import { Router } from 'express';
import { validateOntology } from '../yaml-assembler';

const router = Router({ mergeParams: true });

// GET /ontologies/:id/validation
router.get('/', (req: any, res) => {
  try {
    const issues = validateOntology(Number(req.params.id));
    const errors = issues.filter((i) => i.level === 'error').length;
    const warnings = issues.filter((i) => i.level === 'warning').length;
    res.json({ errors, warnings, issues });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

export default router;
