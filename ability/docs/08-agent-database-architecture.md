# Agent时代的认知智能数据库架构设计

> **文档编号**：08
> **版本**：v1.0
> **最后更新**：2026-04-03
> **归属架构**：智能本体驱动的五层AI架构 - Agent层能力设计

---

## 零、架构演进：从CRUD系统到认知智能系统

### 架构阶段的演进

```
阶段1: 数据驱动 (2000-2010)
  关系型数据库 → 业务系统
  核心能力: CRUD操作

阶段2: 服务驱动 (2010-2020)
  微服务 + 多数据库
  核心能力: 业务解耦、技术选型

阶段3: 智能驱动 (2020-2025)
  本体驱动 + 规则引擎
  核心能力: 领域知识形式化

阶段4: 认知驱动 (2025+)
  LLM + Agent + 多模态数据库
  核心能力: 语义理解、自主推理、工具调用
```

### 当前架构的关键转折点

**从"数据库被动存储"到"数据库主动参与推理"**

传统架构：
```
用户 → API → 业务逻辑 → 数据库读写
```

认知架构：
```
用户自然语言
  → Agent语义理解
    → 数据库语义检索 + 图推理
      → Agent决策
        → 工具调用
          → 数据库写入
            → Agent记忆更新
```

---

## 一、认知智能架构的分层设计

### 完整架构图

```
┌──────────────────────────────────────────────────────────┐
│  Layer 5: 对话层 (Conversation Layer)                     │
│  - 多轮对话管理                                           │
│  - 上下文压缩                                             │
│  - 意图识别                                               │
└──────────────────────────────────────────────────────────┘
                      ↓ 自然语言
┌──────────────────────────────────────────────────────────┐
│  Layer 4: Agent编排层 (Orchestration Layer)              │
│  - 任务分解                                               │
│  - Agent调度                                              │
│  - 结果聚合                                               │
└──────────────────────────────────────────────────────────┘
                      ↓ 结构化任务
┌──────────────────────────────────────────────────────────┐
│  Layer 3: 推理层 (Reasoning Layer)                       │
│  - 语义检索 (ChromaDB)                                    │
│  - 图推理 (Neo4j)                                         │
│  - 规则推理 (Ontology Rules)                              │
│  - 向量 + 图谱 + 规则 的混合推理                           │
└──────────────────────────────────────────────────────────┘
                      ↓ 知识增强的提示
┌──────────────────────────────────────────────────────────┐
│  Layer 2: 能力层 (Capability Layer)                      │
│  - SKILL注册与发现                                        │
│  - 参数推断与校验                                         │
│  - 执行与监控                                             │
└──────────────────────────────────────────────────────────┘
                      ↓ 数据操作
┌──────────────────────────────────────────────────────────┐
│  Layer 1: 数据层 (Data Layer)                            │
│  - MongoDB: 实例数据 + Agent记忆                          │
│  - Neo4j: 知识图谱 + Agent协作图谱                        │
│  - ChromaDB: 向量索引 + 语义记忆                          │
└──────────────────────────────────────────────────────────┘
```

---

## 二、数据库角色的重新定义

### MongoDB: 从"业务数据库"到"记忆数据库"

#### 传统角色
```javascript
// 业务数据存储
db.crm_opportunities.insertOne({
  title: "华建智能项目",
  amount: 350000
})
```

#### Agent时代的新角色

**1. Agent短期记忆**
```javascript
// Agent会话记忆
db.agent_sessions.insertOne({
  session_id: "sess_123",
  agent_id: "sales_assistant",
  conversation_history: [
    { role: "user", content: "帮我找华建智能的商机" },
    { role: "assistant", content: "找到2个商机...", tool_calls: [...] },
    { role: "tool", content: "{...}" }
  ],
  context: {
    current_task: "查询商机",
    entities_mentioned: ["华建智能", "商机"],
    last_action: "search_opportunities"
  },
  created_at: ISODate("...")
})
```

**2. Agent长期记忆**
```javascript
// Agent学习到的知识
db.agent_knowledge.insertOne({
  agent_id: "sales_assistant",
  knowledge_type: "user_preference",
  pattern: {
    user: "李明",
    preference: "喜欢看赢单概率 > 70% 的商机",
    frequency: 15  // 该模式出现次数
  },
  last_updated: ISODate("...")
})
```

**3. Agent工作空间**
```javascript
// Agent的任务状态
db.agent_workspaces.insertOne({
  task_id: "task_456",
  agent_id: "sales_assistant",
  task_type: "商机分析",
  status: "in_progress",
  current_step: 3,
  total_steps: 8,
  intermediate_results: {
    step1: {...},
    step2: {...}
  },
  checkpoints: [...]  // 支持任务恢复
})
```

---

### Neo4j: 从"关系图"到"推理图谱"

#### 传统角色
```cypher
// 查询商机的客户关系
MATCH (o:Opportunity)-[:BELONGS_TO]->(c:Customer)
WHERE o.id = $opp_id
RETURN c
```

#### Agent时代的新角色

**1. 知识图谱增强推理**

```cypher
// Agent推理：为什么这个商机赢单？
MATCH path = (o:Opportunity {id: $opp_id})-[:BELONGS_TO]->(c:Customer)
              <-[:HAS_CUSTOMER]-(other_opp:Opportunity {stage: "won"})
WITH o, c, other_opp, path
MATCH (other_opp)-[:HAS_QUOTE]->(q:Quote {status: "approved"})
RETURN
  c.name as customer,
  other_opp.title as similar_won_opp,
  q.amount as won_amount,
  path as evidence_chain

// Agent可以回答：
// "这个客户有相似的赢单商机：华建智能智慧园区项目，金额35万"
// 这是从图谱中推理出来的因果关系
```

**2. Agent协作图谱**

```cypher
// Agent之间的协作关系
CREATE (a1:Agent {id: "sales_assistant", role: "销售助手"})
CREATE (a2:Agent {id: "finance_checker", role: "财务审核"})
CREATE (a3:Agent {id: "legal_reviewer", role: "法务审查"})

// 协作流程
CREATE (a1)-[:DELEGATES_TO {task: "credit_check", when: "amount > 500000"}]->(a2)
CREATE (a2)-[:DELEGATES_TO {task: "contract_review"}]->(a3)

// Agent可以查询：我需要协调哪些Agent？
MATCH (me:Agent {id: "sales_assistant"})-[r:DELEGATES_TO]->(other:Agent)
RETURN other.role, r.task, r.when
```

**3. 技能依赖图谱**

```cypher
// SKILL之间的依赖关系
CREATE (s1:Skill {id: "ont.create_quote"})
CREATE (s2:Skill {id: "ont.create_opportunity"})
CREATE (s3:Skill {id: "ont.submit_quote"})

CREATE (s3)-[:REQUIRES {precondition: "quote_created"}]->(s1)
CREATE (s1)-[:REQUIRES {precondition: "opportunity_exists"}]->(s2)

// Agent推理：执行报价提交需要哪些前置技能？
MATCH path = (s:Skill {id: "ont.submit_quote"})-[:REQUIRES*]->(prereq:Skill)
RETURN path
```

**4. 决策推理链**

```cypher
// Agent的决策过程记录
CREATE (d1:Decision {
  id: "dec_001",
  agent: "sales_assistant",
  question: "是否跟进这个商机？",
  reasoning: "客户行业匹配、预算达标、历史有合作"
})
CREATE (d1)-[:BASED_ON]->(e1:Evidence {type: "customer_industry", value: "制造业"})
CREATE (d1)-[:BASED_ON]->(e2:Evidence {type: "budget", value: 350000})
CREATE (d1)-[:LED_TO]->(a1:Action {type: "schedule_followup"})

// Agent可以回溯：为什么我做了这个决策？
MATCH (d:Decision {id: "dec_001"})-[:BASED_ON]->(e:Evidence)
RETURN e
```

---

### ChromaDB: 从"语义搜索"到"语义记忆"

#### 传统角色
```python
# 语义搜索商机
results = chroma.query(
  query_texts=["智慧园区项目"],
  n_results=5
)
```

#### Agent时代的新角色

**1. RAG增强的Agent理解**

```python
# 用户: "帮我找一个类似华建智能的项目"

# Step 1: 语义检索相似商机
similar_opps = chroma.query(
  query_texts=["华建智能智慧园区项目"],
  where={"stage": "won"},  # 只找赢单的
  n_results=3
)

# Step 2: 注入到LLM prompt
prompt = f"""
用户想找类似华建智能的项目。以下是相似的赢单商机：

1. {similar_opps[0].document}
   相似度: {similar_opps[0].distance}

2. {similar_opps[1].document}
   相似度: {similar_opps[1].distance}

请分析这些项目的共同特点，推荐给用户。
"""

# Step 3: LLM生成回复
response = llm.generate(prompt)
```

**2. Agent语义记忆**

```python
# Agent记住用户的语义偏好
chroma.add(
  ids=["pref_001"],
  documents=["用户李明偏好：制造业客户、预算30-50万、智慧园区类项目"],
  metadatas=[{
    "type": "user_preference",
    "agent": "sales_assistant",
    "user": "李明",
    "confidence": 0.85
  }]
)

# Agent下次遇到相似场景
# 自动检索：用户之前偏好什么类型的项目？
preferences = chroma.query(
  query_texts=["正在处理的商机：XX制造业智慧工厂"],
  where={"type": "user_preference", "user": "李明"}
)
```

**3. 跨模态语义索引**

```python
# Agent处理多模态数据
# 图片、文档、邮件等向量化

chroma.add(
  ids=["doc_001"],
  documents=["客户需求文档：需要实现生产数据实时监控"],
  metadatas=[{
    "type": "requirement_doc",
    "customer": "华建智能",
    "doc_type": "pdf",
    "page": 5
  }]
)

# Agent可以语义检索：
# "客户对生产监控有什么要求？"
requirements = chroma.query(
  query_texts=["生产监控需求"],
  where={"customer": "华建智能", "type": "requirement_doc"}
)
```

---

## 三、Agent能力的数据库依赖矩阵

### 能力与数据库的映射

| Agent能力 | MongoDB | Neo4j | ChromaDB | 说明 |
|----------|---------|-------|----------|------|
| **语义理解** | ❌ | ❌ | ✅ RAG | 向量检索增强理解 |
| **知识推理** | ❌ | ✅ 图推理 | ⚠️ 辅助 | 图谱提供结构化知识 |
| **记忆管理** | ✅ 会话记忆 | ✅ 决策链 | ✅ 语义记忆 | 三层记忆系统 |
| **技能调用** | ✅ 实例操作 | ✅ 前置检查 | ❌ | 数据验证 + 依赖推理 |
| **工具使用** | ✅ 数据读写 | ✅ 关系查询 | ✅ 语义检索 | 三库协同 |
| **Agent协作** | ✅ 工作空间 | ✅ 协作图谱 | ❌ | 任务分配 + 状态同步 |
| **决策解释** | ⚠️ 日志 | ✅ 推理链 | ⚠️ 证据 | 可解释性 |

---

## 四、关键场景的完整链路

### 场景1：用户自然语言触发技能执行

**用户输入**：*"帮我创建一个华建智能的商机，金额50万"*

```
Step 1: 对话层 - 意图识别
  LLM: "用户要创建商机"
  提取实体: {customer: "华建智能", amount: 500000}

Step 2: 推理层 - 技能匹配
  ChromaDB: 语义检索相似技能描述
    Query: "创建商机"
    Result: "ont.create_opportunity" (相似度0.92)

  Neo4j: 查询技能依赖
    MATCH (s:Skill {id: "ont.create_opportunity"})-[:REQUIRES]->(prereq)
    RETURN prereq
    Result: 无前置依赖

  MongoDB: 查询客户是否存在
    db.crm_customers.findOne({name: "华建智能"})
    Result: {id: "cust_123", name: "华建智能", ...}

Step 3: Agent决策 - 参数补全
  LLM Prompt:
    "创建商机技能需要参数: title, amount, customer_id
     已知: amount=500000, customer_id=cust_123
     缺少: title
     请推断title"

  LLM: "建议title: 华建智能-项目合作"

Step 4: 能力层 - 技能执行
  调用 ont.create_opportunity({
    title: "华建智能-项目合作",
    amount: 500000,
    customer_id: "cust_123"
  })

  MongoDB: 插入商机实例
  Neo4j: 创建节点 + 关系边
  ChromaDB: 向量化商机

Step 5: 记忆更新
  MongoDB: 更新Agent会话记忆
  ChromaDB: 记录用户偏好（喜欢简洁的商机名称）
```

---

### 场景2：Agent自主推理并协调其他Agent

**用户输入**：*"分析一下华建智能这个客户的价值"*

```
Step 1: 任务分解
  Agent分析:
    - 子任务1: 查询客户基本信息
    - 子任务2: 统计历史商机
    - 子任务3: 分析客户关系网络
    - 子任务4: 生成客户画像报告

Step 2: Agent协调
  Neo4j: 查询Agent协作图谱
    MATCH (me:Agent {id: "sales_assistant"})-[r:DELEGATES_TO]->(other:Agent)
    WHERE r.task IN ["customer_analysis", "report_generation"]
    RETURN other

    Result: [
      {agent: "data_analyst", task: "customer_analysis"},
      {agent: "report_writer", task: "report_generation"}
    ]

Step 3: 多Agent协作执行
  Agent 1 (sales_assistant):
    MongoDB: 查询客户信息
    Neo4j: 查询客户关系网络

  Agent 2 (data_analyst):
    MongoDB: 统计历史商机数量、金额
    ChromaDB: 语义搜索相似客户案例

  Agent 3 (report_writer):
    MongoDB: 查询报告模板
    LLM: 生成客户价值分析报告

Step 4: 结果聚合
  MongoDB: 存储中间结果到工作空间

Step 5: 向用户返回
  "华建智能客户价值分析：
   - 合作商机：5个
   - 累计金额：150万
   - 赢单率：60%
   - 客户评级：A级
   - 推荐策略：..."
```

---

### 场景3：基于知识图谱的智能推荐

**用户输入**：*"这个商机有戏吗？"（上下文：正在查看某个商机）*

```
Step 1: 上下文理解
  MongoDB: 查询当前会话上下文
    {current_entity: "opp_123", entity_type: "Opportunity"}

Step 2: 图谱推理
  Neo4j: 多跳查询
    // 1. 查询商机的完整链路
    MATCH path = (o:Opportunity {id: "opp_123"})
                 -[:BELONGS_TO]->(c:Customer)
                 <-[:HAS_CUSTOMER]-(other_opp:Opportunity {stage: "won"})
    RETURN c.name, count(other_opp) as won_count

    // 2. 查询相似商机的赢单概率
    MATCH (o:Opportunity {id: "opp_123"})
    WHERE o.amount > 300000 AND o.amount < 500000
    MATCH (similar:Opportunity)
    WHERE similar.amount > 300000 AND similar.amount < 500000
          AND similar.stage = "won"
    RETURN count(similar) * 100.0 / count(*) as win_rate

    Result:
      - 客户历史赢单: 2个
      - 相似金额商机赢单率: 65%
      - 关键决策人已识别: 是

Step 3: 语义分析
  ChromaDB: 查询相似商机描述
    Query: "商机描述：XX制造业智慧工厂项目"
    Results: [相似度0.85的赢单商机描述]

Step 4: 规则推理
  规则引擎:
    IF 金额 > 30万 AND 客户历史赢单 > 0 AND 决策人已识别
    THEN 赢单概率 = "高"

Step 5: LLM综合推理
  Prompt:
    "商机信息：
     - 金额：35万
     - 客户历史赢单：2个
     - 相似商机赢单率：65%
     - 决策人已识别

     基于以上数据，这个商机有戏吗？为什么？"

  LLM:
    "这个商机很有希望！理由：
     1. 客户华建智能之前有2个成功合作案例，信任度高
     2. 35万金额在客户预算范围内，且相似金额商机赢单率达65%
     3. 关键决策人已识别，可以定向沟通
     建议行动：..."

Step 6: 记忆学习
  ChromaDB: 记录推理模式
    "当用户问'有戏吗'，需要分析：历史合作、金额匹配、决策人"
```

---

## 五、Agent系统的三库协同模式

### 模式1：RAG + GraphRAG 混合检索

```python
class HybridRetriever:
  def retrieve(self, query: str):
    # 1. ChromaDB语义检索
    semantic_results = chroma.query(query, n_results=10)

    # 2. Neo4j图谱检索
    # 从语义结果中提取实体，查询关联信息
    entities = extract_entities(semantic_results)
    graph_results = neo4j.query(
      f"MATCH (e)-[r]-(related) WHERE e.id IN {entities} RETURN e, r, related"
    )

    # 3. 融合排序
    merged = self.merge_and_rank(semantic_results, graph_results)

    # 4. MongoDB补全完整数据
    full_data = mongodb.find({"id": {"$in": merged.ids}})

    return {
      "semantic": semantic_results,  # 语义相似
      "graph": graph_results,        # 关系关联
      "full": full_data              # 完整数据
    }
```

### 模式2：推理链路追溯

```python
class ExplainableAgent:
  def execute_with_trace(self, task):
    trace = []

    # 1. 决策记录
    decision = self.make_decision(task)

    # 2. 记录到Neo4j
    neo4j.run("""
      CREATE (d:Decision {
        id: $decision_id,
        question: $question,
        answer: $answer,
        timestamp: $timestamp
      })
    """, decision)

    # 3. 记录证据来源
    for evidence in decision.evidences:
      if evidence.source == "chromadb":
        neo4j.run("""
          MATCH (d:Decision {id: $decision_id})
          CREATE (e:Evidence {
            type: 'semantic_match',
            content: $content,
            similarity: $similarity
          })
          CREATE (d)-[:BASED_ON]->(e)
        """, evidence)

      elif evidence.source == "neo4j":
        neo4j.run("""
          MATCH (d:Decision {id: $decision_id})
          MATCH (fact)-[r]-(related) WHERE fact.id = $fact_id
          CREATE (e:Evidence {
            type: 'graph_fact',
            content: $content
          })
          CREATE (d)-[:BASED_ON]->(e)
        """, evidence)

    # 4. 用户可以问：为什么这么做？
    # Agent可以回溯完整推理链
```

### 模式3：Agent间的共享记忆

```python
class SharedMemory:
  def __init__(self):
    self.mongodb = MongoDBClient()      # 工作空间
    self.neo4j = Neo4jClient()          # 协作图谱
    self.chroma = ChromaDBClient()      # 语义记忆

  def write_memory(self, agent_id, memory_type, content):
    # 短期记忆：MongoDB
    if memory_type == "working":
      self.mongodb.insert_one("agent_working_memory", {
        "agent_id": agent_id,
        "content": content,
        "timestamp": now()
      })

    # 结构化知识：Neo4j
    elif memory_type == "knowledge":
      self.neo4j.run("""
        MERGE (a:Agent {id: $agent_id})
        MERGE (k:Knowledge {id: $knowledge_id})
        SET k += $content
        MERGE (a)-[:KNOWS]->(k)
      """, agent_id, content)

    # 语义记忆：ChromaDB
    elif memory_type == "semantic":
      self.chroma.add(
        ids=[content["id"]],
        documents=[content["text"]],
        metadatas=[{
          "agent_id": agent_id,
          "type": memory_type
        }]
      )

  def read_memory(self, agent_id, query):
    # 从三个数据库同时检索
    working = self.mongodb.find({
      "agent_id": agent_id
    }).sort("timestamp", -1).limit(10)

    knowledge = self.neo4j.run("""
      MATCH (a:Agent {id: $agent_id})-[:KNOWS]->(k:Knowledge)
      WHERE k.content CONTAINS $query
      RETURN k
    """, agent_id, query)

    semantic = self.chroma.query(
      query_texts=[query],
      where={"agent_id": agent_id}
    )

    return merge_memories(working, knowledge, semantic)
```

---

## 六、核心技术架构模式

### 模式1：向量-图谱-规则的混合推理引擎

```
用户问题: "这个商机能赢单吗？"

         ┌──────────────┐
         │   LLM理解    │
         │  提取意图    │
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │ ChromaDB     │
         │ 语义相似案例  │ ──→ "相似商机赢单率65%"
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │ Neo4j        │
         │ 图谱推理      │ ──→ "客户有2个历史赢单商机"
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │ 规则引擎      │
         │ 业务规则      │ ──→ "金额<50万无需审批"
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │ LLM综合      │
         │ 生成答案      │ ──→ "很有希望！因为..."
         └──────────────┘
```

### 模式2：工具调用中的数据库事务

```python
class SkillExecutorWithTransaction:
  async def execute_skill(self, skill_id, params):
    # 开启多数据库事务
    tx_mongo = self.mongodb.start_session()
    tx_neo4j = self.neo4j.begin_transaction()

    try:
      results = {}

      # 1. 参数校验
      skill = self.get_skill_definition(skill_id)
      validated = self.validate_params(skill, params)

      # 2. MongoDB操作
      if skill.mongodb_operations:
        for op in skill.mongodb_operations:
          if op.type == "insert":
            result = tx_mongo.insert_one(op.collection, validated)
            results[op.name] = result

      # 3. Neo4j操作
      if skill.neo4j_operations:
        for op in skill.neo4j_operations:
          if op.type == "create_node":
            result = tx_neo4j.run(op.cypher, validated)
            results[op.name] = result

      # 4. ChromaDB操作
      if skill.chromadb_operations:
        for op in skill.chromadb_operations:
          if op.type == "add_vector":
            document = self.render_template(op.template, validated)
            result = self.chroma.add(
              ids=[validated["id"]],
              documents=[document]
            )
            results[op.name] = result

      # 5. 提交事务
      tx_mongo.commit_transaction()
      tx_neo4j.commit()

      return {"success": True, "results": results}

    except Exception as e:
      # 回滚事务
      tx_mongo.abort_transaction()
      tx_neo4j.rollback()
      return {"success": False, "error": str(e)}
```

### 模式3：Agent编排中的状态机

```python
class AgentOrchestrator:
  def __init__(self):
    self.mongodb = MongoDBClient()    # 状态持久化
    self.neo4j = Neo4jClient()        # 协作图

  async def orchestrate(self, task):
    # 1. 从图谱中查询Agent协作流程
    workflow = self.neo4j.run("""
      MATCH path = (start:Agent {role: 'coordinator'})
                    -[:DELEGATES_TO*]->(agent:Agent)
      RETURN path
    """)

    # 2. 创建工作空间
    workspace_id = self.mongodb.insert_one("agent_workspaces", {
      "task": task,
      "status": "running",
      "current_step": 0
    })

    # 3. 执行工作流
    for step in workflow.steps:
      agent = self.get_agent(step.agent_id)

      # 传递上下文
      context = self.mongodb.find_one("agent_workspaces", workspace_id)

      # Agent执行
      result = await agent.execute(task, context)

      # 更新工作空间
      self.mongodb.update_one("agent_workspaces", workspace_id, {
        "$push": {"results": result},
        "$set": {"current_step": step.order}
      })

      # 检查是否需要人工介入
      if result.needs_human_review:
        await self.request_human_review(workspace_id, result)

    return self.mongodb.find_one("agent_workspaces", workspace_id)
```

---

## 七、面向未来的扩展性设计

### 1. 多模态数据支持

```yaml
# 本体定义扩展
objects:
  - code: Document
    attributes:
      - name: content
        type: text
      - name: images
        type: multimodal  # 新增：多模态字段
      - name: attachments
        type: file

    storage:
      mongodb:
        collection: documents
        multimodal: true  # 启用多模态存储

      chromadb:
        semantic_search: true
        embed_images: true  # 图片也向量化
        embedding_model: "clip-vit-base"  # 多模态模型
```

### 2. 流式数据处理

```python
# Agent实时监控商机变化
class StreamProcessor:
  def watch_opportunity_changes(self):
    # MongoDB Change Stream
    pipeline = [
      {"$match": {"fullDocument.stage": {"$in": ["won", "lost"]}}}
    ]

    for change in mongodb.watch(pipeline):
      # 1. 更新向量索引
      if change["operationType"] == "update":
        chroma.update(
          ids=[change["documentKey"]["_id"]],
          documents=[self.render_opportunity_text(change["fullDocument"])]
        )

      # 2. 更新图谱关系
      neo4j.run("""
        MATCH (o:Opportunity {id: $id})
        SET o.stage = $stage
      """, change["fullDocument"])

      # 3. 触发Agent通知
      if change["fullDocument"]["stage"] == "won":
        agent.notify("opportunity_won", change["fullDocument"])
```

### 3. 联邦学习与隐私保护

```python
# 多租户场景下的数据隔离
class TenantAwareAgent:
  def query_with_tenant_isolation(self, tenant_id, query):
    # MongoDB: 租户隔离
    mongodb.find({
      "tenant_id": tenant_id,
      "$text": {"$search": query}
    })

    # Neo4j: 多租户图谱
    neo4j.run("""
      MATCH (n)
      WHERE n.tenant_id = $tenant_id
      AND n.content CONTAINS $query
      RETURN n
    """, tenant_id, query)

    # ChromaDB: 租户隔离的向量空间
    chroma.query(
      query_texts=[query],
      where={"tenant_id": tenant_id}
    )
```

---

## 八、终极架构：认知智能操作系统

```
┌─────────────────────────────────────────────────────────────┐
│                   用户自然语言接口                            │
│          "帮我分析这个客户，推荐销售策略"                      │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ 销售Agent │         │ 财务Agent │         │ 法务Agent │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │  Agent编排中心     │
                  │  - 任务分解        │
                  │  - 协作调度        │
                  │  - 冲突解决        │
                  └─────────┬─────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ 推理引擎 │         │ 记忆系统 │         │ 学习引擎 │
   │         │         │         │         │         │
   │语义推理  │         │短期记忆  │         │经验沉淀  │
   │图谱推理  │         │长期记忆  │         │模型微调  │
   │规则推理  │         │语义记忆  │         │知识更新  │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
   │ MongoDB  │         │ Neo4j   │         │ChromaDB │
   │         │         │         │         │         │
   │实例数据  │         │知识图谱  │         │向量索引  │
   │会话记忆  │         │协作图谱  │         │语义记忆  │
   │工作空间  │         │决策链路  │         │多模态    │
   └─────────┘         └─────────┘         └─────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │  本体层（元数据）   │
                  │  - 实体定义        │
                  │  - 行为定义        │
                  │  - 规则定义        │
                  │  - 存储策略        │
                  └───────────────────┘
```

---

## 九、核心设计原则总结

### 1. 数据库是Agent的认知基础
- **MongoDB**: Agent的"陈述性记忆"（事实知识）
- **Neo4j**: Agent的"程序性记忆"（关系知识、推理链）
- **ChromaDB**: Agent的"语义记忆"（模式识别、相似匹配）

### 2. 数据库协同的黄金三角
```
          ChromaDB
          (语义层)
         /        \
        /          \
  MongoDB -------- Neo4j
 (数据层)         (关系层)
```

### 3. Agent系统的三层抽象
- **感知层**: ChromaDB语义理解 + MongoDB数据感知
- **认知层**: Neo4j图推理 + 规则引擎
- **行动层**: SKILL执行 + MongoDB写入

### 4. 可演化架构的关键
- 本体定义与存储策略解耦
- Agent能力与数据库实现解耦
- 支持增量式引入新的数据库类型

---

## 十、实施路径建议

### Phase 1: 基础能力建设
- [ ] MongoDB Agent会话记忆管理
- [ ] ChromaDB RAG基础检索
- [ ] Neo4j 知识图谱构建

### Phase 2: 推理能力增强
- [ ] 混合检索引擎（RAG + GraphRAG）
- [ ] 决策链路追溯
- [ ] Agent间共享记忆

### Phase 3: 协作能力建设
- [ ] Agent协作图谱
- [ ] 技能依赖图谱
- [ ] 多Agent编排引擎

### Phase 4: 智能化升级
- [ ] 流式数据处理
- [ ] 多模态支持
- [ ] 自主学习与进化

---

## 参考文献

- [本体层设计](./07-ability-layer-design.md)
- [能力层设计](./07-ability-layer-design.md)
- [技能系统重构计划](./计划文件路径)

---

**这个架构不仅是技术选型，更是认知智能系统的设计哲学。**