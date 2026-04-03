---
name: ext.baidu_search
description: 使用百度搜索 API 进行网络搜索
metadata: { "openclaw": { "emoji": "🔍", "requires": { "bins": ["python3"], "env": ["BAIDU_API_KEY"] } } }
---

# 百度搜索

通过百度搜索 API 进行网络信息检索。

## 输入参数

- query: 搜索关键词（必填）
- limit: 返回结果数量（默认 10）

## 输出结果

- success: 是否成功
- results: 搜索结果列表
  - title: 标题
  - url: 链接
  - snippet: 摘要

## 配置要求

需要在配置文件中设置 `BAIDU_API_KEY`。

## 使用示例

```json
{
  "query": "人工智能最新进展",
  "limit": 5
}
```
