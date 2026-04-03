---
name: ont.create_lead
description: 创建销售线索，自动校验必填字段（title+phone）
metadata: { "openclaw": { "emoji": "📝", "requires": { "bins": ["node"], "env": [] } } }
---

# 创建线索

基于本体定义 `Lead.Create` 自动生成的技能。

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

## 副作用

无
