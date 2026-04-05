// 技能生成器（元驱动重构版）
// 从快照动态生成技能包，删除硬编码 SKILL_MAPPINGS

import { nanoid } from 'nanoid';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { db } from '../db.js';
import { DefinitionSnapshot } from '../types/snapshot.js';
import { BehaviorManifest, ScenarioManifest } from '../types/manifest.js';
import {
  buildBehaviorManifest,
  buildScenarioManifest,
  behaviorToSlug,
  scenarioToSlug,
} from './manifest-builder.js';
import { BuildResult } from './build-report-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getSkillsDir = (ontologyId: string) =>
  join(__dirname, '../../../skills/ontology', ontologyId);

function generateBuildVersion(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `v${ts}`;
}

export class SkillGenerator {
  async generateAll(
    snapshot: DefinitionSnapshot,
    ontologyId: string,
    buildMode: 'full' | 'incremental'
  ): Promise<BuildResult> {
    const startTime = Date.now();
    const buildId = nanoid();
    const buildVersion = generateBuildVersion();
    const SKILLS_DIR = getSkillsDir(ontologyId);

    console.log(`🔧 [generator] Building ${buildMode} for ontology: ${ontologyId}, version: ${buildVersion}`);

    // Incremental check: compare snapshot_hash
    if (buildMode === 'incremental') {
      const existingHash = db.prepare(
        `SELECT snapshot_hash FROM skills WHERE ontology_id=? AND snapshot_hash IS NOT NULL LIMIT 1`
      ).get(ontologyId) as any;

      if (existingHash?.snapshot_hash === snapshot.snapshot_hash) {
        console.log(`⏭️  [generator] Snapshot unchanged, skipping build`);

        const existingSkills = db.prepare(
          `SELECT skill_slug FROM skills WHERE ontology_id=? AND category='ontology'`
        ).all(ontologyId) as any[];

        return {
          build_id: buildId,
          build_version: buildVersion,
          ontology_id: ontologyId,
          build_mode: 'incremental',
          status: 'success',
          duration_ms: Date.now() - startTime,
          generated_count: 0,
          updated_count: 0,
          skipped_count: existingSkills.length,
          new_skills: [],
          updated_skills: [],
          skipped_skills: existingSkills.map((s: any) => s.skill_slug),
          skill_details: [],
          test_plan_summary: { total_cases: 0, positive_cases: 0, rule_block_cases: 0, scenario_cases: 0 },
        };
      }
    }

    // Full build: clear and rebuild skills dir
    if (existsSync(SKILLS_DIR)) {
      rmSync(SKILLS_DIR, { recursive: true, force: true });
    }
    mkdirSync(SKILLS_DIR, { recursive: true });

    const skillDetails: BuildResult['skill_details'] = [];
    const newSkills: string[] = [];
    const updatedSkills: string[] = [];
    let generatedCount = 0;

    // Get existing skill IDs for tracking new vs updated
    const existingIds = new Set(
      (db.prepare(`SELECT id FROM skills WHERE ontology_id=? AND category='ontology'`).all(ontologyId) as any[])
        .map((r: any) => r.id)
    );

    // Generate behavior skills
    for (const behavior of snapshot.behaviors) {
      try {
        const manifest = buildBehaviorManifest(behavior, snapshot, buildVersion, ontologyId);
        await this.writeBehaviorSkillFiles(manifest, behavior, snapshot, SKILLS_DIR);
        this.registerSkill(manifest, ontologyId);

        const isNew = !existingIds.has(manifest.full_id);
        if (isNew) newSkills.push(manifest.skill_slug);
        else updatedSkills.push(manifest.skill_slug);

        skillDetails.push({
          skill_id: manifest.full_id,
          skill_slug: manifest.skill_slug,
          skill_type: 'behavior',
          action: isNew ? 'generated' : 'updated',
          behavior_code: behavior.code,
        });

        generatedCount++;
        console.log(`  ✓ behavior: ${manifest.full_id}`);
      } catch (err) {
        console.error(`  ✗ behavior ${behavior.code}:`, (err as Error).message);
      }
    }

    // Generate scenario skills
    for (const scenario of snapshot.scenarios) {
      try {
        const manifest = buildScenarioManifest(scenario, snapshot, buildVersion, ontologyId);
        await this.writeScenarioSkillFiles(manifest, scenario, SKILLS_DIR);
        this.registerScenarioSkill(manifest, ontologyId);

        const isNew = !existingIds.has(manifest.full_id);
        if (isNew) newSkills.push(manifest.skill_slug);
        else updatedSkills.push(manifest.skill_slug);

        skillDetails.push({
          skill_id: manifest.full_id,
          skill_slug: manifest.skill_slug,
          skill_type: 'scenario',
          action: isNew ? 'generated' : 'updated',
          scenario_code: scenario.code,
        });

        generatedCount++;
        console.log(`  ✓ scenario: ${manifest.full_id}`);
      } catch (err) {
        console.error(`  ✗ scenario ${scenario.code}:`, (err as Error).message);
      }
    }

    console.log(`✅ [generator] Generated ${generatedCount} skills in ${Date.now() - startTime}ms`);

    return {
      build_id: buildId,
      build_version: buildVersion,
      ontology_id: ontologyId,
      build_mode: buildMode,
      status: 'success',
      duration_ms: Date.now() - startTime,
      generated_count: generatedCount,
      updated_count: updatedSkills.length,
      skipped_count: 0,
      new_skills: newSkills,
      updated_skills: updatedSkills,
      skipped_skills: [],
      skill_details: skillDetails,
      test_plan_summary: { total_cases: 0, positive_cases: 0, rule_block_cases: 0, scenario_cases: 0 },
    };
  }

  private async writeBehaviorSkillFiles(
    manifest: BehaviorManifest,
    behavior: any,
    snapshot: DefinitionSnapshot,
    skillsDir: string
  ): Promise<void> {
    const skillDir = join(skillsDir, manifest.skill_slug);
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, 'scripts'), { recursive: true });
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    mkdirSync(join(skillDir, 'evals'), { recursive: true });

    // manifest.yaml
    writeFileSync(join(skillDir, 'manifest.yaml'), yaml.dump(manifest, { lineWidth: 120 }));

    // manifest.json
    writeFileSync(join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // SKILL.md
    writeFileSync(join(skillDir, 'SKILL.md'), this.generateBehaviorSkillMd(manifest, behavior));

    // scripts/execute.js
    writeFileSync(join(skillDir, 'scripts', 'execute.js'), this.generateExecuteScript(manifest));

    // references/对象说明.md
    const ownerObject = snapshot.objects.find(o => o.code === behavior.owner_object);
    if (ownerObject) {
      writeFileSync(
        join(skillDir, 'references', `${behavior.owner_object.toLowerCase()}.md`),
        this.generateObjectReferenceMd(ownerObject, snapshot)
      );
    }
  }

  private async writeScenarioSkillFiles(
    manifest: ScenarioManifest,
    scenario: any,
    skillsDir: string
  ): Promise<void> {
    const skillDir = join(skillsDir, manifest.skill_slug);
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, 'scripts'), { recursive: true });
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    mkdirSync(join(skillDir, 'evals'), { recursive: true });

    // manifest.yaml
    writeFileSync(join(skillDir, 'manifest.yaml'), yaml.dump(manifest, { lineWidth: 120 }));

    // manifest.json
    writeFileSync(join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // SKILL.md
    writeFileSync(join(skillDir, 'SKILL.md'), this.generateScenarioSkillMd(manifest, scenario));

    // scripts/execute.js
    writeFileSync(join(skillDir, 'scripts', 'execute.js'), this.generateScenarioExecuteScript(manifest));
  }

  private generateBehaviorSkillMd(manifest: BehaviorManifest, behavior: any): string {
    const requiredInputs = manifest.input_schema
      .filter(f => f.required)
      .map(f => `- **${f.name}** (${f.type}, required): ${f.description || f.display_name_zh}`)
      .join('\n');

    const optionalInputs = manifest.input_schema
      .filter(f => !f.required)
      .map(f => `- **${f.name}** (${f.type}): ${f.description || f.display_name_zh}`)
      .join('\n');

    const rulesList = manifest.rule_bindings
      .map(r => `- **${r.rule_code}**: ${r.failure_message_zh}`)
      .join('\n');

    return `---
name: ${manifest.full_id}
description: ${behavior.description || manifest.behavior_name_zh}
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# ${manifest.behavior_name_zh}

基于本体定义 \`${manifest.behavior_code}\` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: ${manifest.owner_object}
**触发方式**: ${manifest.trigger_type}
**版本**: ${manifest.build_version}

## 描述

${behavior.description || manifest.behavior_name_zh}

## 必填输入参数

${requiredInputs || '无'}

## 可选输入参数

${optionalInputs || '无'}

## 规则约束

${rulesList || '无'}

## 成功输出

${manifest.success_template_zh}

## 写库计划

- MongoDB: ${manifest.write_plan.mongodb.ops.map(op => op.op + ' ' + op.collection).join(', ')}
- Neo4j: ${manifest.write_plan.neo4j.ops.map(op => op.op).join(', ')}
- Chroma: ${manifest.write_plan.chroma.ops.length > 0 ? manifest.write_plan.chroma.ops.map(op => op.op + ' ' + op.collection).join(', ') : '不写入'}
`;
  }

  private generateScenarioSkillMd(manifest: ScenarioManifest, scenario: any): string {
    const stepsList = manifest.steps
      .map(s => `${s.step}. **${s.behavior_name_zh}** (\`${s.behavior_code}\`)`)
      .join('\n');

    return `---
name: ${manifest.full_id}
description: ${scenario.description || manifest.scenario_name_zh}
metadata: { "openclaw": { "emoji": "🔄", "requires": { "bins": ["node"], "env": [] } } }
---

# ${manifest.scenario_name_zh}

基于本体场景 \`${manifest.scenario_code}\` 自动生成的技能。

**技能类型**: 场景技能 (scenario)
**业务目标**: ${manifest.business_goal}
**涉及对象**: ${manifest.involved_objects.join(', ')}
**版本**: ${manifest.build_version}

## 描述

${scenario.description || manifest.scenario_name_zh}

## 步骤编排

${stepsList || '无步骤'}

## 入口条件

${manifest.entry_conditions.join('\n') || '无'}

## 成功标准

${manifest.completion_criteria.join('\n') || '无'}
`;
  }

  private generateExecuteScript(manifest: BehaviorManifest): string {
    return `// 技能执行入口: ${manifest.full_id}
// 此脚本由能力层编译平台自动生成
// 版本: ${manifest.build_version}

const params = JSON.parse(process.argv[2] || '{}');

console.log(JSON.stringify({
  skill_id: '${manifest.full_id}',
  skill_slug: '${manifest.skill_slug}',
  skill_type: '${manifest.skill_type}',
  behavior_code: '${manifest.behavior_code}',
  params: params,
  timestamp: new Date().toISOString(),
}));
`;
  }

  private generateScenarioExecuteScript(manifest: ScenarioManifest): string {
    return `// 场景技能执行入口: ${manifest.full_id}
// 此脚本由能力层编译平台自动生成
// 版本: ${manifest.build_version}

const params = JSON.parse(process.argv[2] || '{}');

console.log(JSON.stringify({
  skill_id: '${manifest.full_id}',
  skill_slug: '${manifest.skill_slug}',
  skill_type: '${manifest.skill_type}',
  scenario_code: '${manifest.scenario_code}',
  params: params,
  timestamp: new Date().toISOString(),
}));
`;
  }

  private generateObjectReferenceMd(ownerObject: any, snapshot: DefinitionSnapshot): string {
    const attrs = (ownerObject.attributes || [])
      .map((a: any) => `| ${a.name} | ${a.type} | ${a.required ? '✓' : ''} | ${a.description || ''} |`)
      .join('\n');

    const rels = (ownerObject.relations_detail || [])
      .map((r: any) => `- **${r.name}** → ${r.target_object} (${r.type})`)
      .join('\n');

    return `# ${ownerObject.name} 对象说明

## 基本信息

- **代码**: ${ownerObject.code}
- **名称**: ${ownerObject.name}
- **描述**: ${ownerObject.description || ''}

## 属性

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
${attrs || '| (无) | - | - | - |'}

## 关系

${rels || '无关系'}

## 生命周期

${JSON.stringify(ownerObject.lifecycle || [], null, 2)}
`;
  }

  private registerSkill(manifest: BehaviorManifest, ontologyId: string): void {
    const now = new Date().toISOString();
    const skillDir = join(getSkillsDir(ontologyId), manifest.skill_slug);

    const existing = db.prepare('SELECT id FROM skills WHERE id=?').get(manifest.full_id);

    if (existing) {
      db.prepare(`
        UPDATE skills SET
          name=?, description=?, skill_slug=?, display_name_zh=?,
          skill_type=?, path=?, snapshot_hash=?, build_version=?,
          is_active=1, updated_at=?
        WHERE id=?
      `).run(
        manifest.behavior_name_zh,
        `${manifest.behavior_code} 行为技能`,
        manifest.skill_slug,
        manifest.behavior_name_zh,
        'behavior',
        skillDir,
        manifest.snapshot_hash,
        manifest.build_version,
        now,
        manifest.full_id
      );
    } else {
      db.prepare(`
        INSERT INTO skills
          (id, name, description, category, source, ontology_id,
           skill_slug, display_name_zh, skill_type, path,
           snapshot_hash, build_version, is_active,
           metadata, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        manifest.full_id,
        manifest.behavior_name_zh,
        `${manifest.behavior_code} 行为技能`,
        'ontology',
        'generated',
        ontologyId,
        manifest.skill_slug,
        manifest.behavior_name_zh,
        'behavior',
        skillDir,
        manifest.snapshot_hash,
        manifest.build_version,
        1,
        JSON.stringify({ emoji: '⚙️', requires: { bins: ['node'], env: [] } }),
        now,
        now
      );
    }
  }

  private registerScenarioSkill(manifest: ScenarioManifest, ontologyId: string): void {
    const now = new Date().toISOString();
    const skillDir = join(getSkillsDir(ontologyId), manifest.skill_slug);

    const existing = db.prepare('SELECT id FROM skills WHERE id=?').get(manifest.full_id);

    if (existing) {
      db.prepare(`
        UPDATE skills SET
          name=?, description=?, skill_slug=?, display_name_zh=?,
          skill_type=?, path=?, snapshot_hash=?, build_version=?,
          is_active=1, updated_at=?
        WHERE id=?
      `).run(
        manifest.scenario_name_zh,
        `${manifest.scenario_code} 场景技能`,
        manifest.skill_slug,
        manifest.scenario_name_zh,
        'scenario',
        skillDir,
        manifest.snapshot_hash,
        manifest.build_version,
        now,
        manifest.full_id
      );
    } else {
      db.prepare(`
        INSERT INTO skills
          (id, name, description, category, source, ontology_id,
           skill_slug, display_name_zh, skill_type, path,
           snapshot_hash, build_version, is_active,
           metadata, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        manifest.full_id,
        manifest.scenario_name_zh,
        `${manifest.scenario_code} 场景技能`,
        'ontology',
        'generated',
        ontologyId,
        manifest.skill_slug,
        manifest.scenario_name_zh,
        'scenario',
        skillDir,
        manifest.snapshot_hash,
        manifest.build_version,
        1,
        JSON.stringify({ emoji: '🔄', requires: { bins: ['node'], env: [] } }),
        now,
        now
      );
    }
  }
}

export const skillGenerator = new SkillGenerator();
