// 技能执行入口: ont.crm.lead_create
// 此脚本由能力层编译平台自动生成
// 版本: v20260405033335

const params = JSON.parse(process.argv[2] || '{}');

console.log(JSON.stringify({
  skill_id: 'ont.crm.lead_create',
  skill_slug: 'lead_create',
  skill_type: 'behavior',
  behavior_code: 'Lead.Create',
  params: params,
  timestamp: new Date().toISOString(),
}));
