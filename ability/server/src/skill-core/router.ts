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
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKILLS_DIR = join(__dirname, '../../../skills');
const TMP_DIR = join(__dirname, '../../../tmp');

export const skillCoreRouter = Router();

// ─── 初始化 ─────────────────────────────────────────────────

// 启动时自动扫描 skills/ 目录
export function initSkillCore(): number {
  const externalDir = join(SKILLS_DIR, 'external');
  const ontologyBaseDir = join(SKILLS_DIR, 'ontology');

  let count = 0;
  if (existsSync(externalDir)) count += discoverAndLoadSkills(externalDir, 'external');

  // Support two-level structure: skills/ontology/<ontologyId>/<skillSlug>/SKILL.md
  if (existsSync(ontologyBaseDir)) {
    try {
      const entries = readdirSync(ontologyBaseDir, { withFileTypes: true });
      let foundOntologySubdirs = false;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subDir = join(ontologyBaseDir, entry.name);
        // Check if this looks like an ontologyId dir (contains skill dirs, not SKILL.md directly)
        const subEntries = readdirSync(subDir, { withFileTypes: true });
        const hasDirectSkillMd = subEntries.some(e => e.name === 'SKILL.md');

        if (!hasDirectSkillMd) {
          // Two-level: skills/ontology/<ontologyId>/
          count += discoverAndLoadSkills(subDir, 'ontology');
          foundOntologySubdirs = true;
        }
      }

      if (!foundOntologySubdirs) {
        // Old single-level: skills/ontology/<skillSlug>/SKILL.md
        count += discoverAndLoadSkills(ontologyBaseDir, 'ontology');
      }
    } catch {
      count += discoverAndLoadSkills(ontologyBaseDir, 'ontology');
    }
  }

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
    model: skill.frontmatter.model,
    shell: skill.frontmatter.shell || 'bash',
    loadedFrom: skill.loadedFrom,
  }));

  res.json({ skills, count: skills.length });
});

/** GET /api/v2/skills/list-tmp-files — 列出 tmp 目录中的文件 */
skillCoreRouter.get('/list-tmp-files', (req: Request, res: Response) => {
  const extension = req.query.extension as string | undefined;

  if (!existsSync(TMP_DIR)) {
    res.json({ files: [] });
    return;
  }

  try {
    const files = readdirSync(TMP_DIR)
      .filter(f => {
        if (extension) {
          return f.endsWith(`.${extension}`);
        }
        return true;
      })
      .map(f => {
        const stat = statSync(join(TMP_DIR, f));
        return { name: f, mtime: stat.mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .map(f => f.name);

    res.json({ files });
  } catch (error) {
    console.error('[skill-core] Failed to list tmp files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
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

  console.log(`[skill-core-router] ========== EXECUTE REQUEST START ==========`);
  console.log(`[skill-core-router] Skill ID: ${req.params.id}`);
  console.log(`[skill-core-router] Mode: ${mode || 'auto'}`);
  console.log(`[skill-core-router] Params keys: ${params ? Object.keys(params).join(', ') : 'none'}`);
  console.log(`[skill-core-router] Request timestamp: ${new Date().toISOString()}`);

  try {
    console.log(`[skill-core-router] Calling executeSkill...`);
    const result = await executeSkill({
      skillId: req.params.id,
      args,
      params,
      mode,
      workingDirectory,
    });

    console.log(`[skill-core-router] executeSkill returned: success=${result.success}, mode=${result.executionMode}`);

    if (!result.success) {
      console.log(`[skill-core-router] Execution failed: ${result.error}`);
      res.status(400).json(result);
    } else {
      console.log(`[skill-core-router] Execution succeeded, sending response`);
      res.json(result);
    }
  } catch (error) {
    console.error(`[skill-core-router] ❌ Exception caught:`, error);
    res.status(500).json({
      success: false,
      executionMode: mode || 'inline',
      error: error instanceof Error ? error.message : String(error),
      durationMs: 0,
    });
  }
  console.log(`[skill-core-router] ========== EXECUTE REQUEST END ==========`);
});

/** POST /api/v2/skills/save-html — 保存 HTML 内容到 tmp 目录，返回文件 URL */
skillCoreRouter.post('/save-html', (req: Request, res: Response) => {
  const { html, testId, skillId } = req.body as { html: string; testId?: string; skillId?: string };

  if (!html || typeof html !== 'string') {
    res.status(400).json({ error: 'Missing html content' });
    return;
  }

  // 确保 tmp 目录存在
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }

  // 生成文件名：testId-uuid.html
  const fileId = randomUUID().slice(0, 8);
  const prefix = testId || skillId || 'report';
  const filename = `${prefix}-${fileId}.html`;
  const filePath = join(TMP_DIR, filename);

  writeFileSync(filePath, html, 'utf-8');

  // 返回可通过 /tmp/ 访问的 URL
  const fileUrl = `/tmp/${filename}`;
  console.log(`[skill-core] Saved HTML report: ${filename} (${html.length} chars)`);

  res.json({ success: true, filename, url: fileUrl });
});

/** POST /api/v2/skills/save-file — 保存任意格式文件到 tmp 目录，返回文件 URL */
skillCoreRouter.post('/save-file', (req: Request, res: Response) => {
  const { content, testId, skillId, extension } = req.body as {
    content: string;
    testId?: string;
    skillId?: string;
    extension?: string;
  };

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'Missing content' });
    return;
  }

  // 确保 tmp 目录存在
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }

  // 生成文件名：testId-uuid.ext
  const fileId = randomUUID().slice(0, 8);
  const prefix = testId || skillId || 'file';
  const ext = extension || 'txt';
  const filename = `${prefix}-${fileId}.${ext}`;
  const filePath = join(TMP_DIR, filename);

  writeFileSync(filePath, content, 'utf-8');

  // 返回可通过 /tmp/ 访问的 URL
  const fileUrl = `/tmp/${filename}`;
  console.log(`[skill-core] Saved file: ${filename} (${content.length} chars)`);

  res.json({ success: true, filename, url: fileUrl });
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

/** 从 stream-json 事件中提取可读文本 */
function extractStreamJsonText(event: any): string | null {
  if (!event || typeof event.type !== 'string') return null;
  switch (event.type) {
    case 'assistant': {
      const content = event.message?.content;
      if (!Array.isArray(content)) return null;
      return content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => String(c.text))
        .join('') || null;
    }
    case 'tool_use':
      return `\n⚙️ [${event.name}]\n`;
    case 'tool_result': {
      const content = event.content;
      if (!Array.isArray(content)) return null;
      const text = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => String(c.text))
        .join('');
      return text ? `→ ${text.slice(0, 400)}${text.length > 400 ? '…' : ''}\n` : null;
    }
    case 'result':
      return typeof event.result === 'string' ? event.result : null;
    default:
      return null;
  }
}

/** POST /api/v2/skills/:id/agent-execute — 用 claude CLI 真实执行 agentic 技能（SSE 流式输出）
 *
 * 请求体：{ instruction: string, workingDirectory?: string }
 * 响应：text/event-stream
 *   data: { type: 'output', text: string }
 *   data: { type: 'done', exitCode: number, signal?: string }
 *   data: { type: 'error', text: string }
 *
 * 两个关键处理：
 *  1. 把 SKILL.md body 注入 prompt 前缀，避免依赖 slash command 注册（Unknown skill 问题）
 *  2. 使用 --output-format stream-json 逐行输出 JSON 事件，解决管道缓冲问题
 */
skillCoreRouter.post('/:id/agent-execute', (req: Request, res: Response) => {
  const skillId = req.params.id;
  const { instruction, workingDirectory, timeoutMs, maxTurns } = req.body as {
    instruction?: string;
    workingDirectory?: string;
    timeoutMs?: number;
    maxTurns?: number;
  };

  if (!instruction) {
    res.status(400).json({ error: 'Missing instruction' });
    return;
  }

  const skill = getSkillById(skillId);
  if (!skill) {
    res.status(404).json({ error: `Skill not found: ${skillId}` });
    return;
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data: object) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client gone */ }
  };

  // 去掉指令中的 slash command 前缀（/pptx、/company-research 等）
  const taskText = instruction.replace(/^\/\S+\s*/, '');

  // 构造完整 prompt：SKILL.md body（技能上下文） + 用户任务
  const fullPrompt = skill.body
    ? `${skill.body}\n\n---\n\n以下是需要执行的具体任务：\n\n${taskText}`
    : taskText;

  // tsx 运行时 __dirname = server/src/skill-core/，上溯 3 级到 ability/ 项目���
  const cwd = workingDirectory || join(__dirname, '../../..');
  const effectiveTimeout = timeoutMs ?? 300_000; // 默认 5 分钟
  const effectiveMaxTurns = maxTurns ?? 60;       // 默认最多 60 轮
  console.log(`[agent-execute] skill=${skillId} cwd=${cwd} timeout=${effectiveTimeout}ms maxTurns=${effectiveMaxTurns}`);

  const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';

  const proc = spawn(
    claudePath,
    [
      '--dangerously-skip-permissions',
      '--verbose',
      '--output-format', 'stream-json',
      '--max-turns', String(effectiveMaxTurns),
      '-p', fullPrompt,
    ],
    {
      cwd,
      env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  proc.stdin.end();

  // 超时保护：到期后强制终止并通知前端
  const timeoutHandle = setTimeout(() => {
    if (!proc.killed) {
      console.warn(`[agent-execute] timeout after ${effectiveTimeout}ms, killing proc`);
      proc.kill('SIGTERM');
      sendEvent({ type: 'output', text: `\n⏱️ 已超时（${effectiveTimeout / 1000}s），agent 被强制终止。\n` });
    }
  }, effectiveTimeout);

  // 逐行解析 stream-json，提取可读文本
  let lineBuffer = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed);
        const text = extractStreamJsonText(event);
        if (text) sendEvent({ type: 'output', text });
      } catch {
        sendEvent({ type: 'output', text: line + '\n' });
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    console.error(`[agent-execute:stderr] ${text.slice(0, 300)}`);
    sendEvent({ type: 'output', text });
  });

  proc.on('error', (err: Error) => {
    clearTimeout(timeoutHandle);
    console.error(`[agent-execute] spawn error: ${err.message}`);
    sendEvent({ type: 'error', text: `无法启动 claude: ${err.message}` });
    if (!res.writableEnded) res.end();
  });

  proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
    clearTimeout(timeoutHandle);
    if (lineBuffer.trim()) {
      try {
        const event = JSON.parse(lineBuffer.trim());
        const text = extractStreamJsonText(event);
        if (text) sendEvent({ type: 'output', text });
      } catch {
        sendEvent({ type: 'output', text: lineBuffer });
      }
    }
    console.log(`[agent-execute] close: code=${code} signal=${signal}`);
    sendEvent({ type: 'done', exitCode: code ?? -1, signal: signal ?? undefined });
    if (!res.writableEnded) res.end();
  });

  res.on('close', () => {
    clearTimeout(timeoutHandle);
    if (!proc.killed) {
      console.log(`[agent-execute] SSE client disconnected, killing claude proc`);
      proc.kill('SIGTERM');
    }
  });
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
