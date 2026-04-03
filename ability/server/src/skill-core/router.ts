/**
 * skill-core 模块路由
 * 独立的 Express Router，不污染现有路由
 *
 * 挂载到 /api/v2/skills 前缀，与现有 /api/skills 完全隔离
 */

import { Router, type Request, type Response } from 'express';
import {
  discoverAndLoadSkills,
  getAllSkills,
  getSkillById,
  reloadSkills,
  validateSkillDir,
} from './discovery.js';
import { executeSkill } from './executor.js';
import { validateSkillMd } from './parser.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKILLS_DIR = join(__dirname, '../../../skills');

export const skillCoreRouter = Router();

// ─── 初始化 ─────────────────────────────────────────────────

// 启动时自动扫描 skills/ 目录
export function initSkillCore(): number {
  const externalDir = join(SKILLS_DIR, 'external');
  const ontologyDir = join(SKILLS_DIR, 'ontology');

  let count = 0;
  if (existsSync(externalDir)) count += discoverAndLoadSkills(externalDir, 'external');
  if (existsSync(ontologyDir)) count += discoverAndLoadSkills(ontologyDir, 'ontology');

  console.log(`[skill-core] Loaded ${count} skills`);
  return count;
}

// ─── Routes ─────────────────────────────────────────────────

/** GET /api/v2/skills — 列出所有技能 */
skillCoreRouter.get('/', (_req: Request, res: Response) => {
  const skills = getAllSkills().map(skill => ({
    id: skill.id,
    name: skill.frontmatter.name || skill.id,
    description: skill.frontmatter.description || '',
    context: skill.frontmatter.context || 'inline',
    userInvocable: skill.frontmatter['user-invocable'] !== 'false',
    arguments: skill.frontmatter.arguments,
    whenToUse: skill.frontmatter.when_to_use,
    version: skill.frontmatter.version,
    shell: skill.frontmatter.shell || 'bash',
    loadedFrom: skill.loadedFrom,
  }));

  res.json({ skills, count: skills.length });
});

/** GET /api/v2/skills/:id — 获取技能详情 */
skillCoreRouter.get('/:id', (req: Request, res: Response) => {
  const skill = getSkillById(req.params.id);
  if (!skill) {
    res.status(404).json({ error: `Skill not found: ${req.params.id}` });
    return;
  }

  res.json({
    id: skill.id,
    skillDir: skill.skillDir,
    frontmatter: skill.frontmatter,
    body: skill.body,
    loadedFrom: skill.loadedFrom,
  });
});

/** POST /api/v2/skills/:id/execute — 执行技能 */
skillCoreRouter.post('/:id/execute', async (req: Request, res: Response) => {
  const { args, params, mode, workingDirectory } = req.body;

  try {
    const result = await executeSkill({
      skillId: req.params.id,
      args,
      params,
      mode,
      workingDirectory,
    });

    if (!result.success) {
      res.status(400).json(result);
    } else {
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      executionMode: mode || 'inline',
      error: error instanceof Error ? error.message : String(error),
      durationMs: 0,
    });
  }
});

/** GET /api/v2/skills/:id/validate — 验证技能 */
skillCoreRouter.get('/:id/validate', (req: Request, res: Response) => {
  const skill = getSkillById(req.params.id);
  if (!skill) {
    res.status(404).json({ error: `Skill not found: ${req.params.id}` });
    return;
  }

  const skillMdPath = join(skill.skillDir, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    res.json({ valid: false, errors: ['SKILL.md not found'], warnings: [] });
    return;
  }

  const content = readFileSync(skillMdPath, { encoding: 'utf-8' });
  const validation = validateSkillMd(content, skillMdPath);

  res.json(validation);
});

/** POST /api/v2/skills/discover — 重新扫描技能目录 */
skillCoreRouter.post('/discover', (req: Request, res: Response) => {
  const { directories } = req.body as { directories?: string[] };

  const dirs = directories || [
    join(SKILLS_DIR, 'external'),
    join(SKILLS_DIR, 'ontology'),
  ];

  const count = reloadSkills(dirs);

  res.json({
    discovered: count,
    skills: getAllSkills().map(s => s.id),
  });
});

/** POST /api/v2/skills/reload — 热重载所有技能 */
skillCoreRouter.post('/reload', (_req: Request, res: Response) => {
  const count = initSkillCore();
  res.json({ reloaded: count, skills: getAllSkills().map(s => s.id) });
});

/** GET /api/v2/skills/:id/body — 获取参数替换后的 body（预览） */
skillCoreRouter.post('/:id/preview', async (req: Request, res: Response) => {
  const skill = getSkillById(req.params.id);
  if (!skill) {
    res.status(404).json({ error: `Skill not found: ${req.params.id}` });
    return;
  }

  const { args } = req.body as { args?: string };

  // 参数替换
  const { substituteArguments, parseArgumentNames } = await import('./params.js');
  const argumentNames = parseArgumentNames(
    typeof skill.frontmatter.arguments === 'string'
      ? skill.frontmatter.arguments
      : Array.isArray(skill.frontmatter.arguments)
        ? skill.frontmatter.arguments
        : undefined,
  );

  const substitutedBody = substituteArguments(skill.body, args, {
    argumentNames,
    skillDir: skill.skillDir,
    appendIfNoPlaceholder: false,
  });

  res.json({
    originalBody: skill.body,
    substitutedBody,
    args,
    argumentNames,
  });
});
