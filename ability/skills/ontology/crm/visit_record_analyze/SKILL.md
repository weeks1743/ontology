---
name: ont.crm.visit_record_analyze
description: 提炼拜访记录中的客户态度、异议、承诺与风险信号，形成结构化摘要
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 分析拜访记录

基于本体定义 `VisitRecord.Analyze` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: VisitRecord
**触发方式**: PERCEPTIVE
**版本**: v20260409053319

## 描述

提炼拜访记录中的客户态度、异议、承诺与风险信号，形成结构化摘要

## 必填输入参数

- **visit_record_id** (string, required): 待分析的拜访记录ID

## 可选输入参数

无

## 规则约束

- **VisitRecord.ContentRequired**: 拜访记录内容不能为空

## 成功输出

分析拜访记录成功：操作已完成

## 写库计划

- MongoDB: update crm_visitrecords
- Neo4j: 
- Chroma: 不写入
