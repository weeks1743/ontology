---
name: ont.crm.scenario_lead_entry_completion
description: 线索录入与补全
metadata: { "openclaw": { "emoji": "🔄", "requires": { "bins": ["node"], "env": [] } } }
---

# 线索录入与补全

基于本体场景 `lead_entry_completion` 自动生成的技能。

**技能类型**: 场景技能 (scenario)
**业务目标**: 完成线索的完整信息录入，为后续转化做准备
**涉及对象**: Lead
**版本**: v20260405033335

## 描述

线索录入与补全

## 步骤编排

1. **创建线索** (`Lead.Create`)
3. **补全线索信息** (`Lead.Complete`)

## 入口条件

无

## 成功标准

线索信息完整度≥80%
线索状态变更为已补全
