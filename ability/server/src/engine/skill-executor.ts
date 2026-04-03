// 技能执行引擎 - 执行本体技能和外部技能

import { nanoid } from 'nanoid';
import { getOntologyDefinition, OntologyBehavior, OntologyRule } from './ontology-client.js';
import { ruleValidator } from './rule-validator.js';
import { mongoClient, neo4jClient, chromaClient } from '../database/index.js';
import { executeExternalSkill } from './external-skills.js';
import { ExecutionResult } from '../types.js';

export class SkillExecutor {
  private ontologyCache: Map<string, any> = new Map();

  // 执行技能
  async execute(skillId: string, params: any): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 判断是本体技能还是外部技能
      if (skillId.startsWith('ext.')) {
        return await this.executeExternal(skillId, params, startTime);
      }

      // 本体技能路由
      if (skillId === 'ont.create_lead') {
        return await this.executeCreateLead(params, startTime);
      } else if (skillId === 'ont.complete_lead') {
        return await this.executeCompleteLead(params, startTime);
      } else if (skillId === 'ont.evaluate_lead') {
        return await this.executeEvaluateLead(params, startTime);
      } else if (skillId === 'ont.convert_lead') {
        return await this.executeConvertLead(params, startTime);
      } else if (skillId === 'ont.create_opportunity') {
        return await this.executeCreateOpportunity(params, startTime);
      } else if (skillId === 'ont.advance_opportunity') {
        return await this.executeAdvanceOpportunity(params, startTime);
      } else if (skillId === 'ont.create_quote') {
        return await this.executeCreateQuote(params, startTime);
      } else if (skillId === 'ont.submit_quote') {
        return await this.executeSubmitQuote(params, startTime);
      } else if (skillId === 'ont.approve_quote') {
        return await this.executeApproveQuote(params, startTime);
      } else if (skillId === 'ont.graph_trace') {
        return await this.executeGraphTrace(params, startTime);
      } else if (skillId === 'ont.semantic_search') {
        return await this.executeSemanticSearch(params, startTime);
      } else {
        throw new Error(`Unknown skill: ${skillId}`);
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  // 执行外部技能
  private async executeExternal(skillId: string, params: any, startTime: number): Promise<ExecutionResult> {
    try {
      const result = await executeExternalSkill(skillId, params);

      return {
        success: result.success || false,
        data: result,
        error: result.error,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  // 创建线索
  private async executeCreateLead(params: any, startTime: number): Promise<ExecutionResult> {
    // 规则校验：Lead.RequiredInfo (title + phone 必填)
    const validation = ruleValidator.validateRequiredFields(params, ['title', 'phone']);
    if (!validation.passed) {
      return {
        success: false,
        error: validation.failedRules.map(r => r.message).join('; '),
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const leadId = nanoid();
    const leadData = {
      id: leadId,
      title: params.title,
      phone: params.phone,
      source: params.source || '',
      owner: params.owner || '',
      status: 'new',
    };

    // 写入 MongoDB
    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    if (mongoClient.isOnline()) {
      const result = await mongoClient.insertLead(leadData);
      mongoStatus = result ? 'ok' : 'error';
    }

    // 写入 Neo4j
    let neo4jStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    if (neo4jClient.isOnline()) {
      const result = await neo4jClient.createLeadNode(leadId, leadData);
      neo4jStatus = result ? 'ok' : 'error';
    }

    return {
      success: true,
      data: { lead_id: leadId, ...leadData },
      mongodb_status: mongoStatus,
      neo4j_status: neo4jStatus,
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 补全线索信息
  private async executeCompleteLead(params: any, startTime: number): Promise<ExecutionResult> {
    const { lead_id, budget, requirements } = params;

    if (!lead_id) {
      return {
        success: false,
        error: '缺少 lead_id 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    // 规则校验：Lead.BudgetCheck (budget >= 10000)
    if (budget && budget < 10000) {
      return {
        success: false,
        error: '预算不足：线索预算必须 >= 1万元',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const updateData = {
      budget: budget || 0,
      requirements: requirements || '',
      status: 'qualified',
    };

    // 更新 MongoDB
    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    if (mongoClient.isOnline()) {
      const result = await mongoClient.updateDocument('crm_leads', lead_id, updateData);
      mongoStatus = result ? 'ok' : 'error';
    }

    return {
      success: true,
      data: { lead_id, ...updateData },
      mongodb_status: mongoStatus,
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 评估线索
  private async executeEvaluateLead(params: any, startTime: number): Promise<ExecutionResult> {
    const { lead_id, score, priority } = params;

    if (!lead_id) {
      return {
        success: false,
        error: '缺少 lead_id 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const updateData = {
      score: score || 0,
      priority: priority || 'medium',
      status: 'evaluated',
    };

    // 更新 MongoDB
    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    if (mongoClient.isOnline()) {
      const result = await mongoClient.updateDocument('crm_leads', lead_id, updateData);
      mongoStatus = result ? 'ok' : 'error';
    }

    return {
      success: true,
      data: { lead_id, ...updateData },
      mongodb_status: mongoStatus,
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 线索转商机（复杂副作用：创建客户、联系人、商机）
  private async executeConvertLead(params: any, startTime: number): Promise<ExecutionResult> {
    const { lead_id, customer_name, contact_name, contact_phone, opportunity_title, amount } = params;

    if (!lead_id || !customer_name || !contact_name || !opportunity_title) {
      return {
        success: false,
        error: '缺少必填参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const customerId = nanoid();
    const contactId = nanoid();
    const opportunityId = nanoid();

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let neo4jStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let chromaStatus: 'ok' | 'error' | 'skipped' = 'skipped';

    // 1. 创建客户
    if (mongoClient.isOnline()) {
      await mongoClient.insertCustomer({ id: customerId, name: customer_name });
      mongoStatus = 'ok';
    }
    if (neo4jClient.isOnline()) {
      await neo4jClient.createCustomerNode(customerId, { name: customer_name });
      neo4jStatus = 'ok';
    }

    // 2. 创建联系人
    if (mongoClient.isOnline()) {
      await mongoClient.insertContact({ id: contactId, name: contact_name, phone: contact_phone });
    }
    if (neo4jClient.isOnline()) {
      await neo4jClient.createContactNode(contactId, { name: contact_name, phone: contact_phone });
      // 创建关系：Contact -> Customer
      await neo4jClient.createRelationship(contactId, 'Contact', customerId, 'Customer', 'WORKS_FOR');
    }

    // 3. 创建商机
    if (mongoClient.isOnline()) {
      await mongoClient.insertOpportunity({
        id: opportunityId,
        title: opportunity_title,
        amount: amount || 0,
        stage: 'qualification',
        customer_id: customerId,
      });
    }
    if (neo4jClient.isOnline()) {
      await neo4jClient.createOpportunityNode(opportunityId, {
        title: opportunity_title,
        amount: amount || 0,
        stage: 'qualification',
      });
      // 创建关系：Opportunity -> Customer
      await neo4jClient.createRelationship(opportunityId, 'Opportunity', customerId, 'Customer', 'BELONGS_TO_CUSTOMER');
      // 创建关系：Lead -> Opportunity
      await neo4jClient.createRelationship(lead_id, 'Lead', opportunityId, 'Opportunity', 'CONVERTED_TO');
    }

    // 4. 标记向量化（异步处理）
    if (chromaClient.isOnline()) {
      chromaStatus = 'ok'; // 标记为待处理
    }

    // 5. 更新线索状态
    if (mongoClient.isOnline()) {
      await mongoClient.updateDocument('crm_leads', lead_id, { status: 'converted' });
    }

    return {
      success: true,
      data: {
        lead_id,
        customer_id: customerId,
        contact_id: contactId,
        opportunity_id: opportunityId,
      },
      mongodb_status: mongoStatus,
      neo4j_status: neo4jStatus,
      chroma_status: chromaStatus,
      duration_ms: Date.now() - startTime,
    };
  }

  // 创建商机
  private async executeCreateOpportunity(params: any, startTime: number): Promise<ExecutionResult> {
    const { title, amount, probability, customer_id } = params;

    // 规则校验：Opportunity.ProbabilityRange (0 <= probability <= 100)
    if (probability !== undefined && (probability < 0 || probability > 100)) {
      return {
        success: false,
        error: '概率越界：商机概率必须在 0-100 之间',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const opportunityId = nanoid();
    const opportunityData = {
      id: opportunityId,
      title: title || '',
      amount: amount || 0,
      probability: probability || 50,
      stage: 'qualification',
      customer_id: customer_id || '',
    };

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let neo4jStatus: 'ok' | 'error' | 'skipped' = 'skipped';

    if (mongoClient.isOnline()) {
      const result = await mongoClient.insertOpportunity(opportunityData);
      mongoStatus = result ? 'ok' : 'error';
    }

    if (neo4jClient.isOnline()) {
      const result = await neo4jClient.createOpportunityNode(opportunityId, opportunityData);
      neo4jStatus = result ? 'ok' : 'error';

      if (customer_id && result) {
        await neo4jClient.createRelationship(opportunityId, 'Opportunity', customer_id, 'Customer', 'BELONGS_TO_CUSTOMER');
      }
    }

    return {
      success: true,
      data: { opportunity_id: opportunityId, ...opportunityData },
      mongodb_status: mongoStatus,
      neo4j_status: neo4jStatus,
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 推进商机阶段
  private async executeAdvanceOpportunity(params: any, startTime: number): Promise<ExecutionResult> {
    const { opportunity_id, stage, probability } = params;

    if (!opportunity_id) {
      return {
        success: false,
        error: '缺少 opportunity_id 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const updateData = {
      stage: stage || 'proposal',
      probability: probability || 70,
    };

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    if (mongoClient.isOnline()) {
      const result = await mongoClient.updateDocument('crm_opportunities', opportunity_id, updateData);
      mongoStatus = result ? 'ok' : 'error';
    }

    return {
      success: true,
      data: { opportunity_id, ...updateData },
      mongodb_status: mongoStatus,
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 创建报价单
  private async executeCreateQuote(params: any, startTime: number): Promise<ExecutionResult> {
    const { opportunity_id, amount, items } = params;

    if (!opportunity_id) {
      return {
        success: false,
        error: '缺少 opportunity_id 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    // 规则校验：Quote.ApprovalRequired (amount > 500000 需要审批)
    const needsApproval = amount > 500000;
    if (needsApproval) {
      return {
        success: false,
        error: '超额报价须审批：报价金额 > 50万需要提交审批',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const quoteId = nanoid();
    const quoteData = {
      id: quoteId,
      opportunity_id,
      amount: amount || 0,
      items: items || [],
      status: 'draft',
    };

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let neo4jStatus: 'ok' | 'error' | 'skipped' = 'skipped';

    if (mongoClient.isOnline()) {
      const result = await mongoClient.insertQuote(quoteData);
      mongoStatus = result ? 'ok' : 'error';
    }

    if (neo4jClient.isOnline()) {
      const result = await neo4jClient.createQuoteNode(quoteId, quoteData);
      neo4jStatus = result ? 'ok' : 'error';

      if (result) {
        await neo4jClient.createRelationship(opportunity_id, 'Opportunity', quoteId, 'Quote', 'HAS_QUOTE');
      }
    }

    return {
      success: true,
      data: { quote_id: quoteId, ...quoteData },
      mongodb_status: mongoStatus,
      neo4j_status: neo4jStatus,
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 提交审批
  private async executeSubmitQuote(params: any, startTime: number): Promise<ExecutionResult> {
    const { quote_id } = params;

    if (!quote_id) {
      return {
        success: false,
        error: '缺少 quote_id 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    const updateData = { status: 'pending_approval' };

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    if (mongoClient.isOnline()) {
      const result = await mongoClient.updateDocument('crm_quotes', quote_id, updateData);
      mongoStatus = result ? 'ok' : 'error';
    }

    return {
      success: true,
      data: { quote_id, ...updateData },
      mongodb_status: mongoStatus,
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 审批通过
  private async executeApproveQuote(params: any, startTime: number): Promise<ExecutionResult> {
    const { quote_id, opportunity_id } = params;

    if (!quote_id || !opportunity_id) {
      return {
        success: false,
        error: '缺少必填参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    let mongoStatus: 'ok' | 'error' | 'skipped' = 'skipped';

    // 更新报价单状态
    if (mongoClient.isOnline()) {
      await mongoClient.updateDocument('crm_quotes', quote_id, { status: 'approved' });
      // 更新商机状态为赢单
      await mongoClient.updateDocument('crm_opportunities', opportunity_id, { stage: 'won' });
      mongoStatus = 'ok';
    }

    return {
      success: true,
      data: { quote_id, opportunity_id, status: 'approved', opportunity_stage: 'won' },
      mongodb_status: mongoStatus,
      neo4j_status: 'skipped',
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 图链路溯源
  private async executeGraphTrace(params: any, startTime: number): Promise<ExecutionResult> {
    const { opportunity_id } = params;

    if (!opportunity_id) {
      return {
        success: false,
        error: '缺少 opportunity_id 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    let neo4jStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let pathData = null;

    if (neo4jClient.isOnline()) {
      pathData = await neo4jClient.getFullSalesPath(opportunity_id);
      neo4jStatus = pathData ? 'ok' : 'error';
    }

    return {
      success: neo4jStatus === 'ok',
      data: { opportunity_id, path: pathData },
      mongodb_status: 'skipped',
      neo4j_status: neo4jStatus,
      chroma_status: 'skipped',
      duration_ms: Date.now() - startTime,
    };
  }

  // 语义相似搜索
  private async executeSemanticSearch(params: any, startTime: number): Promise<ExecutionResult> {
    const { query, limit = 5 } = params;

    if (!query) {
      return {
        success: false,
        error: '缺少 query 参数',
        mongodb_status: 'skipped',
        neo4j_status: 'skipped',
        chroma_status: 'skipped',
        duration_ms: Date.now() - startTime,
      };
    }

    let chromaStatus: 'ok' | 'error' | 'skipped' = 'skipped';
    let results = null;

    if (chromaClient.isOnline()) {
      results = await chromaClient.searchSimilarOpportunities(query, limit);
      chromaStatus = results ? 'ok' : 'error';
    }

    return {
      success: chromaStatus === 'ok',
      data: { query, results },
      mongodb_status: 'skipped',
      neo4j_status: 'skipped',
      chroma_status: chromaStatus,
      duration_ms: Date.now() - startTime,
    };
  }
}

// 单例实例
export const skillExecutor = new SkillExecutor();
