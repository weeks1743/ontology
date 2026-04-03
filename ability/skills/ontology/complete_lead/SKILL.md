---
name: ont.complete_lead
description: 补全线索的详细信息（预算、需求等），校验预算规则
metadata: { "openclaw": { "emoji": "✍️", "requires": { "bins": ["node"], "env": [] } } }
---

# 补全线索信息

基于本体定义 `Lead.Complete` 自动生成的技能。

## 描述



## 输入参数

根据 Lead 对象定义的字段。

## 输出结果

- success: 是否成功
- data: 创建/更新的实体数据
- lead_id: 实体 ID
- mongodb_status: MongoDB 操作状态
- neo4j_status: Neo4j 操作状态
- chroma_status: ChromaDB 操作状态

## 规则校验

- Lead.RequiredInfo
- Lead.BudgetThreshold

## 副作用

无
