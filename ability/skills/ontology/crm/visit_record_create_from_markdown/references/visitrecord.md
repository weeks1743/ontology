# 拜访记录 对象说明

## 基本信息

- **代码**: VisitRecord
- **名称**: 拜访记录
- **描述**: 客户互动时间线对象，用于沉淀销售复盘、会议纪要和上传的 Markdown 沟通记录

## 属性

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | ✓ | 拜访记录标题 |
| customer_id | string | ✓ | 关联客户ID |
| sequence_no | number | ✓ | 同一客户的拜访轮次 |
| visit_type | enum | ✓ | 拜访记录来源类型 |
| content_markdown | string | ✓ | 非结构化沟通内容 |
| visit_at | date | ✓ | 拜访发生时间 |
| source_channel | string |  | 上传、销售复盘、纪要等 |
| summary | string |  | 拜访记录摘要 |
| key_signals | array |  | 抽取出的结构化信号 |
| sentiment | enum |  | 拜访中的客户情绪倾向 |
| status | enum |  | 记录分析状态 |

## 关系

- **belongsToCustomer** → Customer (many-to-one)

## 生命周期

[
  "已记录",
  "已分析"
]
