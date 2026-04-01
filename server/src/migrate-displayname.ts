import { db } from './db';

// 按对象 code 分别定义属性中文名映射
const OBJECT_ATTRIBUTE_TRANSLATIONS: Record<string, Record<string, string>> = {
  Lead: {
    title: '线索标题',
    source: '线索来源',
    budget: '预算金额',
    status: '当前状态',
    owner: '负责人',
    phone: '联系电话',
    company: '所属公司',
  },
  Opportunity: {
    name: '商机名称',
    amount: '预计金额',
    probability: '赢单概率%',
    closeDate: '预计关闭日期',
    stage: '阶段',
    owner: '负责人',
  },
  Quote: {
    quoteNo: '报价单号',
    amount: '报价总金额',
    validDays: '有效天数',
    status: '状态',
    discount: '折扣率%',
  },
  Customer: {
    customerName: '客户名称',
    industry: '所属行业',
    region: '所属区域',
    customerLevel: '客户级别',
    ownerSales: '负责销售',
  },
  Contact: {
    name: '姓名',
    phone: '电话',
    email: '邮箱',
    role: '职位角色',
  },
};

function migrateDisplayNames() {
  console.log('开始迁移 displayName 字段...\n');

  const objects = db.prepare('SELECT id, code, name, attributes, relations_detail FROM ontology_objects').all() as Array<{
    id: number;
    code: string;
    name: string;
    attributes: string;
    relations_detail: string;
  }>;

  let updatedCount = 0;

  for (const obj of objects) {
    let attributes = JSON.parse(obj.attributes);
    const relations = JSON.parse(obj.relations_detail);
    let hasChanges = false;

    const attrMap = OBJECT_ATTRIBUTE_TRANSLATIONS[obj.code] ?? {};

    // 处理属性：只补填缺失的 displayName
    attributes = attributes.map((attr: any) => {
      if (!attr.displayName && attrMap[attr.name]) {
        console.log(`  [${obj.name}] 属性 ${attr.name} -> ${attrMap[attr.name]}`);
        hasChanges = true;
        return { ...attr, displayName: attrMap[attr.name] };
      }
      return attr;
    });

    if (hasChanges) {
      db.prepare(`
        UPDATE ontology_objects
        SET attributes = ?, relations_detail = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(attributes), JSON.stringify(relations), obj.id);
      updatedCount++;
    }
  }

  console.log(`\n迁移完成！共更新 ${updatedCount} 个对象。`);
}

try {
  migrateDisplayNames();
} catch (error) {
  console.error('迁移失败:', error);
  process.exit(1);
}
