---
name: ont.crm.lead_evaluate
description: 评估线索
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 评估线索

基于本体定义 `Lead.Evaluate` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Lead
**触发方式**: TRANSACTIONAL
**版本**: v20260409053319

## 描述

评估线索

## 必填输入参数

- **title** (string, required): 线索标题

## 可选输入参数

无

## 规则约束

- **Lead.BudgetThreshold**: 预算低于最低门槛1万元

## 成功输出

评估线索成功：操作已完成

## 写库计划

- MongoDB: update crm_leads
- Neo4j: 
- Chroma: 不写入
