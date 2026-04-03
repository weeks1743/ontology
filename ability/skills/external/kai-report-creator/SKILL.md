---
name: ext.kai_report_creator
description: 基于模板生成专业报告文档
metadata: { "openclaw": { "emoji": "📊", "requires": { "bins": ["node"], "env": [] } } }
---

# 报告生成器

基于预定义模板生成专业的业务报告文档。

## 输入参数

- template: 模板名称（必填）
  - `sales_report` - 销售报告
  - `opportunity_analysis` - 商机分析报告
  - `customer_profile` - 客户画像报告
- data: 报告数据（必填）
- format: 输出格式（默认 `markdown`）
  - `markdown` - Markdown 格式
  - `html` - HTML 格式
  - `pdf` - PDF 格式

## 输出结果

- success: 是否成功
- report: 生成的报告内容
- format: 报告格式

## 使用示例

```json
{
  "template": "sales_report",
  "data": {
    "period": "2026-Q1",
    "total_revenue": 5000000,
    "opportunities": 25,
    "conversion_rate": 0.35
  },
  "format": "markdown"
}
```
