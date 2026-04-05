---
name: ont.crm.scenario_lead_to_opportunity
description: 线索转商机
metadata: { "openclaw": { "emoji": "🔄", "requires": { "bins": ["node"], "env": [] } } }
---

# 线索转商机

基于本体场景 `lead_to_opportunity` 自动生成的技能。

**技能类型**: 场景技能 (scenario)
**业务目标**: 将符合条件的线索转化为销售商机
**涉及对象**: Lead, Opportunity
**版本**: v20260405033335

## 描述

线索转商机

## 步骤编排

1. **评估线索** (`Lead.Evaluate`)
3. **转化为商机** (`Lead.ConvertToOpportunity`)
5. **创建商机** (`Opportunity.Create`)

## 入口条件

无

## 成功标准

线索转化率>30%
商机金额>0
