# Chat UI (CopilotKit MVP)

## 目标

实现对话层最小闭环：

1. 上传 `.m4a` 录音
2. 卡片显示 `queued/analyzing`
3. 分析成功后点击进入 `meeting-viewer` 详情页

## 环境变量

推荐在 `chat/tongyi-agent/.env` 写入：

```bash
DASHSCOPE_API_KEY=你的DashScopeApiKey
TINGWU_APP_ID=你的通义听悟AppId
```

服务启动时会自动读取 `chat/tongyi-agent/.env`（也支持 `chat/.env`）。

也可以像以前一样在启动前手动设置：

```bash
export DASHSCOPE_API_KEY="你的 DashScope API Key"
export TINGWU_APP_ID="你的通义听悟 AppId"
```

## 启动

1. 启动后端（提供上传、任务查询、详情 API）

```bash
cd /Users/weeks/Desktop/workspaces-yzj/ontology/chat
python3 meeting-viewer/server.py
```

2. 启动前端

```bash
cd /Users/weeks/Desktop/workspaces-yzj/ontology/chat/chat-ui
npm install
npm run dev
```

默认前端地址：`http://127.0.0.1:5175`
