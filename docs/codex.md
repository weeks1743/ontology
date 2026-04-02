**结论**

就你们现在这个阶段，只做**本体层**、还不做实例数据的话：

**`YAML` 可以，而且是目前最合适的主格式。**  
但要把它从“可读的配置文件”升级成“对大模型真正友好的语义契约”，还缺不少内容。

`MD` 不适合当**唯一的主格式**，更适合做**解释层/提示层补充**。

**为什么 `YAML` 可以**

对大模型来说，本体层最重要的是两件事：

1. **结构清楚**
2. **语义显式**

你们现在的拆分方式其实已经很对了：

- [model.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/model.yaml)
- [objects.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/objects.yaml)
- [behaviors.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/behaviors.yaml)
- [rules.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/rules.yaml)
- [events.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/events.yaml)
- [scenarios.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/scenarios.yaml)

这对 LLM 很友好，因为它能按块理解：

- 什么是对象
- 什么动作能做
- 触发什么规则
- 产生什么事件
- 场景怎么串起来

比起一大篇长 `Markdown`，这种结构化文件更容易被模型稳定消费。

**但你们现在的 YAML 还不够“LLM-ready”**

最关键的问题是：

**现在的 YAML 更像“语义目录”，还不像“可执行语义契约”。**

你们自己在 [public-interfaces.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/platform/public-interfaces.yaml) 里定义的很多字段，当前本体 YAML 其实还没补齐。

**当前缺少的重点内容**

1. **对象属性定义不够完整**
当前 [objects.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/objects.yaml) 里的 `primary_attributes` 只是名字列表，比如 `leadName`、`source`、`companyName`。  
但对 LLM 真正有用的还应该有：

- `type`
- `required`
- `enum_values`
- `description`
- `example`
- `aliases`
- `nullable`
- `default`
- `validation_rules`

你们后端类型里其实已经有 richer schema 方向了，见 [types.ts](/Users/weeks/Desktop/workspaces-yzj/ontology/server/src/types.ts#L10)。

2. **关系定义太薄**
现在对象里的 `relations` 多数只是关系名列表。  
对 LLM 来说更好的关系定义应该显式包含：

- `source_object`
- `target_object`
- `cardinality`
- `direction`
- `inverse_relation`
- `description`
- `traceability_meaning`

否则模型知道“有关系”，但不知道“怎么连、为什么连、是否可追溯”。

3. **行为缺少输入/输出契约**
当前 [behaviors.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/behaviors.yaml) 有：

- `required_inputs`
- `referenced_rules`
- `emits_events`
- `writeback_targets`

但还缺：

- `input_schema`
- `preconditions`
- `result_schema`
- `side_effects`
- `failure_modes`
- `confirmation_required`
- `permission_scope`

而这些恰好是你们接口契约里明确想要的，见 [public-interfaces.yaml:27](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/platform/public-interfaces.yaml#L27)。

4. **规则只有表达式，没有解释协议**
当前 [rules.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/rules.yaml) 对人可读，但对模型还不够稳。建议补：

- `input_context`
- `variables`
- `evaluation_scope`
- `pass_condition`
- `explanation_template`
- `next_actions`
- `severity_policy`

因为 LLM 真正需要的不只是“规则是什么”，还要知道“解释失败原因时该怎么说”。

5. **事件缺少 payload 和传播语义**
当前 [events.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/events.yaml) 只有 producer / subscribers / impacted_objects。  
建议补：

- `payload_schema`
- `propagation_conditions`
- `triggered_behaviors`
- `trace_policy`
- `idempotency`
- `ordering_guarantee`

这也是你们自己在 [public-interfaces.yaml:66](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/platform/public-interfaces.yaml#L66) 里提到但尚未落进本体文件的。

6. **场景缺少入口条件和断点语义**
当前 [scenarios.yaml](/Users/weeks/Desktop/workspaces-yzj/ontology/specs/ontology/crm-v1/scenarios.yaml) 已经不错，但建议继续补：

- `start_conditions`
- `exit_conditions`
- `decision_points`
- `rollback_or_compensation`
- `observability_metrics`
- `human_roles`
- `ai_allowed_actions`

7. **缺少“自然语言映射层”**
这是你们现在最值得补的一层。  
对大模型最关键的不是只有 schema，而是：

- 用户常说“报价单”时映射到 `Quote`
- “推进阶段”映射到 `Opportunity.AdvanceStage`
- “为什么不能生成合同”映射到 `Quote.GenerateContract` + 相关 rules

建议给对象、行为、规则都增加：

- `aliases`
- `nl_examples`
- `negative_examples`
- `disambiguation_notes`

这会比单纯换格式有效得多。

**所以：YAML 能不能用？**

**能用，而且建议继续用。**

但建议把它升级成：

**“结构化本体 YAML + 面向 LLM 的补充语义字段”**

而不是只保留目前这种比较轻的目录式定义。

**`Markdown` 可以做什么**

`MD` 适合做两类东西：

1. **面向人和大模型的解释文档**
比如：

- 领域概述
- 业务边界
- 术语表
- 常见问句与语义映射
- AI 使用边界
- 场景 walkthrough

2. **Prompt Pack / RAG 文档**
比如生成一个专门给大模型看的 `ontology-brief.md`，把关键内容压缩成：

- 对象总览
- 行为总览
- 规则解释模板
- 场景链路
- 禁止事项
- 术语映射

但 `MD` 不适合做 source of truth，因为它：

- 结构不稳定
- 很容易写散
- 容易出现同义重复和前后不一致
- 不利于程序校验

**所以最推荐的是“组合拳”**

**1. 主格式：YAML**
作为本体层唯一真相源。

**2. 严格契约：JSON Schema**
给工具调用、结构化输出、接口校验用。

**3. 解释层：Markdown**
给人看，也给 LLM 做高质量摘要上下文。

**一句话就是：**
`YAML` 管“定义”，`JSON Schema` 管“约束”，`MD` 管“解释”。

**如果你只选一个格式**

那我会选：

**YAML**

不是 `MD`。

**因为对本体层来说，结构比叙述更重要。**

**我建议你们下一步把 YAML 补成这样**

以对象为例，不再只写属性名，而写成：

```yaml
objects:
  Lead:
    name: 线索
    description: 尚未完成业务资格判断的潜在线索
    aliases:
      - 潜客
      - 销售线索
    lifecycle:
      - 新建
      - 待补全
      - 已判定
      - 已转客户
      - 已作废
    attributes:
      companyName:
        type: string
        required: true
        description: 客户公司名称
        examples:
          - 江苏智造集团
      source:
        type: enum
        required: true
        enum_values: [官网, 展会, 推荐, 广告, 电话]
        aliases: [来源渠道]
      budgetHint:
        type: string
        required: false
        description: 用户口头表达的预算线索，不一定是精确金额
    relations:
      convertsToOpportunity:
        target_object: Opportunity
        cardinality: one-to-many
        description: 线索可转化为商机
        inverse_relation: fromLead
```

这种写法对模型会稳很多。

**我对你们当前仓库的实际建议**

最适合你们的不是“换成 MD”，而是：

1. 保留现有 `YAML` 体系
2. 把每类文件补成更完整的语义契约
3. 额外生成一个 `Markdown` 的 LLM 摘要包

**优先补的三件事**

1. 给 `objects.yaml` 补完整属性 schema、关系 schema、别名
2. 给 `behaviors.yaml / rules.yaml / events.yaml` 补输入输出、解释模板、payload
3. 增加一份专门给大模型用的 `ontology-llm-pack.md`