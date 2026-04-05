---
name: ont.crm.quote_approve
description: 审批通过
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 审批通过

基于本体定义 `Quote.Approve` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Quote
**触发方式**: SYSTEM_OR_MANAGER_ACTION
**版本**: v20260405033335

## 描述

审批通过

## 必填输入参数

- **quoteNo** (string, required): 报价单号
- **amount** (number, required): 报价总金额

## 可选输入参数

无

## 规则约束

无

## 成功输出

审批通过成功：操作已完成

## 写库计划

- MongoDB: update crm_quotes
- Neo4j: 
- Chroma: 不写入
