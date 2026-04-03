#!/usr/bin/env node
/**
 * 报告生成器执行脚本
 */
const fs = require('fs');
const path = require('path');

// 报告模板
const templates = {
  sales_report: (data) => `
# 销售报告

**报告期间**: ${data.period || 'N/A'}

## 核心指标

- **总收入**: ¥${(data.total_revenue || 0).toLocaleString()}
- **商机数量**: ${data.opportunities || 0}
- **转化率**: ${((data.conversion_rate || 0) * 100).toFixed(1)}%

## 分析总结

本期销售表现${data.conversion_rate > 0.3 ? '优秀' : '需要改进'}，建议继续保持当前策略。

---
*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`,

  opportunity_analysis: (data) => `
# 商机分析报告

**商机名称**: ${data.title || 'N/A'}

## 基本信息

- **金额**: ¥${(data.amount || 0).toLocaleString()}
- **阶段**: ${data.stage || 'N/A'}
- **概率**: ${data.probability || 0}%
- **客户**: ${data.customer_name || 'N/A'}

## 风险评估

${data.probability > 70 ? '✅ 高概率赢单' : data.probability > 40 ? '⚠️ 中等风险' : '❌ 高风险'}

## 建议行动

${data.probability < 50 ? '- 加强客户沟通\n- 提供更多价值证明' : '- 推进到下一阶段\n- 准备合同签署'}

---
*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`,

  customer_profile: (data) => `
# 客户画像报告

**客户名称**: ${data.name || 'N/A'}

## 基本信息

- **行业**: ${data.industry || 'N/A'}
- **规模**: ${data.size || 'N/A'}
- **地区**: ${data.region || 'N/A'}

## 业务往来

- **总交易额**: ¥${(data.total_revenue || 0).toLocaleString()}
- **商机数量**: ${data.opportunities || 0}
- **成交率**: ${((data.win_rate || 0) * 100).toFixed(1)}%

## 客户价值

${data.total_revenue > 1000000 ? '⭐⭐⭐ 高价值客户' : data.total_revenue > 500000 ? '⭐⭐ 中等价值客户' : '⭐ 潜力客户'}

---
*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`
};

function generateReport(template, data, format) {
  if (!templates[template]) {
    throw new Error(`未知的模板: ${template}`);
  }

  const content = templates[template](data);

  // 根据格式处理
  if (format === 'html') {
    // 简单的 Markdown 到 HTML 转换
    return content
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^\*\*(.+)\*\*:/gm, '<strong>$1</strong>:')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
  }

  return content;
}

// 主函数
try {
  const params = JSON.parse(process.argv[2] || '{}');

  const template = params.template;
  const data = params.data || {};
  const format = params.format || 'markdown';

  if (!template) {
    console.log(JSON.stringify({
      success: false,
      error: '缺少 template 参数'
    }));
    process.exit(0);
  }

  const report = generateReport(template, data, format);

  console.log(JSON.stringify({
    success: true,
    report: report,
    format: format,
    template: template
  }));
} catch (error) {
  console.log(JSON.stringify({
    success: false,
    error: error.message
  }));
}
