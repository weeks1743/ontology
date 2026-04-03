---
name: ont.create_opportunity
description: 创建商机，校验概率范围（0-100）
metadata: { "openclaw": { "emoji": "💼", "requires": { "bins": ["node"], "env": [] } } }
---

# 创建商机

基于本体定义 `Opportunity.Create` 自动生成的技能。

## 描述



## 输入参数

根据 Opportunity 对象定义的字段。

## 输出结果

- success: 是否成功
- data: 创建/更新的实体数据
- opportunity_id: 实体 ID
- mongodb_status: MongoDB 操作状态
- neo4j_status: Neo4j 操作状态
- chroma_status: ChromaDB 操作状态

## 规则校验

- Opportunity.ProbabilityRange

## 副作用

无
