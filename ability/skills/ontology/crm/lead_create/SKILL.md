---
name: ont.crm.lead_create
description: 创建线索
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 创建线索

基于本体定义 `Lead.Create` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Lead
**触发方式**: USER_ACTION
**版本**: v20260405033335

## 描述

创建线索

## 必填输入参数

- **title** (string, required): 线索标题

## 可选输入参数

无

## 规则约束

- **Lead.RequiredInfo**: 线索标题和联系电话为必填项

## 成功输出

创建线索成功：操作已完成

## 写库计划

- MongoDB: insert crm_leads
- Neo4j: upsert_node
- Chroma: 不写入
