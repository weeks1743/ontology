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

// 3. 获取单个技能 (kai-report-creator)
console.log('3. 获取技能详情 (kai-report-creator):');
const reportSkill = getSkillById('kai-report-creator');
if (reportSkill) {
  console.log(`   ID: ${reportSkill.id}`);
  console.log(`   描述: ${reportSkill.frontmatter.description}`);
  console.log(`   参数: ${reportSkill.frontmatter.arguments}`);
  console.log(`   上下文: ${reportSkill.frontmatter.context || 'inline'}`);
  console.log(`   Shell: ${reportSkill.frontmatter.shell || 'bash'}`);
} else {
  console.log('   未找到');
}
console.log('');

// 3.1 获取单个技能 (kai-slide-creator)
console.log('3.1 获取技能详情 (kai-slide-creator):');
const slideSkill = getSkillById('kai-slide-creator');
if (slideSkill) {
  console.log(`   ID: ${slideSkill.id}`);
  console.log(`   描述: ${slideSkill.frontmatter.description}`);
  console.log(`   版本: ${slideSkill.frontmatter.version}`);
  console.log(`   参数: ${slideSkill.frontmatter.arguments || '无'}`);
  console.log(`   上下文: ${slideSkill.frontmatter.context || 'inline'}`);
  console.log(`   Shell: ${slideSkill.frontmatter.shell || 'bash'}`);
  console.log(`   元数据: ${JSON.stringify(slideSkill.frontmatter.metadata || {})}`);
} else {
  console.log('   未找到');
}
console.log('');

// 4. 执行技能测试 (kai-report-creator)
console.log('4. 执行技能测试 (kai-report-creator):');
const reportResult = await executeSkill({
  skillId: 'kai-report-creator',
  mode: 'inline',  // 强制使用 inline 模式（LLM 执行）
  params: {
    topic: '季度销售报告',
    data: '2026年Q1销售额达到500万，同比增长35%',
    style: 'corporate-blue'
  }
});

console.log('   执行模式:', reportResult.executionMode);
console.log('   成功:', reportResult.success);
console.log('   耗时:', reportResult.durationMs, 'ms');
if (reportResult.spawnOutput) {
  const output = typeof reportResult.spawnOutput === 'string'
    ? reportResult.spawnOutput
    : JSON.stringify(reportResult.spawnOutput, null, 2);
  console.log('   LLM 输出 (前 500 字符):');
  console.log('   ' + output.slice(0, 500).replace(/\n/g, '\n   '));
}
if (reportResult.error) {
  console.log('   错误:', reportResult.error);
}
console.log('');

// 5. 执行技能测试 (kai-slide-creator)
console.log('5. 执行技能测试 (kai-slide-creator):');
const slideResult = await executeSkill({
  skillId: 'kai-slide-creator',
  mode: 'inline',  // 强制使用 inline 模式（LLM 执行）
  params: {
    topic: '产品发布演示',
    style: 'modern-minimal',
    slides: 5,
    language: 'zh-CN'
  }
});

console.log('   执行模式:', slideResult.executionMode);
console.log('   成功:', slideResult.success);
console.log('   耗时:', slideResult.durationMs, 'ms');
if (slideResult.spawnOutput) {
  const output = typeof slideResult.spawnOutput === 'string'
    ? slideResult.spawnOutput
    : JSON.stringify(slideResult.spawnOutput, null, 2);
  console.log('   LLM 输出 (前 500 字符):');
  console.log('   ' + output.slice(0, 500).replace(/\n/g, '\n   '));
}
if (slideResult.error) {
  console.log('   错误:', slideResult.error);
}
console.log('');

console.log('=== 测试完成 ===');