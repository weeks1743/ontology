import { db } from '../db';

/**
 * Add enhanced test data for CRM ontology
 * Based on YAML_SEMANTIC_ASSESSMENT.md recommendations
 */
export function addEnhancedTestData() {
  console.log('Adding enhanced test data for CRM ontology...');

  try {
    db.transaction(() => {
      // Get the CRM ontology ID
      const ontology = db.prepare(
        `SELECT id FROM ontologies WHERE ontology_code = 'crm'`
      ).get() as { id: number } | undefined;

      if (!ontology) {
        console.log('⚠️  CRM ontology not found, skipping test data');
        return;
      }

      const ontologyId = ontology.id;

      // ========================================================================
      // Update Lead Object with enhanced fields
      // ========================================================================
      console.log('  Updating Lead object...');

      const lifecycleEnhanced = [
        {
          state: '新建',
          allowed_transitions: ['待跟进', '已关闭'],
          required_conditions: ['Lead.RequiredInfo'],
          available_behaviors: ['Lead.Complete', 'Lead.Discard'],
          on_enter_events: [],
          on_exit_events: ['lead.created']
        },
        {
          state: '待跟进',
          allowed_transitions: ['跟进中', '已关闭'],
          required_conditions: [],
          available_behaviors: ['Lead.FollowUp', 'Lead.Discard'],
          on_enter_events: ['lead.completed'],
          on_exit_events: []
        },
        {
          state: '跟进中',
          allowed_transitions: ['已评估', '已关闭'],
          required_conditions: [],
          available_behaviors: ['Lead.Evaluate', 'Lead.Discard'],
          on_enter_events: [],
          on_exit_events: []
        },
        {
          state: '已评估',
          allowed_transitions: ['已转化', '已关闭'],
          required_conditions: ['Lead.BudgetThreshold', 'Lead.DecisionMaker'],
          available_behaviors: ['Lead.ConvertToOpportunity', 'Lead.Reject'],
          on_enter_events: ['lead.evaluated'],
          on_exit_events: []
        },
        {
          state: '已转化',
          allowed_transitions: [],
          required_conditions: [],
          available_behaviors: [],
          on_enter_events: ['lead.converted'],
          on_exit_events: []
        },
        {
          state: '已关闭',
          allowed_transitions: [],
          required_conditions: [],
          available_behaviors: [],
          on_enter_events: [],
          on_exit_events: []
        }
      ];

      db.prepare(`
        UPDATE ontology_objects
        SET
          aliases = ?,
          nl_examples = ?,
          negative_examples = ?,
          disambiguation_notes = ?,
          lifecycle_enhanced = ?
        WHERE ontology_id = ? AND code = 'Lead'
      `).run(
        JSON.stringify(['潜客', '销售线索', '意向客户']),
        JSON.stringify([
          '创建一个新线索',
          '这个潜客的预算是多少',
          '把这个销售线索转成商机',
          '线索的来源是什么'
        ]),
        JSON.stringify(['客户', '联系人']),
        '线索是尚未转化的潜在客户，与已转化的"客户"(Customer)不同',
        JSON.stringify(lifecycleEnhanced),
        ontologyId
      );

      // ========================================================================
      // Update Lead.ConvertToOpportunity Behavior with enhanced fields
      // ========================================================================
      console.log('  Updating Lead.ConvertToOpportunity behavior...');

      const inputsSchema = [
        {
          name: 'budget',
          type: 'number',
          required: true,
          description: '预算金额',
          validation: { min: 0, max: 999999999 }
        },
        {
          name: 'company',
          type: 'string',
          required: true,
          description: '公司名称',
          validation: { min_length: 2, max_length: 100 }
        },
        {
          name: 'conversion_reason',
          type: 'string',
          required: false,
          description: '转化原因'
        }
      ];

      const preconditions = [
        { rule: 'Lead.ConvertibleCheck', failure_action: 'block' },
        { rule: 'Lead.BudgetThreshold', failure_action: 'warn' }
      ];

      const resultSchema = [
        { name: 'opportunity_id', type: 'string', description: '创建的商机ID' },
        { name: 'customer_id', type: 'string', description: '创建的客户ID' },
        { name: 'contact_id', type: 'string', description: '创建的联系人ID' },
        { name: 'success', type: 'boolean', description: '是否成功' }
      ];

      const postconditions = [
        { type: 'state_change', details: { from: '已评估', to: '已转化' } },
        { type: 'event_emitted', details: { event: 'opportunity.created' } },
        { type: 'creates_object', details: { type: 'Opportunity', relation: 'converted_from' } },
        { type: 'creates_object', details: { type: 'Customer' } },
        { type: 'creates_object', details: { type: 'Contact' } }
      ];

      const sideEffects = [
        { type: 'modifies', target: 'Lead', fields: ['status', 'converted_at'] },
        { type: 'creates', target: 'Opportunity' },
        { type: 'creates', target: 'Customer' },
        { type: 'creates', target: 'Contact' }
      ];

      db.prepare(`
        UPDATE ontology_behaviors
        SET
          aliases = ?,
          nl_examples = ?,
          inputs_schema = ?,
          preconditions = ?,
          result_schema = ?,
          postconditions = ?,
          side_effects = ?
        WHERE ontology_id = ? AND code = 'Lead.ConvertToOpportunity'
      `).run(
        JSON.stringify(['转商机', '转成商机', '线索转化', '创建商机']),
        JSON.stringify([
          '把这个线索转成商机',
          '转化这个潜客',
          '创建商机',
          '线索转商机'
        ]),
        JSON.stringify(inputsSchema),
        JSON.stringify(preconditions),
        JSON.stringify(resultSchema),
        JSON.stringify(postconditions),
        JSON.stringify(sideEffects),
        ontologyId
      );

      // ========================================================================
      // Update opportunity.created Event with enhanced fields
      // ========================================================================
      console.log('  Updating opportunity.created event...');

      const payloadSchema = [
        { name: 'lead_id', type: 'string', required: true, description: '线索ID' },
        { name: 'opportunity_id', type: 'string', required: true, description: '商机ID' },
        { name: 'customer_id', type: 'string', required: true, description: '客户ID' },
        { name: 'contact_id', type: 'string', required: true, description: '联系人ID' },
        { name: 'conversion_timestamp', type: 'datetime', required: true, description: '转化时间' }
      ];

      const propagationConditions = [
        { condition: "opportunity.status == 'active'", action: 'propagate' },
        { condition: "opportunity.status == 'cancelled'", action: 'skip' }
      ];

      const tracePolicy = {
        retention_days: 90,
        include_payload: true,
        trace_upstream: true
      };

      const causality = {
        triggers_after: ['lead.completed'],
        blocks_until: [],
        triggers: ['activity.logged']
      };

      db.prepare(`
        UPDATE ontology_events
        SET
          payload_schema = ?,
          propagation_conditions = ?,
          triggered_behaviors = ?,
          trace_policy = ?,
          causality = ?
        WHERE ontology_id = ? AND code = 'opportunity.created'
      `).run(
        JSON.stringify(payloadSchema),
        JSON.stringify(propagationConditions),
        JSON.stringify(['Activity.LogFollowUp']),
        JSON.stringify(tracePolicy),
        JSON.stringify(causality),
        ontologyId
      );

      // ========================================================================
      // Update lead_to_opportunity_conversion Scenario with enhanced fields
      // ========================================================================
      console.log('  Updating lead_to_opportunity_conversion scenario...');

      const startConditions = [
        'Lead.status == "已评估"',
        'Lead.ConvertibleCheck passes',
        'User has permission to convert leads'
      ];

      const decisionPointsEnhanced = [
        {
          step: 1,
          rule: 'Lead.ConvertibleCheck',
          description: '检查线索是否满足转化条件',
          if_true_path: '继续转化流程',
          if_false_path: '阻止转化并提示用户'
        }
      ];

      const rollbackCompensation = [
        {
          trigger: 'on_failure',
          actions: ['回滚已创建的对象', '恢复线索状态', '记录失败日志'],
          description: '如果转化过程中任何步骤失败，回滚所有已创建的对象'
        }
      ];

      const observabilityMetrics = [
        'conversion_duration_ms',
        'conversion_success_rate',
        'conversion_failure_reasons'
      ];

      db.prepare(`
        UPDATE ontology_scenarios
        SET
          start_conditions = ?,
          decision_points_enhanced = ?,
          rollback_compensation = ?,
          observability_metrics = ?
        WHERE ontology_id = ? AND code = 'lead_to_opportunity_conversion'
      `).run(
        JSON.stringify(startConditions),
        JSON.stringify(decisionPointsEnhanced),
        JSON.stringify(rollbackCompensation),
        JSON.stringify(observabilityMetrics),
        ontologyId
      );

      // ========================================================================
      // Update Lead.BudgetThreshold Rule with enhanced fields
      // ========================================================================
      console.log('  Updating Lead.BudgetThreshold rule...');

      const expressionStructured = {
        type: 'logical_or',
        operands: [
          {
            type: 'comparison',
            left: 'lead.budget',
            operator: '>=',
            right: 10000
          },
          {
            type: 'is_null',
            field: 'lead.budget'
          }
        ]
      };

      db.prepare(`
        UPDATE ontology_rules
        SET
          input_context = ?,
          expression_structured = ?,
          next_actions = ?,
          failure_message_template = ?,
          constraint_type = ?
        WHERE ontology_id = ? AND code = 'Lead.BudgetThreshold'
      `).run(
        JSON.stringify(['lead.budget']),
        JSON.stringify(expressionStructured),
        JSON.stringify(['重新评估预算', '申请特殊审批', '联系客户确认预算']),
        '预算 {lead.budget} 元低于最低要求 {threshold} 元',
        'hard',
        ontologyId
      );

      console.log('✅ Enhanced test data added successfully');
    })();
  } catch (error) {
    console.error('❌ Failed to add test data:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  addEnhancedTestData();
}
