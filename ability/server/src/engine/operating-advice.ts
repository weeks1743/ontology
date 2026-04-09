import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { mongoClient } from '../database/index.js';
import { executeSkill as executeSkillCore } from '../skill-core/executor.js';
import { selectExternalSkill } from './external-skill-selector.js';

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
  };
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

async function renderAdviceHtml(markdownPath: string, markdownContent: string, customerName: string, roundNo: number) {
  const selection = selectExternalSkill({ artifact_type: 'operating_advice' });
  let htmlContent: string | null = null;

  try {
    const result = await Promise.race([
      executeSkillCore({
        skillId: selection.selected_skill_id,
        params: {
          command: '--generate',
          topic: `${customerName} 第 ${roundNo} 轮客户经营建议`,
          style: 'enterprise-dark',
          language: 'zh-CN',
          content_markdown: markdownContent,
          source_markdown_path: markdownPath,
          output_format: 'html',
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('render timeout after 8s')), 8000);
      }),
    ]);

    if (result.success && typeof result.spawnOutput === 'string' && /<html[\s\S]*<\/html>/i.test(result.spawnOutput)) {
      htmlContent = result.spawnOutput;
    }
  } catch (error) {
    console.warn('[operating-advice] render via kai-slide-creator failed:', (error as Error).message);
  }

  if (!htmlContent) {
    htmlContent = buildFallbackHtml(`${customerName} 客户经营建议`, markdownContent);
  }

  const htmlFileName = `${customerName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}_round_${roundNo}.html`;
  const htmlPath = join(TMP_DIR, htmlFileName);
  writeFileSync(htmlPath, htmlContent, 'utf-8');

  return {
    selectedSkillId: selection.selected_skill_id,
    htmlPath,
    htmlUrl: `/tmp/operating-advice/${htmlFileName}`,
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

  const analysis = analyzeVisitMarkdown(record.content_markdown);
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
    success: true,
  };
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

  const roundNo = params.advice_round || records.length;
  const latestRound = db.prepare(`
    SELECT * FROM operating_advice_artifacts
    WHERE ontology_id=? AND customer_id=?
    ORDER BY round_no DESC
    LIMIT 1
  `).get(ontologyId, params.customer_id) as any;

  const trend = summarizeTrend(records);
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
       advice_markdown_path, advice_html_path, selected_external_skill_id, render_status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
    rendered.selectedSkillId,
    'success',
    new Date().toISOString()
  );

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
    render_status: 'success',
  };
}
