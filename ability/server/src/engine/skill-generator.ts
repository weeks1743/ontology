// 技能生成器 - 从本体定义生成 SKILL 包

import { nanoid } from 'nanoid';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import {
  getOntologyDefinition,
  OntologyBehavior,
  OntologyRule,
  OntologyObject,
} from './ontology-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKILLS_DIR = join(__dirname, '../../../skills/ontology');

// 技能映射配置
interface SkillMapping {
  behaviorCode: string;
  skillId: string;
  skillName: string;
  emoji: string;
  description: string;
  entityType: string; // Lead, Opportunity, Customer, Quote, Contact
  operation: string; // create, update, convert, etc.
}

// CRM 技能映射表
const SKILL_MAPPINGS: SkillMapping[] = [
  {
    behaviorCode: 'Lead.Create',
    skillId: 'ont.create_lead',
    skillName: '创建线索',
    emoji: '📝',
    description: '创建销售线索，自动校验必填字段（title+phone）',
    entityType: 'Lead',
    operation: 'create',
  },
  {
    behaviorCode: 'Lead.Complete',
    skillId: 'ont.complete_lead',
    skillName: '补全线索信息',
    emoji: '✍️',
    description: '补全线索的详细信息（预算、需求等），校验预算规则',
    entityType: 'Lead',
    operation: 'update',
  },
  {
    behaviorCode: 'Lead.Evaluate',
    skillId: 'ont.evaluate_lead',
    skillName: '评估线索',
    emoji: '🎯',
    description: '评估线索质量，设置评分和优先级',
    entityType: 'Lead',
    operation: 'update',
  },
  {
    behaviorCode: 'Lead.ConvertToOpportunity',
    skillId: 'ont.convert_lead',
    skillName: '线索转商机',
    emoji: '🔄',
    description: '将线索转换为商机，自动创建客户、联系人和商机',
    entityType: 'Lead',
    operation: 'convert',
  },
  {
    behaviorCode: 'Opportunity.Create',
    skillId: 'ont.create_opportunity',
    skillName: '创建商机',
    emoji: '💼',
    description: '创建商机，校验概率范围（0-100）',
    entityType: 'Opportunity',
    operation: 'create',
  },
  {
    behaviorCode: 'Opportunity.Advance',
    skillId: 'ont.advance_opportunity',
    skillName: '推进商机阶段',
    emoji: '⏭️',
    description: '推进商机到下一阶段，更新概率和金额',
    entityType: 'Opportunity',
    operation: 'update',
  },
  {
    behaviorCode: 'Opportunity.CreateQuote',
    skillId: 'ont.create_quote',
    skillName: '创建报价单',
    emoji: '📄',
    description: '为商机创建报价单，校验审批规则（>50万需审批）',
    entityType: 'Quote',
    operation: 'create',
  },
  {
    behaviorCode: 'Quote.Submit',
    skillId: 'ont.submit_quote',
    skillName: '提交审批',
    emoji: '📤',
    description: '提交报价单审批，更新状态为待审批',
    entityType: 'Quote',
    operation: 'update',
  },
  {
    behaviorCode: 'Quote.Approve',
    skillId: 'ont.approve_quote',
    skillName: '审批通过',
    emoji: '✅',
    description: '审批通过报价单，更新商机状态为赢单',
    entityType: 'Quote',
    operation: 'update',
  },
];

// 额外的查询技能（不对应 behavior）
const QUERY_SKILLS: SkillMapping[] = [
  {
    behaviorCode: '',
    skillId: 'ont.graph_trace',
    skillName: '图链路溯源',
    emoji: '🔍',
    description: '查询商机的完整销售链路（线索→商机→报价）',
    entityType: 'Opportunity',
    operation: 'query',
  },
  {
    behaviorCode: '',
    skillId: 'ont.semantic_search',
    skillName: '语义相似搜索',
    emoji: '🔎',
    description: '基于语义搜索相似的商机案例',
    entityType: 'Opportunity',
    operation: 'query',
  },
];

export class SkillGenerator {
  // 生成所有本体技能
  async generateAll(ontologyId: string): Promise<number> {
    console.log(`🔧 Generating ontology skills for: ${ontologyId}`);

    // 获取本体定义
    const definition = await getOntologyDefinition(ontologyId);

    // 清空现有技能目录
    if (existsSync(SKILLS_DIR)) {
      rmSync(SKILLS_DIR, { recursive: true, force: true });
    }
    mkdirSync(SKILLS_DIR, { recursive: true });

    let generatedCount = 0;

    // 生成 behavior 对应的技能
    for (const mapping of SKILL_MAPPINGS) {
      const behavior = definition.behaviors.find(b => b.code === mapping.behaviorCode);
      if (behavior) {
        await this.generateSkill(mapping, behavior, definition);
        generatedCount++;
      } else {
        console.warn(`⚠️  Behavior not found: ${mapping.behaviorCode}`);
      }
    }

    // 生成查询技能
    for (const mapping of QUERY_SKILLS) {
      await this.generateQuerySkill(mapping, definition);
      generatedCount++;
    }

    console.log(`✅ Generated ${generatedCount} skills`);
    return generatedCount;
  }

  // 生成单个技能
  private async generateSkill(
    mapping: SkillMapping,
    behavior: OntologyBehavior,
    definition: any
  ): Promise<void> {
    const skillDir = join(SKILLS_DIR, mapping.skillId.replace('ont.', ''));
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, 'scripts'), { recursive: true });

    // 生成 SKILL.md
    const skillMd = this.generateSkillMd(mapping, behavior);
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

    // 生成 _meta.json
    const metaJson = this.generateMetaJson(mapping);
    writeFileSync(join(skillDir, '_meta.json'), JSON.stringify(metaJson, null, 2));

    // 生成 execute.js
    const executeJs = this.generateExecuteScript(mapping, behavior, definition);
    writeFileSync(join(skillDir, 'scripts', 'execute.js'), executeJs);

    // 注册到数据库
    await this.registerSkill(mapping, behavior);

    console.log(`  ✓ ${mapping.skillId}`);
  }

  // 生成查询技能
  private async generateQuerySkill(mapping: SkillMapping, definition: any): Promise<void> {
    const skillDir = join(SKILLS_DIR, mapping.skillId.replace('ont.', ''));
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, 'scripts'), { recursive: true });

    // 生成 SKILL.md
    const skillMd = this.generateQuerySkillMd(mapping);
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

    // 生成 _meta.json
    const metaJson = this.generateMetaJson(mapping);
    writeFileSync(join(skillDir, '_meta.json'), JSON.stringify(metaJson, null, 2));

    // 生成 execute.js
    const executeJs = this.generateQueryExecuteScript(mapping);
    writeFileSync(join(skillDir, 'scripts', 'execute.js'), executeJs);

    // 注册到数据库
    await this.registerQuerySkill(mapping);

    console.log(`  ✓ ${mapping.skillId}`);
  }

  // 生成 SKILL.md 内容
  private generateSkillMd(mapping: SkillMapping, behavior: OntologyBehavior): string {
    return `---
name: ${mapping.skillId}
description: ${mapping.description}
metadata: { "openclaw": { "emoji": "${mapping.emoji}", "requires": { "bins": ["node"], "env": [] } } }
---

# ${mapping.skillName}

基于本体定义 \`${behavior.code}\` 自动生成的技能。

## 描述

${behavior.description}

## 输入参数

根据 ${mapping.entityType} 对象定义的字段。

## 输出结果

- success: 是否成功
- data: 创建/更新的实体数据
- ${mapping.entityType.toLowerCase()}_id: 实体 ID
- mongodb_status: MongoDB 操作状态
- neo4j_status: Neo4j 操作状态
- chroma_status: ChromaDB 操作状态

## 规则校验

${behavior.referenced_rules ? `- ${behavior.referenced_rules.join('\n- ')}` : '无'}

## 副作用

${behavior.side_effects && Array.isArray(behavior.side_effects) ? behavior.side_effects.map(se => `- ${se.description}`).join('\n') : '无'}
`;
  }

  // 生成查询技能的 SKILL.md
  private generateQuerySkillMd(mapping: SkillMapping): string {
    return `---
name: ${mapping.skillId}
description: ${mapping.description}
metadata: { "openclaw": { "emoji": "${mapping.emoji}", "requires": { "bins": ["node"], "env": [] } } }
---

# ${mapping.skillName}

${mapping.description}

## 输入参数

${mapping.skillId === 'ont.graph_trace' ? '- opportunity_id: 商机 ID' : '- query: 搜索查询文本\n- limit: 返回结果数量（默认 5）'}

## 输出结果

- success: 是否成功
- data: 查询结果
`;
  }

  // 生成 _meta.json
  private generateMetaJson(mapping: SkillMapping): any {
    return {
      ownerId: 'ontology-system',
      slug: mapping.skillId,
      version: '1.0.0',
      category: 'ontology',
    };
  }

  // 生成执行脚本（简化版，实际执行逻辑在 skill-executor 中）
  private generateExecuteScript(
    mapping: SkillMapping,
    behavior: OntologyBehavior,
    definition: any
  ): string {
    return `// 技能执行脚本: ${mapping.skillId}
// 此脚本由能力层自动生成

const params = JSON.parse(process.argv[2] || '{}');

// 输出执行结果
console.log(JSON.stringify({
  skill_id: '${mapping.skillId}',
  behavior_code: '${behavior.code}',
  params: params,
  timestamp: new Date().toISOString(),
}));
`;
  }

  // 生成查询执行脚本
  private generateQueryExecuteScript(mapping: SkillMapping): string {
    return `// 查询技能执行脚本: ${mapping.skillId}
// 此脚本由能力层自动生成

const params = JSON.parse(process.argv[2] || '{}');

console.log(JSON.stringify({
  skill_id: '${mapping.skillId}',
  params: params,
  timestamp: new Date().toISOString(),
}));
`;
  }

  // 注册技能到数据库
  private async registerSkill(mapping: SkillMapping, behavior: OntologyBehavior): Promise<void> {
    const now = new Date().toISOString();

    // 检查是否已存在
    const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(mapping.skillId);

    if (existing) {
      // 更新
      db.prepare(`
        UPDATE skills
        SET name = ?, description = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `).run(
        mapping.skillName,
        mapping.description,
        JSON.stringify({ emoji: mapping.emoji, requires: { bins: ['node'], env: [] } }),
        now,
        mapping.skillId
      );
    } else {
      // 插入
      db.prepare(`
        INSERT INTO skills (id, name, description, category, source, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mapping.skillId,
        mapping.skillName,
        mapping.description,
        'ontology',
        'generated',
        JSON.stringify({ emoji: mapping.emoji, requires: { bins: ['node'], env: [] } }),
        now,
        now
      );
    }
  }

  // 注册查询技能到数据库
  private async registerQuerySkill(mapping: SkillMapping): Promise<void> {
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(mapping.skillId);

    if (existing) {
      db.prepare(`
        UPDATE skills
        SET name = ?, description = ?, metadata = ?, updated_at = ?
        WHERE id = ?
      `).run(
        mapping.skillName,
        mapping.description,
        JSON.stringify({ emoji: mapping.emoji, requires: { bins: ['node'], env: [] } }),
        now,
        mapping.skillId
      );
    } else {
      db.prepare(`
        INSERT INTO skills (id, name, description, category, source, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mapping.skillId,
        mapping.skillName,
        mapping.description,
        'ontology',
        'generated',
        JSON.stringify({ emoji: mapping.emoji, requires: { bins: ['node'], env: [] } }),
        now,
        now
      );
    }
  }
}

// 单例实例
export const skillGenerator = new SkillGenerator();
