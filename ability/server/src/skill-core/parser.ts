/**
 * SKILL.md 解析器
 * 移植自 Claude Code 的 frontmatterParser + loadSkillsDir 解析逻辑
 *
 * 支持 YAML frontmatter（--- ... ---）+ Markdown body
 * 100% 兼容 Claude Code 的 SKILL.md 格式
 */

import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import * as yaml from 'js-yaml';
import type { SkillFrontmatter, ParsedSkill, ValidationResult } from './types.js';

/** frontmatter 分隔正则 */
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

/** YAML 中需要引号包裹的特殊字符 */
const YAML_SPECIAL_CHARS = /[{}[\]*&#!|>%@`]|: /;

/**
 * 预处理 YAML 文本：为包含特殊字符的值添加引号
 * 移植自 Claude Code frontmatterParser.ts quoteProblematicValues()
 */
function quoteProblematicValues(frontmatterText: string): string {
  const lines = frontmatterText.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([a-zA-Z_-]+):\s+(.+)$/);
    if (match) {
      const [, key, value] = match;
      if (!key || !value) {
        result.push(line);
        continue;
      }
      // 已引号包裹则跳过
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        result.push(line);
        continue;
      }
      // 包含特殊字符则加引号
      if (YAML_SPECIAL_CHARS.test(value)) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        result.push(`${key}: "${escaped}"`);
        continue;
      }
    }
    result.push(line);
  }

  return result.join('\n');
}

/**
 * 解析 YAML frontmatter 文本为对象
 * 两次尝试：第一次直接解析，失败后预处理再解析
 */
function parseYamlFrontmatter(text: string, sourcePath?: string): SkillFrontmatter {
  if (!text.trim()) return {};

  const attempt = (yamlText: string): SkillFrontmatter | null => {
    try {
      const parsed = yaml.load(yamlText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as SkillFrontmatter;
      }
    } catch {
      return null;
    }
    return null;
  };

  // 第一次尝试：直接解析
  let result = attempt(text);
  if (result) return result;

  // 第二次尝试：预处理后解析
  result = attempt(quoteProblematicValues(text));
  if (result) return result;

  // 两次都失败：输出警告
  const location = sourcePath ? ` in ${sourcePath}` : '';
  console.warn(`[skill-core] Failed to parse YAML frontmatter${location}`);

  return {};
}

/**
 * 解析 Markdown 内容，提取 frontmatter 和 body
 * 移植自 Claude Code parseFrontmatter()
 */
export function parseSkillMd(markdown: string, sourcePath?: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = markdown.match(FRONTMATTER_REGEX);

  if (!match) {
    return { frontmatter: {}, body: markdown };
  }

  const frontmatterText = match[1] || '';
  const body = markdown.slice(match[0].length);

  return {
    frontmatter: parseYamlFrontmatter(frontmatterText, sourcePath),
    body,
  };
}

/**
 * 从文件系统加载并解析 SKILL.md
 * 移植自 Claude Code loadSkillsFromSkillsDir() 的核心逻辑
 */
export function loadSkillFromDir(skillDirPath: string): ParsedSkill | null {
  const skillFilePath = join(skillDirPath, 'SKILL.md');

  if (!existsSync(skillFilePath)) return null;

  try {
    const content = readFileSync(skillFilePath, { encoding: 'utf-8' });
    const { frontmatter, body } = parseSkillMd(content, skillFilePath);

    // 技能 ID：优先用 frontmatter.name，否则用目录名
    const dirName = basename(skillDirPath);
    const id = frontmatter.name || dirName;

    return {
      id,
      skillDir: skillDirPath,
      frontmatter,
      body,
      loadedFrom: 'discovered',
    };
  } catch (error) {
    console.warn(`[skill-core] Failed to load skill from ${skillDirPath}:`, error);
    return null;
  }
}

/**
 * 验证 SKILL.md 内容
 */
export function validateSkillMd(content: string, sourcePath?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查 frontmatter 存在
  if (!FRONTMATTER_REGEX.test(content)) {
    errors.push('Missing YAML frontmatter (--- delimiters)');
    return { valid: false, errors, warnings };
  }

  const { frontmatter, body } = parseSkillMd(content, sourcePath);

  // 检查必要字段
  if (!frontmatter.description && !body.trim()) {
    warnings.push('No description and no body content');
  }

  // 检查 context 值
  if (frontmatter.context && frontmatter.context !== 'inline' && frontmatter.context !== 'fork') {
    errors.push(`Invalid context value: ${frontmatter.context}. Must be 'inline' or 'fork'`);
  }

  // 检查 shell 值
  if (frontmatter.shell && frontmatter.shell !== 'bash' && frontmatter.shell !== 'powershell') {
    warnings.push(`Unrecognized shell value: ${frontmatter.shell}. Defaulting to bash`);
  }

  // 检查 arguments 和 body 中的占位符是否匹配
  if (typeof frontmatter.arguments === 'string') {
    const argNames = frontmatter.arguments.split(/\s+/);
    for (const name of argNames) {
      if (body.includes(`$${name}`)) continue;
      warnings.push(`Argument '${name}' declared but $${name} not found in body`);
    }
  } else if (Array.isArray(frontmatter.arguments)) {
    for (const name of frontmatter.arguments) {
      if (body.includes(`$${name}`)) continue;
      warnings.push(`Argument '${name}' declared but $${name} not found in body`);
    }
  }

  // 检查 body 中的 $ARGUMENTS / $0 等是否有 arguments 声明
  const hasArgPlaceholders = /\$ARGUMENTS|\$\d+/.test(body);
  if (hasArgPlaceholders && !frontmatter.arguments) {
    warnings.push('Body contains $ARGUMENTS/$0 placeholders but no arguments declared');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 解析布尔 frontmatter 值
 * 移植自 Claude Code parseBooleanFrontmatter()
 */
export function parseBooleanFrontmatter(value: unknown): boolean {
  return value === true || value === 'true';
}

/**
 * 将逗号分隔字符串或数组统一为数组
 */
export function toStringArray(value: string | string[] | undefined | null): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * 解析路径 frontmatter（支持逗号分隔和数组）
 * 移植自 Claude Code splitPathInFrontmatter()
 */
export function splitPathInFrontmatter(input: string | string[] | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap(splitPathInFrontmatter);
  if (typeof input !== 'string') return [];

  const parts: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '{') { braceDepth++; current += char; }
    else if (char === '}') { braceDepth--; current += char; }
    else if (char === ',' && braceDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
    } else { current += char; }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);

  return parts
    .map(p => p.endsWith('/**') ? p.slice(0, -3) : p)
    .filter(p => p.length > 0 && p !== '**');
}
