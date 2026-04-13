# AI原生CRM 对话层重大迭代升级说明

## 概述

本次迭代将 CRM 对话层从「上传录音后展示分析卡片的 MVP」升级为「围绕单次业务任务持续推进的 AI 原生 CRM 会话系统」。

升级后的目标不是单点问答，而是围绕真实业务任务完成以下链路：

- 上传录音
- 自动识别为客户拜访任务
- 追问客户名称
- 调用已有录音分析能力
- 调用公司研究能力
- 写入客户、拜访记录、联系人、商机等真实业务数据
- 触发场景增强，输出结构化信息化评估
- 生成并推送 PPTX 产物
- 支持修正发言人、同步画像、更新图谱

## 本次升级重点

### 1. 主会话框架升级

- 新增 `chat/server` TypeScript 服务，采用 `LangGraph.js + SQLite checkpointer`
- 将对话过程重构为可恢复的状态图，而不是简单的接口分发
- 保留 `meeting-viewer` 作为录音详情页与发言人修正页

### 2. 对话任务编排升级

每个会话围绕一条业务任务推进，核心节点包括：

- 录音分析
- 客户名称澄清
- 公司研究
- 拜访记录与客户入库
- 拜访记录分析
- 信息化评估生成
- 公司分析 PPT 生成
- 信息化评估 PPT 生成
- 发言人修正与联系人画像同步
- 商机信息确认与保存

### 3. 能力层增强

在不新增 skill id 的前提下，增强现有能力：

- `ont.crm.visit_record_create_from_markdown`
  - 支持客户 upsert
  - 支持拜访记录写入 MongoDB + Neo4j
  - 支持 `contacts_only` 模式同步联系人
- `ont.crm.visit_record_analyze`
  - 输出更丰富的结构化分析字段
- `ont.crm.opportunity_create`
  - 支持保存客户关联商机与产品备注
- `pptx`
  - 继续复用能力层现有 skill
  - 公司分析报告与信息化评估报告均按 `task prompt` 方式调用

### 4. 场景层增强

- `IT_ASSESSMENT` 场景从 mock 配置升级为真实运行时入口
- 当前职责：
  - 基于录音分析结果生成 `信息化评估.md`
  - 为后续 `pptx` skill 提供可消费输入
- 已明确解耦：
  - `公司分析报告` 仅依赖公司研究 markdown
  - `信息化评估报告` 仅依赖录音分析结果与听悟输出

### 5. 交互层重设计

本次交互层遵循以下原则：

- 删除未实现的入口，避免假功能误导
- 向豆包式布局靠拢，提高内容区空间利用率
- 将“助手列表、搜索、快捷按钮”等无真实能力支撑的元素移除
- 强化消息即状态的交互方式

目前已经引入的卡片类型：

- 录音分析卡
- 澄清问题卡
- 任务状态卡
- 产物卡
- 联系人画像卡
- 客户图谱卡

## 产物策略调整

### 公司分析报告

- 由 `company-research-pm` 生成研究 markdown
- 再通过现有 `pptx` skill 生成 `XXX公司分析报告.pptx`
- 设计目标参考能力层 `EXT009`

### 信息化评估报告

- 基于听悟转写、章节摘要、行动项、拜访分析结果生成 `信息化评估.md`
- 再通过现有 `pptx` skill 生成 `XXX信息化评估报告.pptx`
- 当前已经明确不再耦合公司研究内容

## 本次交付中的关键修复

- 修复录音文件名乱码显示
- 修复发言人修正回调未正确对应业务任务的问题
- 修复新录音继承旧任务别名映射的问题
- 修复对话滚动条强制到底部的问题
- 修复图谱过于技术化的问题，改为企业画像 + 人物画像 + 人物关系展示
- 修复输入区与内容区宽度不一致的问题
- 修复若干老任务因中间节点失败无法继续推进的问题

## 已验证能力

已完成或验证通过的内容：

- `chat/server` 构建通过
- `chat/chat-ui` 构建通过
- `scene` 构建通过
- `ability/server` 构建通过
- 客户、联系人、商机可真实写入 MongoDB / Neo4j
- `cleanup-customer` dry-run 能返回真实待清理范围
- `IT_ASSESSMENT` 能生成 `信息化评估.md`
- `pptx` 可输出公司分析报告与信息化评估报告

## 已知限制

- `pptx` skill 仍依赖模型生成可执行代码，虽然已增加重试与提示，但在极端情况下仍可能失败
- 一些历史任务是在旧状态机版本下创建的，可能需要手工补状态或重跑任务
- 联系人画像目前仍依赖详情页修正发言人后回推

## 建议使用方式

- 新任务建议在升级后的版本上重新新建会话并上传录音
- 若旧任务中断，可优先查看任务状态卡和产物卡，再决定是否重跑
- 若出现录音分析、公司研究、PPT 生成等阶段失败，应优先依据任务状态卡定位失败节点

## 相关核心文件

- `chat/server/src/index.ts`
- `chat/server/src/graph.ts`
- `chat/server/src/db.ts`
- `chat/chat-ui/src/pages/ChatWorkspace.tsx`
- `chat/chat-ui/src/index.css`
- `chat/meeting-viewer/app.js`
- `chat/meeting-viewer/server.py`
- `scene/server/src/runtime.ts`
- `ability/server/src/engine/operating-advice.ts`
- `ability/server/src/skill-core/executor.ts`
