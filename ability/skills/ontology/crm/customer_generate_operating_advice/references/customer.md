# 客户 对象说明

## 基本信息

- **代码**: Customer
- **名称**: 客户
- **描述**: 

## 属性

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| customerName | string | ✓ | 客户名称 |
| industry | string |  | 所属行业 |
| region | string |  | 所属区域 |
| customerLevel | enum |  | 客户级别 |
| ownerSales | string |  | 负责销售 |

## 关系

- **hasContacts** → Contact (one-to-many)
- **hasOpportunities** → Opportunity (one-to-many)
- **fromLeads** → Lead (one-to-many)
- **hasVisitRecords** → VisitRecord (one-to-many)

## 生命周期

[
  "潜在",
  "活跃",
  "观察中",
  "冻结"
]
