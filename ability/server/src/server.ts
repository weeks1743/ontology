import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db, initDatabase } from './db.js';
import { initializeDatabases, disconnectAll } from './database/index.js';
import { loadExternalSkills } from './engine/external-skills.js';
import { eventBus } from './engine/event-bus.js';
import skillsRouter from './routes/skills.js';
import executeRouter from './routes/execute.js';
import logsRouter from './routes/logs.js';
import databaseRouter from './routes/database.js';
import ontologySkillsRouter from './routes/ontology-skills.js';
import externalSkillsRouter from './routes/external-skills.js';
import ontologiesRouter from './routes/ontologies.js';
import eventBusRouter from './routes/event-bus.js';
import mockDataRouter from './routes/mock-data.js';
// skill-core: 新增 SKILL 核心模块（独立路由）
import { skillCoreRouter, initSkillCore } from './skill-core/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3002;

// 确保 tmp 目录存在（项目根目录的 tmp，与 executor.ts 输出路径一致）
const TMP_DIR = join(__dirname, '../../tmp');
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 静态文件：tmp 目录用于存放生成的 HTML 报告
app.use('/tmp', express.static(TMP_DIR));

// 初始化 SQLite 数据库
initDatabase();

// 初始化外部数据库连接（软依赖）
await initializeDatabases();

// 加载外部技能
console.log('🔧 Loading external skills...');
const externalCount = await loadExternalSkills();
console.log(`✅ Loaded ${externalCount} external skills`);

// skill-core: 初始化 Claude Code 兼容的 SKILL 核心
const skillCoreCount = initSkillCore();
console.log(`✅ [skill-core] Loaded ${skillCoreCount} skills (Claude Code compatible)`);

// 路由
// Register CRM event subscriptions (hardcoded for CRM ontology)
eventBus.registerSubscription('visit_record.created', {
  skillId: '',  // Resolved at runtime via slug lookup
  behaviorCode: 'VisitRecord.Analyze',
});
eventBus.registerSubscription('visit_record.analyzed', {
  skillId: '',
  behaviorCode: 'Customer.GenerateOperatingAdvice',
});
console.log('✅ Event bus: CRM event subscriptions registered');

app.use('/api/ontologies', ontologiesRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/skills', executeRouter);
app.use('/api/logs', logsRouter);
app.use('/api/database', databaseRouter);
app.use('/api/ontology-skills', ontologySkillsRouter);
app.use('/api/external-skills', externalSkillsRouter);
app.use('/api/event-bus', eventBusRouter);
app.use('/api/mock-data', mockDataRouter);
// skill-core: Claude Code 兼容的 SKILL API（独立前缀）
app.use('/api/v2/skills', skillCoreRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Ability Layer Server running on http://localhost:${PORT}`);
});

// Set server timeout to 10 minutes for long-running LLM operations (e.g., PPTX generation with multiple continuations)
server.timeout = 600000; // 10 minutes

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
