---
name: ont.crm.visit_record_create_from_markdown
description: 为客户上传一份 Markdown 格式的拜访记录，并纳入客户互动时间线
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 上传拜访记录

基于本体定义 `VisitRecord.CreateFromMarkdown` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: VisitRecord
**触发方式**: TRANSACTIONAL
**版本**: v20260409053319

## 描述

为客户上传一份 Markdown 格式的拜访记录，并纳入客户互动时间线

## 必填输入参数

- **customer_id** (string, required): 客户ID
- **customer_name** (string, required): 客户名称
- **title** (string, required): 拜访记录标题
- **sequence_no** (number, required): 拜访轮次
- **visit_type** (string, required): 拜访类型
- **content_markdown** (string, required): Markdown 记录内容
- **visit_at** (date, required): 拜访时间

## 可选输入参数

- **source_channel** (string): 来源渠道
- **industry** (string): 客户行业
- **region** (string): 客户区域

## 规则约束

- **VisitRecord.ContentRequired**: 拜访记录内容不能为空
- **VisitRecord.SequenceConsistent**: 拜访记录轮次必须从 1 开始且可排序

## 成功输出

上传拜访记录成功：操作已完成

## 写库计划

- MongoDB: insert crm_visit_records
- Neo4j: upsert_node
- Chroma: 不写入
