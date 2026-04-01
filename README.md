# 企业级仿 Palantir 体系 V1 资产包

本目录将“本体中台 + AI 原生应用工厂”的 V1 蓝图落成一套可继续推进的产品资产，重点服务业务架构师、CRM 运营、产品经理和后续研发团队。

## 目录说明

- `docs/01-v1-platform-blueprint.md`
  V1 总体定位、能力分层、核心原则与阶段边界。
- `docs/02-modules-and-operating-model.md`
  本体中台五大模块、角色分工、关键运营闭环。
- `docs/03-crm-v1-domain-blueprint.md`
  CRM 样板间的业务边界、对象体系、场景链路和追溯逻辑。
- `docs/04-ai-native-app-factory.md`
  AI 原生低代码系统在 V1 的定位、交互模式和角色工作台。
- `docs/05-v1-acceptance-and-rollout.md`
  验收标准、实施节奏、组织准备与后续扩展建议。
- `specs/platform/public-interfaces.yaml`
  平台向上层应用暴露的五类标准接口契约。
- `specs/ontology/crm-v1/*.yaml`
  CRM V1 的本体模型层与实例层样例。
- `specs/app-factory/*.yaml`
  AI 原生应用工厂的角色工作台与 AI 交互契约。

## V1 核心结论

- V1 产品形态是**本体中台**，不是先做通用低代码平台。
- AI 原生低代码系统在第一阶段承担**样板应用工厂**角色，用来证明“模型可驱动业务闭环”。
- CRM 仅作为第一个落地领域，范围收敛到**线索 -> 商机 -> 报价 -> 合同**。
- 本体采用**模型层 + 实例层**双层结构，模型层定义语义，实例层承接运行时对象、关系、状态与事件。
- 核心建模单元为**对象、行为、规则、事件、场景**，并以事件驱动形成闭环。

## 使用建议

1. 先阅读 `docs/01` 和 `docs/03`，建立整体产品心智。
2. 再阅读 `specs/ontology/crm-v1`，确认领域模型是否符合业务口径。
3. 最后结合 `specs/platform` 与 `specs/app-factory`，衔接后续原型、系统设计和研发分工。
