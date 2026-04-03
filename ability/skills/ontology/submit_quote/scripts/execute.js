// 技能执行脚本: ont.submit_quote
// 此脚本由能力层自动生成

const params = JSON.parse(process.argv[2] || '{}');

// 输出执行结果
console.log(JSON.stringify({
  skill_id: 'ont.submit_quote',
  behavior_code: 'Quote.Submit',
  params: params,
  timestamp: new Date().toISOString(),
}));
