# 第二层：能力层（Capability Layer）设计方案

> **文档编号**：07  
> **版本**：v1.0  
> **最后更新**：2026-04-02  
> **归属架构**：智能本体驱动的五层AI架构

---

## 一、背景定位

### 五层架构中的位置

```
第1层（本体层）→ 定义：Customer、Lead、Opportunity 的字段/规则/生命周期
第2层（能力层）→ 实现：create_lead、convert_lead_to_opportunity...  ← 本文档
第3层（Agent层）→ 执行：销售助手Agent 调用以上能力完成任务
第4层（编排层）→ 调度：意图识别 / 任务分解 / Agent 选择
第5层（对话层）→ 入口：自然语言交互界面
```

> **核心定位**：能力层是"本体定义的实现层"——本体定义了业务实体"是什么"（字段、规则、关系），能力层让它们"能做什么"（CRUD、状态流转、图关系建立、向量检索）。

### 工程独立性原则

- **独立端口**：前端 `5174`，后端 `3002`（主系统使用 `5173` / `3001`）
- **独立数据库**：SQLite 用于能力元数据（技能注册、执行日志），不与主系统 `ontology.db` 共享
- **解耦方式**：通过 HTTP 调用主系统 REST API 读取本体定义，不直接访问主系统数据库

---

## 二、技术栈

### 前端（`ability/app/`）— 端口 5174

| 技术 | 版本/说明 |
|------|---------|
| React + TypeScript + Vite | 与主系统保持一致 |
| Tailwind CSS v4 | 原子化样式 |
| Lucide React | 图标库 |
| Zustand | 状态管理 |
| React Router DOM | 路由 |
| **设计风格** | 深空暗色 + Glassmorphism + 青紫科技感 |

### 后端（`ability/server/`）— 端口 3002

| 技术 | 说明 |
|------|-----|
| Express + TypeScript | HTTP 服务框架 |
| better-sqlite3 | 能力元数据存储（技能注册、执行日志） |
| mongodb（soft dep） | CRM 业务数据持久化 |
| neo4j-driver（soft dep） | 实体图关系建立 |
| chromadb（soft dep） | 语义向量检索 |

> **软依赖设计**：三大外部数据库连接不上时，系统降级为内存/模拟模式，不影响技能管理功能。

---

## 三、三大外部数据库集成说明

### 3.1 MongoDB — CRM 业务数据持久化

**职责**：存储所有 CRM 实体实例的完整数据（主数据源）。

**Collections 设计**：

| Collection | 对应本体对象 |
|-----------|------------|
| `crm_customers` | Customer（客户） |
| `crm_leads` | Lead（线索） |
| `crm_opportunities` | Opportunity（商机） |
| `crm_quotes` | Quote（报价） |
| `crm_contacts` | Contact（联系人） |

**文档结构示例（Lead）**：

```javascript
{
  _id: ObjectId("..."),
  ontology_ref: "CRM",           // 关联本体代码（来自主系统）
  entity_type: "Lead",
  title: "华建智能-智慧园区采购项目",
  source: "展会",
  budget: 350000,
  status: "跟进中",
  owner: "李明",
  phone: "0755-88001234",
  company: "深圳市华建智能科技有限公司",

  // 关联关系冗余字段（加速查询）
  related_customer_id: null,
  converted_opportunity_id: null,

  // 向量化状态追踪
  vector_status: "pending",      // pending | indexed | failed
  vector_indexed_at: null,

  created_at: ISODate("..."),
  updated_at: ISODate("...")
}
```

**写入时机**：能力层执行每个 CRM 实体创建/更新操作时同步写入。

---

### 3.2 Neo4j — CRM 实体图关系建立

**职责**：建立实体间的有向图关系，支持完整销售链路溯源。

**节点类型（Node Labels）**：

```cypher
(:Customer   {id, name, industry, customerLevel})
(:Lead       {id, title, status, budget, owner})
(:Opportunity{id, name, stage, amount, probability, owner})
(:Quote      {id, quoteNo, amount, status, validDays})
(:Contact    {id, name, role, phone, email})
```

**关系边（对应 CRM 本体 relations 定义）**：

```cypher
(:Lead)-[:BELONGS_TO_CUSTOMER]->(:Customer)    -- Lead.relatedCustomer
(:Lead)-[:CONVERTED_TO]->(:Opportunity)         -- Lead.convertsToOpportunity
(:Opportunity)-[:BELONGS_TO]->(:Customer)       -- Opportunity.belongsToCustomer
(:Opportunity)-[:HAS_QUOTE]->(:Quote)           -- Opportunity.hasQuotes
(:Quote)-[:FOR_CUSTOMER]->(:Customer)           -- Quote.forCustomer
(:Contact)-[:WORKS_FOR]->(:Customer)            -- Contact.belongsToCustomer
(:Contact)-[:PRIMARY_OF]->(:Opportunity)        -- Opportunity.primaryContact
```

**核心查询场景**：

```cypher
-- 1. 客户完整销售链路
MATCH (c:Customer {id: $id})<-[:BELONGS_TO]-(o:Opportunity)-[:HAS_QUOTE]->(q:Quote)
RETURN c, o, q

-- 2. 线索转化路径溯源
MATCH path=(l:Lead)-[:CONVERTED_TO*..5]->(o:Opportunity)
WHERE l.id = $lead_id
RETURN path

-- 3. 关键决策联系人分析
MATCH (c:Contact)-[:PRIMARY_OF]->(o:Opportunity {stage: "赢单"})
RETURN c, count(o) AS won_count ORDER BY won_count DESC
```

**触发时机**：

| 操作 | Neo4j 动作 |
|------|-----------|
| 创建任意实体 | 建立对应 Node |
| `Lead.ConvertToOpportunity` | 建立 `(:Lead)-[:CONVERTED_TO]->(:Opportunity)` 边 |
| `Quote.Approve` | 更新 Opportunity.stage="赢单" |

---

### 3.3 ChromaDB — CRM 实体向量化检索

**职责**：对 CRM 实体的语义文本字段进行向量化，支持：
1. 语义搜索（"找相似的智慧园区赢单商机"）
2. 相似案例推荐（新建商机时，自动推荐历史赢单案例）

**Collection 设计**：

```python
# Collection: crm_opportunities
{
  id: "opp-mongodb-id",
  embedding: [1536维浮点数],
  document: "商机：华建智能-智慧园区Phase1，阶段：赢单，金额：350000，客户：深圳市华建智能科技",
  metadata: {
    entity_type: "Opportunity",
    status: "赢单",           # 用于过滤
    amount_range: "30-50万",
    owner: "李明"
  }
}
```

**Embedding 文本组合逻辑**：

```javascript
// Lead 向量化文本
`线索：${title}，来源：${source}，公司：${company}，预算：${budget}元`

// Opportunity 向量化文本
`商机：${name}，阶段：${stage}，金额：${amount}，客户：${customerName}，负责人：${owner}`
```

**与 MongoDB 的协作**：ChromaDB 只存 ID + 向量 + 过滤元数据，完整数据从 MongoDB 批量查询。

---

## 四、能力层 SQLite 元数据设计

> 专用于管理技能注册、执行日志、数据库连接配置，独立于主系统 `ontology.db`。

```sql
-- 技能注册表
CREATE TABLE skills (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,              -- 英文标识
  name_cn      TEXT NOT NULL,              -- 中文名称
  category     TEXT NOT NULL,              -- 'ontology' | 'external'
  description  TEXT,
  status       TEXT DEFAULT 'active',      -- 'active' | 'draft' | 'marketplace'
  input_schema TEXT,                       -- JSON Schema（输入参数定义）
  output_schema TEXT,                      -- JSON Schema（输出结果定义）
  databases    TEXT DEFAULT '[]',          -- 写入哪些DB：["mongodb","neo4j","chroma"]
  icon         TEXT DEFAULT 'zap',
  tags         TEXT DEFAULT '[]',
  install_count INTEGER DEFAULT 0,        -- 外部技能安装量（用于市场排序）
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 执行日志（每次技能调用记录）
CREATE TABLE execution_logs (
  id             TEXT PRIMARY KEY,
  skill_id       TEXT REFERENCES skills(id),
  input_params   TEXT,                     -- JSON
  output_result  TEXT,                     -- JSON（含各 DB 操作结果）
  status         TEXT NOT NULL,            -- 'success' | 'error' | 'running'
  duration_ms    INTEGER,
  mongodb_status TEXT,                     -- 'ok' | 'error' | 'skipped'
  neo4j_status   TEXT,
  chroma_status  TEXT,
  error_message  TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 数据库连接配置
CREATE TABLE db_configs (
  db_name        TEXT PRIMARY KEY,         -- 'mongodb' | 'neo4j' | 'chroma'
  connection_url TEXT,
  status         TEXT DEFAULT 'offline',   -- 'online' | 'offline' | 'error'
  last_ping      DATETIME,
  doc_count      INTEGER DEFAULT 0
);
```

---

## 五、本体技能清单（12 个）

> **操作对象**：CRM 业务数据实例（由本体定义驱动，经规则校验后写入三大数据库）

| 技能 ID | 中文名 | 对应行为 | 写入数据库 |
|---------|--------|---------|----------|
| `ont.create_customer` | 创建客户 | — | MongoDB + Neo4j |
| `ont.create_lead` | 创建线索 | `Lead.Create` | MongoDB + Neo4j |
| `ont.complete_lead` | 补全线索信息 | `Lead.Complete` | MongoDB + Neo4j |
| `ont.evaluate_lead` | 评估线索 | `Lead.Evaluate` | MongoDB + Neo4j |
| `ont.convert_lead` | 线索转商机 | `Lead.ConvertToOpportunity` | MongoDB + Neo4j（建 CONVERTED_TO 边）|
| `ont.create_opportunity` | 创建商机 | `Opportunity.Create` | MongoDB + Neo4j |
| `ont.advance_opportunity` | 推进商机阶段 | `Opportunity.Advance` | MongoDB + Neo4j |
| `ont.create_quote` | 创建报价单 | `Opportunity.CreateQuote` / `Quote.Create` | MongoDB + Neo4j |
| `ont.submit_quote` | 提交审批 | `Quote.Submit` | MongoDB + Neo4j |
| `ont.approve_quote` | 审批通过 | `Quote.Approve` | MongoDB + Neo4j |
| `ont.graph_trace` | 图链路溯源 | — | Neo4j（只读） |
| `ont.semantic_search` | 语义相似搜索 | — | ChromaDB → MongoDB |
| `ont.vector_index` | 向量化入库 | — | ChromaDB |

**技能执行步骤（以 `ont.create_lead` 为例）**：

```
1. 读取本体定义  →  GET /api/ontologies/:id/objects（Lead 定义）
2. 规则校验     →  Lead.RequiredInfo: title+phone 必填
3. 写入 MongoDB →  crm_leads collection
4. 建立 Neo4j   →  :Lead 节点
5. 异步向量化   →  ChromaDB 排队索引
6. 写执行日志   →  SQLite execution_logs（含三库操作状态）
7. 返回结果
```

---

## 六、外部技能清单（3 个预置通用技能）

> 通用能力技能，与具体业务场景无关，可跨领域复用，后续可通过技能市场搜索安装更多。

| 技能 ID | 中文名 | 使用框架/库 | 能力描述 |
|---------|--------|-----------|---------|
| `ext.web_search` | 网页搜索 | SerpAPI / DuckDuckGo API | 输入关键词，返回结构化搜索结果（标题/摘要/URL）|
| `ext.generate_ppt` | 生成 PPT | PptxGenJS (Node.js) | 输入大纲/JSON 内容，自动生成 PowerPoint 演示文稿 |
| `ext.word_format` | Word 文档排版 | docx.js | 输入 Markdown 或结构化内容，生成规范 Word (.docx) 文档 |

**技能市场扩展机制**：

- 状态区分：预置技能（`active`）vs 待安装技能（`marketplace`）
- 支持按名称/类别/评分搜索技能仓库，一键安装
- 每个技能有独立配置页（参数调整、输出路径、API Key 等）

---

## 七、界面设计：能力控制台（Capability Console）

### 布局概念

```
┌─────────────────────────────────────────────────────────────┐
│  能力层  ·  Capability Layer      [MongoDB●] [Neo4j●] [Chroma●]│
├──────────┬──────────────────────────────────────────────────┤
│          │  [本体技能 ▼]  [外部技能]  [执行日志]  [数据库状态]  │
│  总览    │────────────────────────────────────────────────── │
│  本体技能 │                                                   │
│  外部技能 │  技能卡片网格（4列）                                │
│  执行日志 │  ┌──────────┐┌──────────┐┌──────────┐┌────────┐  │
│  数据库  │  │🟢 创建   ││🟢 创建   ││🟢 线索   ││🟡 语义 │  │
│          │  │  客户    ││  线索    ││  转商机  ││  搜索  │  │
│          │  │ MongoDB  ││ +Neo4j   ││ +Chroma  ││ Chroma │  │
│          │  │ [试用 ▶] ││ [试用 ▶] ││ [试用 ▶] ││[试用▶] │  │
│          │  └──────────┘└──────────┘└──────────┘└────────┘  │
└──────────┴──────────────────────────────────────────────────┘
```

### REPL 执行面板（点击"试用▶"弹出）

```
┌────────────────────────────────────┐
│  执行: ont.create_lead              │
│  参数（JSON 编辑器）:               │
│  {                                  │
│    "title": "华建智能-智慧园区项目", │
│    "phone": "0755-88001234",        │
│    "source": "展会",                │
│    "budget": 350000                 │
│  }                                  │
│  [▶ 执行]                           │
│──────────────────────────────────── │
│  ✅ MongoDB: lead_id = abc123        │
│  ✅ Neo4j: Node(:Lead) created       │
│  ⏳ ChromaDB: indexing...            │
└────────────────────────────────────┘
```

---

## 八、目录结构

```
ontology/
├── ability/
│   ├── app/                          # 前端工程 (port 5174)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.tsx       # 总览仪表盘
│   │   │   │   ├── SkillMarketPage.tsx     # 技能市场（本体+外部分 tabs）
│   │   │   │   ├── SkillDetailPage.tsx     # 技能详情 + REPL 执行面板
│   │   │   │   ├── ExecutionLogsPage.tsx   # 执行日志
│   │   │   │   └── DatabaseStatusPage.tsx  # 数据库连接状态
│   │   │   ├── components/
│   │   │   │   ├── SkillCard.tsx
│   │   │   │   ├── ReplayExecutor.tsx      # REPL 面板
│   │   │   │   └── DbStatusBar.tsx
│   │   │   └── api/client.ts
│   │   ├── package.json              # port: 5174
│   │   └── vite.config.ts
│   │
│   ├── server/                       # 后端工程 (port 3002)
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── db.ts                 # SQLite（技能注册 + 日志）
│   │   │   ├── mongodb.ts            # MongoDB 连接（软依赖）
│   │   │   ├── neo4j.ts              # Neo4j 连接（软依赖）
│   │   │   ├── chroma.ts             # ChromaDB 连接（软依赖）
│   │   │   ├── skills/
│   │   │   │   ├── ontology/         # 13 个本体技能
│   │   │   │   │   ├── create-customer.ts
│   │   │   │   │   ├── create-lead.ts
│   │   │   │   │   ├── complete-lead.ts
│   │   │   │   │   ├── evaluate-lead.ts
│   │   │   │   │   ├── convert-lead.ts
│   │   │   │   │   ├── create-opportunity.ts
│   │   │   │   │   ├── advance-opportunity.ts
│   │   │   │   │   ├── create-quote.ts
│   │   │   │   │   ├── submit-quote.ts
│   │   │   │   │   ├── approve-quote.ts
│   │   │   │   │   ├── graph-trace.ts
│   │   │   │   │   ├── semantic-search.ts
│   │   │   │   │   └── vector-index.ts
│   │   │   │   └── external/         # 3 个外部技能（预置）
│   │   │   │       ├── web-search.ts
│   │   │   │       ├── generate-ppt.ts
│   │   │   │       └── word-format.ts
│   │   │   └── routes/
│   │   │       ├── skills.ts         # 技能 CRUD
│   │   │       ├── execute.ts        # 技能执行
│   │   │       ├── logs.ts           # 执行日志
│   │   │       └── database.ts       # 数据库状态查询
│   │   └── package.json              # port: 3002
│   │
│   └── data/
│       └── ability.db                # 独立 SQLite（不与主系统共享）
│
└── usercase/                         # 15 个 CRM 验证用例
    ├── README.md
    ├── UC001-创建线索规则通过.md
    ├── UC002-创建线索缺电话阻断.md
    ├── UC003-补全线索预算达标.md
    ├── UC004-补全线索预算不足阻断.md
    ├── UC005-评估线索.md
    ├── UC006-线索转商机副作用验证.md
    ├── UC007-创建商机概率合法.md
    ├── UC008-创建商机概率越界阻断.md
    ├── UC009-推进商机阶段.md
    ├── UC010-50万内免审批报价.md
    ├── UC011-超额报价须审批阻断.md
    ├── UC012-提交报价审批.md
    ├── UC013-审批通过赢单闭环.md
    ├── UC014-Neo4j完整链路图查询.md
    └── UC015-ChromaDB语义搜索.md
```

---

## 九、15 个 CRM 验证用例

> 全部基于 `specs/ontology/crm-v2/` YAML 规格与 `data/ontology.db` 真实数据设计。  
> 贯穿：5 个对象、4 条规则、10 个行为、10 个事件、3 个业务场景。  
> 统一业务主角：客户"深圳市华建智能科技有限公司"，销售负责人"李明"。

---

### UC001 — 创建线索，规则通过（Lead.Create + Lead.RequiredInfo ✅）

**对应本体**：行为 `Lead.Create`（required_inputs: title/source/phone），规则 `Lead.RequiredInfo`（severity=high）

**场景**：销售李明通过展会获取华建智能科技新线索，完整填入必填字段。

**技能调用**：`ont.create_lead`
```json
{
  "title": "华建智能-智慧园区采购项目",
  "source": "展会",
  "phone": "0755-88001234",
  "owner": "李明"
}
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `lead.title != null && lead.phone != null` → ✅ |
| 事件触发 | `lead.created`（subscribers: Lead.Complete） |
| MongoDB | 写入 1 条 Lead 文档 |
| Neo4j | 建立 `:Lead` 节点 |
| 状态 | 新建 |

---

### UC002 — 创建线索，缺电话被阻断（Lead.RequiredInfo ❌）

**场景**：销售王芳录入线索漏填联系电话，系统应拦截。

**技能调用**：`ont.create_lead`
```json
{ "title": "某制造企业ERP改造", "source": "广告", "phone": null, "owner": "王芳" }
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `lead.phone != null` → phone=null → ❌ severity=high |
| 返回 | `{ rule: "Lead.RequiredInfo", message: "线索标题和联系电话为必填项", severity: "high" }` |
| 数据库 | 零写入 |

---

### UC003 — 补全线索信息，预算达标（Lead.Complete + Lead.BudgetThreshold ✅）

**对应本体**：行为 `Lead.Complete`（required_inputs: budget/company），规则 `Lead.BudgetThreshold`（`budget >= 10000 || budget == null`）

**场景**：李明对 UC001 线索补全公司与预算（35 万，达标）。

**技能调用**：`ont.complete_lead`
```json
{ "lead_id": "<UC001_lead_id>", "budget": 350000, "company": "深圳市华建智能科技有限公司" }
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `350000 >= 10000` → ✅ |
| 事件触发 | `lead.completed`（subscribers: Lead.Evaluate） |
| 生命周期 | 新建 → 待跟进 |
| 数据库 | MongoDB 更新 budget/company，Neo4j 节点属性同步 |

---

### UC004 — 补全线索，预算不足阻断（Lead.BudgetThreshold ❌，constraint）

**场景**：另一线索预算仅 5000 元，低于 1 万门槛。

**技能调用**：`ont.complete_lead`
```json
{ "lead_id": "<test_lead_id>", "budget": 5000, "company": "个体设计工作室" }
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `5000 >= 10000` → ❌ constraint，severity=medium |
| 返回 | `{ rule: "Lead.BudgetThreshold", message: "预算低于最低门槛1万元", severity: "medium", next_actions: ["重新评估预算","申请特殊审批","联系客户确认预算"] }` |

---

### UC005 — 评估线索（Lead.Evaluate + 事件 lead.evaluated）

**对应本体**：行为 `Lead.Evaluate`（required_inputs: budget/company），事件 `lead.evaluated`（subscribers: Lead.ConvertToOpportunity）

**场景**：李明正式评估华建智能科技线索，确认决策人和预算，推进到已评估状态。

**技能调用**：`ont.evaluate_lead`
```json
{ "lead_id": "<UC003_lead_id>", "budget": 350000, "company": "深圳市华建智能科技有限公司" }
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `Lead.BudgetThreshold` → ✅ |
| 事件 | `lead.evaluated`（解锁 `Lead.ConvertToOpportunity`） |
| 生命周期 | 待跟进 → 跟进中 → 已评估 |
| 预期 | Lead.status=已评估，前端解锁"转为商机"按钮 |

---

### UC006 — 线索转商机（Lead.ConvertToOpportunity，副作用全链路验证）

**对应本体**：行为 `Lead.ConvertToOpportunity`，postconditions 创建 Opportunity/Customer/Contact，side_effects 修改 Lead.status/converted_at

**场景**：李明将华建智能科技线索转化为正式商机，系统自动创建 3 个关联对象。

**技能调用**：`ont.convert_lead`
```json
{
  "lead_id": "<UC005_lead_id>",
  "budget": 350000,
  "company": "深圳市华建智能科技有限公司",
  "conversion_reason": "预算达标，决策人CTO陈伟明确，需求清晰"
}
```

| 副作用 | 验证点 |
|--------|--------|
| Lead.status | 已评估 → 已转化（side_effect: modifies status/converted_at） |
| 新建 Opportunity | relation: converted_from |
| 新建 Customer | 深圳市华建智能科技有限公司 |
| 新建 Contact | CTO 陈伟 |

| 数据库 | 操作 |
|--------|------|
| MongoDB | 4 个 collection 各新增 1 条 |
| Neo4j | `(:Lead)-[:CONVERTED_TO]->(:Opportunity)` + `(:Opportunity)-[:BELONGS_TO]->(:Customer)` |

**result_schema 验证**：`{ opportunity_id, customer_id, contact_id, success: true }`

---

### UC007 — 创建商机，赢单概率合法（Opportunity.Create + Opportunity.ProbabilityRange ✅）

**对应本体**：行为 `Opportunity.Create`（required_inputs: name/amount/closeDate），规则 `Opportunity.ProbabilityRange`（`probability >= 0 && probability <= 100`）

**场景**：独立创建一个 B 级商机（不经由线索转化路径）。

**技能调用**：`ont.create_opportunity`
```json
{
  "name": "华建智能-智慧园区Phase1",
  "amount": 350000,
  "closeDate": "2026-09-30",
  "probability": 65,
  "stage": "需求分析",
  "owner": "李明"
}
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `65 >= 0 && 65 <= 100` → ✅ |
| 事件 | `opportunity.created`（subscribers: Opportunity.Advance） |
| 数据库 | MongoDB + Neo4j `:Opportunity` 节点 + ChromaDB 异步排队 |

---

### UC008 — 赢单概率越界被阻断（Opportunity.ProbabilityRange ❌）

**场景**：误输入赢单概率 150%。

**技能调用**：`ont.create_opportunity`
```json
{ "name": "测试越界商机", "amount": 100000, "closeDate": "2026-12-31", "probability": 150 }
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `150 <= 100` → ❌ validation，severity=medium |
| 返回 | `{ rule: "Opportunity.ProbabilityRange", message: "赢单概率必须在0-100之间" }` |
| 数据库 | 零写入 |

---

### UC009 — 推进商机阶段（Opportunity.Advance，场景 opportunity_to_quote Step1-2）

**对应本体**：行为 `Opportunity.Advance`（required_inputs: stage/probability），场景 `opportunity_to_quote` 步骤 1-2

**场景**：UC007 商机从"需求分析"推进到"方案提案"，赢单概率提升至 75%。

**技能调用**：`ont.advance_opportunity`
```json
{ "opportunity_id": "<UC007_opp_id>", "stage": "方案提案", "probability": 75 }
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `ProbabilityRange` → 75 ✅ |
| 事件 | `opportunity.advanced`（subscribers: Opportunity.CreateQuote，解锁报价） |
| 数据库 | MongoDB + Neo4j 节点属性同步 |

---

### UC010 — 50 万内免审批创建报价（Opportunity.CreateQuote + Quote.AmountApproval ✅）

**对应本体**：规则 `Quote.AmountApproval`（`quote.amount <= 500000 || quote.approvedBy != null`，severity=critical），场景 `opportunity_to_quote` 步骤 3-6

**场景**：35 万报价，在免审批额度内直接创建。

**技能调用**：`ont.create_quote`
```json
{
  "opportunity_id": "<UC009_opp_id>",
  "quoteNo": "QT-2026-0401",
  "amount": 350000,
  "validDays": 30
}
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `350000 <= 500000` → ✅（无需 approvedBy） |
| 事件链 | `opportunity.won` → `Quote.Create` → `quote.created` → `Quote.Submit` |
| Quote 状态 | 草稿，无审批流程 |

---

### UC011 — 超额报价必须审批（Quote.AmountApproval ❌，severity=critical）

**场景**：大单报价 680 万，approvedBy=null，触发 critical 级拦截。

**技能调用**：`ont.create_quote`
```json
{
  "opportunity_id": "<大单商机id>",
  "quoteNo": "QT-2026-0402",
  "amount": 6800000,
  "validDays": 60,
  "approvedBy": null
}
```

| 环节 | 结果 |
|------|------|
| 规则校验 | `6800000 <= 500000` → ❌，`approvedBy == null` → ❌ |
| 返回 | `{ rule: "Quote.AmountApproval", message: "报价超过50万需要审批通过", severity: "critical" }` |
| 数据库 | 零写入 |

---

### UC012 — 提交报价审批（Quote.Submit，事件链 quote.submitted → Quote.Approve）

**对应本体**：行为 `Quote.Submit`（required_inputs: approverId），事件 `quote.submitted`（subscribers: `[Quote.Approve]`），场景步骤 7-8

**场景**：对 UC011 的大单，指定主管提交审批。

**技能调用**：`ont.submit_quote`
```json
{ "quote_id": "<quote_id>", "approverId": "manager_zhangwei_001" }
```

| 环节 | 结果 |
|------|------|
| 事件 | `quote.submitted`（解锁 `Quote.Approve` 行为） |
| Quote 状态 | 待审批 |
| Neo4j | 节点属性更新 |

---

### UC013 — 审批通过完成赢单（Quote.Approve，场景 opportunity_to_quote 步骤 9-10 闭环）

**对应本体**：行为 `Quote.Approve`（trigger_type=SYSTEM_OR_MANAGER_ACTION），writeback_targets=[Quote, Opportunity]，事件 `quote.approved`（impacted_objects=[Quote, Opportunity]）

**场景**：主管张伟审批通过，商机状态同步更新为赢单，完成 `opportunity_to_quote` 全部 10 步。

**技能调用**：`ont.approve_quote`
```json
{ "quote_id": "<UC012_quote_id>" }
```

| 环节 | 结果 |
|------|------|
| writeback | Quote.status=已批准，Opportunity.stage=赢单（两对象同时改写） |
| 事件 | `quote.approved`（subscribers=[]，终态） |

**Neo4j 验证**：
```cypher
MATCH (q:Quote {id: $id})<-[:HAS_QUOTE]-(o:Opportunity)
RETURN q.status, o.stage
-- 期望: "已批准", "赢单"
```

---

### UC014 — Neo4j 完整销售链路图查询

**测试重点**：验证 UC001→UC013 累积建立的图数据完整性。

**技能调用**：`ont.graph_trace`
```json
{ "entity_type": "Customer", "id": "<华建智能客户id>" }
```

**预期 Cypher 路径**：
```cypher
MATCH (c:Customer)<-[:BELONGS_TO]-(o:Opportunity)-[:HAS_QUOTE]->(q:Quote),
      (l:Lead)-[:CONVERTED_TO]->(o),
      (ct:Contact)-[:WORKS_FOR]->(c)
RETURN c.name, l.title, o.name, o.stage, q.status, ct.name
```

**验证点**：节点数 ≥ 4，边数 ≥ 4，Opportunity.stage="赢单"，Quote.status="已批准"

---

### UC015 — ChromaDB 语义搜索相似商机

**测试重点**：向量化索引 + 语义相似检索准确性。

**前置**：先执行 `ont.vector_index` 对 UC007 商机入库
```
向量文本: "商机：华建智能-智慧园区Phase1，阶段：赢单，金额：350000，客户：深圳市华建智能科技有限公司，负责人：李明"
```

**技能调用**：`ont.semantic_search`
```json
{ "query": "智慧园区数字化建设项目", "filter": { "entity_type": "Opportunity" }, "top_k": 3 }
```

**预期结果**：华建智能商机排名第 1，相似度 ≥ 0.70，通过 ChromaDB 返回 ID 后从 MongoDB 补全完整数据。

---

## 十、用例覆盖矩阵

| 用例 | 本体对象 | 行为 | 规则校验 | 事件 | 写入数据库 |
|------|---------|------|---------|------|----------|
| UC001 | Lead | Lead.Create | RequiredInfo ✅ | lead.created | MongoDB + Neo4j |
| UC002 | Lead | Lead.Create | RequiredInfo ❌ | — | 阻断，零写入 |
| UC003 | Lead | Lead.Complete | BudgetThreshold ✅ | lead.completed | MongoDB + Neo4j |
| UC004 | Lead | Lead.Complete | BudgetThreshold ❌ | — | 阻断，零写入 |
| UC005 | Lead | Lead.Evaluate | — | lead.evaluated | MongoDB + Neo4j |
| UC006 | Lead+Opp+Customer+Contact | Lead.ConvertToOpportunity | RequiredInfo+Budget ✅ | lead.converted | MongoDB + Neo4j（边） |
| UC007 | Opportunity | Opportunity.Create | ProbabilityRange ✅ | opportunity.created | MongoDB + Neo4j + Chroma |
| UC008 | Opportunity | Opportunity.Create | ProbabilityRange ❌ | — | 阻断，零写入 |
| UC009 | Opportunity | Opportunity.Advance | ProbabilityRange ✅ | opportunity.advanced | MongoDB + Neo4j |
| UC010 | Quote | Opp.CreateQuote + Quote.Create | AmountApproval ✅ | opp.won + quote.created | MongoDB + Neo4j |
| UC011 | Quote | Quote.Create | AmountApproval ❌（critical） | — | 阻断，零写入 |
| UC012 | Quote | Quote.Submit | — | quote.submitted | MongoDB + Neo4j |
| UC013 | Quote + Opportunity | Quote.Approve | — | quote.approved（终态） | MongoDB + Neo4j |
| UC014 | 全链路 | ont.graph_trace | — | — | Neo4j 只读 |
| UC015 | Opportunity | ont.semantic_search | — | — | ChromaDB → MongoDB |

---

## 十一、验证计划

### 启动顺序

```bash
# 1. 主系统后端（本体定义 API）
cd server && npm run dev          # port 3001

# 2. 能力层后端
cd ability/server && npm run dev  # port 3002

# 3. 能力层前端
cd ability/app && npm run dev     # port 5174
```

### 核心验证检查项

1. **技能市场**：访问 `http://localhost:5174`，本体技能 12 个 + 外部技能 3 个均正常展示
2. **规则阻断**：执行 UC002，确认零写入 + 正确返回错误 JSON
3. **多库写入**：执行 UC001，在 MongoDB/Neo4j 各自验证数据写入
4. **图关系**：执行 UC006，用 Neo4j Browser 验证 `CONVERTED_TO` 边存在
5. **向量检索**：执行 UC015，语义搜索返回相似度 ≥ 0.70
6. **执行日志**：检查 SQLite `execution_logs` 表中三库操作状态字段完整记录
