// 外部技能加载器和配置管理

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { db } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTERNAL_SKILLS_DIR = join(__dirname, '../../../skills/external');
const CONFIG_PATH = join(__dirname, '../../config/skills.json');

// 技能配置接口
export interface SkillConfig {
  [key: string]: Record<string, string>;
}

// 加载技能配置
export function loadSkillConfig(): SkillConfig {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return {};
    }
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading skill config:', error);
    return {};
  }
}

// 保存技能配置
export function saveSkillConfig(config: SkillConfig): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving skill config:', error);
    throw error;
  }
}

// 更新单个技能的配置
export function updateSkillConfig(skillId: string, config: Record<string, string>): void {
  const allConfig = loadSkillConfig();
  allConfig[skillId] = config;
  saveSkillConfig(allConfig);
}

// 获取单个技能的配置
export function getSkillConfig(skillId: string): Record<string, string> {
  const allConfig = loadSkillConfig();
  return allConfig[skillId] || {};
}

// 扫描并加载外部技能
export async function loadExternalSkills(): Promise<number> {
  if (!existsSync(EXTERNAL_SKILLS_DIR)) {
    console.log('External skills directory not found');
    return 0;
  }

  const skillDirs = readdirSync(EXTERNAL_SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let loadedCount = 0;

  for (const skillDir of skillDirs) {
    try {
      const skillPath = join(EXTERNAL_SKILLS_DIR, skillDir);
      const metaPath = join(skillPath, '_meta.json');
      const skillMdPath = join(skillPath, 'SKILL.md');

      if (!existsSync(metaPath) || !existsSync(skillMdPath)) {
        console.warn(`Skipping ${skillDir}: missing _meta.json or SKILL.md`);
        continue;
      }

      // 读取元数据
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

      // 读取 SKILL.md 解析基本信息
      const skillMd = readFileSync(skillMdPath, 'utf-8');
      const nameMatch = skillMd.match(/^name:\s*(.+)$/m);
      const descMatch = skillMd.match(/^description:\s*(.+)$/m);
      const metadataMatch = skillMd.match(/^metadata:\s*(.+)$/m);

      if (!nameMatch || !descMatch) {
        console.warn(`Skipping ${skillDir}: invalid SKILL.md format`);
        continue;
      }

      const skillId = nameMatch[1].trim();
      const description = descMatch[1].trim();
      const metadata = metadataMatch ? JSON.parse(metadataMatch[1].trim()) : {};

      // 注册到数据库
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);

      if (existing) {
        // 更新
        db.prepare(`
          UPDATE skills
          SET name = ?, description = ?, metadata = ?, updated_at = ?
          WHERE id = ?
        `).run(
          skillId,
          description,
          JSON.stringify(metadata),
          now,
          skillId
        );
      } else {
        // 插入
        db.prepare(`
          INSERT INTO skills (id, name, description, category, source, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          skillId,
          skillId,
          description,
          'external',
          meta.source || 'external',
          JSON.stringify(metadata),
          now,
          now
        );
      }

      loadedCount++;
      console.log(`  ✓ Loaded external skill: ${skillId}`);
    } catch (error) {
      console.error(`Error loading skill ${skillDir}:`, error);
    }
  }

  return loadedCount;
}

// 执行外部技能
export async function executeExternalSkill(skillId: string, params: any): Promise<any> {
  const skillDir = skillId.replace('ext.', '').replace(/_/g, '-');
  const skillPath = join(EXTERNAL_SKILLS_DIR, skillDir);

  if (!existsSync(skillPath)) {
    throw new Error(`External skill not found: ${skillId}`);
  }

  // 读取 SKILL.md 获取执行信息
  const skillMdPath = join(skillPath, 'SKILL.md');
  const skillMd = readFileSync(skillMdPath, 'utf-8');
  const metadataMatch = skillMd.match(/^metadata:\s*(.+)$/m);

  if (!metadataMatch) {
    throw new Error(`Invalid SKILL.md format for ${skillId}`);
  }

  const metadata = JSON.parse(metadataMatch[1].trim());
  const requires = metadata.openclaw?.requires || {};

  // 确定执行命令
  let command: string;
  let scriptPath: string;

  if (requires.bins?.includes('python3')) {
    scriptPath = join(skillPath, 'scripts', 'search.py');
    command = 'python3';
  } else if (requires.bins?.includes('node')) {
    scriptPath = join(skillPath, 'scripts', 'generate.js');
    command = 'node';
  } else {
    throw new Error(`Unsupported execution environment for ${skillId}`);
  }

  if (!existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }

  // 加载技能配置
  const config = getSkillConfig(skillId);

  // 执行脚本
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...config };
    const proc = spawn(command, [scriptPath, JSON.stringify(params)], { env });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse script output: ${stdout}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}
