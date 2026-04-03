---
name: ont.advance_opportunity
description: 推进商机到下一阶段，更新概率和金额
metadata: { "openclaw": { "emoji": "⏭️", "requires": { "bins": ["node"], "env": [] } } }
---

# 推进商机阶段

基于本体定义 `Opportunity.Advance` 自动生成的技能。

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
