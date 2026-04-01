import { Router } from 'express';
import { db } from '../db';

const router = Router({ mergeParams: true });

// POST /api/ontologies/:id/seed
router.post('/', (req: any, res: any) => {
  const ontologyId = Number(req.params.id);

  // Check if already seeded
  const countRow = db.prepare(
    `SELECT COUNT(*) as count FROM ontology_objects WHERE ontology_id=?`
  ).get(ontologyId) as { count: number };

  if (countRow.count > 0) {
    res.json({ seeded: false, message: 'Already has data' });
    return;
  }

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
          { name: 'title', type: 'string', required: true, description: '线索标题' },
          { name: 'source', type: 'enum', enum_values: ['官网', '展会', '推荐', '广告', '电话'], description: '线索来源' },
          { name: 'budget', type: 'number', description: '预算金额' },
          { name: 'status', type: 'enum', enum_values: ['新建', '待跟进', '跟进中', '已评估', '已转化', '已关闭'], description: '当前状态' },
          { name: 'owner', type: 'string', description: '负责人' },
          { name: 'phone', type: 'string', description: '联系电话' },
          { name: 'company', type: 'string', description: '所属公司' },
        ]),
        JSON.stringify([])
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
          { name: 'name', type: 'string', required: true },
          { name: 'amount', type: 'number', description: '预计金额' },
          { name: 'probability', type: 'number', description: '赢单概率%' },
          { name: 'closeDate', type: 'date', description: '预计关闭日期' },
          { name: 'stage', type: 'enum', enum_values: ['识别', '初步接触', '需求分析', '方案提案', '报价谈判', '赢单', '输单'] },
          { name: 'owner', type: 'string' },
        ]),
        JSON.stringify([
          { name: 'fromLead', target_object: 'Lead', type: 'many-to-one', description: '来源线索' },
          { name: 'hasQuotes', target_object: 'Quote', type: 'one-to-many', description: '关联报价' },
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
          { name: 'quoteNo', type: 'string', required: true, description: '报价单号' },
          { name: 'amount', type: 'number', required: true, description: '报价总金额' },
          { name: 'validDays', type: 'number', description: '有效天数' },
          { name: 'status', type: 'enum', enum_values: ['草稿', '待审批', '已批准', '已拒绝', '已发送', '已成交', '已失效'] },
          { name: 'discount', type: 'number', description: '折扣率%' },
        ]),
        JSON.stringify([
          { name: 'fromOpportunity', target_object: 'Opportunity', type: 'many-to-one', description: '来源商机' },
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
          { name: 'customerName', type: 'string', required: true, description: '客户名称' },
          { name: 'industry', type: 'string', description: '所属行业' },
          { name: 'region', type: 'string', description: '所属区域' },
          { name: 'customerLevel', type: 'enum', enum_values: ['A', 'B', 'C', 'D'], description: '客户级别' },
          { name: 'ownerSales', type: 'string', description: '负责销售' },
        ]),
        JSON.stringify([])
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
          { name: 'name', type: 'string', required: true },
          { name: 'phone', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'role', type: 'string', description: '职位角色' },
        ]),
        JSON.stringify([
          { name: 'belongsTo', target_object: 'Customer', type: 'many-to-one', description: '所属客户' },
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'USER_ACTION',
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
        'SYSTEM_OR_MANAGER_ACTION',
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
    })();

    res.json({ seeded: true, message: 'CRM sample data seeded successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
