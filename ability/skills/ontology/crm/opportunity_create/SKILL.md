---
name: ont.crm.opportunity_create
description: 创建商机
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 创建商机

基于本体定义 `Opportunity.Create` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Opportunity
**触发方式**: TRANSACTIONAL
**版本**: v20260409053319

## 描述

创建商机

## 必填输入参数

- **name** (string, required): 商机名称

## 可选输入参数

无

## 规则约束

- **Opportunity.ProbabilityRange**: 赢单概率必须在0-100之间

## 成功输出

创建商机成功：操作已完成

## 写库计划

- MongoDB: insert crm_opportunities
- Neo4j: upsert_node
- Chroma: upsert crm_opportunities
