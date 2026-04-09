---
name: ont.crm.customer_generate_operating_advice
description: 基于同一客户最近三轮拜访记录，生成当前轮次的客户经营建议与产物
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 生成客户经营建议

基于本体定义 `Customer.GenerateOperatingAdvice` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Customer
**触发方式**: PERCEPTIVE
**版本**: v20260409053319

## 描述

基于同一客户最近三轮拜访记录，生成当前轮次的客户经营建议与产物

## 必填输入参数

- **customer_id** (string, required): 客户ID
- **visit_record_ids** (array, required): 参与本轮建议生成的拜访记录ID列表
- **advice_round** (number, required): 当前建议轮次

## 可选输入参数

无

## 规则约束

- **Customer.AdviceNeedsVisitRecord**: 生成客户经营建议前，至少需要一份拜访记录
- **Customer.AdviceMaxWindow**: MVP 阶段客户经营建议最多使用最近 3 条拜访记录

## 成功输出

生成客户经营建议成功：操作已完成

## 写库计划

- MongoDB: update crm_customers
- Neo4j: 
- Chroma: 不写入
