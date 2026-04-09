// test-case-generator.ts
// LLM 驱动的通用测试数据生成服务
// 根据 manifest 描述生成领域适配的 MOCK 数据，支持任意本体

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { BehaviorManifest, ScenarioManifest, InputField } from '../types/manifest.js';

// ─── LLM 配置（复用 skill-core/executor.ts 的 DeepSeek 配置）──────────

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

// ─── 通用回退 heuristic（非 CRM 绑定）──────────

function fallbackGenerateParams(inputSchema: InputField[]): Record<string, any> {
  const params: Record<string, any> = {};
  for (const field of inputSchema) {
    if (!field.required) continue;
    const name = field.name.toLowerCase();
    if (name.includes('phone') || name.includes('tel')) {
      params[field.name] = '13800138000';
    } else if (name.includes('email') || name.includes('mail')) {
      params[field.name] = 'test@example.com';
    } else if (name.includes('amount') || name.includes('budget') || name.includes('price') || name.includes('cost')) {
      params[field.name] = 10000;
    } else if (name.includes('id')) {
      params[field.name] = `mock-${field.name}-001`;
    } else if (field.type === 'number') {
      params[field.name] = 100;
    } else if (field.type === 'boolean') {
      params[field.name] = true;
    } else {
      params[field.name] = `测试${field.display_name_zh || field.name}`;
    }
  }
  return params;
}

// ─── Main Generator ──────────────────────────────────────────

export class TestCaseGenerator {
  /**
   * 为单个行为技能生成测试参数（一次 LLM 调用）
   */
  async generateBehaviorTestData(manifest: BehaviorManifest): Promise<{
    positive: Record<string, any>;
    rule_blocks: Array<{ rule_code: string; params: Record<string, any> }>;
  }> {
    // 如果没有输入字段，返回空参数
    if (!manifest.input_schema || manifest.input_schema.length === 0) {
      const emptyResult: { positive: Record<string, any>; rule_blocks: Array<{ rule_code: string; params: Record<string, any> }> } = { positive: {}, rule_blocks: [] };
      // 仍然为规则生成阻断用例
      if (manifest.rule_bindings.length > 0) {
        emptyResult.rule_blocks = manifest.rule_bindings.map(r => ({
          rule_code: r.rule_code,
          params: {},
        }));
      }
      return emptyResult;
    }

    // 尝试 LLM 生成
    if (isLLMConfigured()) {
      try {
        const result = await this.llmGenerateBehaviorData(manifest);
        if (result) return result;
      } catch (err) {
        console.warn(`[test-gen] LLM failed for ${manifest.skill_slug}, falling back to heuristic:`, (err as Error).message);
      }
    }

    // 回退 heuristic
    return this.heuristicBehaviorData(manifest);
  }

  /**
   * 为单个场景技能生成测试参数（一次 LLM 调用）
   */
  async generateScenarioTestData(
    manifest: ScenarioManifest,
    behaviorManifests: BehaviorManifest[]
  ): Promise<Record<string, any>> {
    if (manifest.scenario_code === 'customer_visit_to_advice') {
      return {
        customer_id: 'cust_mock_001',
        customer_name: '华东智造集团',
        title: '第一次拜访纪要',
        sequence_no: 1,
        visit_type: 'uploaded_markdown',
        content_markdown: [
          '# 第一次拜访纪要',
          '',
          '## 客户关注点',
          '- 关注跨工厂协同效率',
          '- 希望统一销售与交付数据',
          '',
          '## 主要异议',
          '- 目前需求还比较泛，需要进一步澄清',
          '',
          '## 下一步承诺',
          '- 下周安排业务和 IT 一起开需求梳理会',
        ].join('\n'),
        visit_at: '2026-04-09',
        source_channel: 'uploaded_markdown',
        visit_record_id: 'visit_mock_001',
        visit_record_ids: ['visit_mock_001'],
        advice_round: 1,
      };
    }

    // 收集场景涉及的所有行为输入字段
    const allFields: InputField[] = [];
    for (const step of manifest.steps) {
      const bhManifest = behaviorManifests.find(m => m.full_id === step.behavior_skill_full_id);
      if (bhManifest) {
        for (const field of bhManifest.input_schema) {
          if (!allFields.some(f => f.name === field.name)) {
            allFields.push(field);
          }
        }
      }
    }

    if (allFields.length === 0) return {};

    // 尝试 LLM 生成
    if (isLLMConfigured()) {
      try {
        const result = await this.llmGenerateScenarioData(manifest, allFields);
        if (result) return result;
      } catch (err) {
        console.warn(`[test-gen] LLM failed for scenario ${manifest.scenario_code}, falling back:`, (err as Error).message);
      }
    }

    // 回退
    return fallbackGenerateParams(allFields);
  }

  // ─── LLM Methods ────────────────────────────────────────

  private async llmGenerateBehaviorData(manifest: BehaviorManifest): Promise<{
    positive: Record<string, any>;
    rule_blocks: Array<{ rule_code: string; params: Record<string, any> }>;
  } | null> {
    const client = getLLMClient();

    const inputDesc = manifest.input_schema
      .map(f => `  - ${f.name} (${f.type}${f.required ? ', 必填' : ', 可选'}): ${f.description || f.display_name_zh}${f.enum_values ? ` [枚举: ${f.enum_values.join('/')}]` : ''}`)
      .join('\n');

    const rulesDesc = manifest.rule_bindings.length > 0
      ? manifest.rule_bindings
          .map(r => `  - ${r.rule_code} (${r.rule_name_zh}): ${r.expression} → 失败消息: ${r.failure_message_zh}`)
          .join('\n')
      : '  无规则约束';

    const prompt = `你是测试数据生成器。根据以下技能定义生成测试参数。仅输出 JSON，不要输出其他内容。

技能: ${manifest.behavior_name_zh}
对象: ${manifest.owner_object}

输入参数:
${inputDesc}

规则约束:
${rulesDesc}

输出格式（纯 JSON，不要 markdown 代码块）:
{
  "positive": { 各字段的合理业务值 },
  "rule_blocks": [
    { "rule_code": "规则代码", "params": { 违反该规则的数据，只修改与规则相关的字段 } }
  ]
}

要求:
1. positive 中的值必须满足所有规则约束
2. 每个 rule_block 的 params 只需违反对应规则，其他字段保持合理值
3. 如果没有规则约束，rule_blocks 为空数组`;

    const response = await client.chat.completions.create({
      model: getLLMConfig().model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    console.log(`[test-gen] LLM generated data for ${manifest.skill_slug} (${response.usage?.total_tokens || 0} tokens)`);

    return this.parseLLMResponse(content);
  }

  private async llmGenerateScenarioData(
    manifest: ScenarioManifest,
    allFields: InputField[]
  ): Promise<Record<string, any> | null> {
    const client = getLLMClient();

    const fieldsDesc = allFields
      .map(f => `  - ${f.name} (${f.type}${f.required ? ', 必填' : ', 可选'}): ${f.description || f.display_name_zh}`)
      .join('\n');

    const stepsDesc = manifest.steps
      .map(s => `  ${s.step}. ${s.behavior_name_zh}`)
      .join('\n');

    const prompt = `你是测试数据生成器。根据以下场景定义生成完整的测试参数。仅输出 JSON 对象，不要输出其他内容。

场景: ${manifest.scenario_name_zh}
业务目标: ${manifest.business_goal}

步骤:
${stepsDesc}

所需参数:
${fieldsDesc}

输出格式（纯 JSON 对象，不要 markdown 代码块）:
{ 各字段的合理业务值，满足所有步骤的需求 }

要求: 生成一组能走完整个场景的合理业务数据`;

    const response = await client.chat.completions.create({
      model: getLLMConfig().model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    console.log(`[test-gen] LLM generated scenario data for ${manifest.scenario_code} (${response.usage?.total_tokens || 0} tokens)`);

    // 解析 JSON
    const jsonStr = this.extractJSON(content);
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }

  // ─── Heuristic Fallback ────────────────────────────────

  private heuristicBehaviorData(manifest: BehaviorManifest): {
    positive: Record<string, any>;
    rule_blocks: Array<{ rule_code: string; params: Record<string, any> }>;
  } {
    if (manifest.behavior_code === 'VisitRecord.CreateFromMarkdown') {
      return {
        positive: {
          customer_id: 'cust_mock_001',
          customer_name: '华东智造集团',
          title: '第一次拜访纪要',
          sequence_no: 1,
          visit_type: 'uploaded_markdown',
          content_markdown: [
            '# 第一次拜访纪要',
            '',
            '## 客户关注点',
            '- 关注跨工厂协同效率',
            '- 希望统一销售与交付数据',
            '',
            '## 主要异议',
            '- 目前需求还比较泛，需要进一步澄清',
            '',
            '## 下一步承诺',
            '- 下周安排业务和 IT 一起开需求梳理会',
          ].join('\n'),
          visit_at: '2026-04-09',
          source_channel: 'uploaded_markdown',
          industry: '制造业',
          region: '华东',
        },
        rule_blocks: [{
          rule_code: 'VisitRecord.ContentRequired',
          params: {
            customer_id: 'cust_mock_001',
            customer_name: '华东智造集团',
            title: '空记录',
            sequence_no: 1,
            visit_type: 'uploaded_markdown',
            content_markdown: '',
            visit_at: '2026-04-09',
          },
        }],
      };
    }

    if (manifest.behavior_code === 'VisitRecord.Analyze') {
      return {
        positive: {
          visit_record_id: 'visit_mock_001',
        },
        rule_blocks: [],
      };
    }

    if (manifest.behavior_code === 'Customer.GenerateOperatingAdvice') {
      return {
        positive: {
          customer_id: 'cust_mock_001',
          visit_record_ids: ['visit_mock_001'],
          advice_round: 1,
        },
        rule_blocks: [{
          rule_code: 'Customer.AdviceNeedsVisitRecord',
          params: {
            customer_id: 'cust_mock_001',
            visit_record_ids: [],
            advice_round: 1,
          },
        }],
      };
    }

    const positive = fallbackGenerateParams(manifest.input_schema);

    const rule_blocks = manifest.rule_bindings.map(rule => {
      const params = { ...positive };
      const code = rule.rule_code.toLowerCase();
      const expr = typeof rule.expression === 'string' ? rule.expression.toLowerCase() : '';

      // 根据规则描述推断如何违反
      if (code.includes('budget') || code.includes('amount') || code.includes('min') || expr.includes('>')) {
        for (const key of Object.keys(params)) {
          if (key.toLowerCase().includes('budget') || key.toLowerCase().includes('amount')) {
            params[key] = 1; // 低于阈值
          }
        }
      } else if (code.includes('probability') || code.includes('range') || expr.includes('<') || expr.includes('0-100')) {
        for (const key of Object.keys(params)) {
          if (key.toLowerCase().includes('probability')) {
            params[key] = 150; // 超出范围
          }
        }
      } else if (code.includes('required') || code.includes('missing') || code.includes('notnull')) {
        // 移除一个必填字段
        const required = manifest.input_schema.filter(f => f.required);
        if (required.length > 0) {
          delete params[required[0].name];
        }
      } else {
        // 通用：移除第一个必填字段
        const required = manifest.input_schema.filter(f => f.required);
        if (required.length > 0) {
          delete params[required[0].name];
        }
      }

      return { rule_code: rule.rule_code, params };
    });

    return { positive, rule_blocks };
  }

  // ─── JSON Parsing Helpers ──────────────────────────────

  private parseLLMResponse(content: string): {
    positive: Record<string, any>;
    rule_blocks: Array<{ rule_code: string; params: Record<string, any> }>;
  } | null {
    const jsonStr = this.extractJSON(content);
    if (!jsonStr) return null;

    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.positive || typeof parsed.positive !== 'object') return null;
      if (!Array.isArray(parsed.rule_blocks)) {
        parsed.rule_blocks = [];
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private extractJSON(content: string): string | null {
    // 去除 markdown 代码块
    let text = content.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return text.trim() || null;
  }
}

export const testCaseGenerator = new TestCaseGenerator();

// ─── Helper: 从磁盘加载所有 manifest ─────────────────────────

export function loadManifestsFromDisk(skillsDir: string): {
  behaviors: BehaviorManifest[];
  scenarios: ScenarioManifest[];
} {
  const behaviors: BehaviorManifest[] = [];
  const scenarios: ScenarioManifest[] = [];

  if (!existsSync(skillsDir)) return { behaviors, scenarios };

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(skillsDir, entry.name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;

    try {
      const raw = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(raw);
      if (manifest.skill_type === 'behavior') {
        behaviors.push(manifest as BehaviorManifest);
      } else if (manifest.skill_type === 'scenario') {
        scenarios.push(manifest as ScenarioManifest);
      }
    } catch {
      // skip invalid manifests
    }
  }

  return { behaviors, scenarios };
}
