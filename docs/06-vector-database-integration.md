# 向量数据库集成方案

## 文档概述

本文档详细说明在本体管理系统中集成向量数据库的技术方案，包括数据来源、集成架构、技术选型和实施建议。

---

## 1. 向量数据库的作用

### 1.1 核心价值

向量数据库用于实现**语义相似度匹配**，主要支持以下场景：

| 场景 | 需求描述 | 技术实现 |
|------|---------|---------|
| **相似案例推荐** | 当创建新商机时，自动推荐历史上相似的赢单案例 | 向量相似度检索 + 标签过滤 |
| **智能问答（RAG）** | "系统里有没有处理过医疗行业的合规问题？" | 向量检索 + LLM生成 |
| **经验自动化分发** | 根据商机特征，推送相关的销售话术和打法 | 语义匹配 + 知识库检索 |

### 1.2 与其他组件的区别

```
MongoDB：存储完整的结构化+非结构化数据（精确查询）
Neo4j：存储实体关系和事件链路（图遍历溯源）
VectorDB：存储文本的语义向量（相似度匹配）
```

**关键区别**：
- MongoDB查询：`WHERE name = "华康医疗"` （精确匹配）
- VectorDB查询：`SIMILAR TO "医疗行业数字化转型项目"` （语义相似）

---

## 2. 数据来源与向量化流程

### 2.1 原始数据来源

向量数据来自 **MongoDB 中的文本字段**：

```javascript
// MongoDB 商机文档示例
{
  _id: "opp-001",
  name: "华康医疗数字化转型项目",
  industry: "医疗",
  budget: 500000,
  status: "won",

  // 以下字段需要向量化
  description: "客户希望通过AI技术实现病历智能分析...",
  pain_points: "现有系统效率低、人工成本高、数据孤岛严重",
  solution: "提供基于大模型的智能诊断辅助系统",
  win_reason: "我们的医疗行业经验丰富，且提供了完整的合规方案",

  activities: [
    {text: "客户提到他们最关心数据安全和隐私保护"},
    {text: "决策人是CTO张三，技术背景强，看重技术架构"}
  ]
}
```

**向量化字段选择原则**：
- ✅ 包含语义信息的文本字段（description, pain_points, solution）
- ✅ 用户输入的自由文本（activities, notes）
- ❌ 结构化字段（industry, budget, status）→ 用作过滤条件，不需要向量化

### 2.2 Embedding 生成流程

```javascript
import OpenAI from 'openai';

// 1. 组合多个字段生成综合文本
function buildEmbeddingText(opportunity) {
  return `
项目：${opportunity.name}
行业：${opportunity.industry}
痛点：${opportunity.pain_points}
方案：${opportunity.solution}
赢单原因：${opportunity.win_reason || ''}
关键跟进：${opportunity.activities.slice(0, 3).map(a => a.text).join('; ')}
  `.trim();
}

// 2. 调用 Embedding API
async function generateEmbedding(text) {
  const openai = new OpenAI();

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",  // 1536维
    input: text,
  });

  return response.data[0].embedding;  // 返回浮点数数组
}

// 3. 完整流程
async function generateOpportunityEmbedding(opportunity) {
  const text = buildEmbeddingText(opportunity);
  return await generateEmbedding(text);
}
```

**成本参考**（OpenAI text-embedding-3-small）：
- 每 1000 tokens：$0.00002
- 单个商机文档（约 500 字）：~$0.00001
- 10 万个商机：~$1

---

## 3. 架构集成方案

### 3.1 方案 A：同步写入（推荐 MVP）

**适用场景**：数据量小，需要实时可用

```
用户操作 → Express 后端
              ↓
        ┌─────┴─────┐
        ↓           ↓
    MongoDB      生成 Embedding
        ↓           ↓
    Change Stream  VectorDB
        ↓
      Neo4j
```

**代码实现**：

```javascript
// 创建商机时同步写入三个库
async function createOpportunity(data) {
  try {
    // 1. 写 MongoDB（主库）
    const doc = await mongodb.opportunities.insertOne(data);

    // 2. 生成向量并写入向量库（并行）
    const embedding = await generateOpportunityEmbedding(data);
    await vectorDB.upsert({
      id: doc._id.toString(),
      vector: embedding,
      metadata: {
        industry: data.industry,
        budget: data.budget,
        status: data.status,
        created_at: new Date().toISOString()
      }
    });

    // 3. Neo4j 通过 Change Stream 异步同步
    // 或在此处同步写入

    return doc;
  } catch (error) {
    // 错误处理：如果向量库写入失败，记录日志但不阻塞主流程
    console.error('VectorDB write failed:', error);
    // 可以加入重试队列
    throw error;
  }
}
```

**优点**：
- 逻辑清晰，易于调试
- 向量数据实时可用
- 适合 MVP 快速验证

**缺点**：
- 写入延迟增加（embedding 生成需要 100-300ms）
- 如果向量库挂了，整个写入失败

---

### 3.2 方案 B：异步队列（生产级）

**适用场景**：高并发，需要解耦

```
用户操作 → Express → MongoDB
                        ↓
                   Change Stream
                   ↙          ↘
              Neo4j 同步    Embedding 队列
                              ↓
                          生成向量
                              ↓
                          VectorDB
```

**代码实现**：

```javascript
// MongoDB Change Stream 监听
const changeStream = mongodb.watch([
  {
    $match: {
      'operationType': { $in: ['insert', 'update'] },
      'ns.coll': 'opportunities'
    }
  }
]);

changeStream.on('change', async (change) => {
  const doc = change.fullDocument;

  // 并行处理
  await Promise.all([
    syncToNeo4j(doc),           // 同步关系
    generateAndStoreVector(doc)  // 生成向量
  ]);
});

async function generateAndStoreVector(doc) {
  try {
    const embedding = await generateOpportunityEmbedding(doc);
    await vectorDB.upsert({
      id: doc._id.toString(),
      vector: embedding,
      metadata: {
        industry: doc.industry,
        budget: doc.budget,
        status: doc.status
      }
    });
  } catch (error) {
    // 写入失败队列，定时重试
    await failureQueue.push({ docId: doc._id, error: error.message });
  }
}
```

**优点**：
- 写入路径解耦，主流程不阻塞
- 向量生成失败不影响业务
- 可以批量处理，提高效率

**缺点**：
- 向量数据有延迟（通常 <1 秒）
- 需要处理重试和失败补偿
- 架构复杂度增加

---

### 3.3 方案 C：批量离线生成

**适用场景**：历史数据迁移，或向量生成不需要实时

```javascript
// 定时任务或手动触发
async function batchGenerateVectors(batchSize = 100) {
  const cursor = mongodb.opportunities.find({
    vector_generated: { $ne: true }  // 未生成向量的文档
  }).limit(batchSize);

  for await (const doc of cursor) {
    try {
      const embedding = await generateOpportunityEmbedding(doc);

      await vectorDB.upsert({
        id: doc._id.toString(),
        vector: embedding,
        metadata: { /* ... */ }
      });

      // 标记已生成
      await mongodb.opportunities.updateOne(
        { _id: doc._id },
        { $set: { vector_generated: true, vector_generated_at: new Date() } }
      );
    } catch (error) {
      console.error(`Failed to generate vector for ${doc._id}:`, error);
    }
  }
}

// 定时任务：每小时执行一次
setInterval(batchGenerateVectors, 3600000);
```

---

## 4. 完整数据流图

### 4.1 写入流程

```
┌─────────────────────────────────────────────────────────┐
│                    用户操作层                             │
│  创建商机 / 更新商机 / 添加跟进记录                        │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Express + 规则引擎                           │
│  - 校验 YAML 规则                                         │
│  - 协调多库写入                                           │
└─┬───────────────┬───────────────┬───────────────────────┘
  ↓               ↓               ↓
┌─────────┐  ┌─────────┐  ┌──────────────┐
│ MongoDB │  │  Neo4j  │  │  VectorDB    │
│ (主库)  │  │ (关系)  │  │  (语义搜索)  │
└─────────┘  └─────────┘  └──────────────┘
  │               ↑               ↑
  │               │               │
  └─ Change Stream ───────────────┘
         (异步同步)
```

### 4.2 读取流程（相似案例推荐）

```
用户："给我推荐类似的赢单案例"
         ↓
    LLM 解析意图
         ↓
    提取当前商机特征
         ↓
┌────────────────────────────────┐
│  VectorDB 相似度检索            │
│  - 输入：当前商机的 embedding   │
│  - 输出：Top-5 相似商机 ID      │
│  - 过滤：industry=医疗, status=won │
└────────────────────────────────┘
         ↓
    拿到 [id1, id2, id3, id4, id5]
         ↓
┌────────────────────────────────┐
│  MongoDB 批量查询               │
│  db.opportunities.find({        │
│    _id: {$in: [id1...id5]}     │
│  })                             │
└────────────────────────────────┘
         ↓
    返回完整案例详情
         ↓
    LLM 生成推荐报告
```

**代码实现**：

```javascript
async function findSimilarOpportunities(currentOpp, topK = 5) {
  // 1. 生成当前商机的向量
  const embedding = await generateOpportunityEmbedding(currentOpp);

  // 2. 向量检索（带过滤条件）
  const results = await vectorDB.search({
    vector: embedding,
    limit: topK,
    filter: {
      status: 'won',  // 只推荐赢单案例
      industry: currentOpp.industry  // 同行业
    }
  });

  // 3. 批量查询 MongoDB 获取详情
  const ids = results.map(r => r.id);
  const opportunities = await mongodb.opportunities.find({
    _id: { $in: ids }
  }).toArray();

  // 4. 返回结果（按相似度排序）
  return opportunities.map((opp, index) => ({
    ...opp,
    similarity_score: results[index].score
  }));
}
```

---

## 5. 技术选型

### 5.1 Embedding 模型选择

| 模型 | 维度 | 成本 | 适用场景 | 推荐度 |
|------|------|------|----------|--------|
| **text-embedding-3-small** | 1536 | 低 | MVP，中文支持好 | ⭐⭐⭐⭐⭐ |
| text-embedding-3-large | 3072 | 中 | 高精度需求 | ⭐⭐⭐ |
| bge-large-zh-v1.5 | 1024 | 免费（自部署） | 纯中文，可本地化 | ⭐⭐⭐⭐ |

**推荐**：OpenAI text-embedding-3-small
- 性价比最高
- 中文支持优秀
- API 稳定可靠
- 无需自建服务

### 5.2 向量数据库选择

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Qdrant** | 开源、Docker 部署简单、性能好、支持过滤 | 需要独立服务 | ⭐⭐⭐⭐⭐ |
| PgVector | 与 PostgreSQL 集成、一库多用 | 性能不如原生向量库 | ⭐⭐⭐⭐ |
| Milvus | 企业级、功能强大、可扩展性好 | 部署复杂、资源消耗大 | ⭐⭐⭐ |
| Pinecone | 托管服务、零运维 | 收费、数据在云端 | ⭐⭐⭐ |

**推荐**：Qdrant
- Docker 一键启动，适合 MVP
- 性能优秀（百万级向量毫秒级检索）
- 支持丰富的过滤条件（metadata filtering）
- 开源免费，无供应商锁定

**启动命令**：
```bash
docker run -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

---

## 6. 数据模型设计

### 6.1 VectorDB 数据结构（Qdrant）

```javascript
{
  id: "opp-001",  // 对应 MongoDB 的 _id
  vector: [0.123, -0.456, 0.789, ...],  // 1536 维浮点数数组
  payload: {
    // 用于过滤的元数据（不参与向量计算）
    industry: "医疗",
    budget_range: "50-100万",
    status: "won",
    created_at: "2024-01-15T10:30:00Z",
    sales_person: "火亮",

    // 可选：存储少量文本用于预览
    name: "华康医疗数字化转型项目",
    snippet: "客户希望通过AI技术实现病历智能分析..."
  }
}
```

### 6.2 MongoDB 扩展字段

```javascript
{
  _id: "opp-001",
  // ... 原有字段 ...

  // 新增：向量化相关字段
  vector_generated: true,
  vector_generated_at: ISODate("2024-01-15T10:30:00Z"),
  vector_model: "text-embedding-3-small",
  vector_version: 1  // 用于向量模型升级时的版本管理
}
```

---

## 7. 实施建议

### 7.1 分阶段实施路径

#### 阶段 0：当前架构（不引入向量库）
```
技术栈：MongoDB + Neo4j
核心功能：关系溯源、上帝视角复盘
```

**验证目标**：
- 图遍历的性能和准确性
- 用户是否真的需要"相似案例推荐"

---

#### 阶段 1：引入向量库（如果需要）

**触发条件**：
- 用户强烈要求"智能推荐相似案例"
- 或需要"全文语义搜索"

**实施步骤**：

1. **环境准备**（1 天）
   ```bash
   # 启动 Qdrant
   docker run -d -p 6333:6333 \
     -v ./qdrant_storage:/qdrant/storage \
     --name qdrant \
     qdrant/qdrant
   ```

2. **安装依赖**（1 天）
   ```bash
   npm install @qdrant/js-client-rest openai
   ```

3. **实现向量生成服务**（2-3 天）
   - 封装 OpenAI Embedding API
   - 实现文本组合逻辑
   - 添加错误处理和重试

4. **实现数据同步**（3-5 天）
   - 方案 A：同步写入（简单）
   - 或方案 B：Change Stream 异步（推荐）

5. **历史数据迁移**（1-2 天）
   - 批量生成历史数据的向量
   - 验证数据一致性

6. **实现相似度检索 API**（2-3 天）
   ```javascript
   GET /api/opportunities/:id/similar
   ```

7. **前端集成**（2-3 天）
   - 在商机详情页展示"相似案例"
   - 添加"智能推荐"功能

**总计**：2-3 周（1-2 人）

---

### 7.2 关键技术细节

#### 向量更新策略

```javascript
// 当商机更新时，判断是否需要重新生成向量
async function updateOpportunity(id, updates) {
  const needsVectorUpdate = [
    'description', 'pain_points', 'solution', 'win_reason'
  ].some(field => field in updates);

  // 更新 MongoDB
  await mongodb.opportunities.updateOne({ _id: id }, { $set: updates });

  // 如果关键字段变更，重新生成向量
  if (needsVectorUpdate) {
    const doc = await mongodb.opportunities.findOne({ _id: id });
    const embedding = await generateOpportunityEmbedding(doc);
    await vectorDB.upsert({
      id: id.toString(),
      vector: embedding,
      metadata: { /* ... */ }
    });
  }
}
```

#### 向量检索优化

```javascript
// 使用 metadata 过滤提高检索精度
async function searchWithFilters(query, filters) {
  const embedding = await generateEmbedding(query);

  return await vectorDB.search({
    vector: embedding,
    limit: 10,
    filter: {
      must: [
        { key: 'status', match: { value: 'won' } },
        { key: 'industry', match: { value: filters.industry } }
      ],
      should: [
        {
          key: 'budget_range',
          match: { value: filters.budget_range }
        }
      ]
    },
    score_threshold: 0.7  // 只返回相似度 > 0.7 的结果
  });
}
```

---

## 8. 成本估算

### 8.1 开发成本

| 阶段 | 工作量 | 人力 |
|------|--------|------|
| 向量生成服务 | 2-3 天 | 1 人 |
| 数据同步实现 | 3-5 天 | 1 人 |
| 历史数据迁移 | 1-2 天 | 1 人 |
| API 开发 | 2-3 天 | 1 人 |
| 前端集成 | 2-3 天 | 1 人 |
| **总计** | **2-3 周** | **1-2 人** |

### 8.2 运营成本

| 项目 | 成本 | 说明 |
|------|------|------|
| OpenAI Embedding API | ~$1/10万条 | text-embedding-3-small |
| Qdrant 服务器 | $0（自建）或 $25/月（云托管） | 1GB 内存可存储 ~50 万向量 |
| 存储成本 | ~1GB/50 万向量 | 1536 维 float32 |

**示例**：
- 10 万商机 × $0.00001 = $1（一次性）
- Qdrant 自建：Docker 部署，无额外成本
- **总计**：几乎可忽略不计

---

## 9. 风险与注意事项

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **向量库与 MongoDB 数据不一致** | 检索结果不准确 | 实现补偿机制，定期全量对账 |
| **Embedding API 限流** | 批量生成失败 | 实现指数退避重试，或切换到自建模型 |
| **向量检索召回率低** | 推荐结果不相关 | 调整 score_threshold，优化文本组合策略 |

### 9.2 最佳实践

1. **先小规模验证**
   - 用 1000 条数据测试检索效果
   - 人工评估推荐质量

2. **监控关键指标**
   - 向量生成成功率
   - 检索平均延迟
   - 推荐点击率（CTR）

3. **版本管理**
   - 记录 `vector_model` 和 `vector_version`
   - 模型升级时可以逐步迁移

4. **降级策略**
   - 如果向量库挂了，降级到基于标签的精确匹配
   - 保证核心功能可用

---

## 10. 总结

### 10.1 何时引入向量库

**需要引入**：
- ✅ 需要"找相似案例"（语义匹配）
- ✅ 需要"智能问答"（RAG 检索）
- ✅ 用户描述是非结构化文本，需要语义理解

**暂不需要**：
- ❌ 只做精确查询（ID、名称、状态）
- ❌ 只做关系溯源（谁创建了谁、谁影响了谁）
- ❌ 数据都是结构化的（表单字段）

### 10.2 推荐方案

**MVP 阶段**：
```
MongoDB + Neo4j（不引入向量库）
```

**扩展阶段**（如果需要）：
```
MongoDB + Neo4j + Qdrant + OpenAI Embedding
集成方式：方案 A（同步写入）或方案 B（Change Stream 异步）
```

---

## 附录

### A. Qdrant 客户端示例

```javascript
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: 'http://localhost:6333' });

// 创建集合
await client.createCollection('opportunities', {
  vectors: {
    size: 1536,
    distance: 'Cosine'
  }
});

// 插入向量
await client.upsert('opportunities', {
  points: [
    {
      id: 'opp-001',
      vector: [0.123, -0.456, ...],
      payload: {
        industry: '医疗',
        status: 'won'
      }
    }
  ]
});

// 检索
const results = await client.search('opportunities', {
  vector: [0.111, -0.222, ...],
  limit: 5,
  filter: {
    must: [
      { key: 'status', match: { value: 'won' } }
    ]
  }
});
```

### B. 参考资料

- [Qdrant 官方文档](https://qdrant.tech/documentation/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [向量数据库选型指南](https://www.pinecone.io/learn/vector-database/)

---

**文档版本**：v1.0
**最后更新**：2024-04-02
**维护者**：架构团队
