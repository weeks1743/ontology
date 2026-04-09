---
name: ont.crm.opportunity_create_quote
description: 创建报价单
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 创建报价单

基于本体定义 `Opportunity.CreateQuote` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Opportunity
**触发方式**: TRANSACTIONAL
**版本**: v20260409053319

## 描述

创建报价单

## 必填输入参数

- **name** (string, required): 商机名称

## 可选输入参数

无

## 规则约束

- **Quote.AmountApproval**: 报价超过50万需要审批通过

## 成功输出

创建报价单成功：操作已完成

## 写库计划

- MongoDB: insert crm_opportunitys
- Neo4j: upsert_node
- Chroma: upsert crm_opportunitys
