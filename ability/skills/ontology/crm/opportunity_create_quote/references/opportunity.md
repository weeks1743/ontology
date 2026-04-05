# 商机 对象说明

## 基本信息

- **代码**: Opportunity
- **名称**: 商机
- **描述**: 

## 属性

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | ✓ |  |
| amount | number |  | 预计金额 |
| probability | number |  | 赢单概率% |
| closeDate | date |  | 预计关闭日期 |
| stage | enum |  |  |
| owner | string |  |  |

## 关系

- **belongsToCustomer** → Customer (many-to-one)
- **primaryContact** → Contact (many-to-one)
- **fromLead** → Lead (many-to-one)
- **hasQuotes** → Quote (one-to-many)

## 生命周期

[
  "识别",
  "初步接触",
  "需求分析",
  "方案提案",
  "报价谈判",
  "赢单",
  "输单"
]
