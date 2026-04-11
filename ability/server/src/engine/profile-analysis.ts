import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { buildCustomerContext, buildVisitAnalysisContext } from './graph-context-service.js';
import { getLLMClient, getLLMConfig, isLLMConfigured } from './llm-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TMP_DIR = join(__dirname, '../../tmp/profile-analysis');

export type ProfileScenario = 'interview' | 'crm_visit';

export interface ProfileAnalysisInput {
  scenario: ProfileScenario;
  transcript: string;
  speakerAliases?: Record<string, string>;
  customerId?: string;
  customerName?: string;
  visitRecordId?: string;
  visitTitle?: string;
}

export interface ProfileAnalysisResult {
  scenario: ProfileScenario;
  prompt: string;
  markdown: string;
  markdownPath: string;
  markdownUrl: string;
  detectedSpeakers: string[];
  appliedAliases: Record<string, string>;
}

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
}

function normalizeTranscript(text: string) {
  return text.replace(/\r\n/g, '\n').trim();
}

function detectSpeakersFromTranscript(text: string): string[] {
  const speakers = new Set<string>();
  const lines = normalizeTranscript(text).split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const labelMatch = line.match(/^([A-Za-z\u4e00-\u9fa5]{1,16}|发言人\d+|Speaker\s*\d+)(?:\s+\d{1,2}:\d{2})?\s*[:：]/);
    if (labelMatch) {
      speakers.add(labelMatch[1].trim());
      continue;
    }

    const participantMatch = line.match(/^-\s*([A-Za-z\u4e00-\u9fa5]{1,16})(?:（[^）]+）)?$/);
    if (participantMatch) {
      speakers.add(participantMatch[1].trim());
    }
  }

  return Array.from(speakers);
}

function applySpeakerAliases(text: string, aliases: Record<string, string>) {
  let output = text;
  const entries = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);

  for (const [raw, alias] of entries) {
    const normalizedAlias = alias.trim();
    if (!raw.trim() || !normalizedAlias) continue;
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`(^|\\n)(${escaped})(\\s+\\d{1,2}:\\d{2})?\\s*([:：])`, 'g'), (_m, prefix, _label, time, colon) => {
      return `${prefix}${normalizedAlias}${time || ''}${colon}`;
    });
    output = output.replace(new RegExp(`\\b${escaped}\\b`, 'g'), normalizedAlias);
  }

  return output;
}

export function buildInterviewProfilePrompt(transcript: string, speakerAliases: Record<string, string>) {
  const detected = detectSpeakersFromTranscript(transcript);
  const aliasNote = Object.keys(speakerAliases).length
    ? `\n【发言人映射】\n${Object.entries(speakerAliases).map(([raw, alias]) => `- ${raw} => ${alias}`).join('\n')}`
    : '';

  return `你是一位资深招聘面试分析顾问，请基于下面的面试录音转写内容，输出“按发言人分组”的结构化人物画像 Markdown，用于后续生成配图卡片与画像面板。

目标：
1. 识别每位发言人的身份定位（候选人 / 面试官 / 业务负责人等）
2. 提炼每位发言人的能力特征、沟通风格、动机偏好、风险提示
3. 所有结论必须来自录音内容证据，不得臆测
4. 输出必须适合直接渲染为 Markdown 卡片

画像字段要求（每个发言人都输出）：
- 角色判断
- 核心标签（3-5个）
- 沟通风格
- 关注点 / 动机偏好
- 能力亮点
- 风险提示
- 面试建议
- 证据摘录（1-3条）

输出格式要求：
- 使用中文
- 必须按“## 人名”分组
- 每个人下用短 bullet
- 不要输出 JSON，不要解释过程
- 如果原始文本出现“发言人1/发言人2”，优先使用映射后的姓名
- 仅基于以下人物：${detected.length > 0 ? detected.join('、') : '从内容中自行识别'}
${aliasNote}

下面是面试转写内容：
${normalizeTranscript(transcript)}`;
}

export async function buildCrmVisitProfilePrompt(input: ProfileAnalysisInput, normalizedTranscript: string, speakerAliases: Record<string, string>) {
  const detected = detectSpeakersFromTranscript(normalizedTranscript);
  const aliasNote = Object.keys(speakerAliases).length
    ? `\n【发言人映射】\n${Object.entries(speakerAliases).map(([raw, alias]) => `- ${raw} => ${alias}`).join('\n')}`
    : '';

  let customerContextText = '';
  if (input.customerId) {
    try {
      const context = await buildCustomerContext(input.customerId, 'crm');
      customerContextText = buildVisitAnalysisContext(context);
    } catch (error) {
      customerContextText = `客户上下文加载失败：${(error as Error).message}`;
    }
  }

  return `你是一位资深 B2B 销售策略顾问，请基于以下“客户拜访录音转写 + CRM 客户上下文”，输出“按发言人分组”的结构化人物画像 Markdown，用于销售沟通复盘、客户关系建模与后续策略生成。

分析目标：
1. 判断每位发言人在客户决策链中的角色与影响力
2. 提炼其态度倾向、关注点、顾虑点、沟通偏好
3. 给出后续跟进建议，帮助销售推进商机
4. 结论必须引用录音内容或 CRM 上下文中的明确信号，不能虚构

画像字段要求（每个发言人都输出）：
- 角色 / 职能判断
- 决策影响力（高 / 中 / 低）
- 当前态度（积极 / 中性 / 谨慎 / 消极）
- 核心关注点
- 潜在顾虑
- 偏好沟通方式
- 跟进建议
- 证据摘录（1-3条）

输出格式要求：
- 使用中文
- 按“## 人名”分组输出
- 每个人下面使用短 bullet
- 只输出 Markdown，不要输出 JSON 或解释
- 优先使用映射后的姓名
- 关注客户侧画像，也可以补充我方销售代表画像，但要明确标注
- 仅基于以下人物：${detected.length > 0 ? detected.join('、') : '从内容中自行识别'}

【客户背景】
客户名称：${input.customerName || '未知客户'}
拜访记录：${input.visitTitle || input.visitRecordId || '当前拜访'}
${aliasNote}

【CRM 客户上下文】
${customerContextText || '暂无额外客户上下文'}

【拜访录音转写】
${normalizedTranscript}`;
}

function buildFallbackMarkdown(scenario: ProfileScenario, transcript: string, speakerAliases: Record<string, string>) {
  const detected = detectSpeakersFromTranscript(transcript);
  const normalized = applySpeakerAliases(transcript, speakerAliases);
  const title = scenario === 'interview' ? '面试人物画像' : 'CRM 客户拜访人物画像';

  const sections = (detected.length > 0 ? detected : ['未识别发言人']).map((speaker) => {
    const name = speakerAliases[speaker] || speaker;
    const evidence = normalized
      .split('\n')
      .filter((line) => line.includes(name))
      .slice(0, 2)
      .map((line) => line.replace(/^[-*\s]+/, '').trim());

    return `## ${name}
- 角色判断：待结合大模型进一步确认
- 核心标签：待分析
- 关注点：待分析
- 沟通风格：待分析
- 风险提示：待分析
- 跟进建议：建议结合完整录音与上下文继续生成
- 证据摘录：
${(evidence.length > 0 ? evidence : ['暂无直接摘录']).map((item) => `  - ${item}`).join('\n')}`;
  });

  return `# ${title}

> 当前环境未配置大模型，以下为占位版结构化画像草稿，可直接作为后续 prompt 输入模板。

${sections.join('\n\n')}
`;
}

export async function analyzeProfile(input: ProfileAnalysisInput): Promise<ProfileAnalysisResult> {
  ensureTmpDir();

  const normalizedTranscript = normalizeTranscript(input.transcript);
  const appliedAliases = input.speakerAliases || {};
  const transcriptWithAliases = applySpeakerAliases(normalizedTranscript, appliedAliases);
  const detectedSpeakers = detectSpeakersFromTranscript(normalizedTranscript);

  const prompt = input.scenario === 'interview'
    ? buildInterviewProfilePrompt(transcriptWithAliases, appliedAliases)
    : await buildCrmVisitProfilePrompt(input, transcriptWithAliases, appliedAliases);

  let markdown = '';

  if (isLLMConfigured()) {
    try {
      const client = getLLMClient();
      const response = await client.chat.completions.create({
        model: getLLMConfig().model,
        messages: [
          {
            role: 'system',
            content: '你擅长将录音转写整理为结构化人物画像。请严格输出 Markdown，不要输出 JSON，不要解释过程，不要使用占位语气。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      });
      markdown = (response.choices[0]?.message?.content || '').trim();
    } catch (error) {
      console.warn('[profile-analysis] LLM failed, using fallback markdown:', (error as Error).message);
      markdown = buildFallbackMarkdown(input.scenario, transcriptWithAliases, appliedAliases);
    }
  } else {
    markdown = buildFallbackMarkdown(input.scenario, transcriptWithAliases, appliedAliases);
  }

  const fileId = nanoid(8);
  const fileName = `${input.scenario}_${fileId}.md`;
  const filePath = join(TMP_DIR, fileName);
  writeFileSync(filePath, markdown, 'utf-8');

  return {
    scenario: input.scenario,
    prompt,
    markdown,
    markdownPath: filePath,
    markdownUrl: `/tmp/profile-analysis/${fileName}`,
    detectedSpeakers,
    appliedAliases,
  };
}
