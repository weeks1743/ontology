// write-plan-builder.ts
// 基于对象默认写库策略推导 write_plan DSL

import { WritePlan, MongoWriteOp, Neo4jWriteOp, ChromaWriteOp } from '../types/manifest.js';
import { SnapshotBehavior, SnapshotObject } from '../types/snapshot.js';

// CRM 对象默认写库策略
const CHROMA_OBJECTS = new Set(['Opportunity']);

// Derive the collection name from object code
function mongoCollection(objectCode: string): string {
  return `crm_${objectCode.toLowerCase()}s`;
}

function behaviorOperation(behaviorCode: string): string {
  const code = behaviorCode.toLowerCase();
  if (code.includes('create') || code.includes('insert') || code.includes('add')) return 'create';
  if (code.includes('convert')) return 'convert';
  if (code.includes('update') || code.includes('complete') || code.includes('evaluate') ||
      code.includes('advance') || code.includes('submit') || code.includes('approve')) return 'update';
  return 'update';
}

export function buildWritePlan(
  behavior: SnapshotBehavior,
  ownerObject: SnapshotObject | undefined,
  ontologyId: string
): WritePlan {
  const op = behaviorOperation(behavior.code);
  const objectCode = behavior.owner_object;
  const collection = mongoCollection(objectCode);
  const needsChroma = CHROMA_OBJECTS.has(objectCode);

  const mongoOps: MongoWriteOp[] = [];
  const neo4jOps: Neo4jWriteOp[] = [];
  const chromaOps: ChromaWriteOp[] = [];

  if (op === 'create') {
    mongoOps.push({
      op: 'insert',
      collection,
      alias: `${objectCode.toLowerCase()}_id`,
      document: buildDocumentTemplate(ownerObject, behavior),
    });

    neo4jOps.push({
      op: 'upsert_node',
      label: objectCode,
      id_field: `${objectCode.toLowerCase()}_id`,
      alias: `${objectCode.toLowerCase()}_node`,
      properties: { id: `$result.${objectCode.toLowerCase()}_id`, ...buildNeo4jProps(ownerObject, ontologyId) },
    });

    if (needsChroma) {
      chromaOps.push({
        op: 'upsert',
        collection: `crm_${objectCode.toLowerCase()}s`,
        id: `$result.${objectCode.toLowerCase()}_id`,
        document: buildChromaDocument(ownerObject),
        metadata: { object_type: objectCode },
      });
    }
  } else if (op === 'convert') {
    // Convert: create multiple objects from one behavior
    // Lead.ConvertToOpportunity pattern
    const targets = behavior.writeback_targets.length > 0
      ? behavior.writeback_targets
      : ['Customer', 'Contact', 'Opportunity'];

    for (const target of targets) {
      const targetCollection = mongoCollection(target);
      mongoOps.push({
        op: 'insert',
        collection: targetCollection,
        alias: `${target.toLowerCase()}_id`,
        document: { id: `$result.${target.toLowerCase()}_id` },
      });

      neo4jOps.push({
        op: 'upsert_node',
        label: target,
        id_field: `${target.toLowerCase()}_id`,
        properties: { id: `$result.${target.toLowerCase()}_id`, ontology_id: ontologyId },
      });
    }

    // Relationship edges for conversion
    neo4jOps.push({
      op: 'upsert_edge',
      from_label: objectCode,
      from_id: `$input.${objectCode.toLowerCase()}_id`,
      to_label: 'Opportunity',
      to_id: `$result.opportunity_id`,
      relationship: 'CONVERTED_TO',
    });

    if (targets.includes('Contact') && targets.includes('Customer')) {
      neo4jOps.push({
        op: 'upsert_edge',
        from_label: 'Contact',
        from_id: `$result.contact_id`,
        to_label: 'Customer',
        to_id: `$result.customer_id`,
        relationship: 'WORKS_FOR',
      });
    }

    if (targets.includes('Customer') && targets.includes('Opportunity')) {
      neo4jOps.push({
        op: 'upsert_edge',
        from_label: 'Opportunity',
        from_id: `$result.opportunity_id`,
        to_label: 'Customer',
        to_id: `$result.customer_id`,
        relationship: 'BELONGS_TO_CUSTOMER',
      });
    }

    if (CHROMA_OBJECTS.has('Opportunity')) {
      chromaOps.push({
        op: 'upsert',
        collection: 'crm_opportunities',
        id: `$result.opportunity_id`,
        document: `$result.opportunity_title`,
        metadata: { object_type: 'Opportunity', source: 'converted' },
      });
    }
  } else {
    // Update
    mongoOps.push({
      op: 'update',
      collection,
      filter: { id: `$input.${objectCode.toLowerCase()}_id` },
      update: buildUpdateTemplate(ownerObject, behavior),
    });

    if (needsChroma) {
      chromaOps.push({
        op: 'upsert',
        collection: `crm_${objectCode.toLowerCase()}s`,
        id: `$input.${objectCode.toLowerCase()}_id`,
        metadata: { object_type: objectCode, updated: true },
      });
    }
  }

  return {
    mongodb: { required: true, ops: mongoOps },
    neo4j: { required: true, ops: neo4jOps },
    chroma: { required: false, ops: chromaOps },
  };
}

function buildDocumentTemplate(obj: SnapshotObject | undefined, behavior: SnapshotBehavior): Record<string, any> {
  const doc: Record<string, any> = { id: '$result.generated_id' };

  if (!obj) return doc;

  const inputs = behavior.inputs_schema || [];
  for (const input of inputs) {
    doc[input.name] = `$input.${input.name}`;
  }

  return doc;
}

function buildNeo4jProps(obj: SnapshotObject | undefined, ontologyId: string): Record<string, any> {
  const props: Record<string, any> = { ontology_id: ontologyId };
  if (!obj) return props;
  for (const attr of (obj.attributes || []).slice(0, 5)) {
    props[attr.name] = `$input.${attr.name}`;
  }
  return props;
}

function buildUpdateTemplate(obj: SnapshotObject | undefined, behavior: SnapshotBehavior): Record<string, any> {
  const update: Record<string, any> = {};
  const inputs = behavior.inputs_schema || [];
  for (const input of inputs) {
    if (input.name !== `${behavior.owner_object.toLowerCase()}_id`) {
      update[input.name] = `$input.${input.name}`;
    }
  }
  return update;
}

function buildChromaDocument(obj: SnapshotObject | undefined): string {
  if (!obj) return '$input.title';
  const nameAttr = obj.attributes?.find(a => a.name === 'title' || a.name === 'name');
  return nameAttr ? `$input.${nameAttr.name}` : '$input.title';
}
