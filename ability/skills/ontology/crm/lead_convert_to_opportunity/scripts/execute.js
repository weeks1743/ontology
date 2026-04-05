// 技能执行入口: ont.crm.lead_convert_to_opportunity
// 此脚本由能力层编译平台自动生成
// 版本: v20260405033335

const params = JSON.parse(process.argv[2] || '{}');

console.log(JSON.stringify({
  skill_id: 'ont.crm.lead_convert_to_opportunity',
  skill_slug: 'lead_convert_to_opportunity',
  skill_type: 'behavior',
  behavior_code: 'Lead.ConvertToOpportunity',
  params: params,
  timestamp: new Date().toISOString(),
}));
