---
name: ont.crm.opportunity_advance
description: 推进商机
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 推进商机

基于本体定义 `Opportunity.Advance` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Opportunity
**触发方式**: TRANSACTIONAL
**版本**: v20260409053319

## 描述

推进商机

## 必填输入参数

- **name** (string, required): 商机名称

## 可选输入参数

无

## 规则约束

- **Opportunity.ProbabilityRange**: 赢单概率必须在0-100之间

## 成功输出

推进商机成功：操作已完成

## 写库计划

- MongoDB: update crm_opportunities
- Neo4j: 
- Chroma: upsert crm_opportunities
