import { Router } from 'express';
import { db } from '../db.js';
import { getDatabaseStatus, healthCheckAll } from '../database/index.js';

const router = Router();

// 获取数据库状态
router.get('/status', async (req, res) => {
  try {
    // 执行健康检查
    const status = await healthCheckAll();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 更新数据库配置
router.post('/config', (req, res) => {
  try {
    const { db_type, connection_url, username, password, database_name } = req.body;
    const now = new Date().toISOString();

    // 检查是否已存在
    const existing = db.prepare('SELECT * FROM db_configs WHERE db_type = ?').get(db_type);

    if (existing) {
      // 更新
      db.prepare(`
        UPDATE db_configs
        SET connection_url = ?, username = ?, password = ?, database_name = ?, last_check = ?
        WHERE db_type = ?
      `).run(connection_url, username, password, database_name, now, db_type);
    } else {
      // 插入
      db.prepare(`
        INSERT INTO db_configs (id, db_type, connection_url, username, password, database_name, status, last_check)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(db_type, db_type, connection_url, username, password, database_name, 'offline', now);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
