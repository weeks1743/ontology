---
name: ont.crm.customer_generate_operating_advice
description: 基于同一客户最近三轮拜访记录，生成当前轮次的客户经营建议与产物
metadata: { "openclaw": { "emoji": "⚙️", "requires": { "bins": ["node"], "env": [] } } }
---

# 生成客户经营建议

基于本体定义 `Customer.GenerateOperatingAdvice` 自动生成的技能。

**技能类型**: 行为技能 (behavior)
**归属对象**: Customer
**触发方式**: PERCEPTIVE（感知型）
**版本**: v20260409053319

## 描述

基于同一客户最近三轮拜访记录，生成当前轮次的客户经营建议与产物。

**增强能力**：该技能自动构建完整的客户图谱上下文（MongoDB 9个集合 + Neo4j 全图查询 + ChromaDB 语义搜索），使用 MEDDIC 方法论、SPIN 销售法等专业框架进行深度分析，输出结构化的经营建议。

## 必填输入参数

- **customer_id** (string, required): 客户ID
- **visit_record_ids** (array, required): 参与本轮建议生成的拜访记录ID列表
- **advice_round** (number, required): 当前建议轮次

## 可选输入参数

无

## 图谱查询与推理

执行时自动聚合以下数据：
- **MongoDB**: 客户档案（含企业概况、数字化成熟度标签）、联系人（含影响力/态度/联系方式）、商机组合、报价、需求、风险、承诺、线索、销售负责人、历史拜访记录
- **Neo4j**: 客户关系图谱（负责人关联、联系人决策网络、商机-报价链路、拜访记录关联）
- **ChromaDB**: 相似商机语义搜索（基于客户名称）

## LLM 专业分析

使用大语言模型（配置时）结合专业方法论进行分析：
- **MEDDIC 评估**: Metrics（量化指标）、Economic Buyer（经济决策人）、Champion（内部支持者）、Decision Criteria（决策标准）、Decision Process（决策流程）、Identified Pain（已识别痛点）
- **联系人策略**: 如何调动 Champion 影响 Decision Maker，如何消除关键障碍者顾虑
- **竞争态势**: 结合拜访记录中的竞品信号，分析差异化优势
- **风险缓解**: 主要风险的应对策略
- **下一步行动**: 具体、可执行、有明确时间节点的行动建议

## 输出产物

- Markdown 经营建议文档（含客户档案、趋势判断、MEDDIC 评估、联系人策略等）
- HTML 精美报告（通过 kai-report-creator 渲染）
- 结构化 JSON 经营建议（存入 operating_advice_artifacts 表）

## 规则约束

- **Customer.AdviceNeedsVisitRecord**: 生成客户经营建议前，至少需要一份拜访记录
- **Customer.AdviceMaxWindow**: MVP 阶段客户经营建议最多使用最近 3 条拜访记录

## 成功输出

生成客户经营建议成功：操作已完成

## 写库计划

- MongoDB: update crm_customers（更新建议关联）
- Neo4j: 读取（不写入）
- Chroma: 读取（不写入）
