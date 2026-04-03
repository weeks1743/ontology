import express from 'express';
import cors from 'cors';
import { db, initDatabase } from './db.js';
import { initializeDatabases, disconnectAll } from './database/index.js';
import { loadExternalSkills } from './engine/external-skills.js';
import skillsRouter from './routes/skills.js';
import executeRouter from './routes/execute.js';
import logsRouter from './routes/logs.js';
import databaseRouter from './routes/database.js';
import ontologySkillsRouter from './routes/ontology-skills.js';
import externalSkillsRouter from './routes/external-skills.js';

const app = express();
const PORT = 3002;

// 中间件
app.use(cors());
app.use(express.json());

// 初始化 SQLite 数据库
initDatabase();

// 初始化外部数据库连接（软依赖）
await initializeDatabases();

// 加载外部技能
console.log('🔧 Loading external skills...');
const externalCount = await loadExternalSkills();
console.log(`✅ Loaded ${externalCount} external skills`);

// 路由
app.use('/api/skills', skillsRouter);
app.use('/api/skills', executeRouter);
app.use('/api/logs', logsRouter);
app.use('/api/database', databaseRouter);
app.use('/api/ontology-skills', ontologySkillsRouter);
app.use('/api/external-skills', externalSkillsRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Ability Layer Server running on http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  server.close(async () => {
    await disconnectAll();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  server.close(async () => {
    await disconnectAll();
    process.exit(0);
  });
});
