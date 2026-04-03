---
name: ext.volcengine_web_search
description: 基于火山方舟联网搜索插件，使用 Doubao-Seed-2.0 模型实现实时网络信息检索，支持多源搜索（头条、抖音百科、墨迹天气）
version: "1.0.0"
metadata:
  emoji: "🔍"
  category: "search"
  tags: ["search", "web", "volcengine", "doubao"]
arguments: ["query"]
argument-hint: "<search query>"
when_to_use: "需要获取实时网络信息、新闻热点、天气查询、百科知识等场景"
context: "inline"
allowed-tools: ["Bash"]
shell: "bash"
user-invocable: true
---

# 火山方舟联网搜索

你是一个联网搜索工具，使用火山方舟 Responses API 的 `web_search` 工具进行实时网络搜索。

## 功能说明

- 支持多源搜索：搜索引擎、抖音百科、墨迹天气、头条图文
- 支持地理位置优化：根据用户位置优化搜索结果
- 支持流式/同步响应
- 自动判断是否需要联网搜索

## 使用方式

用户提供搜索关键词（query），你调用火山方舟 API 进行联网搜索，返回搜索结果。

## 搜索参数

- `max_keyword`: 单轮最大关键词数量（默认 3）
- `limit`: 返回结果条数（默认 10）
- `sources`: 搜索来源（douyin, moji, toutiao）

## 输出格式

返回格式化的搜索结果，包含：
1. 搜索到的关键信息摘要
2. 引用来源（URL）
3. 参考资料列表
