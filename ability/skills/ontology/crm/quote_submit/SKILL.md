---
name: ont.crm.quote_submit
description: 提交审批
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 提交审批

基于本体定义 `Quote.Submit` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Quote
**触发方式**: USER_ACTION
**版本**: v20260405033335

## 描述

提交审批

## 必填输入参数

- **quoteNo** (string, required): 报价单号
- **amount** (number, required): 报价总金额

## 可选输入参数

无

## 规则约束

- **Quote.AmountApproval**: 报价超过50万需要审批通过

## 成功输出

提交审批成功：操作已完成

## 写库计划

- MongoDB: update crm_quotes
- Neo4j: 
- Chroma: 不写入
