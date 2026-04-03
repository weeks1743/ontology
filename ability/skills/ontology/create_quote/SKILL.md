---
name: ont.create_quote
description: 为商机创建报价单，校验审批规则（>50万需审批）
metadata: { "openclaw": { "emoji": "📄", "requires": { "bins": ["node"], "env": [] } } }
---

# 创建报价单

基于本体定义 `Opportunity.CreateQuote` 自动生成的技能。

## 描述



## 输入参数

根据 Quote 对象定义的字段。

## 输出结果

- success: 是否成功
- data: 创建/更新的实体数据
- quote_id: 实体 ID
- mongodb_status: MongoDB 操作状态
- neo4j_status: Neo4j 操作状态
- chroma_status: ChromaDB 操作状态

## 规则校验

- Quote.AmountApproval

## 副作用

无
