# 线索 对象说明

## 基本信息

- **代码**: Lead
- **名称**: 线索
- **描述**: 

## 属性

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | ✓ | 线索标题 |
| source | enum |  | 线索来源 |
| budget | number |  | 预算金额 |
| status | enum |  | 当前状态 |
| owner | string |  | 负责人 |
| phone | string |  | 联系电话 |
| company | string |  | 所属公司 |

## 关系

- **relatedCustomer** → Customer (many-to-one)
- **relatedContact** → Contact (many-to-one)
- **convertsToOpportunity** → Opportunity (one-to-many)

## 生命周期

[
  "新建",
  "待跟进",
  "跟进中",
  "已评估",
  "已转化",
  "已关闭"
]
