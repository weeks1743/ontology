/**
 * Shell 命令执行引擎
 * 移植自 Claude Code promptShellExecution.ts
 *
 * 支持两种语法：
 * - 代码块：```! ... ```
 * - 行内：  !`command`
 */

import { exec } from 'child_process';
import type { FrontmatterShell } from './types.js';

// Pattern for code blocks: ```! command ```
const BLOCK_PATTERN = /```!\s*\n?([\s\S]*?)\n?```/g;

// Pattern for inline: !`command`
// 需要 whitespace 或行首在 ! 前面，避免误匹配 `!!` 或 `$!`
const INLINE_PATTERN = /(?<=^|\s)!`([^`]+)`/gm;

export interface ShellExecutionResult {
  /** 替换后的完整内容 */
  content: string;
  /** 执行的命令列表 */
  executedCommands: string[];
  /** 命令输出列表 */
  outputs: string[];
  /** 命令错误列表 */
  errors: string[];
}

/**
 * 在技能 body 中查找并执行所有嵌入的 shell 命令
 * 移植自 Claude Code executeShellCommandsInPrompt()
 *
 * @param text - 技能 body 文本
 * @param options - 执行选项
 * @returns 替换后的内容和执行信息
 */
export async function executeShellCommandsInPrompt(
  text: string,
  options?: {
    shell?: FrontmatterShell;
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  },
): Promise<ShellExecutionResult> {
  const {
    shell = 'bash',
    cwd = process.cwd(),
    env = {},
    timeout = 30000,
  } = options || {};

  let result = text;
  const executedCommands: string[] = [];
  const outputs: string[] = [];
  const errors: string[] = [];

  // 收集所有匹配
  const blockMatches = Array.from(text.matchAll(BLOCK_PATTERN));
  const inlineMatches = text.includes('!`') ? Array.from(text.matchAll(INLINE_PATTERN)) : [];
  const allMatches = [...blockMatches, ...inlineMatches];

  // 逐个执行（保持顺序）
  for (const match of allMatches) {
    const command = match[1]?.trim();
    if (!command) continue;

    try {
      executedCommands.push(command);
      const output = await executeSingleCommand(command, { shell, cwd, env, timeout });
      outputs.push(output);
      // 使用函数替换器避免 $$, $&, $`, $' 被错误解释
      result = result.replace(match[0], () => output);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      // Shell 执行失败时，在原位显示错误信息
      result = result.replace(match[0], () => `[Shell Error: ${errorMsg}]`);
    }
  }

  return { content: result, executedCommands, outputs, errors };
}

/**
 * 检测文本中是否包含 shell 执行语法
 */
export function hasShellCommands(text: string): boolean {
  if (BLOCK_PATTERN.test(text)) return true;
  if (text.includes('!`')) return INLINE_PATTERN.test(text);
  return false;
}

/**
 * 提取文本中所有 shell 命令（不执行）
 */
export function extractShellCommands(text: string): string[] {
  const commands: string[] = [];

  for (const match of Array.from(text.matchAll(BLOCK_PATTERN))) {
    const cmd = match[1]?.trim();
    if (cmd) commands.push(cmd);
  }

  if (text.includes('!`')) {
    for (const match of Array.from(text.matchAll(INLINE_PATTERN))) {
      const cmd = match[1]?.trim();
      if (cmd) commands.push(cmd);
    }
  }

  return commands;
}

// ─── Internal ─────────────────────────────────────────────────

function executeSingleCommand(
  command: string,
  options: {
    shell: FrontmatterShell;
    cwd: string;
    env: Record<string, string>;
    timeout: number;
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const shellCmd = options.shell === 'powershell' ? 'powershell' : '/bin/bash';
    const shellFlag = options.shell === 'powershell' ? '-Command' : '-c';

    const proc = exec(
      `${shellCmd} ${shellFlag} ${escapeCommand(command)}`,
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        timeout: options.timeout,
        maxBuffer: 1024 * 1024, // 1MB
      },
      (error, stdout, stderr) => {
        if (error) {
          // timeout 也走这个分支
          reject(new Error(stderr || error.message));
          return;
        }
        const parts: string[] = [];
        if (stdout?.trim()) parts.push(stdout.trim());
        if (stderr?.trim()) parts.push(`[stderr]\n${stderr.trim()}`);
        resolve(parts.join('\n') || '');
      },
    );

    proc.on('error', (err) => reject(err));
  });
}

function escapeCommand(cmd: string): string {
  // 用单引号包裹，避免 shell 注入
  return `'${cmd.replace(/'/g, "'\\''")}'`;
}
