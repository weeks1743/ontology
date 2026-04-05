# 纯 SKILL 版本体技能平台最终方案（含三库职责、生成报告、测试方案）

## Summary

- 平台定位为**本体技能编译平台**，不做 CRM 专用实现；CRM、HR、供应链、进销存等系统都走同一套 `本体定义 -> 定义快照 -> 技能编译 -> 技能运行` 流程。
- 坚持**纯 SKILL 实现**：
  - `Behavior SKILL / 行为技能` 负责确定性执行
  - `Scenario SKILL / 场景技能` 负责确定性编排
  - 不引入 Agent
- 技能生成唯一输入为 `Definition Snapshot / 定义快照`；YAML 继续作为可读投影，不作为运行时真源。
- 命名采用**英文键 + 中文说明**；UI、报告、测试方案、技能说明尽量中文优先，必要时用“英文+中文”并列。
- 技能包固定隔离在 `skills/ontology/<ontology_id>/<skill_slug>/`；完整技能 ID 为 `ont.<ontology_id>.<skill_slug>`。
- 生成后必须同步产出两类可查看结果：
  - `生成报告 / Build Report`
  - `测试方案 / Test Plan`
- 生成方式为**手动触发**：
  - 无历史构建数据时：全量构建
  - 有历史构建数据时：增量构建
  - 支持“全部删除后重新生成”
- 有版本号，但**本轮不实现回滚**。
- 暂不实现权限模型、补偿机制、复杂行为类型分类。

## Key Changes

### 1. 本体内容与 SKILL 的参与策略

| 本体内容 | 是否生成独立 SKILL | 在技能中的参与方式 | 编译产物 |
| --- | --- | --- | --- |
| `Object / 对象实体` | 否 | 提供字段、生命周期、关系、默认存储策略、中文业务语义 | 进入 `manifest.yaml/json`、`references/对象说明.md`、`SKILL.md` 字段说明 |
| `Behavior / 逻辑行为` | 是 | 每个公开行为生成 1 个 `Behavior SKILL` | 完整行为技能包 |
| `Rule / 约束规则` | 否 | 编译成 `rule_bindings / 规则绑定`，供行为技能和场景技能使用 | 进入 manifest |
| `Event / 消息事件` | 否 | 编译成 `event_bindings / 事件绑定` 和审计链 | 进入 manifest |
| `Scenario / 业务场景` | 是 | 每个保留场景生成 1 个 `Scenario SKILL`，显式串联多个行为技能 | 完整场景技能包 |
| `Query/Diagnostic / 查询诊断能力` | 条件生成 | 图追溯、语义检索、实例解释等只读技能 | 查询诊断技能包 |

**规则**
- `Rule` 和 `Event` 不暴露为独立技能。
- `Behavior SKILL` 是唯一真正落库和发事件的技能类型。
- `Scenario SKILL` 只做确定性编排，不直接写 Mongo/Neo4j/Chroma。
- 本轮不引入额外 `behavior_kind / 行为类型` 分类体系。

---

### 2. `Definition Snapshot / 定义快照` 与 `load_snapshot / 加载快照`

#### 2.1 定位
`load_snapshot` 是本体技能核心生成服务的唯一输入规则：  
从本体数据库真源中读取一个“单本体、只读、规范化、可校验、可哈希、可冻结”的定义快照。

#### 2.2 真源与范围
- 真源只来自本体系统数据库：
  - `ontologies`
  - `ontology_objects`
  - `ontology_behaviors`
  - `ontology_rules`
  - `ontology_events`
  - `ontology_scenarios`
- 不读取：
  - MongoDB / Neo4j / Chroma 的业务实例数据
  - 已生成技能目录
  - ability 执行日志
- 一次只读取一个 `ontology_id`

#### 2.3 快照结构
`DefinitionSnapshot / 定义快照` 固定包含：

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 快照结构版本 |
| `ontology` | 本体标识、中文名、说明 |
| `objects` | 规范化对象列表 |
| `behaviors` | 规范化行为列表 |
| `rules` | 规范化规则列表 |
| `events` | 规范化事件列表 |
| `scenarios` | 规范化场景列表 |
| `validation` | 完整性校验结果 |
| `build_hints` | 编译提示，如默认 manifest 格式 |
| `source_fingerprint` | 真源变化指纹 |
| `snapshot_hash` | 规范化快照哈希 |
| `generated_at` | 快照生成时间 |

#### 2.4 规范化规则
- 所有列表按 `code` 或 `step` 排序，保证哈希稳定。
- 所有 JSON 字段反序列化并补默认值。
- 所有引用做可解析化：
  - 原始引用保留
  - 同时补充 `exists / display_name_zh / resolved_ref`
- `validation` 分为：
  - `errors / 错误`：阻断构建
  - `warnings / 告警`：允许降级构建
- `snapshot_hash` 基于规范化后的 canonical JSON 计算，不包含 `generated_at`。

#### 2.5 构建阻断条件
命中以下任一项时禁止生成技能包：
- `Behavior` 引用不存在的 `Object`
- `Behavior` 引用不存在的 `Rule`
- `Behavior` 发射不存在的 `Event`
- `Event` 生产者不存在
- `Scenario` 步骤引用不存在的行为或事件
- 对象关系指向不存在对象
- 行为缺少最小输入契约
- 行为无法推断主事实写入对象

---

### 3. 技能包与技能清单规范

#### 3.1 目录与标识
- 外部技能：`skills/external/<skill_slug>/`
- 本体技能：`skills/ontology/<ontology_id>/<skill_slug>/`
- 完整技能标识：`ont.<ontology_id>.<skill_slug>`

#### 3.2 单个技能包内容

| 文件 | 中文名称 | 作用 |
| --- | --- | --- |
| `SKILL.md` | 技能说明文件 | 触发说明、缺字段追问、输出模板、边界说明 |
| `manifest.yaml` | 技能清单说明 | 中文优先、带业务注释、便于大模型理解 |
| `manifest.json` | 技能运行清单 | 运行时严格解析版本 |
| `scripts/execute.js` | 统一执行入口 | 薄入口，只调用共享 runtime |
| `references/对象说明.md` | 对象说明文件 | 对象、规则、事件、状态说明 |
| `evals/测试用例.yaml` | 技能测试方案 | 单技能最小回归测试 |

#### 3.3 技能清单规范
按你的要求，**定义清单规范，但本轮不实现“自动区分哪些字段只给运行时、哪些字段只给大模型理解”的逻辑开关**。  
清单结构仍然按逻辑分组设计，便于后续演进。

##### `BehaviorManifest / 行为清单`
必须包含以下字段组：

| 字段组 | 关键字段 |
| --- | --- |
| 基础信息 | `schema_version`、`ontology_id`、`skill_slug`、`full_id`、`display_name_zh`、`description_zh`、`skill_type=behavior` |
| 本体映射 | `behavior_code`、`owner_object`、`related_objects`、`snapshot_hash` |
| 输入输出 | `input_schema`、`output_schema`、`field_comments_zh`、`output_comments_zh` |
| 读取上下文 | `reads`、`context_aliases` |
| 前置约束 | `object_preconditions`、`rule_bindings` |
| 写库计划 | `db_policy`、`write_plan` |
| 事件绑定 | `event_bindings` |
| 用户输出 | `success_template_zh`、`failure_template_zh`、`next_action_template_zh` |
| 生成元数据 | `build_version`、`generated_at`、`generator_version` |

##### `ScenarioManifest / 场景清单`
必须包含以下字段组：

| 字段组 | 关键字段 |
| --- | --- |
| 基础信息 | `schema_version`、`ontology_id`、`skill_slug`、`full_id`、`display_name_zh`、`description_zh`、`skill_type=scenario` |
| 本体映射 | `scenario_code`、`snapshot_hash` |
| 场景输入 | `required_context`、`input_schema` |
| 进入条件 | `entry_conditions` |
| 步骤编排 | `steps`、`input_mapping`、`output_mapping` |
| 分支关卡 | `decision_gates` |
| 失败策略 | `failure_policy` |
| 完成标准 | `completion_criteria` |
| 汇总输出 | `summary_template_zh`、`failure_summary_template_zh` |
| 生成元数据 | `build_version`、`generated_at`、`generator_version` |

#### 3.4 manifest 文件格式
- 默认采用 `manifest.yaml + manifest.json`
- `manifest.yaml` 中允许大量中文说明和注释
- `manifest.json` 为从 YAML 编译出的严格版本
- 本轮不做“只保留 YAML”方案；后续若需要，可裁掉 JSON 编译层

---

### 4. `write_plan / 写库计划` 的统一 DSL 规范

按推荐方案执行，定义统一 DSL。

#### 4.1 统一变量引用
所有写库计划统一支持以下变量来源：
- `$input.xxx`
- `$reads.xxx`
- `$result.xxx`
- `$steps.<step_id>.output.xxx`

#### 4.2 MongoDB 写计划
`write_plan.mongodb[]` 每项固定结构：

| 字段 | 说明 |
| --- | --- |
| `op` | `insert / update / upsert / delete` |
| `collection` | 集合名 |
| `alias` | 结果别名，可选 |
| `by` | 定位条件，用于 update/upsert/delete |
| `document` | 插入文档 |
| `set` | 更新字段 |
| `unset` | 删除字段 |
| `comment_zh` | 中文说明 |

#### 4.3 Neo4j 写计划
`write_plan.neo4j[]` 每项固定结构：

| 字段 | 说明 |
| --- | --- |
| `op` | `upsert_node / upsert_edge / delete_edge / update_node` |
| `label` | 节点标签 |
| `node` | 节点结构 |
| `edge` | 边结构，含 `from / to / type / properties` |
| `comment_zh` | 中文说明 |

#### 4.4 Chroma 写计划
`write_plan.chroma[]` 每项固定结构：

| 字段 | 说明 |
| --- | --- |
| `op` | `upsert_document / delete_document` |
| `collection` | 集合名 |
| `id` | 文档标识 |
| `document_template` | 向量文本模板 |
| `metadata` | 过滤元数据 |
| `comment_zh` | 中文说明 |

#### 4.5 本轮边界
- 只定义 DSL，不做复杂补偿机制
- 暂不引入异步投影任务表
- 暂不实现死信和回放机制

---

### 5. 三库职责的核心设计

#### 5.1 三库角色边界

| 存储 | 核心角色 | 保存内容 | 不保存内容 |
| --- | --- | --- | --- |
| `MongoDB / 主事实库` | 业务事实真源 | 完整实体文档、状态字段、引用 ID、业务主结果 | 图关系边、向量 |
| `Neo4j / 图谱投影库` | 关系链路与追溯 | 节点、关系边、转化链、审批链、关键链路投影 | 完整业务文档、向量 |
| `Chroma / 语义投影库` | 相似检索与案例召回 | 语义摘要、过滤元数据、向量索引 | 完整实体、复杂关系 |
| `ability.db / 平台元库` | 平台元数据与审计 | 技能索引、构建记录、生成报告、测试方案、执行日志、评估结果 | 业务事实真源 |

#### 5.2 三库设计原则

##### MongoDB / 主事实库
- 所有写行为必须先确定主写对象
- MongoDB 是业务写行为的主提交点
- 技能成功与否以 Mongo 提交结果为基准
- 实体完整字段只在 Mongo 中保存真源

##### Neo4j / 图谱投影库
- 只保存对业务关系和追溯有价值的节点与边
- 不做 Mongo 文档镜像
- 核心用途：
  - 线索转商机追溯
  - 报价审批链查询
  - 上下游关系分析
  - 图追溯技能支持

##### Chroma / 语义投影库
- 只保存需要语义检索的对象
- 当前默认只对 `Opportunity / 商机` 建索引
- 文本内容使用摘要模板，不直接拼原始 JSON
- 检索返回 ID 和摘要，详情回 Mongo 拉取

#### 5.3 对象级默认写库策略

| 对象 | 默认写库 |
| --- | --- |
| `Lead / 线索` | MongoDB + Neo4j |
| `Customer / 客户` | MongoDB + Neo4j |
| `Contact / 联系人` | MongoDB + Neo4j |
| `Opportunity / 商机` | MongoDB + Neo4j + Chroma |
| `Quote / 报价` | MongoDB + Neo4j |

#### 5.4 一致性模型
本轮采用**同步主事实 + 同步投影**：

1. 参数归一化
2. 读取上下文
3. 规则校验
4. 生成写库计划
5. 先写 `MongoDB`
6. 再写 `Neo4j`
7. 若涉及语义检索，再写 `Chroma`
8. 发射业务事件
9. 写平台审计

默认 required 规则：
- `MongoDB.required = true`
- `Neo4j.required = true`
- `Chroma.required = false`

本轮暂不考虑：
- 补偿机制
- 异步投影
- 回放重试系统

---

### 6. Behavior SKILL 与 Scenario SKILL 的标准实现

#### 6.1 Behavior SKILL / 行为技能
统一执行顺序：

1. `normalize_input / 参数归一化`
2. `read_context / 读取实例上下文`
3. `object_preconditions / 对象前置条件`
4. `rule_bindings / 规则绑定执行`
5. `build_write_plan / 构建写库计划`
6. `commit_record_store / 写主事实库`
7. `commit_graph_projection / 写图谱投影`
8. `commit_semantic_projection / 写语义投影`
9. `emit_events / 发射事件`
10. `render_output / 生成业务输出`
11. `audit_log / 记录审计`

标准示例采用：
- `Lead.ConvertToOpportunity / 线索转商机`
- 串联对象：`Lead / Customer / Contact / Opportunity`
- 串联规则：`Lead.BudgetThreshold`
- 串联事件：`lead.converted`、`opportunity.created`
- 串联三库：Mongo 主写、Neo4j 建边、Chroma 建商机索引

#### 6.2 Scenario SKILL / 场景技能
统一执行顺序：

1. `check_entry_conditions / 校验进入条件`
2. `collect_required_context / 收集场景所需输入`
3. `execute_step_skills / 顺序调用子技能`
4. `apply_decision_gates / 应用确定性关卡`
5. `handle_failure_policy / 失败处理`
6. `check_completion_criteria / 校验完成标准`
7. `render_summary / 输出场景总结`
8. `audit_log / 记录场景日志`

标准示例采用：
- `opportunity_to_quote / 商机到报价`
- 步骤：
  1. `advance_opportunity`
  2. `prepare_quote_from_opportunity`
  3. `create_quote`
  4. `submit_quote`
  5. `approve_quote`

本轮约束：
- 场景技能保留，但仅做确定性编排
- 场景步数控制在实现阶段处理，本轮不做专门自动化规则模块

---

### 7. 生成方式、版本与兼容方案

#### 7.1 生成方式
- 仅支持**手动触发**
- 触发入口：
  - `POST /api/ontology-skills/build`
- 构建模式：
  - 无历史构建数据：全量
  - 有历史构建数据：增量
  - “全部删除后重新生成”：视作全量

#### 7.2 版本
- 每次构建生成 `build_version`
- 每个技能记录：
  - `snapshot_hash`
  - `build_version`
  - `generated_at`
  - `is_active`
- 本轮不实现回滚，但保留版本记录

#### 7.3 与现有 skill-core 的兼容
按推荐方案执行：

- skill-core 扩展支持扫描两层 ontology 路径：
  - `skills/ontology/<ontology_id>/<skill_slug>/SKILL.md`
- 技能真实 ID 以路径生成的 `full_id` 为准，不以 frontmatter `name` 为唯一键
- ontology 技能仍统一纳入技能发现与执行体系
- ability 对本体技能新增专属接口，但底层 skill-core 仍负责加载、预览和执行入口

---

### 8. 生成报告 / Build Report 与 测试方案 / Test Plan

#### 8.1 生成报告
每次生成本体技能后，必须同时产出一份可查看的【生成报告】。

报告至少包含：

| 模块 | 内容 |
| --- | --- |
| 构建基础信息 | `ontology_id`、本体名称、`snapshot_hash`、`build_version`、构建模式、开始/结束时间 |
| 输入快照摘要 | 对象数、行为数、规则数、事件数、场景数 |
| 技能生成结果 | 生成了多少 `Behavior SKILL`、多少 `Scenario SKILL`、多少查询技能 |
| 增量变化 | 新增、更新、删除、跳过的技能清单 |
| 校验结果 | `errors / warnings / blocked_items` |
| 生成过程明细 | 每个技能的生成步骤、使用了哪些对象/规则/事件 |
| 产物位置 | 技能目录、manifest 路径、引用说明路径 |
| 测试方案摘要 | 自动生成了多少测试项、对应哪些技能 |
| 总结 | 本次构建是否成功、是否可用于测试 |

报告输出形式：
- `ability.db.skill_build_reports`
- 可选同步写出 `report.md` 到构建目录
- 前端提供【报告结果】查看页或构建详情弹层

#### 8.2 测试方案
每次构建后，必须同时产出一份【测试方案】并接入现有“技能测试”页面。

测试方案至少包含：

| 模块 | 内容 |
| --- | --- |
| 方案基础信息 | `build_version`、`ontology_id`、`snapshot_hash` |
| 技能级测试 | 每个 Behavior SKILL 的最小输入、预期结果、规则断言 |
| 场景级测试 | 每个 Scenario SKILL 的流程输入、步骤预期、完成条件 |
| 数据库断言 | Mongo/Neo4j/Chroma 预期写入结果 |
| 失败用例 | 缺字段、规则阻断、状态非法、审批不足等 |
| 领域样例数据 | 当前 CRM 默认包含两家公司测试夹具 |

测试方案输出形式：
- `ability.db.skill_test_plans`
- `ability.db.skill_test_cases`
- 同步生成 `evals/测试用例.yaml`
- 前端【技能测试】页面按构建版本加载对应测试方案

#### 8.3 当前 CRM 默认样例
当前 CRM 测试方案默认包含：
- `上海松井机械有限公司`
- `江苏九州电器有限公司`

并覆盖：
- 正向链路
- 规则阻断链路
- 场景技能链路
- 三库写入断言

---

### 9. 接口与数据模型新增

#### 9.1 本体系统新增接口
- `GET /api/ontologies/:id/definition-snapshot`

#### 9.2 ability 平台新增/重构接口
- `POST /api/ontology-skills/build`
- `DELETE /api/ontology-skills/all?ontology_id=...`
- `GET /api/ontology-skills/builds/:ontologyId`
- `GET /api/ontology-skills/builds/:buildVersion/report`
- `GET /api/ontology-skills/builds/:buildVersion/test-plan`
- `POST /api/ontology-skills/:id/execute`
- `POST /api/ontology-skills/assess`

#### 9.3 ability.db 新增表
- `skill_builds`
- `skill_build_reports`
- `skill_test_plans`
- `skill_test_cases`

并扩展 `skills` 表，增加：
- `skill_slug`
- `display_name_zh`
- `skill_type`
- `path`
- `snapshot_hash`
- `build_version`
- `is_active`

## Test Plan

### 1. 快照与生成测试
- `definition-snapshot` 返回完整结构
- 相同定义多次读取 `snapshot_hash` 不变
- 任一对象/行为/规则/事件/场景变化，`snapshot_hash` 变化
- 存在引用错误时阻断构建并在生成报告中显示

### 2. 技能结构测试
- `Behavior SKILL` 必须包含：
  - `SKILL.md`
  - `manifest.yaml`
  - `manifest.json`
  - `scripts/execute.js`
  - `references/对象说明.md`
  - `evals/测试用例.yaml`
- `Scenario SKILL` 必须生成显式步骤清单
- ontology 技能路径固定为 `skills/ontology/<ontology_id>/<skill_slug>/`

### 3. 三库运行测试
- `create_lead`
  - Mongo 写 `crm_leads`
  - Neo4j 写 `Lead`
  - Chroma 不写
- `convert_lead_to_opportunity`
  - Mongo 写 `Lead / Customer / Contact / Opportunity`
  - Neo4j 建关系边
  - Chroma 对 `Opportunity` 建索引
- `approve_quote`
  - 更新 `Quote`
  - 更新 `Opportunity`
  - 重建 `Opportunity` 向量

### 4. 生成报告与测试方案测试
- 每次构建后必须生成 1 份可查看报告
- 报告中必须显示：
  - 生成数量
  - 增量变化
  - 校验结果
  - 详细生成过程
- 每次构建后必须生成 1 套测试方案
- 测试方案必须在【技能测试】页面中可加载、可运行

### 5. 业务回归测试
- `上海松井机械有限公司`
  - 正向链路：创建线索 -> 补全 -> 评估 -> 转商机 -> 推进 -> 报价 -> 提审 -> 审批通过
- `江苏九州电器有限公司`
  - 异常链路：缺电话、预算不足、概率越界、超额报价需审批、审批恢复
- 验证：
  - 行为技能正确
  - 场景技能编排正确
  - 三库写入正确
  - 输出内容中文优先且不暴露底层技术细节

## Assumptions

- 本轮只做纯 SKILL 方案，不采用 Agent。
- 技能清单规范按本方案定义，但**本轮不实现“自动区分哪些字段只给运行时、哪些字段只给大模型理解用”的专门逻辑**。
- 不引入额外 `behavior_kind / 行为类型` 体系。
- 场景技能保留，但步数控制在实施时把握，本轮不做专门自动校验模块。
- 暂不实现补偿机制、权限模型、回滚机制。
- 生成方式仅为手动触发；有历史记录时增量，无历史时全量；可通过全部删除后重新生成。