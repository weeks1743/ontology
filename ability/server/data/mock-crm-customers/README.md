# CRM Mock Customer Instances

这是一套面向 CRM 本体验证阶段的完整 mock 实例数据，覆盖 3 家客户、3 名销售、联系人、商机、拜访记录、需求、风险、承诺，以及面向 MongoDB / Neo4j / Chroma 的种子材料。

## 目录说明

- `mongodb_seed.json`
  - 面向 MongoDB 的实例数据
  - 已按集合拆分，可直接作为后续 seed 脚本输入
- `neo4j_seed.cypher`
  - 面向 Neo4j 的节点与关系建图脚本
- `chroma_documents.json`
  - 面向 Chroma 的语义文档集合
- `visit-records/`
  - 9 份高质量 Markdown 拜访记录
  - 你可以手动上传这些文件进行测试

## 覆盖客户

- 上海松井机械有限公司
- 山东金德利餐饮集团有限公司
- 江苏九州电器有限公司

## 设计原则

- 数据完整：每个客户都具备 Customer / Contact / Opportunity / VisitRecord / Need / Risk / Commitment
- 可查询：字段命名稳定，便于后续查询、检索、图谱推理
- 可追踪：拜访记录与商机、联系人、风险、承诺均有关联
- 可用于感知型技能：拜访记录内容足够丰富，支持后续 `分析拜访记录` 与 `生成客户经营建议`

## 建议使用方式

1. 先用 `visit-records/` 下的 Markdown 文件进行手动上传测试
2. 后续需要完整图谱时，再把 `mongodb_seed.json`、`neo4j_seed.cypher`、`chroma_documents.json` 接入初始化脚本
3. 若要扩充案例，请保持：
   - `customer_id`
   - `opportunity_id`
   - `visit_record_id`
   - `contact_id`
   - `sales_id`
   这些主键风格一致
