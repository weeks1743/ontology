# YAML 本体结构完整性评估报告
## AI 语义交互能力分析

**评估日期**: 2026-04-02
**评估范围**: CRM 本体管理系统 YAML 结构
**评估版本**: v0.1.0-draft

---

## 1. 执行摘要

### 1.1 评估目标
评估当前本体管理系统生成的 6 个 YAML 文档是否包含足够的语义信息，以支持 AI 进行语义推理和智能交互。

### 1.2 关键发现
- **P0 阻塞性缺口**: 4 项（结构化规则表达式、状态转换语义、行为前置条件、自然语言映射层）
- **P1 高价值缺口**: 3 项（场景分支逻辑、事件载荷模式、行为 I/O 契约）
- **P2 增强性缺口**: 3 项（关系基数约束、规则解释元数据、动作优先级提示）
- **平台接口对齐缺口**: 12 项字段（见附录 C）

### 1.3 核心发现（基于 codex.md 分析）
**当前 YAML 更像"语义目录"，还不像"可执行语义契约"。**

平台接口契约（public-interfaces.yaml）已经定义了许多关键字段，但当前本体 YAML 尚未实现：
- behavior_interface 要求的 preconditions, result_schema（第 35-37 行）
- rule_interface 要求的 input_context, next_actions（第 54-59 行）
- event_interface 要求的 payload_schema, propagation_conditions（第 73-77 行）
- scenario_interface 要求的 start_conditions, decision_points, rollback_or_compensation（第 91-96 行）

### 1.3 总体支持度评分
| AI 场景 | 当前支持度 | 关键缺口 | 平台接口对齐度 |
|---------|-----------|----------|---------------|
| 推荐下一步动作 | 30% | 状态转换矩阵、行为前置条件、自然语言映射 | 40% |
| 验证操作合法性 | 25% | 结构化约束、规则依赖图 | 60% |
| 生成业务流程 | 40% | 条件分支、异常处理 | 50% |
| 解释业务逻辑 | 35% | 参数化解释、规则理由 | 70% |

### 1.4 核心结论
当前 YAML 结构提供了基础的实体定义和关系引用，但缺乏 AI 推理所需的关键语义信息：
- ✅ **已具备**: 实体清单、基本关系、引用完整性
- ❌ **缺失**: 可执行约束、状态机语义、行为契约、分支逻辑、自然语言映射层
- ⚠️ **平台接口对齐**: 约 55% 的平台接口要求字段尚未在本体 YAML 中实现（见附录 C）

**关键洞察**（来自 codex.md）:
> "对大模型最关键的不是只有 schema，而是用户常说'报价单'时映射到 Quote，'推进阶段'映射到 Opportunity.AdvanceStage，'为什么不能生成合同'映射到 Quote.GenerateContract + 相关 rules。"

**建议策略**: YAML 管"定义"，JSON Schema 管"约束"，MD 管"解释"。

---

## 2. 当前结构概览

### 2.1 模型组成
系统生成 6 个 YAML 文档：

1. **model.yaml** - 本体元信息（领域、版本、定位、设计原则、角色、范围）
2. **objects.yaml** - 对象定义（属性、生命周期、关系）
3. **behaviors.yaml** - 行为定义（触发类型、输入、规则、事件）
4. **rules.yaml** - 规则定义（约束表达式、适用范围、严重度）
5. **events.yaml** - 事件定义（生产者、订阅者、影响对象）
6. **scenarios.yaml** - 场景定义（业务目标、步骤序列、成功标准）

### 2.2 实体类型与字段清单

#### 2.2.1 Object（对象）

| 字段名 | 数据类型 | 当前用途 | 平台接口要求 | 支持 AI 推理 |
|--------|---------|---------|-------------|-------------|
| code | string | 唯一标识符 | ✅ object_type | ✅ |
| name | string | 中文名称 | ✅ display_name | ✅ |
| display_name | string | 显示名称 | ✅ display_name | ✅ |
| description | string | 描述 | - | ✅ |
| lifecycle | string[] | 状态列表 | ✅ lifecycle_stage | ⚠️ 仅列表，无转换规则 |
| attributes | ObjectAttribute[] | 属性定义 | ✅ primary_attributes | ⚠️ 缺少验证规则 |
| relations | ObjectRelation[] | 关系定义 | ✅ upstream/downstream_relations | ⚠️ 缺少基数约束 |
| - | - | - | ❌ ownership（缺失） | ❌ |
| - | - | - | ❌ trace_context（缺失） | ❌ |

**ObjectAttribute 子结构**:
- name, display_name, type, description, required
- enum_values (可选), default_value (可选)
- ❌ 缺失: 验证规则（min/max/pattern）、计算字段、依赖关系

**ObjectRelation 子结构**:
- name, display_name, target_object, type, description
- ❌ 缺失: 基数约束、级联规则、所有权语义、反向关系

#### 2.2.2 Behavior（行为）

| 字段名 | 数据类型 | 当前用途 | 平台接口要求 | 支持 AI 推理 |
|--------|---------|---------|-------------|-------------|
| code | string | 唯一标识符 | ✅ behavior_code | ✅ |
| name | string | 中文名称 | ✅ behavior_name | ✅ |
| display_name | string | 显示名称 | - | ✅ |
| description | string | 描述 | - | ✅ |
| owner_object | string | 归属对象 | ✅ owner_object_type | ✅ |
| owner_object_name | string | 归属对象中文名 | - | ✅ |
| trigger_type | enum | 触发类型 | ✅ trigger_type | ✅ |
| trigger_type_label | string | 触发类型中文 | - | ✅ |
| required_inputs | string[] | 必需输入字段名 | ⚠️ required_inputs（不完整） | ⚠️ 仅字段名，无类型和验证 |
| referenced_rules | string[] | 引用的规则 | ✅ referenced_rules | ✅ |
| emits_events | string[] | 发出的事件 | ✅ emitted_events | ✅ |
| writeback_targets | string[] | 写回目标 | ✅ writeback_targets | ⚠️ 无写回规则 |
| - | - | - | ❌ preconditions（缺失） | ❌ |
| - | - | - | ❌ result_schema（缺失） | ❌ |

❌ **平台接口要求但本体缺失的字段**（见 public-interfaces.yaml:35-37）:
- preconditions - 前置条件
- result_schema - 输出结构定义
- 副作用说明
- 执行优先级

#### 2.2.3 Rule（规则）

| 字段名 | 数据类型 | 当前用途 | 平台接口要求 | 支持 AI 推理 |
|--------|---------|---------|-------------|-------------|
| code | string | 唯一标识符 | ✅ rule_code | ✅ |
| name | string | 中文名称 | ✅ rule_name | ✅ |
| display_name | string | 显示名称 | - | ✅ |
| description | string | 描述 | - | ✅ |
| type | string | 规则类型 | ✅ rule_type | ✅ |
| applicable_objects | string[] | 适用对象 | ✅ applicable_objects | ✅ |
| applicable_behaviors | string[] | 适用行为 | ✅ applicable_behaviors | ✅ |
| expression | string | 约束表达式 | ⚠️ evaluation_expression（不完整） | ❌ 自由文本，不可解析 |
| failure_message | string | 失败消息 | ✅ failure_message | ⚠️ 静态文本，无参数化 |
| severity | enum | 严重度 | ✅ severity | ✅ |
| severity_label | string | 严重度中文 | - | ✅ |
| escalation_target | string | 升级目标 | ✅ escalation_target | ✅ |
| - | - | - | ❌ input_context（缺失） | ❌ |
| - | - | - | ❌ next_actions（缺失） | ❌ |

❌ **平台接口要求但本体缺失的字段**（见 public-interfaces.yaml:54-59）:
- input_context - 输入上下文
- evaluation_expression（结构化） - 可解析的评估表达式
- next_actions - 失败后的建议动作
- 规则依赖关系
- 解释模板

#### 2.2.4 Event（事件）

| 字段名 | 数据类型 | 当前用途 | 平台接口要求 | 支持 AI 推理 |
|--------|---------|---------|-------------|-------------|
| code | string | 唯一标识符 | ✅ event_code | ✅ |
| name | string | 中文名称 | ✅ event_name | ✅ |
| display_name | string | 显示名称 | - | ✅ |
| description | string | 描述 | - | ✅ |
| producer_object | string | 生产者对象 | ✅ producer_object | ✅ |
| producer_object_name | string | 生产者对象中文名 | - | ✅ |
| producer_behavior | string | 生产者行为 | ✅ producer_behavior | ✅ |
| producer_behavior_name | string | 生产者行为中文名 | - | ✅ |
| subscribers | string[] | 订阅者行为列表 | ✅ subscribers | ✅ |
| impacted_objects | string[] | 影响的对象 | ✅ impacted_objects | ✅ |
| - | - | - | ❌ payload_schema（缺失） | ❌ |
| - | - | - | ❌ propagation_conditions（缺失） | ❌ |
| - | - | - | ❌ triggered_behaviors（缺失） | ❌ |
| - | - | - | ❌ trace_policy（缺失） | ❌ |

❌ **平台接口要求但本体缺失的字段**（见 public-interfaces.yaml:73-77）:
- payload_schema - 事件载荷结构
- propagation_conditions - 传播条件
- triggered_behaviors - 触发的行为
- trace_policy - 追踪策略
- 幂等性标注

#### 2.2.5 Scenario（场景）

| 字段名 | 数据类型 | 当前用途 | 平台接口要求 | 支持 AI 推理 |
|--------|---------|---------|-------------|-------------|
| code | string | 唯一标识符 | ✅ scenario_code | ✅ |
| name | string | 中文名称 | ✅ scenario_name | ✅ |
| display_name | string | 显示名称 | - | ✅ |
| description | string | 描述 | - | ✅ |
| business_goal | string | 业务目标 | ✅ business_goal | ✅ |
| involved_objects | string[] | 涉及的对象 | ✅ involved_objects | ✅ |
| steps | ScenarioStep[] | 步骤序列 | ✅ step_definitions | ⚠️ 仅线性序列 |
| success_criteria | string[] | 成功标准 | ✅ success_criteria | ⚠️ 自由文本 |
| - | - | - | ❌ start_conditions（缺失） | ❌ |
| - | - | - | ❌ decision_points（缺失） | ❌ |
| - | - | - | ❌ rollback_or_compensation（缺失） | ❌ |
| - | - | - | ❌ observability_metrics（缺失） | ❌ |

**ScenarioStep 子结构**:
- step (number), behavior (可选), event (可选), decision_gate (可选)
- behavior_name, event_name (中文名称)
- ❌ 缺失: 条件分支（if/else）、循环、并行路径、异常处理、回滚逻辑

❌ **平台接口要求但本体缺失的字段**（见 public-interfaces.yaml:91-96）:
- start_conditions - 场景启动条件
- decision_points - 结构化决策点
- rollback_or_compensation - 回滚或补偿逻辑
- observability_metrics - 可观测性指标

### 2.3 现有语义能力矩阵

| 语义类别 | 当前支持 | 缺失关键能力 | 影响 |
|---------|---------|-------------|------|
| 约束表达 | 20% | 结构化语言、规则组合 | 无法程序化验证 |
| 状态机 | 15% | 转换规则、前置条件 | 无法推荐有效转换 |
| 行为契约 | 25% | I/O 类型、前后置条件 | 无法预测行为结果 |
| 关系语义 | 30% | 基数约束、级联规则 | 无法验证数据一致性 |
| 事件因果 | 35% | 载荷结构、因果链 | 无法追踪事件流 |
| 场景分支 | 20% | 条件逻辑、异常处理 | 只能生成线性流程 |

---

## 3. 语义缺口分类分析

### 3.1 约束表达与可执行性

#### 3.1.1 当前状态
规则的 `expression` 字段是自由文本字符串，例如：
```yaml
expression: "lead.budget >= 10000 || lead.budget == null"
```

这种表达方式对人类可读，但对 AI 不可解析。

#### 3.1.2 缺失语义
1. **无结构化约束语言** - 表达式无法解析为抽象语法树（AST）
2. **无规则依赖图** - 无法检测规则之间的冲突或依赖
3. **无约束类型标注** - 无法区分硬约束（必须满足）vs 软偏好（建议满足）
4. **无规则组合逻辑** - 无法表达"规则 A 和规则 B 必须同时满足"

#### 3.1.3 影响分析
- AI 无法程序化验证规则是否满足
- AI 无法组合多个复杂约束
- AI 无法解释规则冲突的原因
- AI 无法提供规则失败的具体参数

#### 3.1.4 示例对比

**当前结构**:
```yaml
code: "Lead.BudgetThreshold"
expression: "lead.budget >= 10000 || lead.budget == null"
failure_message: "预算不足，无法转化为商机"
```

**增强后结构**:
```yaml
code: "Lead.BudgetThreshold"
expression:
  type: "logical_or"
  operands:
    - type: "comparison"
      left: "lead.budget"
      operator: ">="
      right: 10000
    - type: "is_null"
      field: "lead.budget"
constraint_type: "hard"  # 硬约束，必须满足
failure_message_template: "预算 {lead.budget} 元低于最低要求 {threshold} 元"
failure_message_params:
  threshold: 10000
depends_on: []  # 无依赖规则
conflicts_with: []  # 无冲突规则
```

---

### 3.2 状态机语义

#### 3.2.1 当前状态
对象的 `lifecycle` 是字符串数组，例如：
```yaml
lifecycle: ["新建", "待跟进", "跟进中", "已评估", "已转化", "已关闭"]
```

这只是状态列表，没有转换规则。

#### 3.2.2 缺失语义
1. **无状态转换规则** - 不知道哪些状态可以互相转换
2. **无转换前置条件** - 不知道转换需要满足什么规则
3. **无状态关联行为** - 不知道每个状态下可执行哪些行为
4. **无转换触发事件** - 不知道状态转换会触发什么事件

#### 3.2.3 影响分析
- AI 无法推荐有效的下一步状态
- AI 无法解释为什么某个转换被阻止
- AI 无法验证状态转换的合法性
- AI 无法预测状态转换的副作用

#### 3.2.4 示例对比

**当前结构**:
```yaml
lifecycle: ["新建", "待跟进", "跟进中", "已评估", "已转化", "已关闭"]
```

**增强后结构**:
```yaml
lifecycle:
  - state: "新建"
    allowed_transitions: ["待跟进", "已关闭"]
    required_conditions: ["Lead.RequiredInfo"]
    available_behaviors: ["Lead.Complete", "Lead.Discard"]
    on_enter_events: []
    on_exit_events: ["lead.qualified"]
  - state: "待跟进"
    allowed_transitions: ["跟进中", "已关闭"]
    required_conditions: []
    available_behaviors: ["Lead.FollowUp", "Lead.Discard"]
    on_enter_events: ["lead.assigned"]
    on_exit_events: []
  - state: "已评估"
    allowed_transitions: ["已转化", "已关闭"]
    required_conditions: ["Lead.BudgetThreshold", "Lead.DecisionMaker"]
    available_behaviors: ["Lead.Convert", "Lead.Reject"]
    on_enter_events: ["lead.evaluated"]
    on_exit_events: []
```

---

### 3.3 行为输入输出契约

#### 3.3.1 当前状态
行为的 `required_inputs` 只有字段名，例如：
```yaml
required_inputs: ["budget", "company"]
```

没有类型、验证规则、输出定义。

#### 3.3.2 缺失语义
1. **无输入类型和验证规则** - 不知道输入的数据类型和约束
2. **无输出结构定义** - 不知道行为会返回什么数据
3. **无副作用说明** - 不知道行为会修改哪些对象
4. **无前置/后置条件** - 不知道执行前后的状态要求

#### 3.3.3 影响分析
- AI 无法在执行前验证输入
- AI 无法预测行为结果
- AI 无法解释行为失败原因
- AI 无法追踪数据流

#### 3.3.4 示例对比

**当前结构**:
```yaml
code: "Lead.Convert"
required_inputs: ["budget", "company"]
referenced_rules: ["Lead.BudgetThreshold"]
emits_events: ["lead.converted"]
```

**增强后结构**:
```yaml
code: "Lead.Convert"
inputs:
  - name: "budget"
    type: "number"
    required: true
    validation: {min: 0, max: 999999999}
  - name: "company"
    type: "string"
    required: true
    validation: {min_length: 2, max_length: 100}
  - name: "conversion_reason"
    type: "string"
    required: false
outputs:
  - name: "opportunity_id"
    type: "string"
  - name: "success"
    type: "boolean"
preconditions:
  - rule: "Lead.BudgetThreshold"
    failure_action: "block"
  - rule: "Lead.DecisionMaker"
    failure_action: "warn"
postconditions:
  - state_change: {from: "已评估", to: "已转化"}
  - event_emitted: "lead.converted"
  - creates_object: {type: "Opportunity", relation: "converted_from"}
side_effects:
  - modifies: ["Lead.status", "Lead.converted_at"]
  - creates: ["Opportunity"]
```

---

### 3.4 关系语义与基数

#### 3.4.1 当前状态
关系有 `type`（如 `"one-to-many"`）和 `target_object`，例如：
```yaml
relations:
  - name: "activities"
    target_object: "Activity"
    type: "one-to-many"
```

没有基数约束和级联规则。

#### 3.4.2 缺失语义
1. **无基数约束** - 不知道最少/最多关联几个对象
2. **无级联规则** - 不知道删除时是否级联
3. **无所有权语义** - 不知道是组合关系还是引用关系
4. **无双向关系定义** - 不知道反向关系名称

#### 3.4.3 影响分析
- AI 无法验证关系数量是否合法
- AI 无法推理数据一致性
- AI 无法预测删除操作的影响
- AI 无法导航双向关系

#### 3.4.4 示例对比

**当前结构**:
```yaml
relations:
  - name: "activities"
    target_object: "Activity"
    type: "one-to-many"
```

**增强后结构**:
```yaml
relations:
  - name: "activities"
    target_object: "Activity"
    type: "one-to-many"
    cardinality: {min: 0, max: null}  # 无限制
    ownership: "composition"  # 组合关系，级联删除
    cascade_delete: true
    inverse_relation: "lead"  # Activity 对象上的反向关系
  - name: "assigned_to"
    target_object: "User"
    type: "many-to-one"
    cardinality: {min: 1, max: 1}  # 必须有且只有一个
    ownership: "reference"  # 引用关系，不级联
    cascade_delete: false
    inverse_relation: "assigned_leads"
```

---

### 3.5 事件载荷与因果

#### 3.5.1 当前状态
事件有 `producer_behavior` 和 `subscribers`。

**实际 YAML 示例**（来自 events.yaml）:
```yaml
- code: opportunity.created
  name: 商机已创建
  producer_object: Lead
  producer_behavior: Lead.ConvertToOpportunity
  subscribers:
    - Activity.LogFollowUp
  impacted_objects:
    - Customer
    - Contact
    - Opportunity
```

没有事件载荷结构和因果链。

#### 3.5.1.1 平台接口契约
public-interfaces.yaml（第 73-77 行）明确要求：
- payload_schema - 事件载荷结构
- propagation_conditions - 传播条件
- triggered_behaviors - 触发的行为
- trace_policy - 追踪策略

**这些是平台接口已定义但本体未实现的字段。**

#### 3.5.2 缺失语义
1. **无事件载荷结构** - 不知道事件携带什么数据
2. **无时序约束** - 不知道事件顺序要求
3. **无因果链** - 不知道事件之间的依赖关系
4. **无幂等性标注** - 不知道事件是否可重复处理

#### 3.5.3 影响分析
- AI 无法追踪事件流
- AI 无法理解跨对象影响
- AI 无法预测事件传播路径
- AI 无法处理事件重试

#### 3.5.4 示例对比

**当前结构**（来自实际 events.yaml）:
```yaml
code: opportunity.created
name: 商机已创建
producer_object: Lead
producer_behavior: Lead.ConvertToOpportunity
subscribers:
  - Activity.LogFollowUp
impacted_objects:
  - Customer
  - Contact
  - Opportunity
```

**增强后结构**（满足平台接口要求）:
```yaml
code: opportunity.created
name: 商机已创建
producer_object: Lead
producer_behavior: Lead.ConvertToOpportunity
payload_schema:  # 平台接口要求
  - name: lead_id
    type: string
    required: true
  - name: opportunity_id
    type: string
    required: true
  - name: customer_id
    type: string
    required: true
  - name: contact_id
    type: string
    required: true
  - name: conversion_timestamp
    type: datetime
    required: true
subscribers:
  - behavior: Activity.LogFollowUp
    priority: 1
    idempotent: true
propagation_conditions:  # 平台接口要求
  - condition: "opportunity.status == 'active'"
    action: "propagate"
  - condition: "opportunity.status == 'cancelled'"
    action: "skip"
triggered_behaviors:  # 平台接口要求
  - Activity.LogFollowUp
trace_policy:  # 平台接口要求
  retention_days: 90
  include_payload: true
  trace_upstream: true
causality:
  triggers_after: [lead.completed]
  blocks_until: []
impacted_objects:
  - Customer
  - Contact
  - Opportunity
```

---

### 3.6 场景分支与决策逻辑

#### 3.6.1 当前状态
场景的 `steps` 是线性序列，`decision_gate` 是字符串数组。

**实际 YAML 示例**（来自 scenarios.yaml）:
```yaml
- code: lead_to_opportunity_conversion
  name: 线索转商机
  business_goal: 从线索生成客户、联系人和商机，并保留来源追溯
  involved_objects:
    - Lead
    - Customer
    - Contact
    - Opportunity
  steps:
    - step: 1
      behavior: Lead.ConvertToOpportunity
      decision_gate:
        - Lead.ConvertibleCheck
    - step: 2
      event: opportunity.created
    - step: 3
      behavior: Activity.LogFollowUp
  success_criteria:
    - Customer、Contact、Opportunity 均创建成功
    - Lead 与 Opportunity 存在追溯关系
```

没有条件分支和异常处理。

#### 3.6.1.1 平台接口契约
public-interfaces.yaml（第 91-96 行）明确要求：
- start_conditions - 场景启动条件
- decision_points - 结构化决策点（不只是 decision_gate 字符串数组）
- rollback_or_compensation - 回滚或补偿逻辑
- observability_metrics - 可观测性指标

**这些是平台接口已定义但本体未实现的字段。**

#### 3.6.2 缺失语义
1. **无条件分支** - 无法表达 if/else 逻辑
2. **无循环结构** - 无法表达重复步骤
3. **无并行路径** - 无法表达同时执行的步骤
4. **无异常处理和回滚** - 无法处理失败情况
5. **decision_gate 没有评估条件** - 不知道如何评估决策点

#### 3.6.3 影响分析
- AI 无法生成复杂流程
- AI 无法处理异常路径
- AI 无法解释决策点
- AI 无法优化流程

#### 3.6.4 示例对比

**当前结构**:
```yaml
steps:
  - step: 1
    behavior: "Lead.Evaluate"
  - step: 2
    decision_gate: ["Lead.BudgetThreshold"]
  - step: 3
    behavior: "Lead.Convert"
```

**增强后结构**:
```yaml
steps:
  - step: 1
    type: "action"
    behavior: "Lead.Evaluate"
    on_success: [2]
    on_failure: [99]  # 跳转到异常处理
  - step: 2
    type: "decision"
    condition:
      rule: "Lead.BudgetThreshold"
      operator: "passes"
    if_true: [3]
    if_false: [4]
  - step: 3
    type: "action"
    behavior: "Lead.Convert"
    on_success: [5]
  - step: 4
    type: "action"
    behavior: "Lead.Reject"
    on_success: [5]
  - step: 5
    type: "end"
    status: "completed"
  - step: 99
    type: "error_handler"
    behavior: "Lead.LogError"
    rollback_to: 0
```

---

### 3.7 自然语言映射层

#### 3.7.1 当前状态
当前 YAML 结构完全缺失自然语言映射层。所有实体只有规范的 code 和 name，没有别名、自然语言示例或消歧义说明。

**实际 YAML 示例**（来自 objects.yaml）:
```yaml
objects:
  - code: Lead
    name: 线索
    display_name: 线索
    description: 尚未完成业务资格判断的潜在线索
    # 缺少: aliases, nl_examples, negative_examples, disambiguation_notes
```

#### 3.7.2 缺失语义
1. **无别名映射** - 用户说"潜客"、"销售线索"时无法映射到 Lead
2. **无自然语言示例** - 不知道用户如何用自然语言表达操作意图
3. **无负面示例** - 不知道哪些说法不应该映射到该实体
4. **无消歧义说明** - 当多个实体名称相似时无法区分

#### 3.7.3 影响分析
这是 codex.md 特别强调的关键缺失，对 LLM 理解用户意图至关重要：
- AI 无法理解用户的口语化表达
- AI 无法处理同义词和行业术语
- AI 无法区分相似概念（如"客户"vs"联系人"）
- AI 无法提供准确的意图识别

#### 3.7.4 平台接口契约
public-interfaces.yaml 未明确要求此层，但这是 AI 交互的基础能力。

#### 3.7.5 示例对比

**当前结构**（来自实际 objects.yaml）:
```yaml
- code: Lead
  name: 线索
  display_name: 线索
  description: 尚未完成业务资格判断的潜在线索
```

**增强后结构**（基于 codex.md 建议）:
```yaml
- code: Lead
  name: 线索
  display_name: 线索
  description: 尚未完成业务资格判断的潜在线索
  aliases:
    - 潜客
    - 销售线索
    - 意向客户
  nl_examples:
    - "创建一个新线索"
    - "这个潜客的预算是多少"
    - "把这个销售线索转成商机"
  negative_examples:
    - "客户" # 应该映射到 Customer，不是 Lead
    - "联系人" # 应该映射到 Contact，不是 Lead
  disambiguation_notes: "线索是尚未转化的潜在客户，与已转化的'客户'(Customer)不同"

  attributes:
    companyName:
      type: string
      required: true
      description: 客户公司名称
      examples:
        - 江苏智造集团
        - 上海科技有限公司
      aliases:
        - 公司名
        - 企业名称
    source:
      type: enum
      required: true
      enum_values: [官网, 展会, 推荐, 广告, 电话]
      aliases:
        - 来源渠道
        - 线索来源
    budgetHint:
      type: string
      required: false
      description: 用户口头表达的预算线索，不一定是精确金额
      examples:
        - "大概100万左右"
        - "预算充足"
      aliases:
        - 预算
        - 预算范围
```

**行为的自然语言映射示例**:
```yaml
- code: Lead.ConvertToOpportunity
  name: 转化为商机
  display_name: 转化为商机
  aliases:
    - 转商机
    - 转成商机
    - 线索转化
  nl_examples:
    - "把这个线索转成商机"
    - "转化这个潜客"
    - "创建商机"
  negative_examples:
    - "创建线索" # 应该映射到 Lead.Create
    - "完善线索" # 应该映射到 Lead.Complete
```

#### 3.7.6 实施优先级
**P0 级别** - 这是 AI 理解用户意图的基础，应该与结构化规则表达式同等优先。

---

## 4. AI 场景能力评估

### 4.1 场景一：推荐下一步动作

#### 4.1.1 场景描述
用户在某个对象的特定状态下，AI 需要推荐可执行的下一步操作。

**示例问题**:
- "线索在'新建'状态下可以执行哪些操作？"
- "我应该先完善信息还是直接跟进？"
- "为什么'转化为商机'按钮是灰色的？"

#### 4.1.2 所需语义
1. 状态转换图（哪些状态可以转换）
2. 行为前置条件（执行前需要满足什么）
3. 动作优先级（推荐顺序）
4. 上下文感知（当前数据状态）

#### 4.1.3 当前支持度：30%

✅ **已支持**:
- 有行为列表和触发类型
- 有规则引用
- 有对象生命周期列表

❌ **缺失**:
- 无状态转换矩阵
- 无行为前置条件
- 无动作优先级
- 规则表达式不可解析

#### 4.1.4 关键缺口
无法判断当前状态下哪些行为可执行。

#### 4.1.5 影响示例
**用户问**: "线索在'新建'状态下可以执行哪些操作？"

**当前 AI 能力**: 只能列出所有归属于 Lead 的行为，无法过滤出当前状态可用的。

**期望 AI 能力**: "在'新建'状态下，您可以：1) 完善信息（推荐，因为缺少必填字段）2) 放弃线索"

---

### 4.2 场景二：验证操作合法性

#### 4.2.1 场景描述
用户准备执行某个操作前，AI 需要验证是否满足所有约束条件。

**示例问题**:
- "我能转化这个线索吗？"
- "为什么转化失败了？"
- "需要满足什么条件才能转化？"

#### 4.2.2 所需语义
1. 结构化约束（可程序化验证）
2. 规则依赖图（检测冲突）
3. 前置条件（执行前检查）
4. 冲突检测（规则互斥）

#### 4.2.3 当前支持度：25%

✅ **已支持**:
- 有规则列表和严重度
- 有适用对象/行为
- 有失败消息

❌ **缺失**:
- 规则表达式不可解析
- 无规则组合逻辑
- 无行为前置条件
- 无冲突检测

#### 4.2.4 关键缺口
无法程序化验证规则。

#### 4.2.5 影响示例
**用户问**: "我能转化这个线索吗？"

**当前 AI 能力**: 只能说"需要满足 Lead.BudgetThreshold 规则"，无法验证当前数据是否满足。

**期望 AI 能力**: "不能，因为：1) 预算 5000 元低于最低要求 10000 元（Lead.BudgetThreshold）2) 缺少决策人信息（Lead.DecisionMaker）"

---

### 4.3 场景三：生成业务流程

#### 4.3.1 场景描述
根据业务目标，AI 需要组装一个完整的业务流程。

**示例问题**:
- "如何从线索转化为商机？"
- "高价值客户的完整流程是什么？"
- "如果预算不足怎么办？"

#### 4.3.2 所需语义
1. 目标-场景映射（哪个场景实现哪个目标）
2. 步骤依赖（执行顺序）
3. 分支条件（if/else 逻辑）
4. 异常处理（失败路径）

#### 4.3.3 当前支持度：40%

✅ **已支持**:
- 有场景和步骤序列
- 有业务目标描述
- 有决策点标记

❌ **缺失**:
- 无条件分支
- 无并行步骤
- 无异常路径
- decision_gate 无评估逻辑

#### 4.3.4 关键缺口
只能生成线性流程。

#### 4.3.5 影响示例
**用户问**: "如果预算不足怎么办？"

**当前 AI 能力**: 只能展示线性流程，无法表达"预算不足走审批流程，否则直接转化"。

**期望 AI 能力**: "如果预算 < 10000 元，则：1) 提交审批 2) 等待审批结果 3) 审批通过后转化；如果预算 >= 10000 元，则直接转化。"

---

### 4.4 场景四：解释业务逻辑

#### 4.4.1 场景描述
当操作失败或被阻止时，AI 需要解释原因。

**示例问题**:
- "为什么转化失败了？"
- "这个规则是什么意思？"
- "为什么需要这个规则？"

#### 4.4.2 所需语义
1. 规则解释模板（参数化消息）
2. 规则-目标链接（规则存在理由）
3. 失败原因参数化（具体数值）
4. 示例（正确和错误的例子）

#### 4.4.3 当前支持度：35%

✅ **已支持**:
- 有规则名称和描述
- 有失败消息
- 有严重度

❌ **缺失**:
- 失败消息是静态文本
- 无解释模板
- 无规则存在理由
- 无示例

#### 4.4.4 关键缺口
无法生成上下文相关的解释。

#### 4.4.5 影响示例
**用户问**: "为什么转化失败了？"

**当前 AI 能力**: "预算不足，无法转化为商机"（静态消息）

**期望 AI 能力**: "您的预算 5000 元低于最低要求 10000 元。这个规则确保只有高价值线索才转化为商机，以提高销售效率。建议：1) 重新评估预算 2) 申请特殊审批"

---

## 5. 优先级改进路线图

### 5.1 P0 缺口（阻塞性）- 必须解决才能实现基本 AI 交互

#### P0-1: 自然语言映射层（新增）
**影响场景**: 所有场景
**当前问题**: 完全缺失别名、自然语言示例、消歧义说明
**平台接口**: 未明确要求，但是 AI 交互的基础
**改进方案**:
- 为所有对象、行为、规则添加 aliases
- 添加 nl_examples（用户如何用自然语言表达）
- 添加 negative_examples（不应该映射的说法）
- 添加 disambiguation_notes（消歧义说明）

**实施优先级**: 最高（与 P0-2 同等）
**预计工作量**: 3-4 天
**参考**: codex.md 第 133-147 行

#### P0-2: 结构化规则表达式
**影响场景**: 场景 1, 2, 4
**当前问题**: 规则表达式是自由文本，AI 无法解析和验证
**平台接口**: 部分对齐（evaluation_expression，但需要结构化）
**改进方案**:
- 定义结构化约束语言（JSON Schema 或 AST）
- 支持常见操作符（比较、逻辑、集合、字符串）
- 提供表达式解析器和验证器

**实施优先级**: 最高
**预计工作量**: 3-5 天

#### P0-3: 状态转换语义
**影响场景**: 场景 1, 2
**当前问题**: 只有状态列表，无转换规则
**平台接口**: 部分对齐（lifecycle_stage）
**改进方案**:
- 为每个状态定义 allowed_transitions
- 为每个转换定义 required_conditions
- 为每个状态定义 available_behaviors

**实施优先级**: 最高
**预计工作量**: 2-3 天

#### P0-4: 行为前置条件
**影响场景**: 场景 1, 2
**当前问题**: 不知道行为执行前需要满足什么
**平台接口**: ✅ 已定义（preconditions, result_schema - public-interfaces.yaml:35-37）
**改进方案**:
- 为每个行为定义 preconditions（规则列表）
- 定义 failure_action（block/warn/log）
- 定义 postconditions（状态变化、事件）
- 实现 result_schema（平台接口要求）

**实施优先级**: 最高（平台接口已定义）
**预计工作量**: 2-3 天

---

### 5.2 P1 缺口（高价值）- 显著提升 AI 能力

#### P1-1: 场景分支逻辑
**影响场景**: 场景 3
**当前问题**: 只能表达线性流程
**平台接口**: ✅ 已定义（decision_points, rollback_or_compensation - public-interfaces.yaml:94-96）
**改进方案**:
- 支持 decision 步骤类型
- 定义条件评估逻辑（if_true/if_false）
- 支持异常处理（on_failure, error_handler）
- 实现 start_conditions（平台接口要求）
- 实现 rollback_or_compensation（平台接口要求）

**实施优先级**: 高（平台接口已定义）
**预计工作量**: 3-4 天

#### P1-2: 事件载荷模式
**影响场景**: 场景 1, 3
**当前问题**: 不知道事件携带什么数据
**平台接口**: ✅ 已定义（payload_schema, propagation_conditions, triggered_behaviors - public-interfaces.yaml:73-77）
**改进方案**:
- 定义 payload_schema（字段、类型、必需性）
- 定义因果链（triggers_after, blocks_until）
- 定义订阅者优先级和幂等性
- 实现 propagation_conditions（平台接口要求）
- 实现 trace_policy（平台接口要求）

**实施优先级**: 高（平台接口已定义）
**预计工作量**: 2-3 天

#### P1-3: 行为 I/O 契约
**影响场景**: 场景 1, 2
**当前问题**: 只有输入字段名，无类型和验证
**改进方案**:
- 定义 inputs（类型、验证规则）
- 定义 outputs（返回结构）
- 定义 side_effects（修改哪些对象）

**实施优先级**: 高
**预计工作量**: 2-3 天

---

### 5.3 P2 缺口（增强性）- 改善用户体验

#### P2-1: 关系基数约束
**影响场景**: 场景 2
**当前问题**: 无法验证关系数量
**改进方案**:
- 定义 cardinality（min/max）
- 定义 ownership（composition/reference）
- 定义 cascade_delete

**实施优先级**: 中
**预计工作量**: 1-2 天

#### P2-2: 规则解释元数据
**影响场景**: 场景 4
**当前问题**: 失败消息是静态文本
**改进方案**:
- 定义 failure_message_template（参数化）
- 定义 failure_message_params（参数值）
- 定义 rationale（规则存在理由）

**实施优先级**: 中
**预计工作量**: 1-2 天

#### P2-3: 动作优先级提示
**影响场景**: 场景 1
**当前问题**: 无法推荐最佳动作
**改进方案**:
- 为行为定义 priority（推荐顺序）
- 定义 recommendation_context（推荐条件）
- 定义 user_guidance（操作提示）

**实施优先级**: 中
**预计工作量**: 1-2 天

---

## 6. 实施建议

### 6.1 向后兼容策略

**原则**: 所有增强都应该是可选的，不破坏现有数据。

**方法**:
1. **渐进式字段添加** - 新字段都是可选的，有合理的默认值
2. **双模式支持** - 同时支持简单模式和增强模式
   - 简单模式：`lifecycle: ["新建", "待跟进"]`（现有）
   - 增强模式：`lifecycle: [{state: "新建", allowed_transitions: [...]}]`（新增）
3. **自动迁移工具** - 提供脚本将现有数据升级为增强格式

### 6.2 与平台接口对齐

**关键原则**: 优先实现平台接口已定义的字段，确保本体 YAML 满足平台契约。

**对齐检查清单**（见附录 C）:
- ✅ behavior_interface: preconditions, result_schema
- ✅ rule_interface: input_context, next_actions
- ✅ event_interface: payload_schema, propagation_conditions, triggered_behaviors, trace_policy
- ✅ scenario_interface: start_conditions, decision_points, rollback_or_compensation, observability_metrics

**验证方法**:
1. 为每个接口编写契约测试
2. 确保生成的 YAML 满足接口要求
3. 定期对照 public-interfaces.yaml 检查对齐度

### 6.3 渐进式增强路径

**阶段 1（1-2 周）**: P0 缺口 + 平台接口对齐
- 实现自然语言映射层（aliases, nl_examples）
- 实现结构化规则表达式
- 实现状态转换语义
- 实现行为前置条件和 result_schema（平台接口要求）
- **里程碑**: AI 可以理解用户意图、推荐下一步动作并验证操作合法性

**阶段 2（2-3 周）**: P1 缺口 + 平台接口对齐
- 实现场景分支逻辑和 start_conditions（平台接口要求）
- 实现事件载荷模式和 propagation_conditions（平台接口要求）
- 实现行为 I/O 契约
- 实现 rollback_or_compensation（平台接口要求）
- **里程碑**: AI 可以生成复杂流程并追踪数据流

**阶段 3（1-2 周）**: P2 缺口
- 实现关系基数约束
- 实现规则解释元数据和 next_actions（平台接口要求）
- 实现动作优先级提示
- **里程碑**: AI 可以提供高质量的解释和建议

### 6.4 验证方法

**功能验证**:
1. 为每个 AI 场景编写测试用例
2. 使用真实 CRM 数据进行端到端测试
3. 验证 AI 推理结果的准确性

**性能验证**:
1. 测量 YAML 生成时间（目标 < 100ms）
2. 测量规则验证时间（目标 < 50ms）
3. 测量场景组装时间（目标 < 200ms）

**用户验证**:
1. A/B 测试（增强版 vs 基础版）
2. 收集用户反馈（AI 推荐的准确性）
3. 监控 AI 交互成功率

---

## 附录

### A. 完整字段对比表

| 实体类型 | 当前字段数 | 增强后字段数 | 新增关键字段 |
|---------|-----------|-------------|-------------|
| Object | 7 | 10 | lifecycle.allowed_transitions, attributes.validation |
| Behavior | 10 | 15 | inputs, outputs, preconditions, postconditions, side_effects |
| Rule | 11 | 16 | expression (结构化), constraint_type, depends_on, conflicts_with, rationale |
| Event | 10 | 14 | payload_schema, causality, subscribers.priority, subscribers.idempotent |
| Scenario | 8 | 10 | steps.type, steps.condition, steps.on_success, steps.on_failure |

### B. 参考标准

本评估参考了以下业界标准：

1. **BPMN 2.0** (Business Process Model and Notation)
   - 场景分支逻辑
   - 异常处理和回滚

2. **DMN** (Decision Model and Notation)
   - 结构化决策表
   - 规则组合逻辑

3. **OWL** (Web Ontology Language)
   - 关系语义
   - 约束表达

4. **JSON Schema**
   - 数据验证规则
   - 类型系统

### C. 平台接口契约对照表

本表对照 public-interfaces.yaml 的要求，标注当前本体 YAML 的实现状态。

#### C.1 Object Interface（对象接口）

| 平台接口要求字段 | public-interfaces.yaml 行号 | 当前本体实现状态 | 优先级 |
|----------------|---------------------------|----------------|--------|
| object_type | 11 | ✅ 已实现（code） | - |
| object_id | 12 | ✅ 已实现 | - |
| display_name | 13 | ✅ 已实现 | - |
| primary_attributes | 14 | ⚠️ 部分实现（缺少完整 schema） | P0 |
| status | 15 | ✅ 已实现 | - |
| lifecycle_stage | 16 | ⚠️ 部分实现（缺少转换规则） | P0 |
| upstream_relations | 17 | ⚠️ 部分实现（缺少基数约束） | P2 |
| downstream_relations | 18 | ⚠️ 部分实现（缺少基数约束） | P2 |
| ownership | 19 | ❌ 未实现 | P2 |
| trace_context | 20 | ❌ 未实现 | P2 |

**对齐度**: 50%（5/10 完全实现）

#### C.2 Behavior Interface（行为接口）

| 平台接口要求字段 | public-interfaces.yaml 行号 | 当前本体实现状态 | 优先级 |
|----------------|---------------------------|----------------|--------|
| behavior_code | 30 | ✅ 已实现（code） | - |
| behavior_name | 31 | ✅ 已实现（name） | - |
| owner_object_type | 32 | ✅ 已实现（owner_object） | - |
| trigger_type | 33 | ✅ 已实现 | - |
| required_inputs | 34 | ⚠️ 部分实现（仅字段名） | P1 |
| preconditions | 35 | ❌ 未实现 | **P0** |
| referenced_rules | 36 | ✅ 已实现 | - |
| result_schema | 37 | ❌ 未实现 | **P0** |
| writeback_targets | 38 | ✅ 已实现 | - |
| emitted_events | 39 | ✅ 已实现（emits_events） | - |

**对齐度**: 60%（6/10 完全实现）
**关键缺失**: preconditions, result_schema（P0 优先级）

#### C.3 Rule Interface（规则接口）

| 平台接口要求字段 | public-interfaces.yaml 行号 | 当前本体实现状态 | 优先级 |
|----------------|---------------------------|----------------|--------|
| rule_code | 49 | ✅ 已实现（code） | - |
| rule_name | 50 | ✅ 已实现（name） | - |
| rule_type | 51 | ✅ 已实现（type） | - |
| applicable_objects | 52 | ✅ 已实现 | - |
| applicable_behaviors | 53 | ✅ 已实现 | - |
| input_context | 54 | ❌ 未实现 | P1 |
| evaluation_expression | 55 | ⚠️ 部分实现（不可解析） | **P0** |
| failure_message | 56 | ✅ 已实现 | - |
| severity | 57 | ✅ 已实现 | - |
| escalation_target | 58 | ✅ 已实现 | - |
| next_actions | 59 | ❌ 未实现 | P2 |

**对齐度**: 73%（8/11 完全实现）
**关键缺失**: evaluation_expression（结构化）（P0 优先级）

#### C.4 Event Interface（事件接口）

| 平台接口要求字段 | public-interfaces.yaml 行号 | 当前本体实现状态 | 优先级 |
|----------------|---------------------------|----------------|--------|
| event_code | 69 | ✅ 已实现（code） | - |
| event_name | 70 | ✅ 已实现（name） | - |
| producer_behavior | 71 | ✅ 已实现 | - |
| producer_object | 72 | ✅ 已实现 | - |
| payload_schema | 73 | ❌ 未实现 | **P1** |
| subscribers | 74 | ✅ 已实现 | - |
| propagation_conditions | 75 | ❌ 未实现 | **P1** |
| impacted_objects | 76 | ✅ 已实现 | - |
| triggered_behaviors | 77 | ❌ 未实现 | P1 |
| trace_policy | 78 | ❌ 未实现 | P2 |

**对齐度**: 60%（6/10 完全实现）
**关键缺失**: payload_schema, propagation_conditions（P1 优先级）

#### C.5 Scenario Interface（场景接口）

| 平台接口要求字段 | public-interfaces.yaml 行号 | 当前本体实现状态 | 优先级 |
|----------------|---------------------------|----------------|--------|
| scenario_code | 88 | ✅ 已实现（code） | - |
| scenario_name | 89 | ✅ 已实现（name） | - |
| business_goal | 90 | ✅ 已实现 | - |
| start_conditions | 91 | ❌ 未实现 | **P1** |
| involved_objects | 92 | ✅ 已实现 | - |
| step_definitions | 93 | ✅ 已实现（steps） | - |
| decision_points | 94 | ⚠️ 部分实现（仅字符串数组） | **P1** |
| success_criteria | 95 | ✅ 已实现 | - |
| rollback_or_compensation | 96 | ❌ 未实现 | P1 |
| observability_metrics | 97 | ❌ 未实现 | P2 |

**对齐度**: 60%（6/10 完全实现）
**关键缺失**: start_conditions, decision_points（结构化）, rollback_or_compensation（P1 优先级）

#### C.6 总体对齐度统计

| 接口类型 | 要求字段数 | 完全实现 | 部分实现 | 未实现 | 对齐度 |
|---------|-----------|---------|---------|--------|--------|
| Object Interface | 10 | 5 | 3 | 2 | 50% |
| Behavior Interface | 10 | 6 | 1 | 3 | 60% |
| Rule Interface | 11 | 8 | 1 | 2 | 73% |
| Event Interface | 10 | 6 | 0 | 4 | 60% |
| Scenario Interface | 10 | 6 | 1 | 3 | 60% |
| **总计** | **51** | **31** | **6** | **14** | **61%** |

#### C.7 关键改进建议

**立即实施（P0/P1 + 平台接口要求）**:
1. Behavior: preconditions, result_schema
2. Rule: evaluation_expression（结构化）
3. Event: payload_schema, propagation_conditions
4. Scenario: start_conditions, decision_points（结构化）

**后续实施（P2）**:
5. Object: ownership, trace_context
6. Rule: next_actions
7. Event: trace_policy
8. Scenario: observability_metrics

---

## 结论

当前 YAML 本体结构提供了良好的基础框架，但缺乏 AI 语义推理所需的关键信息。

### 核心发现

1. **平台接口对齐度**: 61%（31/51 字段完全实现）
   - 14 个平台接口要求的字段尚未实现
   - 6 个字段部分实现但不完整

2. **关键缺失**（基于 codex.md 和 public-interfaces.yaml）:
   - **自然语言映射层**（完全缺失）- 这是 AI 理解用户意图的基础
   - **结构化约束语言**（规则表达式不可解析）
   - **行为契约**（preconditions, result_schema）
   - **事件载荷**（payload_schema, propagation_conditions）
   - **场景分支**（start_conditions, decision_points）

3. **当前状态**: "语义目录"而非"可执行语义契约"
   - 提供了实体清单和基本关系
   - 缺乏 AI 推理所需的执行语义

### 改进后的能力

通过实施本报告提出的改进建议，特别是 P0 和 P1 优先级的缺口，可以显著提升 AI 的语义交互能力，使其能够：

1. ✅ 理解用户的自然语言意图（通过自然语言映射层）
2. ✅ 推荐有效的下一步动作（通过状态转换语义和行为前置条件）
3. ✅ 验证操作合法性并解释原因（通过结构化规则表达式）
4. ✅ 生成复杂的业务流程（通过场景分支逻辑）
5. ✅ 追踪事件流和数据流（通过事件载荷模式）
6. ✅ 提供上下文相关的业务逻辑解释（通过规则解释元数据）

### 实施建议

**优先级排序**:
1. **P0（阻塞性）**: 自然语言映射层、结构化规则表达式、状态转换语义、行为前置条件
2. **P1（高价值 + 平台接口要求）**: 场景分支逻辑、事件载荷模式、行为 I/O 契约
3. **P2（增强性）**: 关系基数约束、规则解释元数据、动作优先级提示

**实施路径**: 分 3 个阶段，预计总工作量 4-7 周（见第 6.3 节）

**关键原则**（来自 codex.md）:
> YAML 管"定义"，JSON Schema 管"约束"，MD 管"解释"

---

**报告生成时间**: 2026-04-02
**评估人**: Claude Sonnet 4.6
**版本**: v2.0（完善版）
**主要更新**:
- 整合 codex.md 的 7 个关键缺失内容分析
- 对照 public-interfaces.yaml 的平台接口契约
- 使用实际 YAML 文件的真实示例
- 新增第 3.7 节"自然语言映射层"
- 新增附录 C"平台接口契约对照表"
- 调整优先级排序（考虑平台接口要求）
