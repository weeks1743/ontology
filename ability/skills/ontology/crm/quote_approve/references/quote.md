# 报价 对象说明

## 基本信息

- **代码**: Quote
- **名称**: 报价
- **描述**: 

## 属性

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| quoteNo | string | ✓ | 报价单号 |
| amount | number | ✓ | 报价总金额 |
| validDays | number |  | 有效天数 |
| status | enum |  |  |
| discount | number |  | 折扣率% |

## 关系

- **fromOpportunity** → Opportunity (many-to-one)
- **forCustomer** → Customer (many-to-one)
- **primaryContact** → Contact (many-to-one)

## 生命周期

[
  "草稿",
  "待审批",
  "已批准",
  "已拒绝",
  "已发送",
  "已成交",
  "已失效"
]
