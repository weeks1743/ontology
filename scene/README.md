# Scene Layer - 场景配置层

## 概述

Scene Layer 是一个可视化配置系统，用于管理行业特定的业务场景和内容模板。通过简化的架构和直观的 UI，无需编写 YAML 即可配置场景。

## 架构

### 后端 (Express + SQLite)

**数据模型（6张表）：**
- `scene_ontologies` - 本体定义
- `scene_industries` - 行业模板（IT、生物医药、食品饮料）
- `scene_scenarios` - 业务场景（如：售前拜访PPT生成）
- `scene_content_sections` - 内容章节（带提示词模板）
- `scene_skill_bindings` - 技能绑定（输入/输出映射）
- `scene_test_cases` - 测试用例（模拟数据）

**API 端点：**
```
GET    /api/ontologies
POST   /api/ontologies
GET    /api/ontologies/:id/industries
GET    /api/industries/:id/scenarios
GET    /api/scenarios/:id/sections
GET    /api/sections/:id/bindings
GET    /api/scenarios/:id/test-cases
POST   /api/test-cases/:id/run
```

### 前端 (React 19 + Zustand + Tailwind)

**页面结构：**
- `SceneListPage` - 本体列表
- `SceneWorkspacePage` - 三栏布局工作区
  - 左侧：导航标签
  - 中间：主内容区
  - 右侧：详情面板（可选）

**6个工作视图：**
1. 📊 Dashboard - 概览统计
2. 🏭 Industries - 行业模板配置
3. 🎯 Scenarios - 场景配置
4. 🧩 Sections - 内容章节配置
5. 🔗 Bindings - 技能绑定可视化
6. 🧪 Test Cases - 测试用例执行

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
- 前端: http://localhost:5176
- 后端: http://localhost:3003

### 构建生产版本
```bash
npm run build
```

### 运行测试
```bash
npm test
```

## 预配置的行业模板

### 1. 信息技术 (IT) 💻
- **颜色**: #3B82F6 (蓝色)
- **场景**: 售前拜访PPT生成
- **章节**:
  - 客户基本情况
  - 信息化现状分析
  - 信息化产出
  - 信息化建议
- **技能绑定**: 企业研究、拜访记录分析

### 2. 生物医药 (Biology) 🧬
- **颜色**: #10B981 (绿色)
- **场景**: 售前拜访PPT生成
- **章节**:
  - 客户基本情况
  - 产品组合分析
  - 临床需求分析
  - 解决方案建议

### 3. 食品饮料 (Food) 🍜
- **颜色**: #F59E0B (琥珀色)
- **场景**: 售前拜访PPT生成
- **章节**:
  - 客户基本情况
  - 供应链现状
  - 品控体系
  - 市场策略建议

## 使用流程

1. **选择行业** → 查看行业模板和品牌配色
2. **选择场景** → 查看业务场景配置
3. **配置章节** → 编辑提示词模板和示例内容
4. **查看绑定** → 了解技能如何映射到章节
5. **运行测试** → 使用模拟数据验证配置

## 技术栈

- **后端**: Express.js, better-sqlite3, TypeScript
- **前端**: React 19, Zustand, Tailwind CSS v4, Vite
- **开发**: tsx, concurrently, TypeScript

## 数据库位置

开发环境: `server/data/scene.db`

## API 测试示例

```bash
# 创建本体
curl -X POST http://localhost:3003/api/ontologies \
  -H "Content-Type: application/json" \
  -d '{"ontology_id":"crm","ontology_name":"CRM客户关系管理"}'

# 获取行业列表
curl http://localhost:3003/api/ontologies/crm/industries | jq

# 获取场景列表
curl http://localhost:3003/api/industries/1/scenarios | jq

# 运行测试用例
curl -X POST http://localhost:3003/api/test-cases/1/run | jq
```

## 设计理念

- **可视化优先**: 无需编写 YAML，通过 UI 配置
- **AI 原生**: 深色主题，适合 AI 辅助开发
- **行业特定**: 每个行业有独特的品牌色和图标
- **层次化**: Industry → Scenario → Section → Binding
- **模拟数据**: 内置测试用例，快速验证配置

## 与其他层的集成

- **Ability Layer**: 通过 skill_id 引用外部技能
- **Ontology Layer**: 通过 ontology_id 关联本体定义
- **Portal Layer**: 提供场景配置的可视化界面

## 故障排除

### 样式未加载
确保 Tailwind CSS 已正确安装：
```bash
npm install -D tailwindcss @tailwindcss/postcss autoprefixer
```

### 端口冲突
修改 `vite.config.ts` 中的端口或 `server/src/index.ts` 中的 PORT 变量

### 数据库锁定
删除 `server/data/scene.db-wal` 和 `server/data/scene.db-shm` 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

## License

MIT
