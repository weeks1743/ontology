---
name: ont.convert_lead
description: 将线索转换为商机，自动创建客户、联系人和商机
metadata: { "openclaw": { "emoji": "🔄", "requires": { "bins": ["node"], "env": [] } } }
---

# 线索转商机

基于本体定义 `Lead.ConvertToOpportunity` 自动生成的技能。

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
