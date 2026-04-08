# 清空本体数据功能实现计划

## 需求概述
在本体技能测试页面右上角新增"清空数据"按钮，点击后清空对应本体在 MongoDB、Neo4j、ChromaDB 的所有数据。

## 当前数据存储架构分析

### MongoDB
- 集合名格式: `{ontologyId}_*`，如 `crm_leads`、`crm_opportunities`、`crm_customers`、`crm_quotes`、`crm_contacts`
- 可通过集合名前缀区分不同本体的数据

### ChromaDB
- 集合名格式: `{ontologyId}_*`，如 `crm_opportunities`
- 可通过集合名前缀区分不同本体的数据

### Neo4j
- **问题**: 节点标签不带本体前缀（如 `Lead`、`Opportunity`），也没有 `ontology_id` 属性
- 当前无法区分不同本体的节点数据
- **解决方案**: 给所有 Neo4j 节点添加 `ontology_id` 属性，确保安全清空

## 实现步骤

### Step 1: 修改 Neo4j 节点属性（添加 ontology_id）
**文件**: `server/src/engine/write-plan-builder.ts`

修改 `buildNeo4jProps` 函数，在所有节点属性中添加 `ontology_id`:
```typescript
function buildNeo4jProps(obj: SnapshotObject | undefined, ontologyId: string): Record<string, any> {
  if (!obj) return { ontology_id: ontologyId };
  const props: Record<string, any> = { ontology_id: ontologyId };
  for (const attr of (obj.attributes || []).slice(0, 5)) {
    props[attr.name] = `$input.${attr.name}`;
  }
  return props;
}
```

同时修改 `buildWritePlan` 函数签名，传入 `ontologyId` 参数。

### Step 2: 修改 manifest-builder 传递 ontologyId
**文件**: `server/src/engine/manifest-builder.ts`

修改 `buildBehaviorManifest` 中调用 `buildWritePlan` 的地方:
```typescript
const writePlan = buildWritePlan(behavior, ownerObject, ontologyId);
```

### Step 3: 新增后端清空数据 API
**文件**: `server/src/routes/ontology-skills.ts`

新增端点:
```typescript
// POST /api/ontology-skills/clear-data
router.post('/clear-data', async (req, res) => {
  try {
    const { ontology_id } = req.body;
    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    // 1. MongoDB: 清空 {ontology_id}_* 集合
    // 2. ChromaDB: 清空 {ontology_id}_* 集合
    // 3. Neo4j: 删除所有 ontology_id 属性匹配的节点和关系

    res.json({ success: true, cleared: { mongodb: N, neo4j: M, chroma: P } });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
```

### Step 4: 新增数据库客户端清空方法
**文件**: `server/src/database/mongodb.ts`, `server/src/database/chroma.ts`, `server/src/database/neo4j.ts`

为每个数据库客户端添加清空方法:

**MongoDB**:
```typescript
async clearOntologyCollections(ontologyId: string): Promise<number>
```

**ChromaDB**:
```typescript
async clearOntologyCollections(ontologyId: string): Promise<number>
```

**Neo4j**:
```typescript
async clearOntologyNodes(ontologyId: string): Promise<number>
```

### Step 5: 前端添加清空数据按钮
**文件**: `app/src/pages/SkillTestPage.tsx`

在页面右上角添加清空按钮:
```tsx
<button
  onClick={handleClearData}
  className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
>
  清空数据
</button>
```

添加确认对话框和 API 调用逻辑。

### Step 6: 前端 API 客户端添加方法
**文件**: `app/src/api/client.ts`

在 `ontologySkillsApi` 中添加:
```typescript
clearData: async (ontologyId: string): Promise<{ success: boolean; cleared: any }> => {
  const res = await fetch(`${API_BASE}/ontology-skills/clear-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ontology_id: ontologyId }),
  });
  if (!res.ok) throw new Error('Failed to clear data');
  return res.json();
},
```

## 注意事项

1. **安全性**: 添加确认对话框，防止误操作
2. **数据隔离**: Neo4j 节点必须有 `ontology_id` 属性才能安全清空
3. **重新构建**: 修改 write-plan-builder 后，需要重新构建技能才能让新节点包含 `ontology_id`
4. **向后兼容**: 对于旧节点（没有 ontology_id），可以提供一个选项来清空所有节点（仅当确认只有一个本体时）

## 文件改动清单

| 文件 | 改动类型 |
|------|----------|
| `server/src/engine/write-plan-builder.ts` | 修改 - 添加 ontology_id 属性 |
| `server/src/engine/manifest-builder.ts` | 修改 - 传递 ontologyId 参数 |
| `server/src/database/mongodb.ts` | 新增 - clearOntologyCollections 方法 |
| `server/src/database/chroma.ts` | 新增 - clearOntologyCollections 方法 |
| `server/src/database/neo4j.ts` | 新增 - clearOntologyNodes 方法 |
| `server/src/routes/ontology-skills.ts` | 新增 - /clear-data 端点 |
| `app/src/api/client.ts` | 新增 - clearData 方法 |
| `app/src/pages/SkillTestPage.tsx` | 修改 - 添加清空按钮和逻辑 |