/**
 * SKILL 执行引擎
 * 支持 inline / fork / spawn 三种执行模式
 *
 * inline: 参数替换 + shell 执行 + LLM 执行（对话扩展）
 * fork:   worker thread 隔离执行（子代理模拟）
 * spawn:  向后兼容旧格式（child_process 子进程）
 *
 * 独立模块，不依赖现有 ability skill-executor.ts
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import type {
  ParsedSkill,
  SkillExecutionRequest,
  SkillExecutionResult,
} from './types.js';
import { substituteArguments, parseArgumentNames } from './params.js';
import { executeShellCommandsInPrompt, hasShellCommands } from './shell.js';
import { getSkillById } from './discovery.js';
import { getSkillConfig } from '../engine/external-skills.js';

// ─── LLM 配置（延迟读取 .env，避免模块加载顺序问题）──────────

let openaiClient: OpenAI | null = null;

function getLLMConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  };
}

function getLLMClient(): OpenAI {
  const config = getLLMConfig();
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }
  return openaiClient;
}

function isLLMConfigured(): boolean {
  const key = process.env.DEEPSEEK_API_KEY || '';
  return key.length > 0 && !key.startsWith('your_');
}

// ─── Main Executor ──────────────────────────────────────────

/**
 * 统一执行入口
 * 根据 frontmatter.context 和请求参数路由到具体执行器
 */
export async function executeSkill(
  request: SkillExecutionRequest,
): Promise<SkillExecutionResult> {
  const startTime = Date.now();

  // 1. 查找技能
  const skill = getSkillById(request.skillId);
  if (!skill) {
    return failResult(`Skill not found: ${request.skillId}`, startTime);
  }

  // 2. 确定执行模式
  const mode = request.mode || skill.frontmatter.context || detectExecutionMode(skill);

  // 3. 路由到具体执行器
  try {
    switch (mode) {
      case 'inline':
        return await executeInline(skill, request, startTime);
      case 'fork':
        return await executeFork(skill, request, startTime);
      case 'spawn':
        return await executeSpawn(skill, request, startTime);
      default:
        return await executeInline(skill, request, startTime);
    }
  } catch (error) {
    return failResult(
      error instanceof Error ? error.message : String(error),
      startTime,
      mode as 'inline' | 'fork' | 'spawn',
    );
  }
}

// ─── Inline Executor ────────────────────────────────────────

/**
 * inline 执行：参数替换 + shell 执行 + LLM 执行
 * 模拟 Claude Code 的 "扩展到对话" 行为
 *
 * 执行流程：
 * 1. 参数替换（$ARGUMENTS / $0 / $named）
 * 2. Shell 命令预执行（!`command` 和 ```! ... ```）
 * 3. 向后兼容 scripts/ 目录脚本
 * 4. LLM 执行（将 SKILL body + 用户参数发给 DeepSeek）
 */
async function executeInline(
  skill: ParsedSkill,
  request: SkillExecutionRequest,
  startTime: number,
): Promise<SkillExecutionResult> {
  // 1. 参数替换
  const args = typeof request.args === 'string' ? request.args : undefined;
  const paramArgs = request.params
    ? Object.values(request.params).join(' ')
    : args;

  const argumentNames = parseArgumentNames(skill.frontmatter.arguments);
  let body = substituteArguments(skill.body, paramArgs, {
    argumentNames,
    skillDir: skill.skillDir,
    appendIfNoPlaceholder: true,
  });

  // 2. Shell 命令执行（如果 body 包含 !`...` 或 ```! ... ```）
  let shellCommands: string[] = [];
  let shellOutputs: string[] = [];

  if (hasShellCommands(body)) {
    const shellResult = await executeShellCommandsInPrompt(body, {
      shell: skill.frontmatter.shell || 'bash',
      cwd: request.workingDirectory || skill.skillDir,
      timeout: 30000,
    });
    body = shellResult.content;
    shellCommands = shellResult.executedCommands;
    shellOutputs = shellResult.outputs;
  }

  // 3. 向后兼容：如果有 scripts/ 目录下的可执行脚本
  if (shellCommands.length === 0 && request.params) {
    const scriptResult = await tryExecuteScript(skill, request.params);
    if (scriptResult) {
      return {
        success: true,
        executionMode: 'inline',
        substitutedBody: body,
        shellCommands,
        shellOutputs,
        spawnOutput: scriptResult,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 4. LLM 执行：将 SKILL body 作为 system prompt，用户参数作为 user message
  if (isLLMConfigured() && body.length > 100) {
    const llmResult = await executeWithLLM(skill, body, request.params);
    if (llmResult) {
      return {
        success: true,
        executionMode: 'inline',
        substitutedBody: body,
        shellCommands,
        shellOutputs,
        spawnOutput: llmResult,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 5. 降级：返回参数替换后的 body
  return {
    success: true,
    executionMode: 'inline',
    substitutedBody: body,
    shellCommands,
    shellOutputs,
    durationMs: Date.now() - startTime,
  };
}

// ─── Fork Executor ──────────────────────────────────────────

/**
 * fork 执行：创建隔离的执行环境
 * 使用 LLM + 隔离 child_process 模拟子代理
 */
async function executeFork(
  skill: ParsedSkill,
  request: SkillExecutionRequest,
  startTime: number,
): Promise<SkillExecutionResult> {
  const args = typeof request.args === 'string' ? request.args : undefined;
  const paramArgs = request.params
    ? Object.values(request.params).join(' ')
    : args;

  const argumentNames = parseArgumentNames(skill.frontmatter.arguments);
  const prompt = substituteArguments(skill.body, paramArgs, {
    argumentNames,
    skillDir: skill.skillDir,
    appendIfNoPlaceholder: true,
  });

  // Shell 命令预执行
  let processedPrompt = prompt;
  if (hasShellCommands(prompt)) {
    const shellResult = await executeShellCommandsInPrompt(prompt, {
      cwd: request.workingDirectory || skill.skillDir,
      timeout: 60000,
    });
    processedPrompt = shellResult.content;
  }

  // LLM 执行
  if (isLLMConfigured()) {
    const llmResult = await executeWithLLM(skill, processedPrompt, request.params);
    if (llmResult) {
      return {
        success: true,
        executionMode: 'fork',
        substitutedBody: processedPrompt,
        spawnOutput: llmResult,
        durationMs: Date.now() - startTime,
      };
    }
  }

  return {
    success: true,
    executionMode: 'fork',
    substitutedBody: processedPrompt,
    durationMs: Date.now() - startTime,
  };
}

// ─── Spawn Executor (Legacy) ────────────────────────────────

/**
 * spawn 执行：向后兼容旧格式
 * 使用 child_process.spawn 执行 scripts/ 目录下的脚本
 */
async function executeSpawn(
  skill: ParsedSkill,
  request: SkillExecutionRequest,
  startTime: number,
): Promise<SkillExecutionResult> {
  const params = request.params || {};

  const spawnOutput = await tryExecuteScript(skill, params);
  if (spawnOutput === null) {
    return failResult(
      `No executable script found for skill: ${skill.id}`,
      startTime,
      'spawn',
    );
  }

  return {
    success: true,
    executionMode: 'spawn',
    spawnOutput,
    durationMs: Date.now() - startTime,
  };
}

// ─── LLM Executor ───────────────────────────────────────────

/**
 * 使用 DeepSeek（OpenAI 兼容格式）执行 SKILL
 *
 * 将 SKILL.md body 作为 system prompt
 * 将用户参数格式化为 user message
 * 返回 LLM 生成的文本结果
 */
async function executeWithLLM(
  skill: ParsedSkill,
  processedBody: string,
  params?: Record<string, unknown>,
): Promise<string | null> {
  try {
    const config = getLLMConfig();
    console.log(`[skill-core] LLM config: model=${config.model}, key=${config.apiKey ? config.apiKey.substring(0, 8) + '...' : 'EMPTY'}, base=${config.baseURL}`);
    const client = getLLMClient();

    // 构建 system prompt：SKILL 名称 + 描述 + body 指令
    const skillName = skill.frontmatter.name || skill.id;
    const skillDesc = skill.frontmatter.description || '';

    const systemPrompt = [
      `You are a SKILL executor. You MUST execute the SKILL "${skillName}" immediately and output the result directly.`,
      skillDesc ? `SKILL Description: ${skillDesc}` : '',
      '',
      'CRITICAL RULES:',
      '1. DO NOT ask questions or wait for user confirmation — execute immediately.',
      '2. DO NOT explain what you would do — just do it and output the result.',
      '3. Output ONLY the final result (HTML, JSON, or text as specified by the SKILL).',
      '4. Do NOT wrap output in markdown code blocks unless the SKILL says to.',
      '5. If the SKILL says to generate HTML, output raw HTML starting with <!DOCTYPE html>.',
      '6. If the SKILL says to generate JSON, output raw JSON.',
      '',
      '=== SKILL INSTRUCTIONS START ===',
      processedBody,
      '=== SKILL INSTRUCTIONS END ===',
    ].join('\n');

    // 构建 user message：用户的输入参数
    const userMessage = params
      ? `Execute this SKILL NOW with these parameters (generate output directly, no questions):\n\n${JSON.stringify(params, null, 2)}`
      : 'Execute this SKILL NOW with default parameters. Generate output directly.';

    const response = await client.chat.completions.create({
      model: getLLMConfig().model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    });

    // 检查是否被截断（length 模式意味着输出超出了 max_tokens）
    const finishReason = response.choices[0]?.finish_reason;
    let content = response.choices[0]?.message?.content || '';

    if (finishReason === 'length' && content.length > 0) {
      console.log(`[skill-core] Output truncated (${content.length} chars), continuing generation...`);
      content = await continueGeneration(client, systemPrompt, userMessage, content);
    }

    if (!content) {
      console.error('[skill-core] LLM returned empty content');
      return null;
    }

    console.log(`[skill-core] LLM executed skill "${skill.id}" (${content.length} chars, ${response.usage?.total_tokens || 0} tokens)`);
    return content;
  } catch (error) {
    console.error('[skill-core] LLM execution failed:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 继续被截断的生成
 * 将已生成的内容作为上下文，让 LLM 接着生成剩余部分
 * 持续航写直到完成（或达到最大尝试次数）
 */
async function continueGeneration(
  client: OpenAI,
  systemPrompt: string,
  originalUserMessage: string,
  existingContent: string,
): Promise<string> {
  let fullContent = existingContent;
  const maxRetries = 10;  // 增加到 10 次，理论最大 81920 tokens

  for (let i = 0; i < maxRetries; i++) {
    const continueMessage = `The previous output was truncated. Continue generating from where you left off. Output ONLY the continuation, do NOT repeat any previous content.\n\nLast 500 characters of previous output:\n${fullContent.slice(-500)}`;

    const response = await client.chat.completions.create({
      model: getLLMConfig().model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: originalUserMessage },
        { role: 'assistant', content: fullContent },
        { role: 'user', content: continueMessage },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    });

    const continuation = response.choices[0]?.message?.content || '';
    fullContent += continuation;

    const finishReason = response.choices[0]?.finish_reason;
    // 如果不是因为长度截断，说明生成完成
    if (finishReason !== 'length') {
      console.log(`[skill-core] Generation completed after ${i + 1} continuations (${fullContent.length} chars total)`);
      break;
    }

    console.log(`[skill-core] Continued generation (${fullContent.length} chars total, attempt ${i + 1}/${maxRetries})`);

    // 安全检查：如果连续 10 次都被截断，可能是无限循环
    if (i === maxRetries - 1) {
      console.warn(`[skill-core] Max retries reached (${maxRetries}), output may be incomplete`);
    }
  }

  return fullContent;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * 自动检测执行模式
 * 根据 SKILL.md 内容判断使用 inline、fork 还是 spawn
 */
function detectExecutionMode(skill: ParsedSkill): 'inline' | 'fork' | 'spawn' {
  const body = skill.body;

  // body 中有 shell 执行语法 → inline
  if (hasShellCommands(body)) return 'inline';

  // 有 scripts/ 目录且包含可执行脚本 → spawn
  const scriptsDir = join(skill.skillDir, 'scripts');
  if (existsSync(scriptsDir)) {
    const scriptFiles = ['generate.js', 'search.py', 'execute.js', 'run.py', 'index.js'];
    for (const file of scriptFiles) {
      if (existsSync(join(scriptsDir, file))) return 'spawn';
    }
  }

  // 默认 inline
  return 'inline';
}

/**
 * 尝试执行 scripts/ 目录下的脚本（向后兼容）
 */
async function tryExecuteScript(
  skill: ParsedSkill,
  params: Record<string, unknown>,
): Promise<unknown | null> {
  const scriptsDir = join(skill.skillDir, 'scripts');
  if (!existsSync(scriptsDir)) return null;

  // 查找可执行脚本
  const scriptFiles = ['generate.js', 'search.py', 'execute.js', 'run.py', 'index.js'];
  let scriptPath: string | null = null;
  let command: string | null = null;

  for (const file of scriptFiles) {
    const fullPath = join(scriptsDir, file);
    if (existsSync(fullPath)) {
      scriptPath = fullPath;
      command = file.endsWith('.py') ? 'python3' : 'node';
      break;
    }
  }

  if (!scriptPath || !command) return null;

  // 加载技能配置（从 skills.json）
  const skillConfig = getSkillConfig(skill.id);

  // 执行脚本
  return new Promise((resolve, reject) => {
    const proc = spawn(command, [scriptPath, JSON.stringify(params)], {
      cwd: skill.skillDir,
      env: { ...process.env, ...skillConfig } as Record<string, string>,  // 合并配置
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout);
      }
    });

    proc.on('error', reject);
  });
}

function failResult(
  error: string,
  startTime: number,
  mode: 'inline' | 'fork' | 'spawn' = 'inline',
): SkillExecutionResult {
  return {
    success: false,
    executionMode: mode,
    error,
    durationMs: Date.now() - startTime,
  };
}
