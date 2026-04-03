import { Router } from 'express';
import { db } from '../db.js';
import { Skill } from '../types.js';
import { getAllSkills } from '../skill-core/discovery.js';

const router = Router();

// 获取所有技能（合并 SQLite + skill-core registry）
router.get('/', (req, res) => {
  try {
    // 1. 从 SQLite 获取旧系统技能
    const sqliteSkills = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
    const parsedSqliteSkills = sqliteSkills.map(skill => ({
      ...skill,
      metadata: JSON.parse(skill.metadata as string),
      input_schema: skill.input_schema ? JSON.parse(skill.input_schema as string) : undefined,
      output_schema: skill.output_schema ? JSON.parse(skill.output_schema as string) : undefined,
    }));

    // 2. 从 skill-core registry 获取新系统技能
    const skillCoreSkills = getAllSkills().map(skill => ({
      id: skill.id,
      name: skill.frontmatter.name || skill.id,
      description: skill.frontmatter.description || '',
      category: skill.loadedFrom === 'external' ? 'external' : skill.loadedFrom,
      source: skill.skillDir,
      metadata: {
        ...skill.frontmatter.metadata,
        emoji: skill.frontmatter.metadata?.emoji,
        context: skill.frontmatter.context,
        arguments: skill.frontmatter.arguments,
        when_to_use: skill.frontmatter.when_to_use,
        version: skill.frontmatter.version,
        user_invocable: skill.frontmatter['user-invocable'],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // 3. 合并列表（去重：优先使用 skill-core 的数据）
    const skillMap = new Map<string, any>();

    // 先添加 SQLite 技能
    for (const skill of parsedSqliteSkills) {
      skillMap.set(skill.id, skill);
    }

    // 再添加 skill-core 技能（覆盖同名技能）
    for (const skill of skillCoreSkills) {
      skillMap.set(skill.id, skill);
    }

    // 4. 返回合并后的列表
    const mergedSkills = Array.from(skillMap.values());
    res.json(mergedSkills);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取单个技能
router.get('/:id', (req, res) => {
  try {
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    const parsed = {
      ...skill,
      metadata: JSON.parse((skill as any).metadata),
      input_schema: (skill as any).input_schema ? JSON.parse((skill as any).input_schema) : undefined,
      output_schema: (skill as any).output_schema ? JSON.parse((skill as any).output_schema) : undefined,
    };
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 创建技能
router.post('/', (req, res) => {
  try {
    const skill: Skill = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO skills (id, name, description, category, source, metadata, input_schema, output_schema, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      skill.id,
      skill.name,
      skill.description,
      skill.category,
      skill.source,
      JSON.stringify(skill.metadata),
      skill.input_schema ? JSON.stringify(skill.input_schema) : null,
      skill.output_schema ? JSON.stringify(skill.output_schema) : null,
      now,
      now
    );

    res.status(201).json({ ...skill, created_at: now, updated_at: now });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 删除技能
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
