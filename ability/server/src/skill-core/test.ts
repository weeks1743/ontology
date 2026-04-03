/**
 * skill-core 模块测试
 * 运行: npx tsx src/skill-core/test.ts
 */

import 'dotenv/config';
import { initSkillCore, getAllSkills, getSkillById, executeSkill } from './index.js';

console.log('=== skill-core 模块测试 ===\n');

// 1. 初始化
console.log('1. 初始化模块...');
const count = initSkillCore();
console.log(`   加载了 ${count} 个技能\n`);

// 2. 列出所有技能
console.log('2. 所有技能:');
const skills = getAllSkills();
skills.forEach(s => {
  console.log(`   - ${s.id} (${s.frontmatter.context || 'inline'})`);
});
console.log('');

// 3. 获取单个技能
console.log('3. 获取技能详情:');
const skill = getSkillById('ext.kai_report_creator');
if (skill) {
  console.log(`   ID: ${skill.id}`);
  console.log(`   描述: ${skill.frontmatter.description}`);
  console.log(`   参数: ${skill.frontmatter.arguments}`);
  console.log(`   上下文: ${skill.frontmatter.context || 'inline'}`);
  console.log(`   Shell: ${skill.frontmatter.shell || 'bash'}`);
} else {
  console.log('   未找到');
}
console.log('');

// 4. 执行技能
console.log('4. 执行技能测试:');
const result = await executeSkill({
  skillId: 'ext.kai_report_creator',
  params: {
    template: 'sales_report',
    data: { period: '2026-Q1', total_revenue: 5000000, opportunities: 25, conversion_rate: 0.35 },
    format: 'markdown'
  }
});

console.log('   执行模式:', result.executionMode);
console.log('   成功:', result.success);
console.log('   耗时:', result.durationMs, 'ms');
if (result.substitutedBody) {
  console.log('   替换后的 body (前 200 字符):');
  console.log('   ' + result.substitutedBody.slice(0, 200).replace(/\n/g, '\n   '));
}
if (result.error) {
  console.log('   错误:', result.error);
}
console.log('');

console.log('=== 测试完成 ===');