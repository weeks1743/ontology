# 能力层 - Capability Layer

五层 AI 架构中的第二层，将本体定义转化为可执行的业务操作。

## 项目结构

```
ability/
├── server/                 # 后端服务（端口 3002）
│   ├── src/
│   │   ├── server.ts      # Express 入口
│   │   ├── db.ts          # SQLite 数据库
│   │   ├── types.ts       # TypeScript 类型定义
│   │   ├── database/      # 外部数据库集成
│   │   │   ├── mongodb.ts
│   │   │   ├── neo4j.ts
│   │   │   ├── chroma.ts
│   │   │   └── index.ts
│   │   ├── routes/        # API 路由
│   │   │   ├── skills.ts
│   │   │   ├── execute.ts
│   │   │   ├── logs.ts
│   │   │   ├── database.ts
│   │   │   └── ontology-skills.ts
│   │   └── engine/        # 技能引擎（Phase 3）
│   ├── config/
│   │   └── database.json  # 数据库配置
│   └── data/
│       └── ability.db     # SQLite 数据库
├── app/                   # 前端应用（端口 5175）
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── store/
│   │   │   └── ability-store.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── SkillMarketPage.tsx
│   │   │   ├── SkillDetailPage.tsx
│   │   │   └── ExecutionLogsPage.tsx
│   │   └── components/
│   │       └── LeftSidebar.tsx
│   └── index.html
└── skills/                # 技能包目录
    ├── ontology/          # 本体技能（Phase 3 生成）
    └── external/          # 外部技能（Phase 4 预置）
```

## 启动服务

### 1. 安装依赖

```bash
# 后端
cd ability/server
npm install

# 前端
cd ability/app
npm install
```

### 2. 启动服务

```bash
# 后端（端口 3002）
cd ability/server
npm run dev

# 前端（端口 5175）
cd ability/app
npm run dev
```

### 3. 访问应用

打开浏览器访问：http://localhost:5175

## 实现进度

### ✅ Phase 1: 独立工程骨架（已完成）

- [x] 后端基础架构（Express + TypeScript + SQLite）
- [x] 前端基础架构（React + TypeScript + Vite + Tailwind v4）
- [x] API 路由（技能、执行、日志、数据库状态）
- [x] 前端页面（Dashboard、SkillMarket、SkillDetail、ExecutionLogs）
- [x] 深空暗色 + Glassmorphism 设计风格
- [x] Zustand 状态管理

### ✅ Phase 2: 数据库集成层（已完成）

- [x] MongoDB 客户端（连接管理 + CRUD 操作）
- [x] Neo4j 客户端（图节点/关系创建 + 链路查询）
- [x] ChromaDB 客户端（向量化 + 语义搜索）
- [x] 软依赖设计（优雅降级，离线不阻塞）
- [x] 健康检查机制
- [x] 数据库状态 API
- [x] 配置文件管理

**软依赖行为验证**：
```bash
# 查看数据库状态
curl http://localhost:3002/api/database/status

# 预期输出（数据库未启动时）
{
  "mongodb": { "status": "offline", "error": "..." },
  "neo4j": { "status": "offline", "error": "..." },
  "chromadb": { "status": "offline", "error": "..." }
}
```

### 🚧 Phase 3: 本体技能生成（待实现）

- [ ] 调用主系统 API 获取 behaviors
- [ ] 生成标准 SKILL 包（SKILL.md + _meta.json + scripts/execute.js）
- [ ] 技能执行引擎（DSL 解释器）
- [ ] 规则校验器（表达式求值）
- [ ] 多库写入逻辑

### 🚧 Phase 4: 外部技能预置（待实现）

- [ ] 百度搜索技能包
- [ ] 报告生成器技能包
- [ ] 技能配置管理

### 🚧 Phase 5: 前端 UI 增强（待实现）

- [ ] 技能测试页面
- [ ] 配置对话框
- [ ] 测试用例运行器

### 🚧 Phase 6: 测试用例（待实现）

- [ ] 15 个 CRM 业务流程验证用例

## 数据库配置

详见 [DATABASE_SETUP.md](./DATABASE_SETUP.md)

### 快速启动数据库（Docker）

```bash
# MongoDB
docker run -d --name mongodb -p 27017:27017 mongo:latest

# Neo4j
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password neo4j:latest

# ChromaDB
docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
```

## API 端点

### 技能管理
- `GET /api/skills` - 获取所有技能
- `GET /api/skills/:id` - 获取单个技能
- `POST /api/skills` - 创建技能
- `DELETE /api/skills/:id` - 删除技能
- `POST /api/skills/:id/execute` - 执行技能

### 本体技能
- `POST /api/ontology-skills/generate` - 生成本体技能
- `DELETE /api/ontology-skills/all` - 删除所有本体技能

### 执行日志
- `GET /api/logs` - 获取执行日志
- `GET /api/logs/:id` - 获取单条日志

### 数据库状态
- `GET /api/database/status` - 获取数据库状态
- `POST /api/database/config` - 更新数据库配置

## 技术栈

### 后端
- Express 4.21
- TypeScript 5.4
- better-sqlite3 11.10
- MongoDB 6.0
- neo4j-driver 5.15
- chromadb 1.7

### 前端
- React 19.2
- TypeScript 5.6
- Vite 5.4
- Tailwind CSS 4.0
- Zustand 5.0
- Lucide React 0.469

## 设计特点

### 1. 软依赖设计
外部数据库（MongoDB/Neo4j/ChromaDB）连接失败时不阻塞系统启动，技能执行时跳过离线数据库的写入并记录 `skipped` 状态。

### 2. 深空暗色主题
- 背景色：`#0a0f1e` (space-darker)
- 玻璃效果：`rgba(15, 23, 42, 0.6)` + `backdrop-blur(12px)`
- 边框：`rgba(100, 200, 255, 0.1)`

### 3. 执行日志追踪
每次技能执行都记录：
- 输入参数和输出结果
- 执行状态（success/error/partial）
- 三个数据库的操作状态（ok/error/skipped）
- 执行耗时

## 下一步

继续实现 **Phase 3: 本体技能生成**：
1. 创建 `ontology-client.ts` 调用主系统 API
2. 创建 `skill-generator.ts` 生成 SKILL 包
3. 创建 `skill-executor.ts` 执行引擎
4. 创建 `rule-validator.ts` 规则校验器
5. 实现 12 个 CRM 本体技能

## 许可证

MIT
