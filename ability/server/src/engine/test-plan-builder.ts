// test-plan-builder.ts
// 从 manifest 磁盘文件自动生成测试方案和测试用例
// 使用 LLM 驱动的通用测试数据生成，不绑定任何特定领域

import { nanoid } from 'nanoid';
import { TestPlan, TestCase } from '../types/manifest.js';
import { testCaseGenerator, loadManifestsFromDisk } from './test-case-generator.js';

export async function buildTestPlan(
  skillsDir: string,
  buildVersion: string,
  ontologyId: string,
  snapshotHash: string
): Promise<{ plan: TestPlan; cases: TestCase[] }> {
  const planId = nanoid();
  const now = new Date().toISOString();
  const cases: TestCase[] = [];
  let sequence = 0;

  // 从磁盘加载已生成的 manifest 文件
  const { behaviors } = loadManifestsFromDisk(skillsDir);
  console.log(`[test-plan] Loaded ${behaviors.length} behavior manifests`);

  // 为每个行为技能生成测试用例
  for (const manifest of behaviors) {
    const testData = await testCaseGenerator.generateBehaviorTestData(manifest);

    // 1. 正向用例
    cases.push({
      id: nanoid(),
      plan_id: planId,
      skill_id: manifest.full_id,
      skill_slug: manifest.skill_slug,
      case_code: `${manifest.skill_slug}_positive`,
      case_name_zh: `${manifest.behavior_name_zh}（正向用例）`,
      case_type: 'positive',
      description_zh: `验证 ${manifest.behavior_name_zh} 的基本成功路径，所有必填字段均已填写`,
      params: testData.positive,
      expected_result: { success: true },
      sequence: sequence++,
      created_at: now,
    });

    // 2. 规则阻断用例
    for (const rb of testData.rule_blocks) {
      const rule = manifest.rule_bindings.find(r => r.rule_code === rb.rule_code);
      const ruleName = rule?.rule_name_zh || rb.rule_code;
      const failureMsg = rule?.failure_message_zh || '';

      cases.push({
        id: nanoid(),
        plan_id: planId,
        skill_id: manifest.full_id,
        skill_slug: manifest.skill_slug,
        case_code: `${manifest.skill_slug}_rule_block_${rb.rule_code.toLowerCase()}`,
        case_name_zh: `${manifest.behavior_name_zh}（规则阻断: ${ruleName}）`,
        case_type: 'rule_block',
        description_zh: `验证规则 ${ruleName} 阻断：${failureMsg}`,
        params: rb.params,
        expected_result: { success: false, error_contains: failureMsg },
        sequence: sequence++,
        created_at: now,
      });
    }
  }

  const plan: TestPlan = {
    id: planId,
    build_version: buildVersion,
    ontology_id: ontologyId,
    snapshot_hash: snapshotHash,
    total_cases: cases.length,
    created_at: now,
  };

  console.log(`[test-plan] Generated ${cases.length} test cases (${behaviors.length} behaviors)`);

  return { plan, cases };
}
