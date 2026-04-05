/**
 * skill-core 外部技能测试（简化版）
 * 测试 slide-creator-main 技能的加载和基本信息
 * 运行: npx tsx src/skill-core/test-slide.ts
 */

import 'dotenv/config';
import { initSkillCore, getAllSkills, getSkillById } from './index.js';

console.log('=== slide-creator-main 技能测试 ===\n');

// 1. 初始化并加载技能
console.log('1. 初始化模块...');
const count = initSkillCore();
console.log(`   加载了 ${count} 个技能\n`);

// 2. 查找 slide-creator 技能
console.log('2. 查找 kai-slide-creator 技能:');
const slideSkill = getSkillById('kai-slide-creator');

if (!slideSkill) {
  console.log('   ❌ 未找到 kai-slide-creator 技能');
  console.log('   请检查 skills/external/slide-creator-main/SKILL.md 是否存在');
  process.exit(1);
}

console.log('   ✅ 技能已加载\n');

// 3. 显示技能详细信息
console.log('3. 技能详细信息:');
console.log('   ID:', slideSkill.id);
console.log('   名称:', slideSkill.frontmatter.name || slideSkill.id);
console.log('   版本:', slideSkill.frontmatter.version || '未指定');
console.log('   描述:', slideSkill.frontmatter.description?.slice(0, 100) + '...');
console.log('   用户可调用:', slideSkill.frontmatter['user-invocable'] !== 'false');
console.log('   上下文:', slideSkill.frontmatter.context || 'inline');
console.log('   Shell:', slideSkill.frontmatter.shell || 'bash');
console.log('   加载来源:', slideSkill.loadedFrom);
console.log('   技能目录:', slideSkill.skillDir);
console.log('');

// 4. 显示元数据
console.log('4. 技能元数据:');
const metadata = slideSkill.frontmatter.metadata as any;
if (metadata?.openclaw) {
  console.log('   OpenClaw 配置:');
  console.log('     - 图标:', metadata.openclaw.emoji || '未设置');
  console.log('     - 支持系统:', metadata.openclaw.os?.join(', ') || '未指定');
  console.log('     - 主页:', metadata.openclaw.homepage || '未指定');
  if (metadata.openclaw.requires) {
    console.log('     - 依赖:');
    console.log('       * 二进制工具:', metadata.openclaw.requires.bins?.join(', ') || '无');
    console.log('       * 环境变量:', metadata.openclaw.requires.env?.join(', ') || '无');
  }
} else {
  console.log('   无 OpenClaw 元数据');
}
console.log('');

// 5. 显示 SKILL.md body（前 200 字符）
console.log('5. SKILL.md 内容预览 (前 200 字符):');
console.log('   ' + slideSkill.body.slice(0, 200).replace(/\n/g, '\n   '));
console.log('');

// 6. 检查必需文件
console.log('6. 检查必需文件:');
import { existsSync } from 'fs';
import { join } from 'path';

const requiredFiles = [
  'SKILL.md',
  'README.md',
  'README.zh-CN.md',
  'demos',
  'themes',
  'references',
  'tests'
];

for (const file of requiredFiles) {
  const fullPath = join(slideSkill.skillDir, file);
  const exists = existsSync(fullPath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
}
console.log('');

// 7. 验证技能有效性
console.log('7. 验证技能配置:');
const hasValidName = slideSkill.id.length > 0;
const hasDescription = (slideSkill.frontmatter.description?.length ?? 0) > 0;
const hasBody = slideSkill.body.length > 100;
const isExternal = slideSkill.loadedFrom === 'external';

console.log(`   ${hasValidName ? '✅' : '❌'} 有有效的 ID`);
console.log(`   ${hasDescription ? '✅' : '❌'} 有描述信息`);
console.log(`   ${hasBody ? '✅' : '❌'} 有完整的 body 内容 (${slideSkill.body.length} 字符)`);
console.log(`   ${isExternal ? '✅' : '❌'} 加载来源为 external`);
console.log('');

console.log('=== 测试完成 ===');
console.log('');
console.log('💡 提示:');
console.log('   - 技能已成功加载到 skill-core registry');
console.log('   - 可以通过 API 访问: GET /api/v2/skills/kai-slide-creator');
console.log('   - 可以在前端技能市场显示（如果配置了 skill-names.json）');
console.log('   - 执行需要配置 DEEPSEEK_API_KEY（用于 LLM inline 执行）');
console.log('');