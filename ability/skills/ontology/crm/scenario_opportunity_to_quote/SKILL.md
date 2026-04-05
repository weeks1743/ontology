---
name: ont.crm.scenario_opportunity_to_quote
description: 商机到报价
metadata: { "openclaw": { "emoji": "🔄", "requires": { "bins": ["node"], "env": [] } } }
---

# 商机到报价

基于本体场景 `opportunity_to_quote` 自动生成的技能。

**技能类型**: 场景技能 (scenario)
**业务目标**: 推进商机至报价阶段，完成报价单审批
**涉及对象**: Opportunity, Quote
**版本**: v20260405033335

## 描述

商机到报价

## 步骤编排

1. **推进商机** (`Opportunity.Advance`)
3. **创建报价单** (`Opportunity.CreateQuote`)
5. **创建报价** (`Quote.Create`)
7. **提交审批** (`Quote.Submit`)
9. **审批通过** (`Quote.Approve`)

## 入口条件

无

## 成功标准

报价审批完成
商机状态更新为赢单
