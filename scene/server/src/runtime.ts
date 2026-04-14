import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SceneDb } from "./db.js";
import { getBindings, getScenarioByCode, getSections } from "./repository.js";

const ABILITY_BASE_URL = process.env.ABILITY_BASE_URL ?? "http://127.0.0.1:3002";
const OUTPUTS_ROOT = process.env.TONGYI_OUTPUTS_DIR ?? join(process.cwd(), "../chat/tongyi-agent/outputs");

type ExecuteSkillResponse = {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  substitutedBody?: string;
  spawnOutput?: unknown;
};

function readJson(path: string) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readTongyiSummary(outputTaskId: string) {
  const baseDir = join(OUTPUTS_ROOT, outputTaskId);
  const summaryPath = join(baseDir, "summary.txt");
  const summarizationPath = join(baseDir, "assets", "summarization.json");
  const summaryText = existsSync(summaryPath) ? readFileSync(summaryPath, "utf-8") : "";
  const summarization = readJson(summarizationPath) as { paragraphSummary?: string; summary?: string } | null;
  return summarization?.paragraphSummary || summarization?.summary || summaryText || "暂无录音摘要";
}

function readTongyiContext(outputTaskId: string) {
  const baseDir = join(OUTPUTS_ROOT, outputTaskId);
  const assetsDir = join(baseDir, "assets");
  const summarization = readJson(join(assetsDir, "summarization.json")) as {
    paragraphSummary?: string;
    conversationalSummary?: Array<{ summary?: string }>;
  } | null;
  const meetingAssistance = readJson(join(assetsDir, "meetingAssistance.json")) as {
    actions?: Array<{ text?: string }>;
    keywords?: string[];
  } | null;
  const autoChapters = readJson(join(assetsDir, "autoChapters.json")) as Array<{ headline?: string; summary?: string }> | null;

  return {
    summary: summarization?.paragraphSummary || "",
    conversationalSummaries: (summarization?.conversationalSummary || [])
      .map((item) => item.summary || "")
      .filter(Boolean)
      .slice(0, 3),
    actionItems: (meetingAssistance?.actions || [])
      .map((item) => item.text || "")
      .filter(Boolean)
      .slice(0, 6),
    keywords: (meetingAssistance?.keywords || []).filter(Boolean).slice(0, 8),
    chapterHighlights: (autoChapters || [])
      .map((item) => `${item.headline || ""}：${item.summary || ""}`.trim())
      .filter(Boolean)
      .slice(0, 4),
  };
}

function markdownToPlainSummary(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("---"))
    .slice(0, 8)
    .join(" ");
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ABILITY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload.error ?? `Ability request failed: ${response.status}`);
  }
  return payload as T;
}

async function executeOntologySkill(skillId: string, params: Record<string, unknown>) {
  return requestJson<ExecuteSkillResponse>(`/api/ontology-skills/${encodeURIComponent(skillId)}/execute`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

function renderSectionMarkdown(params: {
  customerName: string;
  sectionCode: string;
  sectionName: string;
  visitAnalysis: Record<string, any>;
  tongyiContext: ReturnType<typeof readTongyiContext>;
}) {
  const summary = params.visitAnalysis.summary || params.tongyiContext.summary || "暂无分析摘要";
  const keySignals = (params.visitAnalysis.key_signals || []).map((item: string) => `- ${item}`).join("\n") || "- 暂无经营信号";
  const nextStep = params.visitAnalysis.next_step_suggestion || params.visitAnalysis.nextStepSuggestion || "建议继续补充客户决策链信息";
  const chapterLines = params.tongyiContext.chapterHighlights.map((item) => `- ${item}`).join("\n");
  const actionLines = params.tongyiContext.actionItems.map((item) => `- ${item}`).join("\n");
  const keywordLine = params.tongyiContext.keywords.join("、");

  if (params.sectionCode === "INFO_STATUS") {
    return [
      `## ${params.sectionName}`,
      "",
      `- 客户名称：${params.customerName}`,
      `- 录音摘要：${params.tongyiContext.summary || "暂无录音摘要"}`,
      keywordLine ? `- 高频关键词：${keywordLine}` : "",
      "",
      "### 章节重点",
      chapterLines || "- 暂无章节重点",
      "",
      "### 当前判断",
      summary,
      "",
    ].filter(Boolean).join("\n");
  }

  if (params.sectionCode === "INFO_OUTPUT") {
    return [
      `## ${params.sectionName}`,
      "",
      "### 访谈信号",
      keySignals,
      "",
      `- 客户态度：${params.visitAnalysis.sentiment || "中性"}`,
      `- 关键人物：${(params.visitAnalysis.stakeholders || params.visitAnalysis.keyStakeholders || []).join("、") || "待补充"}`,
      "",
      "### 原始行动项",
      actionLines || "- 暂无行动项",
      "",
    ].join("\n");
  }

  return [
    `## ${params.sectionName}`,
    "",
    "### 推进建议",
    `- 下一步建议：${nextStep}`,
    `- 客户态度：${params.visitAnalysis.sentiment || "中性"}`,
    `- 经营提示：${summary}`,
    "",
    "### 建议动作",
    keySignals,
    "",
    "### 录音中已识别行动项",
    actionLines || "- 暂无行动项",
    "",
  ].join("\n");
}

function buildAssessmentPptSourceMarkdown(params: {
  customerName: string;
  visitAnalysis: Record<string, any>;
  tongyiContext: ReturnType<typeof readTongyiContext>;
}) {
  const summary = params.visitAnalysis.summary || params.tongyiContext.summary || "暂无录音摘要";
  const stakeholders = (params.visitAnalysis.stakeholders || params.visitAnalysis.keyStakeholders || []).slice(0, 5);
  const keySignals = (params.visitAnalysis.key_signals || []).slice(0, 8);
  const nextStep = params.visitAnalysis.next_step_suggestion || params.visitAnalysis.nextStepSuggestion || "建议继续补充客户决策链信息";
  const chapterHighlights = params.tongyiContext.chapterHighlights.slice(0, 4);
  const actionItems = params.tongyiContext.actionItems.slice(0, 5);

  return [
    `# ${params.customerName} 信息化评估 PPT 素材`,
    "",
    "## 幻灯片1：信息化现状分析",
    `- 客户名称：${params.customerName}`,
    `- 录音摘要：${summary}`,
    ...chapterHighlights.map((item) => `- ${item}`),
    "",
    "## 幻灯片2：信息化产出分析",
    `- 客户态度：${params.visitAnalysis.sentiment || "中性"}`,
    ...(stakeholders.length > 0 ? stakeholders.map((item: string) => `- 关键人物：${item}`) : ["- 关键人物：待补充"]),
    ...keySignals.map((item: string) => `- ${item}`),
    "",
    "## 幻灯片3：信息化升级建议",
    `- 下一步建议：${nextStep}`,
    ...actionItems.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

export async function executeScenarioRuntime(db: SceneDb, params: {
  ontologyId: string;
  scenarioCode: string;
  customerName: string;
  visitRecordId: string;
  tingwuTaskId: string;
  artifactRoot: string;
  taskId: string;
}) {
  const scenario = getScenarioByCode(db, params.ontologyId, params.scenarioCode);
  if (!scenario) {
    throw new Error(`Scenario not found: ${params.scenarioCode}`);
  }

  const sections = getSections(db, scenario.id);
  if (sections.length === 0) {
    throw new Error(`Scenario has no sections: ${params.scenarioCode}`);
  }

  const activeBindings = sections.flatMap((section) => getBindings(db, section.id).filter((binding) => binding.is_active === 1));
  const perceptiveBinding = activeBindings.find((binding) => binding.skill_id === "ont.crm.visit_record_analyze");
  if (!perceptiveBinding) {
    throw new Error(`Scenario ${params.scenarioCode} has no active visit_record_analyze binding`);
  }

  const visitAnalysis = await executeOntologySkill("ont.crm.visit_record_analyze", {
    visit_record_id: params.visitRecordId,
  });
  if (!visitAnalysis.success) {
    throw new Error(visitAnalysis.error ?? "visit_record_analyze failed");
  }

  const tongyiContext = readTongyiContext(params.tingwuTaskId);
  mkdirSync(params.artifactRoot, { recursive: true });

  const sectionMarkdown = sections
    .slice(0, 3)
    .map((section) =>
      renderSectionMarkdown({
        customerName: params.customerName,
        sectionCode: section.code,
        sectionName: section.name,
        visitAnalysis: visitAnalysis.data || {},
        tongyiContext,
      }),
    )
    .join("\n");

  const assessmentMarkdownPath = join(params.artifactRoot, "信息化评估.md");
  writeFileSync(assessmentMarkdownPath, `# ${params.customerName} 信息化评估\n\n${sectionMarkdown}\n`, "utf-8");
  const assessmentPptSourcePath = join(params.artifactRoot, "信息化评估_PPT素材.md");
  writeFileSync(
    assessmentPptSourcePath,
    buildAssessmentPptSourceMarkdown({
      customerName: params.customerName,
      visitAnalysis: visitAnalysis.data || {},
      tongyiContext,
    }),
    "utf-8",
  );

  return {
    success: true,
    assessment_markdown_path: assessmentMarkdownPath,
    assessment_ppt_source_path: assessmentPptSourcePath,
    assessment_markdown: readFileSync(assessmentMarkdownPath, "utf-8"),
    visit_analysis: visitAnalysis.data || {},
  };
}
