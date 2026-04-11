import { Router } from 'express';
import { eventBus } from '../engine/event-bus.js';

const router = Router();

// GET /api/event-bus/chain/:chainId
router.get('/chain/:chainId', (req, res) => {
  try {
    const { chainId } = req.params;
    const logs = eventBus.getChainLogs(chainId);
    res.json({ chain_id: chainId, logs });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/event-bus/events
router.get('/events', (req, res) => {
  res.json({ events: eventBus.getAllEvents() });
});

export default router;
