import { Router } from 'express';
import { db } from '../db.js';
import { Skill } from '../types.js';
import { getAllSkills, getSkillById } from '../skill-core/discovery.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const router = Router();

// 加载技能名称映射配置
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skillNamesPath = join(__dirname, '../../config/skill-names.json');
let skillNamesMap: Record<string, { display_name: string; emoji?: string; github_path?: string }> = {};

function loadOntologySkillManifestField(skill: any, field: string): any {
  try {
    if (!skill.path) return undefined;
    const manifestPath = join(skill.path, 'manifest.json');
    if (!existsSync(manifestPath)) return undefined;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    return manifest[field];
  } catch {
    return undefined;
  }
}

try {
  if (existsSync(skillNamesPath)) {
    const content = readFileSync(skillNamesPath, 'utf-8');
    skillNamesMap = JSON.parse(content);
  }
} catch (error) {
  console.warn('Failed to load skill-names.json:', error);
}

// 获取所有技能（合并 SQLite + skill-core registry）
router.get('/', (req, res) => {
  try {
    const { ontology_id } = req.query;

    // ontology_id 为必传参数（对于 ontology 类技能）
    // external 类技能不按 ontology_id 过滤（全局共享）

    // 1. 从 SQLite 获取技能
    let sqliteSkills: any[];
    if (ontology_id) {
      // 获取指定 ontology_id 的 ontology 技能 + 所有 external 技能
      sqliteSkills = db.prepare(`
        SELECT * FROM skills
        WHERE (ontology_id = ? AND category = 'ontology') OR category = 'external'
        ORDER BY created_at DESC
      `).all(ontology_id as string) as any[];
    } else {
      // 如果没有 ontology_id，只返回 external 技能
      sqliteSkills = db.prepare(`
        SELECT * FROM skills WHERE category = 'external' ORDER BY created_at DESC
      `).all() as any[];
    }

    const parsedSqliteSkills = sqliteSkills.map(skill => ({
      ...skill,
      metadata: JSON.parse(skill.metadata as string),
      input_schema: skill.input_schema ? JSON.parse(skill.input_schema as string) : undefined,
      output_schema: skill.output_schema ? JSON.parse(skill.output_schema as string) : undefined,
    })).map(skill => {
      const triggerType = skill.category === 'ontology' ? loadOntologySkillManifestField(skill, 'trigger_type') : undefined;
      const ownerObject = skill.category === 'ontology' ? loadOntologySkillManifestField(skill, 'owner_object') : undefined;
      return {
        ...skill,
        trigger_type: triggerType || skill.trigger_type,
        owner_object: ownerObject || skill.owner_object,
        metadata: triggerType
          ? { ...(skill.metadata || {}), trigger_type: triggerType }
          : skill.metadata,
      };
    });

    // 2. 从 skill-core registry 获取新系统技能（仅 external）
    const skillCoreSkills = getAllSkills()
      .filter(skill => skill.loadedFrom === 'external')
      .map(skill => {
        const nameMapping = skillNamesMap[skill.id] || {};
        return {
          id: skill.id,
          name: skill.frontmatter.name || skill.id,
          display_name: nameMapping.display_name || skill.frontmatter.name || skill.id,
          description: skill.frontmatter.description || '',
          category: 'external',
          source: skill.skillDir,
          metadata: {
            ...(typeof skill.frontmatter.metadata === 'object' ? skill.frontmatter.metadata : {}),
            emoji: nameMapping.emoji || (typeof skill.frontmatter.metadata === 'object' ? (skill.frontmatter.metadata as any)?.emoji : undefined),
            context: skill.frontmatter.context,
            arguments: skill.frontmatter.arguments,
            when_to_use: skill.frontmatter.when_to_use,
            version: skill.frontmatter.version,
            user_invocable: skill.frontmatter['user-invocable'],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

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

// 获取硬编码技能 ID 映射（不在 DB 中的特殊行为技能）
router.get('/hardcoded', (req, res) => {
  res.json({
    skills: {
      'visit_record.create_from_markdown': 'hardcoded.visit_record.create_from_markdown',
      'visit_record.analyze': 'hardcoded.visit_record.analyze',
      'customer.generate_operating_advice': 'hardcoded.customer.generate_operating_advice',
    },
  });
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
      trigger_type: loadOntologySkillManifestField(skill as any, 'trigger_type'),
      owner_object: loadOntologySkillManifestField(skill as any, 'owner_object'),
    };
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// 获取技能详情（README.md 或 SKILL.md body）
router.get('/:id/detail', (req, res) => {
  try {
    // 先尝试从 skill-core registry 获取（外部技能）
    let skill = getSkillById(req.params.id);
    let skillDir: string;
    let skillBody: string | undefined;

    if (skill) {
      // 外部技能
      skillDir = skill.skillDir;
      skillBody = skill.body;
    } else {
      // 尝试从 SQLite 查询（本体技能）
      const dbSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id) as any;
      if (!dbSkill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      // 构建技能目录路径
      if (dbSkill.path) {
        skillDir = dbSkill.path;
      } else if (dbSkill.ontology_id && dbSkill.skill_slug) {
        skillDir = join(__dirname, '../../../skills/ontology', dbSkill.ontology_id, dbSkill.skill_slug);
      } else {
        return res.status(404).json({ error: 'Skill directory not found' });
      }

      // 本体技能没有 pre-parsed body，后续读取完整文件
      skillBody = undefined;
    }

    const readmeZhPath = join(skillDir, 'README.zh-CN.md');
    const readmePath = join(skillDir, 'README.md');
    const skillMdPath = join(skillDir, 'SKILL.md');

    // 获取 GitHub 仓库信息（仅外部技能）
    const nameMapping = skillNamesMap[req.params.id] || {};
    const githubBaseUrl = skillNamesMap['_github_base_url'] || '';
    const githubPath = nameMapping.github_path || '';

    // 优先读取 README.zh-CN.md（中文文档优先）
    if (existsSync(readmeZhPath)) {
      const content = readFileSync(readmeZhPath, 'utf-8');
      return res.json({
        skill_id: req.params.id,
        content,
        source: 'README.zh-CN.md',
        github_base_url: githubBaseUrl,
        github_path: githubPath,
      });
    }

    // 其次读取 README.md
    if (existsSync(readmePath)) {
      const content = readFileSync(readmePath, 'utf-8');
      return res.json({
        skill_id: req.params.id,
        content,
        source: 'README.md',
        github_base_url: githubBaseUrl,
        github_path: githubPath,
      });
    }

    // 最后返回 SKILL.md
    if (existsSync(skillMdPath)) {
      // 对于本体技能，读取完整文件；对于外部技能，使用已解析的 body
      let content = skillBody || readFileSync(skillMdPath, 'utf-8');

      // 移除 YAML frontmatter（如果存在）
      if (content.startsWith('---\n')) {
        const endIndex = content.indexOf('\n---\n', 4);
        if (endIndex !== -1) {
          content = content.substring(endIndex + 5).trim();
        }
      }

      return res.json({
        skill_id: req.params.id,
        content,
        source: 'SKILL.md',
        github_base_url: githubBaseUrl,
        github_path: githubPath,
      });
    }

    res.status(404).json({ error: 'No README.md or SKILL.md found' });
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
      INSERT INTO skills (id, name, description, category, source, ontology_id, metadata, input_schema, output_schema, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      skill.id,
      skill.name,
      skill.description,
      skill.category,
      skill.source,
      skill.ontology_id || null,
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
