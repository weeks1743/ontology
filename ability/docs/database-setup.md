# 能力层数据库配置说明

## 数据库架构

能力层系统使用三种数据库来支持 CRM 业务场景：

1. **MongoDB** - 文档数据库，存储 CRM 业务数据（线索、商机、客户、联系人、报价单）
2. **Neo4j** - 图数据库，存储实体关系图谱（客户-商机-线索关系链）
3. **ChromaDB** - 向量数据库，支持语义搜索和商机匹配

## Docker 启动命令

### 启动所有数据库
```bash
cd /Users/weeks/Desktop/workspaces-yzj/ontology/ability
docker-compose up -d
```

### 查看数据库状态
```bash
docker-compose ps
```

### 查看数据库日志
```bash
docker-compose logs -f
```

### 停止所有数据库
```bash
docker-compose down
```

### 停止并删除数据卷（清空数据）
```bash
docker-compose down -v
```

## 数据库连接信息

### MongoDB
- **端口**: 27017
- **数据库**: crm_capability
- **用户名**: 无（本地开发环境无需认证）
- **密码**: 无
- **连接 URL**: mongodb://localhost:27017

### Neo4j
- **HTTP 端口**: 7474 (浏览器访问: http://localhost:7474)
- **Bolt 端口**: 7687
- **用户名**: neo4j
- **密码**: password
- **连接 URL**: bolt://localhost:7687

### ChromaDB
- **HTTP 端口**: 8000
- **集合名称**: crm_opportunities
- **连接 URL**: http://localhost:8000
- **浏览器访问**: http://localhost:8000/api/v1/heartbeat

## 健康检查

检查数据库是否正常运行：

```bash
# MongoDB
docker exec ontology-mongodb mongosh --eval "db.runCommand('ping')"

# Neo4j
curl http://localhost:7474

# ChromaDB
curl http://localhost:8000/api/v1/heartbeat
```

## 数据库管理界面

- **Neo4j Browser**: http://localhost:7474
  - 可以查看图数据、执行 Cypher 查询

## 初始数据

系统启动后会自动：
1. 创建 MongoDB 数据库 `crm_capability`
2. 创建 ChromaDB 集合 `crm_opportunities`
3. Neo4j 无需初始数据，运行技能时会自动创建节点和关系

## 常见问题

### 端口冲突
如果端口已被占用，修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "27018:27017"  # 改为其他端口
```

同时修改 `ability/server/config/database.json` 中的连接配置。

### Neo4j 密码
首次启动 Neo4j 后，可以在浏览器 http://localhost:7474 更改密码。
当前配置使用默认密码: `neo4j/password`

### ChromaDB CORS 配置
ChromaDB 已配置允许以下来源的跨域请求：
- http://localhost:5175 (前端)
- http://localhost:3002 (能力层服务器)
- http://localhost:3001 (主系统服务器)

## 数据持久化

数据存储在 Docker 数据卷中：
- mongodb_data
- neo4j_data
- chromadb_data

即使删除容器，数据也会保留。要清空数据，需要删除数据卷：
```bash
docker-compose down -v
```

## 备份与恢复

### MongoDB 备份
```bash
docker exec ontology-mongodb mongodump --db crm_capability --out /tmp/backup
docker cp ontology-mongodb:/tmp/backup ./mongodb-backup
```

### MongoDB 恢复
```bash
docker cp ./mongodb-backup ontology-mongodb:/tmp/backup
docker exec ontology-mongodb mongorestore --db crm_capability /tmp/backup/crm_capability
```

### Neo4j 备份
```bash
docker exec ontology-neo4j neo4j-admin database dump neo4j --to-path=/tmp/backup
docker cp ontology-neo4j:/tmp/backup ./neo4j-backup
```