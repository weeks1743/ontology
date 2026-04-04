import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import ontologiesRouter from './routes/ontologies';
import objectsRouter from './routes/objects';
import behaviorsRouter from './routes/behaviors';
import rulesRouter from './routes/rules';
import eventsRouter from './routes/events';
import scenariosRouter from './routes/scenarios';
import yamlRouter from './routes/yaml';
import validationRouter from './routes/validation';
import seedRouter from './routes/seed';

const app = express();
const PORT = process.env['PORT'] ?? 3001;

// Init DB
initDb();

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api/ontologies', ontologiesRouter);
app.use('/api/ontologies/:id/objects', objectsRouter);
app.use('/api/ontologies/:id/behaviors', behaviorsRouter);
app.use('/api/ontologies/:id/rules', rulesRouter);
app.use('/api/ontologies/:id/events', eventsRouter);
app.use('/api/ontologies/:id/scenarios', scenariosRouter);
app.use('/api/ontologies/:id/yaml', yamlRouter);
app.use('/api/ontologies/:id/validation', validationRouter);
app.use('/api/ontologies/:id/seed', seedRouter);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Ontology server running on http://localhost:${PORT}`);
});
