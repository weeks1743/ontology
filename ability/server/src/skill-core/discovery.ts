/**
 * SKILL 动态发现与加载
 * 移植自 Claude Code loadSkillsDir.ts 的核心逻辑
 *
 * 独立模块，不依赖现有 ability external-skills.ts
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import type { ParsedSkill, SkillFrontmatter, ValidationResult } from './types.js';
import { parseSkillMd, validateSkillMd, parseBooleanFrontmatter } from './parser.js';
import { parseArgumentNames } from './params.js';

/** 技能注册表（内存） */
const skillRegistry = new Map<string, ParsedSkill>();

/**
 * 从指定目录扫描所有 SKILL.md 并加载
 *
 * 目录结构（兼容 Claude Code）：
 *   baseDir/
 *   └── my-skill/
 *       └── SKILL.md
 */
export function discoverAndLoadSkills(
  baseDir: string,
  loadedFrom: 'external' | 'ontology' | 'discovered' = 'discovered',
): number {
  if (!existsSync(baseDir)) return 0;

  let count = 0;

  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

      const skillDirPath = join(baseDir, entry.name);
      const skillFilePath = join(skillDirPath, 'SKILL.md');

      if (!existsSync(skillFilePath)) continue;

      try {
        const skill = loadSkillFromPath(skillDirPath, skillFilePath, loadedFrom);
        if (skill) {
          skillRegistry.set(skill.id, skill);
          count++;
        }
      } catch (error) {
        console.warn(`[skill-core] Failed to load ${skillDirPath}:`, error);
      }
    }
  } catch (error) {
    console.warn(`[skill-core] Failed to scan ${baseDir}:`, error);
  }

  return count;
}

function loadSkillFromPath(
  skillDirPath: string,
  skillFilePath: string,
  loadedFrom: 'external' | 'ontology' | 'discovered',
): ParsedSkill | null {
  const content = readFileSync(skillFilePath, { encoding: 'utf-8' });
  const { frontmatter, body } = parseSkillMd(content, skillFilePath);

  const dirName = basename(skillDirPath);
  const id = (frontmatter.name as string) || dirName;

  return {
    id,
    skillDir: skillDirPath,
    frontmatter,
    body,
    loadedFrom,
  };
}

// ─── Registry Operations ────────────────────────────────────

export function getAllSkills(): ParsedSkill[] {
  return Array.from(skillRegistry.values());
}

export function getSkillById(id: string): ParsedSkill | undefined {
  return skillRegistry.get(id);
}

export function clearSkillRegistry(): void {
  skillRegistry.clear();
}

export function reloadSkills(baseDirs: string[], loadedFrom: 'external' | 'ontology' | 'discovered' = 'discovered'): number {
  skillRegistry.clear();
  let total = 0;
  for (const dir of baseDirs) {
    total += discoverAndLoadSkills(dir, loadedFrom);
  }
  return total;
}

// ─── Validation ─────────────────────────────────────────────

export function validateSkillDir(skillDirPath: string): ValidationResult {
  const skillFilePath = join(skillDirPath, 'SKILL.md');

  if (!existsSync(skillFilePath)) {
    return {
      valid: false,
      errors: [`SKILL.md not found in ${skillDirPath}`],
      warnings: [],
    };
  }

  const content = readFileSync(skillFilePath, { encoding: 'utf-8' });
  return validateSkillMd(content, skillFilePath);
}

// ─── Dynamic Discovery ──────────────────────────────────────

/**
 * 向上遍历文件路径，发现嵌套的 .claude/skills/ 目录
 * 移植自 Claude Code discoverSkillDirsForPaths()
 */
export function discoverSkillDirsForPaths(
  filePaths: string[],
  cwd: string,
): string[] {
  const resolvedCwd = cwd.endsWith('/') ? cwd.slice(0, -1) : cwd;
  const seenDirs = new Set<string>();
  const newDirs: string[] = [];

  for (const filePath of filePaths) {
    let currentDir = filePath;

    while (currentDir.startsWith(resolvedCwd + '/')) {
      const skillDir = join(currentDir, '.claude', 'skills');

      if (!seenDirs.has(skillDir)) {
        seenDirs.add(skillDir);
        if (existsSync(skillDir)) {
          newDirs.push(skillDir);
        }
      }

      const parent = join(currentDir, '..');
      if (parent === currentDir) break;
      currentDir = parent;
    }
  }

  // 深路径优先
  return newDirs.sort((a, b) => b.split('/').length - a.split('/').length);
}
