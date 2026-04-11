---
name: ont.crm.visit_record_analyze
description: 提炼拜访记录中的客户态度、异议、承诺与风险信号，形成结构化摘要
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 分析拜访记录

基于本体定义 `VisitRecord.Analyze` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: VisitRecord
**触发方式**: PERCEPTIVE（感知型）
**版本**: v20260409053319

## 描述

提炼拜访记录中的客户态度、异议、承诺与风险信号，形成结构化摘要。

**增强能力**：该技能在执行时会自动查询客户的完整图谱数据（MongoDB + Neo4j + ChromaDB），将客户背景信息（联系人决策网络、商机组合、需求风险矩阵）注入 LLM 分析提示词，使分析结果更加个性化和精准。

## 必填输入参数

- **visit_record_id** (string, required): 待分析的拜访记录ID

## 可选输入参数

无

## 图谱查询

执行时自动查询以下数据：
- **MongoDB**: 客户档案、联系人、商机、需求、风险、承诺、线索、历史拜访记录
- **Neo4j**: 客户关系图谱（负责人、联系人影响力网络、商机关联、报价链路）
- **ChromaDB**: 相似商机语义搜索

## LLM 分析

使用大语言模型（配置时）进行结构化分析，输出：
- 拜访摘要（100字以内）
- 情感判断（积极/中性/谨慎/消极）
- 关注点信号、风险信号、机会信号、承诺信号
- 关键利益相关者识别
- 下一步跟进建议与紧急度评估

## 规则约束

- **VisitRecord.ContentRequired**: 拜访记录内容不能为空

## 成功输出

分析拜访记录成功：操作已完成

## 写库计划

- MongoDB: update crm_visitrecords
- Neo4j: 读取（不写入）
- Chroma: 读取（不写入）
