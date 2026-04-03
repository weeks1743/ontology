/**
 * 参数替换引擎
 * 移植自 Claude Code argumentSubstitution.ts
 *
 * 支持：
 * - $ARGUMENTS       → 完整参数字符串
 * - $ARGUMENTS[0]    → 索引参数
 * - $0, $1, $2       → 索引参数简写
 * - $foo, $bar       → 命名参数（需在 frontmatter arguments 中声明）
 * - ${CLAUDE_SKILL_DIR}  → 技能目录
 * - ${SKILL_DIR}         → 技能目录（别名）
 */

import type { SkillFrontmatter } from './types.js';

/**
 * 将参数字符串解析为参数数组
 * 支持引号包裹的参数（"hello world"）
 * 移植自 Claude Code parseArguments()
 */
export function parseArguments(args: string): string[] {
  if (!args || !args.trim()) return [];

  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < args.length; i++) {
    const char = args[i];

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);

  return tokens;
}

/**
 * 解析 frontmatter 的 arguments 字段为参数名数组
 * 移植自 Claude Code parseArgumentNames()
 */
export function parseArgumentNames(
  argumentNames: string | string[] | undefined,
): string[] {
  if (!argumentNames) return [];

  const isValidName = (name: string): boolean =>
    typeof name === 'string' && name.trim() !== '' && !/^\d+$/.test(name);

  if (Array.isArray(argumentNames)) return argumentNames.filter(isValidName);
  if (typeof argumentNames === 'string') return argumentNames.split(/\s+/).filter(isValidName);
  return [];
}

/**
 * 替换内容中的参数占位符
 * 移植自 Claude Code substituteArguments()
 *
 * 替换顺序（与 Claude Code 一致）：
 * 1. 命名参数 $foo, $bar
 * 2. 索引参数 $ARGUMENTS[0], $ARGUMENTS[1]
 * 3. 简写索引 $0, $1
 * 4. 完整参数 $ARGUMENTS
 * 5. 环境变量 ${CLAUDE_SKILL_DIR}, ${SKILL_DIR}
 */
export function substituteArguments(
  content: string,
  args: string | undefined,
  options?: {
    argumentNames?: string[];
    skillDir?: string;
    appendIfNoPlaceholder?: boolean;
  },
): string {
  const { argumentNames = [], skillDir, appendIfNoPlaceholder = true } = options || {};

  if (args === undefined || args === null) return content;

  const parsedArgs = parseArguments(args);
  const originalContent = content;
  let result = content;

  // 1. 替换命名参数 $foo, $bar
  for (let i = 0; i < argumentNames.length; i++) {
    const name = argumentNames[i];
    if (!name) continue;
    // 匹配 $name 但不匹配 $name[...] 或 $nameXxx
    result = result.replace(
      new RegExp(`\\$${name}(?![\\[\\w])`, 'g'),
      parsedArgs[i] ?? '',
    );
  }

  // 2. 替换索引参数 $ARGUMENTS[0], $ARGUMENTS[1]
  result = result.replace(/\$ARGUMENTS\[(\d+)\]/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return parsedArgs[index] ?? '';
  });

  // 3. 替换简写索引 $0, $1, $2
  result = result.replace(/\$(\d+)(?!\w)/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10);
    return parsedArgs[index] ?? '';
  });

  // 4. 替换完整参数 $ARGUMENTS
  result = result.split('$ARGUMENTS').join(args);

  // 5. 替换环境变量 ${CLAUDE_SKILL_DIR}
  if (skillDir) {
    const normalizedDir = process.platform === 'win32' ? skillDir.replace(/\\/g, '/') : skillDir;
    result = result.replace(/\$\{CLAUDE_SKILL_DIR\}/g, normalizedDir);
    result = result.replace(/\$\{SKILL_DIR\}/g, normalizedDir);
  }

  // 6. 如果没有找到任何占位符，追加参数
  if (result === originalContent && appendIfNoPlaceholder && args) {
    result = result + `\n\nARGUMENTS: ${args}`;
  }

  return result;
}

/**
 * 从 frontmatter 构建完整的参数替换选项
 */
export function buildSubstitutionOptions(frontmatter: SkillFrontmatter, skillDir: string) {
  return {
    argumentNames: parseArgumentNames(frontmatter.arguments),
    skillDir,
    appendIfNoPlaceholder: true,
  };
}
