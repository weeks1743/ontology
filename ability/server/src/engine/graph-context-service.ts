/**
 * Graph Context Service — 聚合 MongoDB + Neo4j + ChromaDB 构建完整客户上下文
 * 从 operating-advice.ts 提取，供感知型技能（拜访记录分析、经营建议生成）复用
 */

import { mongoClient } from '../database/index.js';
import { neo4jClient } from '../database/neo4j.js';
import { chromaClient } from '../database/chroma.js';

// ============================
// Core: Build Customer Context
// ============================

export interface CustomerContext {
  customer: any;
  visitRecords: any[];
  contacts: any[];
  opportunities: any[];
  needs: any[];
  risks: any[];
  commitments: any[];
  leads: any[];
  quotes: any[];
  salesRep: any | null;
  graphContextText: string;
  graphData: any[];
  semanticContext: any[];
}

/**
 * Build comprehensive customer context from MongoDB, Neo4j, and ChromaDB.
 */
export async function buildCustomerContext(customerId: string, ontologyId: string): Promise<CustomerContext> {
  const customerCollection = `${ontologyId}_customers`;
  const customer = await mongoClient.findOne(customerCollection, { id: customerId });
  if (!customer) throw new Error(`Customer not found: ${customerId}`);

  // Get visit records
  const visitCollection = `${ontologyId}_visit_records`;
  const visitRecords = await mongoClient.findMany(visitCollection, { customer_id: customerId }, { sort: { sequence_no: 1 }, limit: 10 });

  // Get contacts
  const contactCollection = `${ontologyId}_contacts`;
  const contacts = await mongoClient.findMany(contactCollection, { customer_id: customerId });

  // Get opportunities
  const opportunityCollection = `${ontologyId}_opportunities`;
  const opportunities = await mongoClient.findMany(opportunityCollection, { customer_id: customerId });

  // Get needs, risks, commitments
  const needs = await mongoClient.findMany(`${ontologyId}_needs`, { customer_id: customerId });
  const risks = await mongoClient.findMany(`${ontologyId}_risks`, { customer_id: customerId });
  const commitments = await mongoClient.findMany(`${ontologyId}_commitments`, { customer_id: customerId });

  // Get leads
  const leads = await mongoClient.findMany(`${ontologyId}_leads`, { customer_id: customerId });

  // Get quotes
  const quotes = await mongoClient.findMany(`${ontologyId}_quotes`, { customer_id: customerId });

  // Get sales rep info
  const salesRep = customer.owner_sales_id
    ? await mongoClient.findOne(`${ontologyId}_sales_reps`, { id: customer.owner_sales_id })
    : null;

  // Neo4j full graph neighborhood
  let graphContextText = '';
  let graphData: any[] = [];
  try {
    if (neo4jClient.isOnline()) {
      const allGraphResult = await neo4jClient.runQuery(
        `MATCH (c:Customer {id: $customerId})
         OPTIONAL MATCH (c)-[:HAS_CONTACT]->(contact:Contact)
         OPTIONAL MATCH (c)-[:HAS_OPPORTUNITY]->(opp:Opportunity)
         OPTIONAL MATCH (c)-[:HAS_VISIT_RECORD]->(v:VisitRecord)
         OPTIONAL MATCH (c)-[:HAS_NEED]->(need:Need)
         OPTIONAL MATCH (c)-[:HAS_RISK]->(risk:Risk)
         OPTIONAL MATCH (c)-[:HAS_COMMITMENT]->(commit:Commitment)
         OPTIONAL MATCH (c)-[:SERVES]-(rep:SalesRep)
         OPTIONAL MATCH (c)-[:GENERATED_FROM]->(lead:Lead)
         OPTIONAL MATCH (opp)-[:HAS_QUOTE]->(quote:Quote)
         RETURN c,
                collect(DISTINCT contact) AS contacts,
                collect(DISTINCT opp) AS opportunities,
                collect(DISTINCT v) AS visits,
                collect(DISTINCT need) AS needs,
                collect(DISTINCT risk) AS risks,
                collect(DISTINCT commit) AS commitments,
                collect(DISTINCT rep) AS reps,
                collect(DISTINCT lead) AS leads,
                collect(DISTINCT quote) AS quotes`,
        { customerId }
      );
      graphData = allGraphResult || [];
      graphContextText = formatGraphContext(graphData, graphData);
    }
  } catch (e) {
    console.warn('[graph-context] Neo4j graph context failed:', (e as Error).message);
  }

  // ChromaDB semantic search
  let semanticContext: any[] = [];
  try {
    const searchResult = await chromaClient.searchSimilarOpportunities(customer.customer_name || customer.id, 5);
    semanticContext = searchResult || [];
  } catch (e) {
    console.warn('[graph-context] ChromaDB semantic context failed:', (e as Error).message);
  }

  return {
    customer,
    visitRecords,
    contacts,
    opportunities,
    needs,
    risks,
    commitments,
    leads,
    quotes,
    salesRep,
    graphContextText,
    graphData,
    semanticContext,
  };
}

// ============================
// Formatting for LLM prompts
// ============================

/**
 * Serialize Neo4j graph query result into a readable text block for LLM prompts.
 */
export function formatGraphContext(graphData: any[], allGraphData: any[]): string {
  if (!graphData?.length && !allGraphData?.length) return '暂无图谱数据';

  const parts: string[] = [];

  // Sales Rep relationship
  const reps = allGraphData?.filter((r: any) => r.rep).map((r: any) => r.rep) || [];
  if (reps.length > 0) {
    const rep = reps[0];
    parts.push(`【负责人】${rep.name || ''}（${rep.team || ''}，${rep.region || ''}，${rep.seniority || ''}）`);
  }

  // Contacts from graph
  const graphContacts = allGraphData?.flatMap((r: any) => r.contacts || []).filter(Boolean) || [];
  if (graphContacts.length > 0) {
    const contactsStr = graphContacts.map((c: any) =>
      `${c.name || ''}（${c.role || ''}，影响力:${c.influence_level || ''}，态度:${c.attitude || ''}）`
    ).join('；');
    parts.push(`【联系人图谱】${contactsStr}`);
  }

  // Opportunities from graph
  const graphOpps = allGraphData?.flatMap((r: any) => r.opportunities || []).filter(Boolean) || [];
  if (graphOpps.length > 0) {
    const oppsStr = graphOpps.map((o: any) =>
      `${o.name || ''} | 阶段:${o.stage || ''} | 金额:¥${o.amount || 0} | 概率:${o.probability || 0}%`
    ).join('\n');
    parts.push(`【商机图谱】\n${oppsStr}`);
  }

  // Leads
  const graphLeads = allGraphData?.flatMap((r: any) => r.leads || []).filter(Boolean) || [];
  if (graphLeads.length > 0) {
    const leadsStr = graphLeads.map((l: any) =>
      `${l.title || l.id || ''} | 来源:${l.source || ''} | 状态:${l.status || ''}`
    ).join('\n');
    parts.push(`【线索】\n${leadsStr}`);
  }

  // Quotes
  const graphQuotes = allGraphData?.flatMap((r: any) => r.quotes || []).filter(Boolean) || [];
  if (graphQuotes.length > 0) {
    const quotesStr = graphQuotes.map((q: any) =>
      `${q.id || ''} | 关联商机:${q.opportunity_id || ''} | 金额:¥${q.amount || 0} | 状态:${q.status || ''}`
    ).join('\n');
    parts.push(`【报价】\n${quotesStr}`);
  }

  // Visit records from graph
  const graphVisits = allGraphData?.flatMap((r: any) => r.visits || []).filter(Boolean) || [];
  if (graphVisits.length > 0) {
    const visitsStr = graphVisits.map((v: any) =>
      `${v.title || v.id || ''} | 轮次:${v.sequence_no || ''}`
    ).join('；');
    parts.push(`【拜访记录图谱】${visitsStr}`);
  }

  return parts.join('\n') || '暂无图谱数据';
}

/**
 * Format visit records for LLM consumption (concise).
 */
export function formatVisitRecordsForLLM(visitRecords: any[]): string {
  if (!visitRecords?.length) return '暂无拜访记录';
  return visitRecords.map((r: any) => {
    const signals = (r.key_signals || []).join('；') || '未提取到信号';
    return `【第${r.sequence_no}轮】${r.title || ''}\n  摘要: ${r.summary || '暂无摘要'}\n  情感: ${r.sentiment || '未知'} | 信号: ${signals}`;
  }).join('\n');
}

/**
 * Format contact network with influence mapping.
 */
export function formatContactNetwork(contacts: any[]): string {
  if (!contacts?.length) return '暂无联系人数据';
  return contacts.map((c: any) =>
    `- **${c.name}**（${c.role}）: 影响力=${c.influence_level || '未知'}, 态度=${c.attitude || '未知'}, 电话=${c.phone || '无'}, 邮箱=${c.email || '无'}`
  ).join('\n');
}

/**
 * Format opportunity portfolio with quote info.
 */
export function formatOpportunityPortfolio(opportunities: any[], quotes: any[]): string {
  if (!opportunities?.length) return '暂无商机数据';
  return opportunities.map((o: any) => {
    const relatedQuote = quotes?.find((q: any) => q.opportunity_id === o.id);
    const quoteInfo = relatedQuote ? ` | 报价: ¥${relatedQuote.amount} (状态:${relatedQuote.status})` : '';
    return `- **${o.name}**: ${o.stage}, 金额 ¥${o.amount}, 赢率 ${o.probability}%, 预计成交 ${o.close_date}${quoteInfo}`;
  }).join('\n');
}

/**
 * Build a compact customer context summary for enriching the visit record analysis prompt.
 * This is lighter than the full composeAdvicePrompt — suitable for single-record analysis.
 */
export function buildVisitAnalysisContext(context: CustomerContext): string {
  const { customer, contacts, opportunities, needs, risks, commitments, leads, quotes, salesRep, graphContextText } = context;

  const customerProfile = [
    `企业名称: ${customer.customer_name || customer.customerName || customer.name}`,
    `行业: ${customer.industry || '未知'}`,
    `细分: ${customer.segment || '未知'}`,
    `区域: ${customer.region || '未知'}`,
    `客户等级: ${customer.customer_level || '未知'}`,
  ].join('\n');

  const contactMap = formatContactNetwork(contacts);
  const oppPortfolio = formatOpportunityPortfolio(opportunities, quotes);

  const needsList = needs.map((n: any) => `- ${n.name}（优先级: ${n.priority}）`).join('\n') || '暂无需求';
  const risksList = risks.map((r: any) => `- ${r.name}（等级: ${r.level}）`).join('\n') || '暂无风险';
  const commitmentsList = commitments.map((c: any) => `- ${c.name}（截止: ${c.due_date}）`).join('\n') || '暂无承诺';

  const leadPipeline = leads?.map((l: any) =>
    `- ${l.title || l.id}: 来源=${l.source || '未知'}, 状态=${l.status || '未知'}`
  ).join('\n') || '暂无线索数据';

  const repInfo = salesRep
    ? `负责人: ${salesRep.name}（${salesRep.team}，${salesRep.seniority}）`
    : '负责人: 未知';

  const graphSection = graphContextText !== '暂无图谱数据'
    ? `\n【客户关系图谱】\n${graphContextText}`
    : '';

  return `【客户背景信息】（供分析时参考）

${customerProfile}

${repInfo}

【联系人决策网络】
${contactMap}

【商机组合】
${oppPortfolio}

【线索来源】
${leadPipeline}

【客户需求与风险】
需求:
${needsList}

风险:
${risksList}

承诺:
${commitmentsList}
${graphSection}`;
}
