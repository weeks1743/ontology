import { Router } from 'express';
import { db } from '../db';

const router = Router({ mergeParams: true });

// POST /api/ontologies/:id/seed
router.post('/', (req: any, res: any) => {
  const ontologyId = Number(req.params.id);

  const countRow = db.prepare(
    `SELECT COUNT(*) as count FROM ontology_objects WHERE ontology_id=?`
  ).get(ontologyId) as { count: number };
  const hadExistingData = countRow.count > 0;

  try {
    db.transaction(() => {
      // ─── OBJECTS ────────────────────────────────────────────────────────────

      // 1. Lead (线索)
      db.prepare(
        `INSERT OR IGNORE INTO ontology_objects
         (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead',
        '线索',
        '',
        JSON.stringify(['新建', '待跟进', '跟进中', '已评估', '已转化', '已关闭']),
        JSON.stringify([
          { name: 'title', displayName: '线索标题', type: 'string', required: true, description: '线索标题' },
          { name: 'source', displayName: '线索来源', type: 'enum', enum_values: ['官网', '展会', '推荐', '广告', '电话'], description: '线索来源' },
          { name: 'budget', displayName: '预算金额', type: 'number', description: '预算金额' },
          { name: 'status', displayName: '当前状态', type: 'enum', enum_values: ['新建', '待跟进', '跟进中', '已评估', '已转化', '已关闭'], description: '当前状态' },
          { name: 'owner', displayName: '负责人', type: 'string', description: '负责人' },
          { name: 'phone', displayName: '联系电话', type: 'string', description: '联系电话' },
          { name: 'company', displayName: '所属公司', type: 'string', description: '所属公司' },
        ]),
        JSON.stringify([
          { name: 'relatedCustomer', displayName: '关联客户', target_object: 'Customer', type: 'many-to-one', description: '关联的已有客户' },
          { name: 'relatedContact', displayName: '关联联系人', target_object: 'Contact', type: 'many-to-one', description: '关联的已有联系人' },
          { name: 'convertsToOpportunity', displayName: '转化为商机', target_object: 'Opportunity', type: 'one-to-many', description: '转化生成的商机' },
        ])
      );

      // 2. Opportunity (商机)
      db.prepare(
        `INSERT OR IGNORE INTO ontology_objects
         (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Opportunity',
        '商机',
        '',
        JSON.stringify(['识别', '初步接触', '需求分析', '方案提案', '报价谈判', '赢单', '输单']),
        JSON.stringify([
          { name: 'name', displayName: '商机名称', type: 'string', required: true },
          { name: 'amount', displayName: '预计金额', type: 'number', description: '预计金额' },
          { name: 'probability', displayName: '赢单概率%', type: 'number', description: '赢单概率%' },
          { name: 'closeDate', displayName: '预计关闭日期', type: 'date', description: '预计关闭日期' },
          { name: 'stage', displayName: '阶段', type: 'enum', enum_values: ['识别', '初步接触', '需求分析', '方案提案', '报价谈判', '赢单', '输单'] },
          { name: 'owner', displayName: '负责人', type: 'string' },
        ]),
        JSON.stringify([
          { name: 'belongsToCustomer', displayName: '所属客户', target_object: 'Customer', type: 'many-to-one', description: '所属客户' },
          { name: 'primaryContact', displayName: '主要联系人', target_object: 'Contact', type: 'many-to-one', description: '主要联系人' },
          { name: 'fromLead', displayName: '来源线索', target_object: 'Lead', type: 'many-to-one', description: '来源线索' },
          { name: 'hasQuotes', displayName: '报价', target_object: 'Quote', type: 'one-to-many', description: '关联报价' },
        ])
      );

      // 3. Quote (报价)
      db.prepare(
        `INSERT OR IGNORE INTO ontology_objects
         (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Quote',
        '报价',
        '',
        JSON.stringify(['草稿', '待审批', '已批准', '已拒绝', '已发送', '已成交', '已失效']),
        JSON.stringify([
          { name: 'quoteNo', displayName: '报价单号', type: 'string', required: true, description: '报价单号' },
          { name: 'amount', displayName: '报价总金额', type: 'number', required: true, description: '报价总金额' },
          { name: 'validDays', displayName: '有效天数', type: 'number', description: '有效天数' },
          { name: 'status', displayName: '状态', type: 'enum', enum_values: ['草稿', '待审批', '已批准', '已拒绝', '已发送', '已成交', '已失效'] },
          { name: 'discount', displayName: '折扣率%', type: 'number', description: '折扣率%' },
        ]),
        JSON.stringify([
          { name: 'fromOpportunity', displayName: '来源商机', target_object: 'Opportunity', type: 'many-to-one', description: '来源商机' },
          { name: 'forCustomer', displayName: '客户', target_object: 'Customer', type: 'many-to-one', description: '报价客户' },
          { name: 'primaryContact', displayName: '联系人', target_object: 'Contact', type: 'many-to-one', description: '主要联系人' },
        ])
      );

      // 4. Customer (客户)
      db.prepare(
        `INSERT OR IGNORE INTO ontology_objects
         (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Customer',
        '客户',
        '',
        JSON.stringify(['潜在', '活跃', '观察中', '冻结']),
        JSON.stringify([
          { name: 'customerName', displayName: '客户名称', type: 'string', required: true, description: '客户名称' },
          { name: 'industry', displayName: '所属行业', type: 'string', description: '所属行业' },
          { name: 'region', displayName: '所属区域', type: 'string', description: '所属区域' },
          { name: 'customerLevel', displayName: '客户级别', type: 'enum', enum_values: ['A', 'B', 'C', 'D'], description: '客户级别' },
          { name: 'ownerSales', displayName: '负责销售', type: 'string', description: '负责销售' },
        ]),
        JSON.stringify([
          { name: 'hasContacts', displayName: '联系人', target_object: 'Contact', type: 'one-to-many', description: '客户的联系人' },
          { name: 'hasOpportunities', displayName: '商机', target_object: 'Opportunity', type: 'one-to-many', description: '客户的商机' },
          { name: 'fromLeads', displayName: '来源线索', target_object: 'Lead', type: 'one-to-many', description: '转化来源的线索' },
        ])
      );

      // 5. Contact (联系人)
      db.prepare(
        `INSERT OR IGNORE INTO ontology_objects
         (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Contact',
        '联系人',
        '',
        JSON.stringify(['活跃', '非活跃']),
        JSON.stringify([
          { name: 'name', displayName: '姓名', type: 'string', required: true },
          { name: 'phone', displayName: '电话', type: 'string' },
          { name: 'email', displayName: '邮箱', type: 'string' },
          { name: 'role', displayName: '职位角色', type: 'string', description: '职位角色' },
        ]),
        JSON.stringify([
          { name: 'belongsToCustomer', displayName: '所属客户', target_object: 'Customer', type: 'many-to-one', description: '所属客户' },
          { name: 'relatedOpportunities', displayName: '相关商机', target_object: 'Opportunity', type: 'one-to-many', description: '相关的商机' },
          { name: 'fromLeads', displayName: '来源线索', target_object: 'Lead', type: 'one-to-many', description: '关联的线索' },
        ])
      );

      // ─── RULES ──────────────────────────────────────────────────────────────

      // 1. Lead.RequiredInfo
      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead.RequiredInfo',
        '线索必填信息校验',
        'validation',
        JSON.stringify(['Lead']),
        JSON.stringify([]),
        'lead.title != null && lead.phone != null',
        '线索标题和联系电话为必填项',
        'high'
      );

      // 2. Lead.BudgetThreshold
      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead.BudgetThreshold',
        '线索预算门槛',
        'constraint',
        JSON.stringify(['Lead']),
        JSON.stringify([]),
        'lead.budget >= 10000 || lead.budget == null',
        '预算低于最低门槛1万元',
        'medium'
      );

      // 3. Opportunity.ProbabilityRange
      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Opportunity.ProbabilityRange',
        '商机赢单概率范围',
        'validation',
        JSON.stringify(['Opportunity']),
        JSON.stringify([]),
        'opportunity.probability >= 0 && opportunity.probability <= 100',
        '赢单概率必须在0-100之间',
        'medium'
      );

      // 4. Quote.AmountApproval
      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Quote.AmountApproval',
        '报价超额审批规则',
        'constraint',
        JSON.stringify(['Quote']),
        JSON.stringify([]),
        'quote.amount <= 500000 || quote.approvedBy != null',
        '报价超过50万需要审批通过',
        'critical'
      );

      // ─── BEHAVIORS (emits_events left empty, updated after events) ──────────

      // 1. Lead.Create
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead.Create',
        '创建线索',
        'Lead',
        'TRANSACTIONAL',
        JSON.stringify(['title', 'source', 'phone']),
        JSON.stringify(['Lead.RequiredInfo']),
        JSON.stringify([]),
        JSON.stringify(['Lead'])
      );

      // 2. Lead.Complete
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead.Complete',
        '补全线索信息',
        'Lead',
        'TRANSACTIONAL',
        JSON.stringify(['budget', 'company']),
        JSON.stringify(['Lead.RequiredInfo', 'Lead.BudgetThreshold']),
        JSON.stringify([]),
        JSON.stringify(['Lead'])
      );

      // 3. Lead.Evaluate
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead.Evaluate',
        '评估线索',
        'Lead',
        'TRANSACTIONAL',
        JSON.stringify(['budget', 'company']),
        JSON.stringify(['Lead.BudgetThreshold']),
        JSON.stringify([]),
        JSON.stringify(['Lead'])
      );

      // 4. Lead.ConvertToOpportunity
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Lead.ConvertToOpportunity',
        '转化为商机',
        'Lead',
        'TRANSACTIONAL',
        JSON.stringify(['opportunityName', 'amount']),
        JSON.stringify(['Lead.RequiredInfo', 'Lead.BudgetThreshold']),
        JSON.stringify([]),
        JSON.stringify(['Lead', 'Opportunity'])
      );

      // 5. Opportunity.Create
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Opportunity.Create',
        '创建商机',
        'Opportunity',
        'TRANSACTIONAL',
        JSON.stringify(['name', 'amount', 'closeDate']),
        JSON.stringify(['Opportunity.ProbabilityRange']),
        JSON.stringify([]),
        JSON.stringify(['Opportunity'])
      );

      // 6. Opportunity.Advance
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Opportunity.Advance',
        '推进商机',
        'Opportunity',
        'TRANSACTIONAL',
        JSON.stringify(['stage', 'probability']),
        JSON.stringify(['Opportunity.ProbabilityRange']),
        JSON.stringify([]),
        JSON.stringify(['Opportunity'])
      );

      // 7. Opportunity.CreateQuote
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Opportunity.CreateQuote',
        '创建报价单',
        'Opportunity',
        'TRANSACTIONAL',
        JSON.stringify(['quoteNo', 'amount']),
        JSON.stringify(['Quote.AmountApproval']),
        JSON.stringify([]),
        JSON.stringify(['Quote'])
      );

      // 8. Quote.Create
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Quote.Create',
        '创建报价',
        'Quote',
        'TRANSACTIONAL',
        JSON.stringify(['quoteNo', 'amount', 'validDays']),
        JSON.stringify(['Quote.AmountApproval']),
        JSON.stringify([]),
        JSON.stringify(['Quote'])
      );

      // 9. Quote.Submit
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Quote.Submit',
        '提交审批',
        'Quote',
        'TRANSACTIONAL',
        JSON.stringify(['approverId']),
        JSON.stringify(['Quote.AmountApproval']),
        JSON.stringify([]),
        JSON.stringify(['Quote'])
      );

      // 10. Quote.Approve
      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Quote.Approve',
        '审批通过',
        'Quote',
        'TRANSACTIONAL',
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(['Quote', 'Opportunity'])
      );

      // ─── EVENTS ─────────────────────────────────────────────────────────────

      // 1. lead.created
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'lead.created',
        '线索已创建',
        'Lead',
        'Lead.Create',
        JSON.stringify(['Lead.Complete']),
        JSON.stringify(['Lead'])
      );

      // 2. lead.completed
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'lead.completed',
        '线索已补全',
        'Lead',
        'Lead.Complete',
        JSON.stringify(['Lead.Evaluate']),
        JSON.stringify(['Lead'])
      );

      // 3. lead.evaluated
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'lead.evaluated',
        '线索已评估',
        'Lead',
        'Lead.Evaluate',
        JSON.stringify(['Lead.ConvertToOpportunity']),
        JSON.stringify(['Lead'])
      );

      // 4. lead.converted
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'lead.converted',
        '线索已转化',
        'Lead',
        'Lead.ConvertToOpportunity',
        JSON.stringify(['Opportunity.Create']),
        JSON.stringify(['Lead', 'Opportunity'])
      );

      // 5. opportunity.created
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'opportunity.created',
        '商机已创建',
        'Opportunity',
        'Opportunity.Create',
        JSON.stringify(['Opportunity.Advance']),
        JSON.stringify(['Opportunity'])
      );

      // 6. opportunity.advanced
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'opportunity.advanced',
        '商机已推进',
        'Opportunity',
        'Opportunity.Advance',
        JSON.stringify(['Opportunity.CreateQuote']),
        JSON.stringify(['Opportunity'])
      );

      // 7. opportunity.won
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'opportunity.won',
        '商机已赢单',
        'Opportunity',
        'Opportunity.CreateQuote',
        JSON.stringify(['Quote.Create']),
        JSON.stringify(['Opportunity', 'Quote'])
      );

      // 8. quote.created
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'quote.created',
        '报价单已创建',
        'Quote',
        'Quote.Create',
        JSON.stringify(['Quote.Submit']),
        JSON.stringify(['Quote'])
      );

      // 9. quote.submitted
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'quote.submitted',
        '报价已提交审批',
        'Quote',
        'Quote.Submit',
        JSON.stringify(['Quote.Approve']),
        JSON.stringify(['Quote'])
      );

      // 10. quote.approved
      db.prepare(
        `INSERT OR IGNORE INTO ontology_events
         (ontology_id, code, name, producer_object, producer_behavior, subscribers, impacted_objects)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'quote.approved',
        '报价已批准',
        'Quote',
        'Quote.Approve',
        JSON.stringify([]),
        JSON.stringify(['Quote', 'Opportunity'])
      );

      // ─── UPDATE BEHAVIORS: add emits_events references ───────────────────────

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['lead.created']), ontologyId, 'Lead.Create');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['lead.completed']), ontologyId, 'Lead.Complete');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['lead.evaluated']), ontologyId, 'Lead.Evaluate');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['lead.converted']), ontologyId, 'Lead.ConvertToOpportunity');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['opportunity.created']), ontologyId, 'Opportunity.Create');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['opportunity.advanced']), ontologyId, 'Opportunity.Advance');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['opportunity.won']), ontologyId, 'Opportunity.CreateQuote');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['quote.created']), ontologyId, 'Quote.Create');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['quote.submitted']), ontologyId, 'Quote.Submit');

      db.prepare(
        `UPDATE ontology_behaviors SET emits_events=? WHERE ontology_id=? AND code=?`
      ).run(JSON.stringify(['quote.approved']), ontologyId, 'Quote.Approve');

      // ─── SCENARIOS ───────────────────────────────────────────────────────────

      // 1. lead_entry_completion
      db.prepare(
        `INSERT OR IGNORE INTO ontology_scenarios
         (ontology_id, code, name, business_goal, involved_objects, steps, success_criteria)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'lead_entry_completion',
        '线索录入与补全',
        '完成线索的完整信息录入，为后续转化做准备',
        JSON.stringify(['Lead']),
        JSON.stringify([
          { step: 1, behavior: 'Lead.Create' },
          { step: 2, event: 'lead.created' },
          { step: 3, behavior: 'Lead.Complete' },
          { step: 4, event: 'lead.completed' },
        ]),
        JSON.stringify(['线索信息完整度≥80%', '线索状态变更为已补全'])
      );

      // 2. lead_to_opportunity
      db.prepare(
        `INSERT OR IGNORE INTO ontology_scenarios
         (ontology_id, code, name, business_goal, involved_objects, steps, success_criteria)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'lead_to_opportunity',
        '线索转商机',
        '将符合条件的线索转化为销售商机',
        JSON.stringify(['Lead', 'Opportunity']),
        JSON.stringify([
          { step: 1, behavior: 'Lead.Evaluate' },
          { step: 2, event: 'lead.evaluated' },
          { step: 3, behavior: 'Lead.ConvertToOpportunity' },
          { step: 4, event: 'lead.converted' },
          { step: 5, behavior: 'Opportunity.Create' },
          { step: 6, event: 'opportunity.created' },
        ]),
        JSON.stringify(['线索转化率>30%', '商机金额>0'])
      );

      // 3. opportunity_to_quote
      db.prepare(
        `INSERT OR IGNORE INTO ontology_scenarios
         (ontology_id, code, name, business_goal, involved_objects, steps, success_criteria)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'opportunity_to_quote',
        '商机到报价',
        '推进商机至报价阶段，完成报价单审批',
        JSON.stringify(['Opportunity', 'Quote']),
        JSON.stringify([
          { step: 1, behavior: 'Opportunity.Advance' },
          { step: 2, event: 'opportunity.advanced' },
          { step: 3, behavior: 'Opportunity.CreateQuote' },
          { step: 4, event: 'opportunity.won' },
          { step: 5, behavior: 'Quote.Create' },
          { step: 6, event: 'quote.created' },
          { step: 7, behavior: 'Quote.Submit' },
          { step: 8, event: 'quote.submitted' },
          { step: 9, behavior: 'Quote.Approve' },
          { step: 10, event: 'quote.approved' },
        ]),
        JSON.stringify(['报价审批完成', '商机状态更新为赢单'])
      );

      // ─── VISIT-DRIVEN ADVICE MVP ───────────────────────────────────────────

      db.prepare(
        `INSERT OR IGNORE INTO ontology_objects
         (ontology_id, code, name, description, lifecycle, attributes, relations_detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'VisitRecord',
        '拜访记录',
        '客户互动时间线对象，用于沉淀销售复盘、会议纪要和上传的 Markdown 沟通记录',
        JSON.stringify(['已记录', '已分析']),
        JSON.stringify([
          { name: 'title', displayName: '记录标题', type: 'string', required: true, description: '拜访记录标题' },
          { name: 'customer_id', displayName: '客户ID', type: 'string', required: true, description: '关联客户ID' },
          { name: 'sequence_no', displayName: '轮次', type: 'number', required: true, description: '同一客户的拜访轮次' },
          { name: 'visit_type', displayName: '拜访类型', type: 'enum', required: true, enum_values: ['sales_review', 'meeting_note', 'uploaded_markdown'], description: '拜访记录来源类型' },
          { name: 'content_markdown', displayName: 'Markdown内容', type: 'string', required: true, description: '非结构化沟通内容' },
          { name: 'visit_at', displayName: '拜访时间', type: 'date', required: true, description: '拜访发生时间' },
          { name: 'source_channel', displayName: '来源渠道', type: 'string', description: '上传、销售复盘、纪要等' },
          { name: 'summary', displayName: '摘要', type: 'string', description: '拜访记录摘要' },
          { name: 'key_signals', displayName: '关键经营信号', type: 'array', description: '抽取出的结构化信号' },
          { name: 'sentiment', displayName: '客户态度', type: 'enum', enum_values: ['积极', '中性', '谨慎', '消极'], description: '拜访中的客户情绪倾向' },
          { name: 'status', displayName: '状态', type: 'enum', enum_values: ['已记录', '已分析'], description: '记录分析状态' },
        ]),
        JSON.stringify([
          { name: 'belongsToCustomer', displayName: '所属客户', target_object: 'Customer', type: 'many-to-one', description: '该记录关联的客户' },
        ])
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'VisitRecord.ContentRequired',
        '拜访记录内容必填',
        'validation',
        JSON.stringify(['VisitRecord']),
        JSON.stringify(['VisitRecord.CreateFromMarkdown']),
        'visitRecord.content_markdown != null && visitRecord.content_markdown != ""',
        '拜访记录内容不能为空',
        'high'
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'VisitRecord.SequenceConsistent',
        '拜访记录顺序可排序',
        'validation',
        JSON.stringify(['VisitRecord']),
        JSON.stringify(['VisitRecord.CreateFromMarkdown', 'Customer.GenerateOperatingAdvice']),
        'visitRecord.sequence_no >= 1',
        '拜访记录轮次必须从 1 开始且可排序',
        'medium'
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Customer.AdviceNeedsVisitRecord',
        '客户经营建议需要拜访记录',
        'validation',
        JSON.stringify(['Customer']),
        JSON.stringify(['Customer.GenerateOperatingAdvice']),
        'customer.visit_record_ids != null && customer.visit_record_ids.length > 0',
        '生成客户经营建议前，至少需要一份拜访记录',
        'high'
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_rules
         (ontology_id, code, name, type, applicable_objects, applicable_behaviors, expression, failure_message, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Customer.AdviceMaxWindow',
        '客户经营建议最多取最近三条',
        'constraint',
        JSON.stringify(['Customer']),
        JSON.stringify(['Customer.GenerateOperatingAdvice']),
        'customer.visit_record_ids == null || customer.visit_record_ids.length <= 3',
        'MVP 阶段客户经营建议最多使用最近 3 条拜访记录',
        'low'
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'VisitRecord.CreateFromMarkdown',
        '上传拜访记录',
        'VisitRecord',
        'TRANSACTIONAL',
        JSON.stringify(['customer_id', 'customer_name', 'title', 'sequence_no', 'visit_type', 'content_markdown', 'visit_at']),
        JSON.stringify(['VisitRecord.ContentRequired', 'VisitRecord.SequenceConsistent']),
        JSON.stringify([]),
        JSON.stringify(['VisitRecord', 'Customer'])
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'VisitRecord.Analyze',
        '分析拜访记录',
        'VisitRecord',
        'PERCEPTIVE',
        JSON.stringify(['visit_record_id']),
        JSON.stringify(['VisitRecord.ContentRequired']),
        JSON.stringify([]),
        JSON.stringify(['VisitRecord'])
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_behaviors
         (ontology_id, code, name, owner_object, trigger_type, required_inputs, referenced_rules, emits_events, writeback_targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'Customer.GenerateOperatingAdvice',
        '生成客户经营建议',
        'Customer',
        'PERCEPTIVE',
        JSON.stringify(['customer_id', 'visit_record_ids', 'advice_round']),
        JSON.stringify(['Customer.AdviceNeedsVisitRecord', 'Customer.AdviceMaxWindow']),
        JSON.stringify([]),
        JSON.stringify([])
      );

      db.prepare(
        `INSERT OR IGNORE INTO ontology_scenarios
         (ontology_id, code, name, business_goal, involved_objects, steps, success_criteria)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ontologyId,
        'customer_visit_to_advice',
        '客户拜访到经营建议',
        '基于同一客户持续上传的拜访记录，逐轮生成并更新客户经营建议',
        JSON.stringify(['Customer', 'VisitRecord']),
        JSON.stringify([
          { step: 1, behavior: 'VisitRecord.CreateFromMarkdown' },
          { step: 2, behavior: 'VisitRecord.Analyze' },
          { step: 3, behavior: 'Customer.GenerateOperatingAdvice' },
        ]),
        JSON.stringify(['拜访记录完成分析', '客户经营建议 Markdown 生成成功', '客户经营建议 HTML 生成成功或返回降级结果'])
      );

      const customerRow = db.prepare(
        `SELECT relations_detail FROM ontology_objects WHERE ontology_id=? AND code='Customer'`
      ).get(ontologyId) as { relations_detail: string } | undefined;

      if (customerRow) {
        const relations = JSON.parse(customerRow.relations_detail || '[]') as Array<Record<string, any>>;
        const withoutAdviceArtifacts = relations.filter(rel => rel.name !== 'hasOperatingAdviceArtifacts');
        if (!withoutAdviceArtifacts.some(rel => rel.name === 'hasVisitRecords')) {
          withoutAdviceArtifacts.push(
            { name: 'hasVisitRecords', displayName: '拜访记录', target_object: 'VisitRecord', type: 'one-to-many', description: '客户的拜访记录时间线' },
          );
          db.prepare(
            `UPDATE ontology_objects SET relations_detail=?, updated_at=CURRENT_TIMESTAMP WHERE ontology_id=? AND code='Customer'`
          ).run(JSON.stringify(withoutAdviceArtifacts), ontologyId);
        } else if (withoutAdviceArtifacts.length !== relations.length) {
          db.prepare(
            `UPDATE ontology_objects SET relations_detail=?, updated_at=CURRENT_TIMESTAMP WHERE ontology_id=? AND code='Customer'`
          ).run(JSON.stringify(withoutAdviceArtifacts), ontologyId);
        }
      }

      db.prepare(
        `UPDATE ontology_behaviors
         SET description=?, inputs_schema=?, result_schema=?, side_effects=?, updated_at=CURRENT_TIMESTAMP
         WHERE ontology_id=? AND code='VisitRecord.CreateFromMarkdown'`
      ).run(
        '为客户上传一份 Markdown 格式的拜访记录，并纳入客户互动时间线',
        JSON.stringify([
          { name: 'customer_id', type: 'string', required: true, description: '客户ID' },
          { name: 'customer_name', type: 'string', required: true, description: '客户名称' },
          { name: 'title', type: 'string', required: true, description: '拜访记录标题' },
          { name: 'sequence_no', type: 'number', required: true, description: '拜访轮次' },
          { name: 'visit_type', type: 'string', required: true, description: '拜访类型' },
          { name: 'content_markdown', type: 'string', required: true, description: 'Markdown 记录内容' },
          { name: 'visit_at', type: 'date', required: true, description: '拜访时间' },
          { name: 'source_channel', type: 'string', required: false, description: '来源渠道' },
          { name: 'industry', type: 'string', required: false, description: '客户行业' },
          { name: 'region', type: 'string', required: false, description: '客户区域' },
        ]),
        JSON.stringify([
          { name: 'visit_record_id', type: 'string', description: '创建的拜访记录ID' },
          { name: 'customer_id', type: 'string', description: '客户ID' },
          { name: 'success', type: 'boolean', description: '是否创建成功' },
        ]),
        JSON.stringify([
          { type: 'creates', target: 'VisitRecord' },
          { type: 'modifies', target: 'Customer', fields: ['visit_record_ids'] },
        ]),
        ontologyId
      );

      db.prepare(
        `UPDATE ontology_behaviors
         SET description=?, inputs_schema=?, result_schema=?, side_effects=?, updated_at=CURRENT_TIMESTAMP
         WHERE ontology_id=? AND code='VisitRecord.Analyze'`
      ).run(
        '提炼拜访记录中的客户态度、异议、承诺与风险信号，形成结构化摘要',
        JSON.stringify([
          { name: 'visit_record_id', type: 'string', required: true, description: '待分析的拜访记录ID' },
        ]),
        JSON.stringify([
          { name: 'summary', type: 'string', description: '拜访摘要' },
          { name: 'key_signals', type: 'array', description: '经营信号列表' },
          { name: 'sentiment', type: 'string', description: '客户态度判断' },
        ]),
        JSON.stringify([
          { type: 'modifies', target: 'VisitRecord', fields: ['summary', 'key_signals', 'sentiment', 'status'] },
        ]),
        ontologyId
      );

      db.prepare(
        `UPDATE ontology_behaviors
         SET description=?, inputs_schema=?, result_schema=?, side_effects=?, updated_at=CURRENT_TIMESTAMP
         WHERE ontology_id=? AND code='Customer.GenerateOperatingAdvice'`
      ).run(
        '基于同一客户最近三轮拜访记录，生成当前轮次的客户经营建议与产物',
        JSON.stringify([
          { name: 'customer_id', type: 'string', required: true, description: '客户ID' },
          { name: 'visit_record_ids', type: 'array', required: true, description: '参与本轮建议生成的拜访记录ID列表' },
          { name: 'advice_round', type: 'number', required: true, description: '当前建议轮次' },
        ]),
        JSON.stringify([
          { name: 'round_no', type: 'number', description: '建议轮次' },
          { name: 'current_assessment', type: 'string', description: '当前判断' },
          { name: 'recommended_actions', type: 'array', description: '建议动作列表' },
          { name: 'evidence_summary', type: 'string', description: '证据摘要' },
          { name: 'change_since_last_round', type: 'string', description: '相较上一轮变化' },
          { name: 'advice_markdown_path', type: 'string', description: 'Markdown 路径' },
          { name: 'advice_html_path', type: 'string', description: 'HTML 路径' },
        ]),
        JSON.stringify([
          { type: 'modifies', target: 'Customer', fields: ['latest_operating_advice_round'] },
        ]),
        ontologyId
      );
    })();

    res.json({
      seeded: !hadExistingData,
      updated: hadExistingData,
      message: hadExistingData
        ? 'CRM sample data enriched successfully'
        : 'CRM sample data seeded successfully',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
