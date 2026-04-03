# 数据库配置指南

## 概述

能力层集成了三个外部数据库，采用**软依赖设计**：
- 启动时尝试连接，失败时标记为 `offline`，不阻塞系统
- 技能执行时检查连接状态，离线时跳过写入并记录 `skipped` 状态

## 数据库配置

配置文件位置：`ability/server/config/database.json`

### MongoDB 配置

```json
{
  "mongodb": {
    "connection_url": "mongodb://localhost:27017",
    "database_name": "crm_capability",
    "username": "",
    "password": ""
  }
}
```

**启动 MongoDB（Docker）**：
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest
```

**Collections**：
- `crm_customers` - 客户数据
- `crm_leads` - 销售线索
- `crm_opportunities` - 商机数据
- `crm_quotes` - 报价单
- `crm_contacts` - 联系人

### Neo4j 配置

```json
{
  "neo4j": {
    "connection_url": "bolt://localhost:7687",
    "username": "neo4j",
    "password": "password"
  }
}
```

**启动 Neo4j（Docker）**：
```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

**图模型**：
- 节点：`:Customer`, `:Lead`, `:Opportunity`, `:Quote`, `:Contact`
- 关系：`BELONGS_TO_CUSTOMER`, `CONVERTED_TO`, `HAS_QUOTE`, `WORKS_FOR`, `PRIMARY_OF`

### ChromaDB 配置

```json
{
  "chromadb": {
    "connection_url": "http://localhost:8000",
    "collection_name": "crm_opportunities"
  }
}
```

**启动 ChromaDB（Docker）**：
```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  chromadb/chroma:latest
```

**Collection**：
- `crm_opportunities` - 商机向量数据，用于语义搜索

## 快速启动所有数据库

```bash
# 启动 MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:latest

# 启动 Neo4j
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password neo4j:latest

# 启动 ChromaDB
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest

# 等待服务启动（约 10 秒）
sleep 10

# 重启能力层后端以重新连接
cd ability/server && npm run dev
```

## 验证连接状态

访问 API 端点查看数据库状态：
```bash
curl http://localhost:3002/api/database/status
```

预期响应：
```json
{
  "mongodb": {
    "status": "online",
    "last_check": "2026-04-03T10:30:00.000Z"
  },
  "neo4j": {
    "status": "online",
    "last_check": "2026-04-03T10:30:00.000Z"
  },
  "chromadb": {
    "status": "online",
    "last_check": "2026-04-03T10:30:00.000Z"
  }
}
```

## 软依赖行为

### 场景 1：所有数据库在线
- 技能执行时正常写入三个数据库
- 执行日志记录：`mongodb_status: 'ok'`, `neo4j_status: 'ok'`, `chroma_status: 'ok'`

### 场景 2：部分数据库离线
- 技能执行时只写入在线的数据库
- 离线数据库的操作被跳过
- 执行日志记录：`mongodb_status: 'ok'`, `neo4j_status: 'skipped'`, `chroma_status: 'skipped'`

### 场景 3：所有数据库离线
- 技能仍然可以执行（如果不依赖数据库读取）
- 所有数据库操作被跳过
- 执行日志记录：`mongodb_status: 'skipped'`, `neo4j_status: 'skipped'`, `chroma_status: 'skipped'`

## 故障排查

### MongoDB 连接失败
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**解决方案**：
1. 检查 MongoDB 是否运行：`docker ps | grep mongodb`
2. 检查端口是否被占用：`lsof -i :27017`
3. 查看 MongoDB 日志：`docker logs mongodb`

### Neo4j 连接失败
```
Error: Failed to connect to server
```
**解决方案**：
1. 检查 Neo4j 是否运行：`docker ps | grep neo4j`
2. 访问 Neo4j Browser：http://localhost:7474
3. 验证用户名密码是否正确

### ChromaDB 连接失败
```
Error: Failed to connect to chromadb
```
**解决方案**：
1. 检查 ChromaDB 是否运行：`docker ps | grep chromadb`
2. 检查端口是否被占用：`lsof -i :8000`
3. 查看 ChromaDB 日志：`docker logs chromadb`

## 生产环境配置

生产环境建议使用环境变量覆盖配置：

```bash
export MONGODB_URL="mongodb://prod-server:27017"
export NEO4J_URL="bolt://prod-server:7687"
export CHROMADB_URL="http://prod-server:8000"
```

修改 `database.json` 支持环境变量：
```json
{
  "mongodb": {
    "connection_url": "${MONGODB_URL:-mongodb://localhost:27017}",
    ...
  }
}
```
