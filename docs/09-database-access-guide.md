# 数据库访问指南

项目使用三个数据库存储 CRM 业务数据，配置文件位于 `ability/server/config/database.json`。

## 连接信息

| 数据库 | 地址 | 用途 |
|--------|------|------|
| MongoDB | `mongodb://127.0.0.1:27017` | 文档存储 |
| Neo4j | `bolt://localhost:7687` | 图关系存储 |
| ChromaDB | `http://localhost:8000` | 向量检索 |

---

## 1. MongoDB（文档数据库）

- **数据库名**：`crm_capability`
- **GUI 工具**：[MongoDB Compass](https://www.mongodb.com/try/download/compass)（已安装到 `/Applications/MongoDB Compass.app`）
- **CLI 工具**：`mongosh`（需单独安装：`brew install mongosh`）

### 连接

- Compass：连接地址填 `mongodb://127.0.0.1:27017`
- CLI：`mongosh mongodb://127.0.0.1:27017/crm_capability`

### 集合列表

| 集合名 | 说明 |
|--------|------|
| `crm_leads` | 线索 |
| `crm_opportunities` | 商机 |
| `crm_customers` | 客户 |
| `crm_quotes` | 报价 |
| `crm_contacts` | 联系人 |

### 常用命令

```js
// 查看所有集合
show collections

// 查看线索（最新 10 条）
db.crm_leads.find().sort({created_at: -1}).limit(10).pretty()

// 查看商机
db.crm_opportunities.find().pretty()

// 查看客户
db.crm_customers.find().pretty()

// 查看报价
db.crm_quotes.find().pretty()

// 查看联系人
db.crm_contacts.find().pretty()

// 统计各集合文档数
db.crm_leads.countDocuments()
db.crm_opportunities.countDocuments()
db.crm_customers.countDocuments()
db.crm_quotes.countDocuments()
db.crm_contacts.countDocuments()

// 按条件查询
db.crm_leads.find({ status: "new" }).pretty()
db.crm_opportunities.find({ stage: "qualification" }).pretty()

// 清空集合（慎用）
db.crm_leads.deleteMany({})
```

---

## 2. Neo4j（图数据库）

- **用户名**：`neo4j`
- **密码**：`password`
- **Browser UI**：http://localhost:7474
- **桌面工具**：[Neo4j Desktop](https://neo4j.com/download/)

### 连接

浏览器打开 http://localhost:7474，输入用户名 `neo4j`，密码 `password`。

### 节点类型

| 标签 | 说明 |
|------|------|
| `Lead` | 线索 |
| `Customer` | 客户 |
| `Contact` | 联系人 |
| `Opportunity` | 商机 |
| `Quote` | 报价 |

### 关系类型

| 关系 | 说明 |
|------|------|
| `BELONGS_TO_CUSTOMER` | 线索/商机归属于客户 |
| `WORKS_FOR` | 联系人隶属于客户 |
| `CONVERTED_TO` | 线索转化为商机 |

### 常用 Cypher 查询

```cypher
-- 查看所有节点
MATCH (n) RETURN n LIMIT 50

-- 节点统计
MATCH (n) RETURN labels(n)[0] AS 类型, count(n) AS 数量

-- 按类型查看
MATCH (l:Lead) RETURN l
MATCH (c:Customer) RETURN c
MATCH (o:Opportunity) RETURN o
MATCH (q:Quote) RETURN q
MATCH (ct:Contact) RETURN ct

-- 查看所有关系
MATCH (a)-[r]->(b) RETURN a, type(r) AS 关系, b

-- 关系统计
MATCH ()-[r]->() RETURN type(r) AS 关系, count(r) AS 数量

-- 查看完整销售链路
MATCH path = (o:Opportunity)<-[:CONVERTED_TO*0..]-(l:Lead)-[:BELONGS_TO_CUSTOMER]->(c:Customer)
RETURN path

-- 清空所有数据（慎用）
MATCH (n) DETACH DELETE n
```

### 通过 HTTP API 查询

```bash
# 节点统计
curl -s -u neo4j:password \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"MATCH (n) RETURN labels(n)[0] AS 类型, count(n) AS 数量"}]}' \
  http://localhost:7474/db/neo4j/tx/commit | python3 -m json.tool

# 关系统计
curl -s -u neo4j:password \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"MATCH ()-[r]->() RETURN type(r) AS 关系, count(r) AS 数量"}]}' \
  http://localhost:7474/db/neo4j/tx/commit | python3 -m json.tool
```

---

## 3. ChromaDB（向量数据库）

- **默认集合**：`crm_opportunities`
- **API 地址**：`http://localhost:8000`

### 常用 API（curl）

```bash
# 心跳检测
curl http://localhost:8000/api/v1/heartbeat

# 列出所有集合
curl http://localhost:8000/api/v1/collections | python3 -m json.tool

# 获取集合中的所有数据（需替换 {collection_id}）
curl -s http://localhost:8000/api/v1/collections/{collection_id}/get \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

# 语义搜索（需替换 {collection_id}）
curl -s http://localhost:8000/api/v1/collections/{collection_id}/query \
  -H "Content-Type: application/json" \
  -d '{"query_texts": ["CRM项目商机"], "n_results": 5}' | python3 -m json.tool

# 删除集合中的所有数据（慎用，需替换 {collection_id}）
curl -s -X DELETE http://localhost:8000/api/v1/collections/{collection_id}
```

### 快速获取 collection_id

```bash
# 获取集合列表，提取 id
curl -s http://localhost:8000/api/v1/collections | python3 -c "
import json, sys
data = json.load(sys.stdin)
for c in data:
    print(f\"{c['name']} -> {c['id']}\")
"
```

---

## 快速状态检查

```bash
# 一键检查三个数据库是否在线
echo "MongoDB:" && curl -s http://localhost:27017 2>&1 | head -1
echo "Neo4j:" && curl -s http://localhost:7474 2>&1 | head -1
echo "ChromaDB:" && curl -s http://localhost:8000/api/v1/heartbeat
```
