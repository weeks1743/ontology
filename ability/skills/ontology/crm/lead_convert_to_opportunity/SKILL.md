---
name: ont.crm.lead_convert_to_opportunity
description: 转化为商机
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 转化为商机

基于本体定义 `Lead.ConvertToOpportunity` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Lead
**触发方式**: TRANSACTIONAL
**版本**: v20260409053319

## 描述

转化为商机

## 必填输入参数

- **budget** (number, required): 预算金额
- **company** (string, required): 公司名称

## 可选输入参数

- **conversion_reason** (string): 转化原因

## 规则约束

- **Lead.RequiredInfo**: 线索标题和联系电话为必填项
- **Lead.BudgetThreshold**: 预算低于最低门槛1万元

## 成功输出

转化为商机成功：操作已完成

## 写库计划

- MongoDB: insert crm_leads, insert crm_opportunitys
- Neo4j: upsert_node, upsert_node, upsert_edge
- Chroma: upsert crm_opportunities
