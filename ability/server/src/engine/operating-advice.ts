import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { mongoClient } from '../database/index.js';
import { buildCustomerContext, formatGraphContext, buildVisitAnalysisContext } from './graph-context-service.js';
import { getLLMClient, getLLMConfig, isLLMConfigured } from './llm-client.js';
import { executeSkill as executeSkillCore } from '../skill-core/executor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TMP_DIR = join(__dirname, '../../tmp/operating-advice');

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function extractBullets(sectionTitle: string, content: string): string[] {
  const idx = content.indexOf(sectionTitle);
  if (idx === -1) return [];
  const rest = content.slice(idx + sectionTitle.length);
  const lines = rest.split('\n');
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) break;
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      bullets.push(trimmed.slice(2).trim());
    }
  }
  return bullets;
}

function inferSentiment(content: string): '积极' | '中性' | '谨慎' | '消极' {
  if (/(推进|预算已批|下周安排|愿意试点|积极|认可|配合)/.test(content)) return '积极';
  if (/(观望|再看看|需要内部讨论|担心|谨慎|等等)/.test(content)) return '谨慎';
  if (/(暂停|否决|压缩预算|竞品领先|负面|搁置)/.test(content)) return '消极';
  return '中性';
}

/** Map English urgency values to Chinese */
function toChineseUrgency(val: string): '高' | '中' | '低' {
  const map: Record<string, '高' | '中' | '低'> = { high: '高', medium: '中', low: '低', 高: '高', 中: '中', 低: '低' };
  return map[val.toLowerCase()] || '中';
}

/** Map English influence/attitude values to Chinese */
function toChineseLabel(val: string, type: 'influence' | 'attitude'): string {
  if (!val) return '未知';
  if (type === 'influence') {
    const map: Record<string, string> = { high: '高', medium: '中', low: '低', 高: '高', 中: '中', 低: '低' };
    return map[val.toLowerCase()] || val;
  }
  // attitude
  const map: Record<string, string> = { positive: '积极', neutral: '中性', cautious: '谨慎', negative: '消极', 积极: '积极', 中性: '中性', 谨慎: '谨慎', 消极: '消极' };
  return map[val.toLowerCase()] || val;
}

export function analyzeVisitMarkdown(contentMarkdown: string) {
  const plain = stripMarkdown(contentMarkdown);
  const keySignals = [
    ...extractBullets('## 客户关注点', contentMarkdown).map(item => `关注点:${item}`),
    ...extractBullets('## 主要异议', contentMarkdown).map(item => `异议:${item}`),
    ...extractBullets('## 风险信号', contentMarkdown).map(item => `风险:${item}`),
    ...extractBullets('## 下一步承诺', contentMarkdown).map(item => `承诺:${item}`),
  ];

  const summaryLines = plain.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 6);
  const summary = summaryLines.join('；').slice(0, 220);
  const sentiment = inferSentiment(plain);
  const riskSignals = keySignals.filter(item => item.startsWith('风险:') || item.startsWith('异议:'));
  const promiseSignals = keySignals.filter(item => item.startsWith('承诺:'));
  const focusSignals = keySignals.filter(item => item.startsWith('关注点:'));

  return {
    summary: summary || '该拜访记录包含客户沟通纪要，但未提炼出足够多的摘要内容。',
    key_signals: keySignals,
    sentiment,
    focusSignals,
    riskSignals,
    promiseSignals,
    keyStakeholders: [],
    nextStepSuggestion: '',
    urgency: '中' as const,
    opportunitySignals: [],
  };
}

/**
 * LLM-enhanced visit record analysis: extracts structured insight from raw markdown.
 * Optionally enriched with customer context for more targeted analysis.
 */
async function analyzeVisitRecordLLM(contentMarkdown: string, customerContext?: string) {
  if (!isLLMConfigured()) return analyzeVisitMarkdown(contentMarkdown);

  try {
    const contextSection = customerContext
      ? `\n${customerContext}\n\n请结合以上客户背景信息，对以下拜访记录进行更有针对性的分析：\n`
      : '\n请分析以下拜访记录：\n';

    const client = getLLMClient();
    const response = await client.chat.completions.create({
      model: getLLMConfig().model,
      messages: [
        {
          role: 'system',
          content: `你是一位资深CRM销售顾问（15年以上B2B大客户经验），擅长从拜访记录中提炼关键信号。
请分析以下拜访记录，输出严格JSON格式：
{
  "summary": "100字以内的拜访摘要，包含客户态度、核心议题",
  "sentiment": "积极|中性|谨慎|消极",
  "focus_signals": ["客户关注的核心议题1", "议题2"],
  "risk_signals": ["识别到的风险或障碍1", "障碍2"],
  "opportunity_signals": ["发现的销售机会或推进信号1", "信号2"],
  "commitment_signals": ["客户做出的承诺或下一步行动1"],
  "key_stakeholders_mentioned": ["提及的决策人/影响者姓名及角色"],
  "next_step_suggestion": "建议的下一步跟进动作（一句话）",
  "urgency": "高|中|低"
}
只输出JSON，不要其他文字。所有字段值必须使用中文，不要使用英文。`,
        },
        {
          role: 'user',
          content: contextSection + contentMarkdown,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || '';
    if (!content) throw new Error('LLM returned empty');

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();

    const analysis = JSON.parse(jsonStr);

    // Map to existing format for backward compatibility
    const keySignals = [
      ...(analysis.focus_signals || []).map((s: string) => `关注点:${s}`),
      ...(analysis.risk_signals || []).map((s: string) => `风险:${s}`),
      ...(analysis.commitment_signals || []).map((s: string) => `承诺:${s}`),
    ];

    return {
      summary: analysis.summary || '拜访记录已分析',
      key_signals: keySignals,
      sentiment: analysis.sentiment || '中性',
      focusSignals: (analysis.focus_signals || []).map((s: string) => `关注点:${s}`),
      riskSignals: (analysis.risk_signals || []).map((s: string) => `风险:${s}`),
      promiseSignals: (analysis.commitment_signals || []).map((s: string) => `承诺:${s}`),
      // Additional LLM fields
      opportunitySignals: analysis.opportunity_signals || [],
      nextStepSuggestion: analysis.next_step_suggestion || '',
      urgency: toChineseUrgency(analysis.urgency || '中'),
      keyStakeholders: analysis.key_stakeholders_mentioned || [],
      llm_enhanced: true,
    };
  } catch (error) {
    console.warn('[operating-advice] LLM visit analysis failed, using rule-based fallback:', (error as Error).message);
    return analyzeVisitMarkdown(contentMarkdown);
  }
}

function summarizeTrend(records: any[]) {
  const last = records[records.length - 1];
  const first = records[0];
  const sentiments = records.map(r => r.sentiment || '中性');
  const hasPositiveShift = sentiments.includes('积极') && !sentiments.every(s => s === sentiments[0]);
  const hasNegativeShift = sentiments.includes('消极') || sentiments.includes('谨慎');

  let stage = '客户仍处于早期观察阶段';
  if (records.length === 1) {
    stage = '客户已完成初步接触，建议继续聚焦需求澄清';
  } else if (records.length === 2) {
    stage = '客户进入真实评估阶段，异议和风险开始显性化';
  } else if (records.length >= 3) {
    stage = '客户已进入关键推进窗口，建议基于最近三次互动做明确行动决策';
  }

  const currentAssessment = hasPositiveShift
    ? '客户合作意愿正在升温，但仍需针对最新顾虑给出落地动作。'
    : hasNegativeShift
      ? '客户存在明显犹豫或风险信号，建议优先处理阻塞项再推进。'
      : '客户态度整体平稳，建议围绕关键关注点持续推进。';

  const risks = Array.from(new Set(records.flatMap(r => r.riskSignals || []))).slice(0, 5);
  const opportunities = Array.from(new Set(records.flatMap(r => r.promiseSignals || []).concat(records.flatMap(r => r.focusSignals || [])))).slice(0, 5);

  const actions = [
    risks.length > 0
      ? `优先回应风险项：${risks[0].replace(/^[^:]+:/, '')}`
      : '继续围绕客户当前优先级最高的问题准备下一轮沟通材料',
    opportunities.length > 0
      ? `围绕客户已表达的诉求推进：${opportunities[0].replace(/^[^:]+:/, '')}`
      : '补充确认客户内部决策路径和下一步时间表',
    last?.sentiment === '积极'
      ? '安排一次带方案的推进会，尽快把兴趣转化为明确里程碑'
      : '由销售与售前联合复盘，准备针对异议的回应方案',
  ];

  return {
    stage,
    currentAssessment,
    risks,
    opportunities,
    recommendedActions: actions,
    evidenceSummary: [
      `第一轮记录：${first?.summary || '无摘要'}`,
      ...records.slice(1).map((record, idx) => `第${idx + 2}轮记录：${record.summary || '无摘要'}`),
      `趋势判断：${stage}`,
    ].join('\n'),
  };
}

function buildAdviceMarkdown(params: {
  customer: any;
  records: any[];
  roundNo: number;
  currentAssessment: string;
  stage: string;
  evidenceSummary: string;
  recommendedActions: string[];
  risks: string[];
  opportunities: string[];
  changeSinceLastRound: string;
}) {
  const { customer, records, roundNo, currentAssessment, stage, evidenceSummary, recommendedActions, risks, opportunities, changeSinceLastRound } = params;

  return [
    `# ${customer.customer_name || customer.customerName || customer.name || customer.id} 客户经营建议`,
    '',
    `- 建议轮次: 第 ${roundNo} 轮`,
    `- 客户ID: ${customer.id}`,
    `- 客户行业: ${customer.industry || '未知'}`,
    `- 客户区域: ${customer.region || '未知'}`,
    '',
    '## 当前沟通阶段判断',
    stage,
    '',
    '## 拜访记录摘要',
    ...records.map((record: any, idx: number) => `- 第 ${idx + 1} 条（轮次 ${record.sequence_no}）: ${record.summary || '暂无摘要'}`),
    '',
    '## 跨记录趋势判断',
    evidenceSummary,
    '',
    '## 当前主要风险',
    ...(risks.length > 0 ? risks.map(item => `- ${item.replace(/^[^:]+:/, '')}`) : ['- 暂未识别出明显高风险项']),
    '',
    '## 当前主要机会',
    ...(opportunities.length > 0 ? opportunities.map(item => `- ${item.replace(/^[^:]+:/, '')}`) : ['- 暂未识别出明确机会信号']),
    '',
    '## 本轮经营判断',
    currentAssessment,
    '',
    '## 本轮经营建议',
    ...recommendedActions.map(item => `- ${item}`),
    '',
    '## 与上一轮建议相比的变化',
    changeSinceLastRound,
    '',
    '## 下一步行动建议',
    ...recommendedActions.map(item => `- ${item}`),
    '',
  ].join('\n');
}

function buildFallbackHtml(title: string, markdownContent: string) {
  const sections = markdownContent
    .split('\n')
    .map(line => {
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (!line.trim()) return '<div class="spacer"></div>';
      return `<p>${line}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; --bg: #f6f1e8; --ink: #1d1b19; --accent: #17594a; --muted: #6f665d; }
    body { margin: 0; font-family: "Noto Serif SC", "Source Han Serif SC", serif; background: linear-gradient(135deg, #f6f1e8, #e7dcc8); color: var(--ink); }
    main { max-width: 980px; margin: 0 auto; padding: 48px 24px 72px; }
    h1 { font-size: 40px; margin: 0 0 24px; }
    h2 { margin-top: 32px; font-size: 24px; color: var(--accent); border-top: 1px solid rgba(23,89,74,.2); padding-top: 18px; }
    p, li { font-size: 17px; line-height: 1.75; }
    ul { padding-left: 22px; }
    .spacer { height: 10px; }
  </style>
</head>
<body>
  <main>
    ${sections}
  </main>
</body>
</html>`;
}

/**
 * Build fallback HTML immediately (synchronous)
 */
async function buildFallbackHtmlQuick(markdownPath: string, markdownContent: string, customerName: string, roundNo: number) {
  const htmlContent = buildFallbackHtml(`${customerName} 客户经营建议`, markdownContent);
  const htmlFileName = `${customerName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_round_${roundNo}.html`;
  const htmlPath = join(TMP_DIR, htmlFileName);
  writeFileSync(htmlPath, htmlContent, 'utf-8');
  return {
    htmlPath,
    htmlUrl: `/tmp/operating-advice/${htmlFileName}`,
  };
}

/**
 * Try to render via kai-slide-creator (async, may take longer)
 * Updates the DB artifact when complete.
 * Includes LLM full advice (MEDDIC, contact strategy, competitor response) in the slide input.
 */
async function renderViaSlideCreator(markdownPath: string, markdownContent: string, customerName: string, roundNo: number, artifactId: string) {
  try {
    // Read the LLM full advice from the artifact
    const artifact = db.prepare(`
      SELECT llm_advice FROM operating_advice_artifacts WHERE id = ?
    `).get(artifactId) as any;

    let enhancedMarkdown = markdownContent;

    if (artifact?.llm_advice) {
      try {
        const llmAdvice = JSON.parse(artifact.llm_advice);

        // Build LLM advice section
        const llmSections: string[] = [];

        // MEDDIC 评估
        if (llmAdvice['MEDDIC评估']) {
          const m = llmAdvice['MEDDIC评估'];
          llmSections.push(
            '## MEDDIC 评估详情',
            '',
            `| 维度 | 状态 |`,
            `|------|------|`,
            `| **量化指标** | ${m['量化指标'] || '待确认'} |`,
            `| **经济决策人** | ${m['经济决策人'] || '待确认'} |`,
            `| **内部支持者** | ${m['内部支持者'] || '待确认'} |`,
            `| **决策标准** | ${m['决策标准'] || '待确认'} |`,
            `| **决策流程** | ${m['决策流程'] || '待确认'} |`,
            `| **已识别痛点** | ${m['已识别痛点'] || '待确认'} |`,
            ''
          );
        }

        // 兼容旧数据（英文 key）
        if (llmAdvice.meddic_summary && !llmAdvice['MEDDIC评估']) {
          const m = llmAdvice.meddic_summary;
          llmSections.push(
            '## MEDDIC 评估详情',
            '',
            `| 维度 | 状态 |`,
            `|------|------|`,
            `| **量化指标** | ${m.metrics || '待确认'} |`,
            `| **经济决策人** | ${m.economic_buyer || '待确认'} |`,
            `| **内部支持者** | ${m.champion || '待确认'} |`,
            `| **决策标准** | ${m.decision_criteria || '待确认'} |`,
            `| **决策流程** | ${m.decision_process || '待确认'} |`,
            `| **已识别痛点** | ${m.identified_pain || '待确认'} |`,
            ''
          );
        }

        // Contact strategy (Chinese key with English fallback)
        const contactStrategy = llmAdvice['联系人策略'] || llmAdvice.contact_strategy;
        if (contactStrategy) {
          llmSections.push(
            '## 关键联系人经营策略',
            '',
            contactStrategy,
            ''
          );
        }

        // Risk mitigation (Chinese key with English fallback)
        const riskMitigation = llmAdvice['风险缓解'] || llmAdvice.risk_mitigation;
        if (riskMitigation) {
          llmSections.push(
            '## 风险缓解策略',
            '',
            riskMitigation,
            ''
          );
        }

        // Competitor response (Chinese key with English fallback)
        const competitorResponse = llmAdvice['竞品应对'] || llmAdvice.competitor_response;
        if (competitorResponse) {
          llmSections.push(
            '## 竞品应对策略',
            '',
            competitorResponse,
            ''
          );
        }

        // Advice target & priority (map English to Chinese for backward compatibility)
        const priorityMap: Record<string, string> = { high: '高', medium: '中', low: '低', 高: '高', 中: '中', 低: '低' };
        const priorityCn = llmAdvice['优先级'] || llmAdvice.priority;
        const priorityDisplay = priorityCn ? priorityMap[priorityCn.toLowerCase()] || priorityCn : '';
        if (llmAdvice['建议目标'] || llmAdvice.advice_target || llmAdvice['优先级'] || llmAdvice.priority) {
          llmSections.push(
            '## 建议目标与优先级',
            '',
            (llmAdvice['建议目标'] || llmAdvice.advice_target) ? `**目标**: ${llmAdvice['建议目标'] || llmAdvice.advice_target}` : '',
            priorityDisplay ? `**优先级**: ${priorityDisplay}` : '',
            (llmAdvice['预期结果'] || llmAdvice.expected_results) ? `**预期结果**: ${llmAdvice['预期结果'] || llmAdvice.expected_results}` : '',
            ''
          );
        }

        if (llmSections.length > 0) {
          const chineseNote = `\n\n> 注意：以下所有内容均为中文，生成的幻灯片请保持全中文输出。`;
          enhancedMarkdown = markdownContent + '\n\n' + llmSections.join('\n') + chineseNote;
        }
      } catch (e) {
        console.warn('[operating-advice] Failed to parse llm_advice for report:', (e as Error).message);
      }
    }

    const result = await executeSkillCore({
        skillId: 'kai-slide-creator',
        params: {
          command: '--generate',
          content_markdown: enhancedMarkdown,
          topic: `${customerName} 第 ${roundNo} 轮客户经营建议`,
          style: 'enterprise-dark',
        },
      });

    if (result.success && typeof result.spawnOutput === 'string' && /<html[\s\S]*<\/html>/i.test(result.spawnOutput)) {
      const htmlFileName = `${customerName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_round_${roundNo}_report.html`;
      const htmlPath = join(TMP_DIR, htmlFileName);
      writeFileSync(htmlPath, result.spawnOutput, 'utf-8');

      // Update artifact with report HTML
      db.prepare(`
        UPDATE operating_advice_artifacts
        SET advice_html_path = ?, render_status = 'success', selected_external_skill_id = 'kai-slide-creator'
        WHERE id = ?
      `).run(htmlPath, artifactId);

      console.log(`[operating-advice] Slide generated: ${htmlFileName}`);
    }
  } catch (error) {
    console.warn('[operating-advice] render via kai-slide-creator failed:', (error as Error).message);
    // Update status to indicate fallback is being used
    db.prepare(`
      UPDATE operating_advice_artifacts
      SET render_status = 'fallback'
      WHERE id = ?
    `).run(artifactId);
  }
}

async function renderAdviceHtml(markdownPath: string, markdownContent: string, customerName: string, roundNo: number) {
  // Return fallback HTML immediately
  const rendered = await buildFallbackHtmlQuick(markdownPath, markdownContent, customerName, roundNo);

  return {
    selectedSkillId: 'kai-slide-creator',
    htmlPath: rendered.htmlPath,
    htmlUrl: rendered.htmlUrl,
  };
}

export async function createVisitRecord(params: any, ontologyId = 'crm') {
  const now = new Date().toISOString();
  const visitRecordId = params.visit_record_id || `visit_${nanoid(10)}`;
  const customerId = params.customer_id;
  const customerName = params.customer_name || params.customerName || '未命名客户';
  const customerCollection = `${ontologyId}_customers`;
  const visitCollection = `${ontologyId}_visit_records`;

  if (!params.content_markdown || !String(params.content_markdown).trim()) {
    throw new Error('拜访记录内容不能为空');
  }

  if (!params.sequence_no || Number(params.sequence_no) < 1) {
    throw new Error('拜访记录轮次必须从 1 开始且可排序');
  }

  const customer = await mongoClient.findOne(customerCollection, { id: customerId });
  if (!customer) {
    await mongoClient.insertDocument(customerCollection, {
      id: customerId,
      customer_name: customerName,
      industry: params.industry || '',
      region: params.region || '',
      owner_sales: params.owner_sales || '',
      visit_record_ids: [],
    });
  }

  await mongoClient.insertDocument(visitCollection, {
    id: visitRecordId,
    customer_id: customerId,
    customer_name: customerName,
    title: params.title,
    sequence_no: params.sequence_no,
    visit_type: params.visit_type,
    content_markdown: params.content_markdown,
    visit_at: params.visit_at,
    source_channel: params.source_channel || 'uploaded_markdown',
    status: '已记录',
    summary: '',
    key_signals: [],
    sentiment: '中性',
    ontology_id: ontologyId,
    created_at: now,
  });

  const latestCustomer = await mongoClient.findOne(customerCollection, { id: customerId });
  const nextIds = Array.from(new Set([...(latestCustomer?.visit_record_ids || []), visitRecordId]));
  await mongoClient.updateByFilter(customerCollection, { id: customerId }, { visit_record_ids: nextIds });

  return {
    visit_record_id: visitRecordId,
    customer_id: customerId,
    customer_name: customerName,
    success: true,
  };
}

export async function analyzeVisitRecord(params: any, ontologyId = 'crm') {
  const visitCollection = `${ontologyId}_visit_records`;
  const record = await mongoClient.findOne(visitCollection, { id: params.visit_record_id });
  if (!record) {
    throw new Error(`VisitRecord not found: ${params.visit_record_id}`);
  }

  if (!record.content_markdown || !String(record.content_markdown).trim()) {
    throw new Error('拜访记录内容不能为空');
  }

  // Build customer context to enrich the analysis
  let customerContext: string | undefined;
  try {
    console.log(`[operating-advice] Building customer context for visit analysis: customer=${record.customer_id}`);
    const context = await buildCustomerContext(record.customer_id, ontologyId);
    customerContext = buildVisitAnalysisContext(context);
    console.log(`[operating-advice] Customer context built: ${customerContext.length} chars`);
  } catch (e) {
    console.warn('[operating-advice] Could not build customer context for visit analysis:', (e as Error).message);
  }

  // Use LLM-enhanced analysis with customer context when available
  const analysis = await analyzeVisitRecordLLM(record.content_markdown, customerContext);
  await mongoClient.updateByFilter(visitCollection, { id: record.id }, {
    summary: analysis.summary,
    key_signals: analysis.key_signals,
    sentiment: analysis.sentiment,
    status: '已分析',
  });

  return {
    visit_record_id: record.id,
    summary: analysis.summary,
    key_signals: analysis.key_signals,
    sentiment: analysis.sentiment,
    keyStakeholders: analysis.keyStakeholders || [],
    nextStepSuggestion: analysis.nextStepSuggestion || '',
    urgency: toChineseUrgency(analysis.urgency || '中'),
    opportunitySignals: analysis.opportunitySignals || [],
    success: true,
  };
}

/**
 * Compose a structured LLM prompt for generating operating advice.
 * Includes full customer context: MongoDB documents, Neo4j graph, ChromaDB semantic search.
 */
function composeAdvicePrompt(context: any, records: any[], previousAdvice: any | null): string {
  const {
    customer, contacts, opportunities, needs, risks, commitments,
    leads, quotes, salesRep, graphContextText, visitRecords,
  } = context;

  // Customer profile
  const customerProfile = [
    `企业名称: ${customer.customer_name || customer.customerName || customer.name}`,
    `企业ID: ${customer.id}`,
    `行业: ${customer.industry || '未知'}`,
    `细分: ${customer.segment || '未知'}`,
    `区域: ${customer.region || '未知'}`,
    `客户等级: ${customer.customer_level || '未知'}`,
    `数字化成熟度: ${customer.digital_maturity || '未知'}`,
    `核心标签: ${(customer.core_tags || []).join('、') || '无'}`,
    `企业概况: ${customer.company_profile || '无'}`,
  ].join('\n');

  // Contact network with influence mapping
  const influenceMap: Record<string, string> = { high: '高', medium: '中', low: '低' };
  const attitudeMap: Record<string, string> = { positive: '积极', neutral: '中性', cautious: '谨慎', negative: '消极' };
  const contactMap = contacts.map((c: any) => {
    const influence = influenceMap[c.influence_level?.toLowerCase()] || c.influence_level || '未知';
    const attitude = attitudeMap[c.attitude?.toLowerCase()] || c.attitude || '未知';
    return `- **${c.name}**（${c.role}）: 影响力=${influence}, 态度=${attitude}, 电话=${c.phone || '无'}, 邮箱=${c.email || '无'}`;
  }).join('\n') || '暂无联系人数据';

  // Opportunity portfolio
  const oppPortfolio = opportunities.map((o: any) => {
    const relatedQuote = quotes?.find((q: any) => q.opportunity_id === o.id);
    const quoteInfo = relatedQuote ? ` | 报价: ¥${relatedQuote.amount} (状态:${relatedQuote.status})` : '';
    return `- **${o.name}**: ${o.stage}, 金额 ¥${o.amount}, 赢率 ${o.probability}%, 预计成交 ${o.close_date}${quoteInfo}`;
  }).join('\n') || '暂无商机数据';

  // Total pipeline value
  const totalPipeline = opportunities.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);
  const weightedPipeline = opportunities.reduce((sum: number, o: any) => sum + (o.amount || 0) * (o.probability || 0) / 100, 0);

  // Lead pipeline
  const leadPipeline = leads?.map((l: any) =>
    `- ${l.title || l.id}: 来源=${l.source || '未知'}, 状态=${l.status || '未知'}`
  ).join('\n') || '暂无线索数据';

  // Needs & risks
  const needsList = needs.map((n: any) => `- ${n.name}（优先级: ${n.priority}）`).join('\n') || '暂无需求';
  const risksList = risks.map((r: any) => `- ${r.name}（等级: ${r.level}）`).join('\n') || '暂无风险';
  const commitmentsList = commitments.map((c: any) => `- ${c.name}（截止: ${c.due_date}）`).join('\n') || '暂无承诺';

  // Visit record analysis with LLM signals
  const visitDetail = visitRecords.map((r: any) => {
    const signals = (r.key_signals || []).join('；') || '未提取到信号';
    return `【第${r.sequence_no}轮】${r.title || ''}\n  摘要: ${r.summary || r.content_markdown?.substring(0, 300) || '无'}\n  情感: ${r.sentiment || '未知'} | 信号: ${signals}`;
  }).join('\n');

  // Sales rep info
  const repInfo = salesRep
    ? `负责人: ${salesRep.name}（${salesRep.team}，${salesRep.seniority}，专注${(salesRep.focus_industries || []).join('、')}）`
    : '负责人: 未知';

  // Graph context
  const graphSection = graphContextText !== '暂无图谱数据'
    ? `【客户关系图谱】\n${graphContextText}`
    : '';

  const previousContext = previousAdvice
    ? `\n【上一轮经营建议】\n阶段判断: ${previousAdvice.current_assessment}\n建议动作: ${JSON.stringify(previousAdvice.recommended_actions)}`
    : '\n⚡ 这是第一轮经营建议。请基于首批拜访记录建立完整的客户经营基线。';

  return `你是一位拥有15年经验的B2B大客户销售顾问，擅长运用SPIN销售法、MEDDIC方法论和顾问式销售策略。请基于以下全量客户数据，生成专业、可执行的客户经营建议。

═══════════════════════════════════════════
【一、客户企业档案】
═══════════════════════════════════════════
${customerProfile}

${repInfo}

═══════════════════════════════════════════
【二、联系人决策网络】
═══════════════════════════════════════════
${contactMap}

💡 分析提示：
- 影响力"高" + 态度"积极"的人 = 内部支持者（推动项目进展）
- 影响力"高" + 态度"谨慎/中性"的人 = 关键障碍，需要重点攻克
- 决策链是否覆盖到最终决策者（掌握预算审批权的人）？

═══════════════════════════════════════════
【三、商机组合与管道分析】
═══════════════════════════════════════════
商机详情:
${oppPortfolio}

📊 管道指标:
- 商机总数: ${opportunities.length} 个
- 总管道金额: ¥${totalPipeline.toLocaleString()}
- 加权管道金额: ¥${weightedPipeline.toLocaleString()}

线索来源:
${leadPipeline}

报价状态:
${quotes?.map((q: any) => `- 报价 ${q.id}: 关联 ${q.opportunity_id}, 金额 ¥${q.amount}, 状态 ${q.status}`).join('\n') || '暂无报价'}

═══════════════════════════════════════════
【四、客户需求与风险矩阵】
═══════════════════════════════════════════
客户需求:
${needsList}

风险因素:
${risksList}

客户承诺:
${commitmentsList}

═══════════════════════════════════════════
【五、拜访记录与情感趋势】
═══════════════════════════════════════════
${visitDetail}

${graphSection ? `${graphSection}` : ''}

═══════════════════════════════════════════
【六、综合分析要求】
═══════════════════════════════════════════
请从以下维度进行分析:

1. **MEDDIC评估**: 当前商机的 量化指标、经济决策人、决策标准、决策流程、已识别痛点、内部支持者 各是什么状态？

2. **联系人策略**: 如何调动内部支持者影响最终决策者？如何消除态度谨慎者的顾虑？

3. **竞争态势**: 结合拜访记录中的竞品信号，我们的差异化优势在哪里？

4. **下一步行动**: 具体、可执行、有明确时间节点的行动建议（至少3条）。

${previousContext}

═══════════════════════════════════════════
【输出格式要求】
═══════════════════════════════════════════
请以严格JSON格式输出经营建议:
{
  "建议目标": "本次建议的核心目标（一句话，具体可衡量）",
  "建议动作": ["具体行动1（明确谁、做什么、何时完成）", "具体行动2", "具体行动3"],
  "建议依据": "支撑建议的关键证据（明确引用客户数据、拜访记录、联系人态度等）",
  "预期结果": "预期达成的结果（量化指标）",
  "优先级": "高|中|低",
  "当前判断": "当前经营判断（2-3句话，包含阶段判断和关键因素分析）",
  "阶段判断": "客户所处阶段的精准判断（一句话）",
  "MEDDIC评估": {
    "量化指标": "客户业务可量化的成功指标和衡量标准",
    "经济决策人": "掌握预算决策权的人及其态度",
    "内部支持者": "在客户内部积极推动项目的人及其影响力",
    "决策标准": "客户评估方案和供应商的标准",
    "决策流程": "客户从评估到签约的完整决策流程和时间表",
    "已识别痛点": "客户当前面临的核心业务痛点"
  },
  "联系人策略": "如何调动内部支持者影响最终决策人，如何消除关键障碍者顾虑",
  "风险缓解": "主要风险及对应的应对策略",
  "竞品应对": "如有竞品信号，如何应对（无则省略或填无）"
}

只输出JSON，不要包含任何其他文字。`;
}

/**
 * Generate advice using LLM. Returns trend object compatible with summarizeTrend.
 */
async function generateLLMAdvice(customer: any, records: any[], ontologyId: string): Promise<{
  stage: string;
  currentAssessment: string;
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  evidenceSummary: string;
  llmAdvice?: any;
}> {
  try {
    const context = await buildCustomerContext(customer.id, ontologyId);

    const latestRound = db.prepare(`
      SELECT * FROM operating_advice_artifacts
      WHERE ontology_id=? AND customer_id=?
      ORDER BY round_no DESC LIMIT 1
    `).get(ontologyId, customer.id) as any;

    const prompt = composeAdvicePrompt(context, records, latestRound);

    const client = getLLMClient();
    const response = await client.chat.completions.create({
      model: getLLMConfig().model,
      messages: [
        {
          role: 'system',
          content: '你是一位拥有15年B2B大客户销售经验的顾问，擅长MEDDIC方法论、SPIN销售法和顾问式销售策略。输出严格JSON格式。**重要：所有输出必须使用中文，不要使用英文缩写如Champion、EB、Decision Maker等，统一使用中文表述（如"内部支持者"、"经济决策人"、"最终决策者"）。影响力/态度值用"高/中/低"和"积极/中性/谨慎/消极"。**',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content || '';
    if (!content) throw new Error('LLM returned empty');

    // Parse JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    jsonStr = jsonStr.trim();

    const advice = JSON.parse(jsonStr);

    console.log('[operating-advice] LLM advice generated successfully');

    return {
      stage: advice['阶段判断'] || `客户已进入${records.length >= 3 ? '关键推进' : '真实评估'}阶段`,
      currentAssessment: advice['当前判断'] || '建议继续深入挖掘客户需求',
      risks: records.flatMap(r => r.riskSignals || []).slice(0, 5),
      opportunities: records.flatMap(r => r.promiseSignals || r.focusSignals || []).slice(0, 5),
      recommendedActions: Array.isArray(advice['建议动作']) ? advice['建议动作'] : ['继续跟进客户需求'],
      evidenceSummary: advice['建议依据'] || records.map((r, i) => `第${i + 1}轮: ${r.summary || '无摘要'}`).join('\n'),
      llmAdvice: advice,
    };
  } catch (error) {
    console.warn('[operating-advice] LLM advice failed, falling back to rule engine:', (error as Error).message);
    throw error; // Re-throw so caller can fallback
  }
}

export async function generateOperatingAdvice(params: any, ontologyId = 'crm') {
  ensureTmpDir();

  const customerCollection = `${ontologyId}_customers`;
  const visitCollection = `${ontologyId}_visit_records`;
  const customer = await mongoClient.findOne(customerCollection, { id: params.customer_id });

  if (!customer) {
    throw new Error(`Customer not found: ${params.customer_id}`);
  }

  const candidateIds = Array.isArray(params.visit_record_ids) && params.visit_record_ids.length > 0
    ? params.visit_record_ids
    : customer.visit_record_ids || [];

  if (candidateIds.length === 0) {
    throw new Error('生成客户经营建议前，至少需要一份拜访记录');
  }

  const allRecords = await mongoClient.findMany(
    visitCollection,
    { customer_id: params.customer_id, id: { $in: candidateIds } },
    { sort: { sequence_no: 1 }, limit: 10 }
  );
  const records = allRecords.slice(-3);

  if (records.length === 0) {
    throw new Error('未找到可用于生成建议的拜访记录');
  }

  for (const record of records) {
    if (!record.status || record.status !== '已分析') {
      throw new Error(`拜访记录尚未分析完成: ${record.id}`);
    }
  }

  const latestRound = db.prepare(`
    SELECT * FROM operating_advice_artifacts
    WHERE ontology_id=? AND customer_id=?
    ORDER BY round_no DESC
    LIMIT 1
  `).get(ontologyId, params.customer_id) as any;

  const roundNo = params.advice_round || (latestRound ? latestRound.round_no + 1 : 1);

  // Try LLM-based advice first, fallback to rule-based summarizeTrend
  let trend;
  if (isLLMConfigured()) {
    try {
      trend = await generateLLMAdvice(customer, records, ontologyId);
    } catch (llmError) {
      console.warn('[operating-advice] LLM failed, using rule-based fallback:', (llmError as Error).message);
      trend = summarizeTrend(records);
    }
  } else {
    trend = summarizeTrend(records);
  }
  const changeSinceLastRound = latestRound
    ? `相较上一轮，本轮更加关注：${trend.recommendedActions[0]}。上一轮判断为“${latestRound.current_assessment}”。`
    : '这是第一轮经营建议，系统已基于首批拜访记录建立经营基线。';

  const markdownContent = buildAdviceMarkdown({
    customer,
    records,
    roundNo,
    currentAssessment: trend.currentAssessment,
    stage: trend.stage,
    evidenceSummary: trend.evidenceSummary,
    recommendedActions: trend.recommendedActions,
    risks: trend.risks,
    opportunities: trend.opportunities,
    changeSinceLastRound,
  });

  const customerName = customer.customer_name || customer.customerName || customer.name || params.customer_id;
  const markdownFileName = `${customerName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_round_${roundNo}.md`;
  const markdownPath = join(TMP_DIR, markdownFileName);
  writeFileSync(markdownPath, markdownContent, 'utf-8');

  const rendered = await renderAdviceHtml(markdownPath, markdownContent, customerName, roundNo);

  const artifactId = `advice_${nanoid(10)}`;
  db.prepare(`
    INSERT INTO operating_advice_artifacts
      (id, ontology_id, customer_id, customer_name, round_no, based_on_visit_record_ids,
       current_assessment, recommended_actions, evidence_summary, change_since_last_round,
       advice_markdown_path, advice_html_path, selected_external_skill_id, llm_advice, render_status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    artifactId,
    ontologyId,
    params.customer_id,
    customerName,
    roundNo,
    JSON.stringify(records.map(r => r.id)),
    trend.currentAssessment,
    JSON.stringify(trend.recommendedActions),
    trend.evidenceSummary,
    changeSinceLastRound,
    markdownPath,
    rendered.htmlPath,
    'kai-slide-creator',
    (trend as any).llmAdvice ? JSON.stringify((trend as any).llmAdvice) : null,
    'generating',
    new Date().toISOString()
  );

  // Fire-and-forget async slide generation
  renderViaSlideCreator(markdownPath, markdownContent, customerName, roundNo, artifactId);

  return {
    artifact_id: artifactId,
    round_no: roundNo,
    based_on_visit_record_ids: records.map(r => r.id),
    current_assessment: trend.currentAssessment,
    recommended_actions: trend.recommendedActions,
    evidence_summary: trend.evidenceSummary,
    change_since_last_round: changeSinceLastRound,
    advice_markdown_path: markdownPath,
    advice_markdown_url: `/tmp/operating-advice/${markdownFileName}`,
    advice_html_path: rendered.htmlPath,
    advice_html_url: rendered.htmlUrl,
    selected_external_skill_id: rendered.selectedSkillId,
    render_status: 'generating',
  };
}
