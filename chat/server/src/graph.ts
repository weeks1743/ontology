import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Annotation, Command, END, START, StateGraph, interrupt } from "@langchain/langgraph";
import { nanoid } from "nanoid";

import {
  createAudioJob,
  deleteThreadMessagesByKinds,
  getAudioJobByTask,
  getProfileResult,
  getSpeakerAliases,
  getTask,
  insertMessage,
  listArtifacts,
  updateAudioJob,
  updateMessagePayload,
  updateTask,
  upsertArtifact,
} from "./db.js";
import { executeOntologySkill, executeSkillCore } from "./ability-client.js";
import { runAudioAnalysis } from "./audio-job.js";
import { executeSceneRuntime } from "./scene-client.js";
import { OUTPUTS_DIR } from "./paths.js";
import { runCompanyResearch } from "./research.js";
import { SqliteSaver } from "./sqlite-checkpointer.js";
import { buildTranscriptText, buildVisitMarkdown, extractSpeakerParagraphs, loadTongyiOutput } from "./tongyi-output.js";
import type {
  AnalysisCardPayload,
  ClarificationCardPayload,
  ConversationTaskState,
  GraphCardPayload,
  PersistedMessage,
  ProfileCardPayload,
  TaskStatusCardPayload,
} from "./types.js";
import { nowIso, parseOpportunityInput, safeFileName, sleep } from "./utils.js";

type GraphState = {
  taskId?: string;
  threadId?: string;
  ontologyId?: string;
  capabilityCode?: string;
  audioPath?: string;
  audioFileName?: string;
  analysisMessageId?: string | null;
  customerName?: string | null;
  researchFilePath?: string | null;
  researchPreview?: string | null;
  customerId?: string | null;
  visitRecordId?: string | null;
  tingwuTaskId?: string | null;
  visitMarkdownPath?: string | null;
  transcriptText?: string | null;
  visitSummary?: string | null;
  sceneEnabled?: boolean;
  assessmentFilePath?: string | null;
  assessmentPptSourcePath?: string | null;
  pptFilePath?: string | null;
  pptFileName?: string | null;
  companyAnalysisPptPath?: string | null;
  companyAnalysisPptName?: string | null;
  itAssessmentPptPath?: string | null;
  itAssessmentPptName?: string | null;
  profileMarkdown?: string | null;
  opportunityInputText?: string | null;
  opportunityId?: string | null;
};

const GraphAnnotation = Annotation.Root({
  taskId: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  threadId: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  ontologyId: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  capabilityCode: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  audioPath: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  audioFileName: Annotation<string | undefined>({ reducer: (_prev, next) => next, default: () => undefined }),
  analysisMessageId: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  customerName: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  researchFilePath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  researchPreview: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  customerId: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  visitRecordId: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  tingwuTaskId: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  visitMarkdownPath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  transcriptText: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  visitSummary: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  sceneEnabled: Annotation<boolean | undefined>({ reducer: (_prev, next) => next, default: () => true }),
  assessmentFilePath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  assessmentPptSourcePath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  pptFilePath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  pptFileName: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  companyAnalysisPptPath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  companyAnalysisPptName: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  itAssessmentPptPath: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  itAssessmentPptName: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  profileMarkdown: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  opportunityInputText: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
  opportunityId: Annotation<string | null | undefined>({ reducer: (_prev, next) => next, default: () => null }),
});

type AudioSkillResult = {
  success: boolean;
  data?: {
    visit_record_id?: string;
    customer_id?: string;
    customer_name?: string;
    summary?: string;
    key_signals?: string[];
    sentiment?: string;
    opportunity_id?: string;
  };
  error?: string;
};

type SceneRuntimeResult = {
  success: boolean;
  assessment_markdown_path: string;
  assessment_ppt_source_path: string;
  assessment_markdown: string;
  visit_analysis: Record<string, any>;
};

const runningTasks = new Set<string>();

function ensureTask(taskId: string) {
  const task = getTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}

function updateTaskNode(taskId: string, graphNode: string, status: ConversationTaskState["status"] = "running") {
  updateTask(taskId, { graphNode, status });
}

function insertClarificationMessage(
  task: ConversationTaskState,
  stepCode: ClarificationCardPayload["stepCode"],
  payload: Omit<ClarificationCardPayload, "taskId" | "stepCode">,
) {
  const taskPayload = task.payload ?? {};
  const existingId = taskPayload[`${stepCode}MessageId`] as string | undefined;
  if (existingId) return existingId;

  const message = insertMessage({
    id: nanoid(16),
    threadId: task.threadId,
    role: "assistant",
    kind: "clarification-card",
    payload: {
      taskId: task.taskId,
      stepCode,
      ...payload,
    },
  });
  updateTask(task.taskId, {
    payload: {
      ...taskPayload,
      [`${stepCode}MessageId`]: message.id,
    },
  });
  return message.id;
}

function markClarificationResolved(task: ConversationTaskState, stepCode: ClarificationCardPayload["stepCode"]) {
  const taskPayload = task.payload ?? {};
  const messageId = taskPayload[`${stepCode}MessageId`] as string | undefined;
  if (!messageId) return;
  updateMessagePayload(task.threadId, messageId, { status: "resolved" });
}

function insertTaskStatus(taskId: string, threadId: string, payload: Omit<TaskStatusCardPayload, "taskId">) {
  return insertMessage({
    id: nanoid(16),
    threadId,
    role: "assistant",
    kind: "task-status-card",
    payload: {
      taskId,
      ...payload,
    },
  });
}

function insertArtifactCard(taskId: string, threadId: string, params: {
  artifactType: "company_research" | "it_assessment_markdown" | "company_analysis_pptx" | "it_assessment_pptx";
  title: string;
  fileName: string;
  filePath: string;
  subtitle?: string;
}) {
  upsertArtifact({
    id: `${taskId}:${params.artifactType}`,
    taskId,
    artifactType: params.artifactType,
    fileName: params.fileName,
    filePath: params.filePath,
    status: "ready",
  });
  return insertMessage({
    id: nanoid(16),
    threadId,
    role: "assistant",
    kind: "artifact-card",
    payload: {
      taskId,
      artifactType: params.artifactType,
      title: params.title,
      fileName: params.fileName,
      filePath: params.filePath,
      subtitle: params.subtitle,
      downloadUrl: `/api/chat/artifacts/${taskId}/${encodeURIComponent(params.fileName)}`,
      status: "ready",
    },
  });
}

function parseProfiles(markdown: string): ProfileCardPayload[] {
  const sections = markdown
    .split(/^##\s+/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return sections.map((section, index) => {
    const [heading, ...rest] = section.split("\n");
    const lines = rest.map((line) => line.trim()).filter(Boolean);
    const lineValue = (prefix: string) =>
      lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
    const tagsRaw = lineValue("- 核心标签：");
    return {
      taskId: "",
      profileId: `profile-${index + 1}`,
      name: heading.trim(),
      role: lineValue("- 角色判断：") || lineValue("- 角色 / 职能判断："),
      influence: lineValue("- 决策影响力：") || undefined,
      attitude: lineValue("- 当前态度：") || undefined,
      tags: tagsRaw ? tagsRaw.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean) : [],
      summary:
        lineValue("- 动机偏好：") ||
        lineValue("- 核心关注点：") ||
        lineValue("- 跟进建议：") ||
        lineValue("- 面试建议：") ||
        "已生成联系人画像",
    };
  }).filter((profile) => {
    if (!profile.name || profile.name.startsWith("# ")) return false;
    if (profile.name.includes("CRM 客户拜访结构化画像")) return false;
    return true;
  });
}

function stripMarkdown(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFieldValue(markdown: string, label: string) {
  const pattern = new RegExp(`-\\s*\\*\\*${label}\\*\\*：(.+)`);
  const match = markdown.match(pattern);
  return match ? stripMarkdown(match[1]) : "";
}

function extractSubsectionBody(markdown: string, sectionTitle: string, subsectionTitle: string) {
  const section = markdown.match(new RegExp(`### ${sectionTitle}[\\s\\S]*?(?=\\n### |\\n---|$)`))?.[0] ?? "";
  if (!section) return "";
  const subsection = section.match(new RegExp(`\\*\\*${subsectionTitle}：\\*\\*[\\s\\S]*?(?=\\n\\*\\*|$)`))?.[0] ?? "";
  return subsection;
}

function extractBulletItems(text: string, limit = 4) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || /^\d+\./.test(line))
    .map((line) => stripMarkdown(line.replace(/^-\s+/, "").replace(/^\d+\.\s*/, "")))
    .filter(Boolean)
    .slice(0, limit);
}

function buildCompanyPortrait(markdown: string, customerName: string) {
  const headquarters = extractFieldValue(markdown, "总部");
  const founded = extractFieldValue(markdown, "成立时间");
  const industry = extractFieldValue(markdown, "行业");
  const scaleRaw = extractFieldValue(markdown, "规模");
  const overviewSection = markdown.match(/### 企业概况[\s\S]*?(?=\n### |\n---|$)/)?.[0] ?? "";
  const productOverview = extractSubsectionBody(markdown, "详细产品洞察", "产品战略概述");
  const transformation = extractSubsectionBody(markdown, "转型战略与举措", "数字化转型");
  const strategy = markdown.match(/### 核心要点[\s\S]*?(?=\n### |\n---|$)/)?.[0] ?? "";

  const revenueMatch = scaleRaw.match(/(总资产[^，。；]*|营收[^，。；]*)/);
  const employeeMatch = scaleRaw.match(/员工[^，。；]*?(\d+[^\s，。；]*)/);

  const businesses = Array.from(new Set([
    /土地一级开发/.test(productOverview) ? "土地一级开发" : "",
    /房地产开发/.test(productOverview) ? "房地产开发" : "",
    /城市运营服务/.test(productOverview) ? "城市运营服务" : "",
    /产业服务/.test(productOverview) ? "产业服务" : "",
    /文化旅游/.test(productOverview) || /文旅/.test(productOverview) ? "文旅业务" : "",
    /健康休闲/.test(productOverview) ? "健康休闲" : "",
    /海洋科技/.test(productOverview) ? "海洋科技投资" : "",
  ].filter(Boolean))).slice(0, 5);

  const characteristics = Array.from(new Set([
    /金蝶软件/.test(transformation) ? "金蝶全面预算管控" : "",
    /业财一体化/.test(transformation) ? "业财一体化" : "",
    /城市运营商/.test(strategy + productOverview + overviewSection) ? "开发商向城市运营商转型" : "",
    /地域资源/.test(strategy) || /舟山/.test(overviewSection) ? "深耕舟山区域资源" : "",
    /风险前置/.test(transformation) ? "风险前置防控" : "",
  ].filter(Boolean))).slice(0, 4);

  const overviewSummaryLines = overviewSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("###") && !line.startsWith("**") && !line.startsWith("- **参考来源"));
  const summary = stripMarkdown(overviewSummaryLines.slice(0, 4).join(" "));

  let businessType = "";
  if (/城市综合开发|城市开发|运营商/.test(productOverview + summary)) {
    businessType = "城市开发运营商";
  } else if (/国资/.test(summary + scaleRaw)) {
    businessType = "区域国资平台";
  }

  const summarySentence = [
    businessType ? `定位为${businessType}` : "",
    /舟山/.test(summary + overviewSection) ? "深耕舟山群岛新区" : "",
    businesses.length > 0 ? `主营${businesses.slice(0, 3).join("、")}` : "",
  ].filter(Boolean).join("，");

  return {
    name: customerName,
    businessType: businessType || undefined,
    industry: industry || undefined,
    headquarters: headquarters || undefined,
    founded: founded || undefined,
    scale: employeeMatch ? `人员规模：${employeeMatch[1]}` : (scaleRaw || undefined),
    revenue: revenueMatch ? revenueMatch[1] : undefined,
    businesses,
    characteristics,
    researchSummary: summarySentence || summary || undefined,
  };
}

function buildGraphCard(task: ConversationTaskState, profiles: ProfileCardPayload[], opportunityId?: string | null): GraphCardPayload {
  const researchArtifact = listArtifacts(task.taskId).find((artifact) => artifact.artifactType === "company_research");
  let researchMarkdown = "";
  if (researchArtifact?.filePath && existsSync(researchArtifact.filePath)) {
    researchMarkdown = readFileSync(researchArtifact.filePath, "utf-8");
  }
  const companyPortrait = buildCompanyPortrait(researchMarkdown, task.customerName ?? "客户");

  const people = profiles.map((profile) => {
    const traitSet = new Set<string>();
    const source = `${profile.summary} ${profile.attitude ?? ""} ${profile.role} ${profile.tags.join(" ")}`;
    if (/审批|合规|权限|财务/.test(source)) traitSet.add("严谨");
    if (/试点|尝试|创新|开放/.test(source)) traitSet.add("开放");
    if (/预算|成本|回报|务实/.test(source)) traitSet.add("务实");
    if (/推进|时间|落地|里程碑/.test(source)) traitSet.add("推动型");
    if (/管理|统筹|协调/.test(source)) traitSet.add("统筹型");
    if (profile.attitude === "谨慎") traitSet.add("审慎");
    if (profile.attitude === "积极") traitSet.add("开放");
    const traits = Array.from(traitSet).slice(0, 3);
    return {
      id: `person:${profile.name}`,
      name: profile.name,
      role: profile.role,
      influence: profile.influence,
      attitude: profile.attitude,
      traits,
      focus: profile.tags.slice(0, 3).join("、") || undefined,
      summary: profile.summary.length > 64 ? `${profile.summary.slice(0, 64)}...` : profile.summary,
    };
  });

  const peopleRelations = people.slice(1).map((person, index) => {
    const anchor = people[0];
    const relationSource = `${anchor?.role ?? ""} ${person.role} ${anchor?.summary ?? ""} ${person.summary}`;
    let label = "项目协同";
    if (/信息|技术/.test(relationSource) && /财务|预算/.test(relationSource)) {
      label = "方案评估";
    } else if (/总|负责人|高/.test(`${anchor?.influence ?? ""}${person.influence ?? ""}`)) {
      label = "决策协同";
    } else if (/试点|落地/.test(relationSource)) {
      label = "试点推进";
    }
    return {
      id: `relation-${index + 1}`,
      from: anchor?.id ?? person.id,
      to: person.id,
      label,
      description: `${anchor?.name ?? person.name} 与 ${person.name} 围绕 ${label} 形成配合关系`,
    };
  });

  return {
    taskId: task.taskId,
    title: "客户图谱已建立",
    summary: `${task.customerName ?? "客户"} 的研究、拜访、联系人画像${opportunityId ? "与商机" : ""}已关联完成。`,
    company: companyPortrait,
    people,
    peopleRelations,
    opportunity: opportunityId
      ? {
          id: opportunityId,
          summary: "商机已建立，可继续录入产品与金额等推进信息。",
        }
      : null,
  };
}

function sourceTaskIdForMeetingArtifacts(task: ConversationTaskState) {
  return task.tingwuTaskId || task.taskId;
}

function safePptFileName(input: string) {
  return safeFileName(input).replace(/\.pptx$/i, "") + ".pptx";
}

function extractPptxPath(output: unknown) {
  const text = typeof output === "string" ? output : JSON.stringify(output);
  const match = text.match(/PPTX saved to:\s*(.+\.pptx)/);
  return match ? match[1].trim() : null;
}

function buildCompanyAnalysisPptTask(customerName: string, markdownPath: string, outputPath: string) {
  return [
    `基于以下企业研究报告内容，生成完整的企业研究演示文稿。`,
    `报告文件路径：${markdownPath}`,
    ``,
    `幻灯片要求：`,
    `1. 共 12 张幻灯片，覆盖报告全部核心内容`,
    `2. 设计风格：午夜商务风（主色 1E2761 午夜蓝 + 辅色 CADCFC 冰蓝 + 白色），封面与结论用深色背景`,
    `3. 每张幻灯片都要有视觉元素（色块、分隔线、图标字符等），避免纯文字`,
    `4. 幻灯片结构：`,
    `   - 第 1 张：封面（公司名 + 研究框架标签 + 日期）`,
    `   - 第 2 张：企业概况基本信息表格`,
    `   - 第 3 张：发展历程时间线`,
    `   - 第 4 张：高管战略愿景引语`,
    `   - 第 5 张：产品战略总览`,
    `   - 第 6 张：核心业务与产品矩阵`,
    `   - 第 7 张：数字化转型举措`,
    `   - 第 8 张：管理模式与组织协同`,
    `   - 第 9 张：未来路线图与挑战`,
    `   - 第 10 张：增长逻辑与产品化启示`,
    `   - 第 11 张：核心要点与待研究问题`,
    `   - 第 12 张：结论页（深色背景，核心结论 + 定位语）`,
    ``,
    `5. 关键约束：`,
    `   - 幻灯片尺寸 10" × 5.62"（16:9），使用 LAYOUT_16x9`,
    `   - 内容安全区：y 轴 0.25"–5.10"`,
    `   - 所有元素底边必须 ≤ 5.44"`,
    `   - 封面和结论页内容垂直居中`,
    ``,
    `6. 文件保存到：${outputPath}`,
  ].join("\n");
}

function buildItAssessmentPptTask(customerName: string, markdownPath: string, outputPath: string) {
  return [
    `基于以下信息化评估报告内容，生成完整的信息化评估演示文稿。`,
    `报告文件路径：${markdownPath}`,
    ``,
    `幻灯片要求：`,
    `1. 共 3 张幻灯片，完整覆盖报告核心内容`,
    `2. 设计风格：午夜商务风（主色 1E2761 午夜蓝 + 辅色 CADCFC 冰蓝 + 白色），与公司分析报告保持一致`,
    `3. 每张幻灯片都要有清晰的结构化视觉元素，避免纯文字堆叠`,
    `4. 幻灯片结构：`,
    `   - 第 1 张：信息化现状分析（现状、关键问题、核心背景）`,
    `   - 第 2 张：信息化产出分析（关键信号、关键人物、态度、风险）`,
    `   - 第 3 张：信息化升级建议（推进建议、行动项、里程碑）`,
    ``,
    `5. 关键约束：`,
    `   - 幻灯片尺寸 10" × 5.62"（16:9），使用 LAYOUT_16x9`,
    `   - 内容安全区：y 轴 0.25"–5.10"`,
    `   - 所有元素底边必须 ≤ 5.44"`,
    `   - 文案尽量提炼成咨询汇报风格，不直接复制 markdown 原文`,
    ``,
    `6. 文件保存到：${outputPath}`,
  ].join("\n");
}

type SkillCorePptxResult = {
  success: boolean;
  error?: string;
  spawnOutput?: unknown;
  substitutedBody?: string;
};

function getPptExecutionOutput(result: SkillCorePptxResult) {
  return typeof result.spawnOutput === "string"
    ? result.spawnOutput
    : typeof result.substitutedBody === "string"
      ? result.substitutedBody
      : JSON.stringify(result.spawnOutput ?? result.substitutedBody ?? "");
}

function isPptExecutionFailure(result: SkillCorePptxResult) {
  const output = getPptExecutionOutput(result);
  return /Execution Error:|ReferenceError:|TypeError:|SyntaxError:|Cannot find module/i.test(output);
}

async function runPptxWithRetry(params: {
  taskPrompt: string;
  retryHint: string;
}) {
  const first = await executeSkillCore<SkillCorePptxResult>("pptx", {
    task: params.taskPrompt,
  });
  if (first.success && !isPptExecutionFailure(first)) {
    return first;
  }

  const second = await executeSkillCore<SkillCorePptxResult>("pptx", {
    task: `${params.taskPrompt}\n\n补充约束：\n${params.retryHint}`,
  });
  return second;
}

async function syncSpeakerProfilesForTask(taskId: string) {
  const task = ensureTask(taskId);
  if (!task.visitRecordId || !task.customerName) {
    return { ready: false, reason: "missing_visit_or_customer" as const };
  }

  const sourceTaskId = sourceTaskIdForMeetingArtifacts(task);
  const aliases = getSpeakerAliases(sourceTaskId);
  const profile = getProfileResult(sourceTaskId);
  const bundle = task.tingwuTaskId ? loadTongyiOutput(task.tingwuTaskId, OUTPUTS_DIR) : null;
  const bySpeaker = bundle ? extractSpeakerParagraphs(bundle) : new Map<string, string[]>();

  const contacts = aliases
    .filter((entry) => entry.alias.trim() && !entry.isInternal)
    .map((entry) => {
      const snippets = bySpeaker.get(entry.rawSpeaker) ?? [];
      return {
        raw_speaker: entry.rawSpeaker,
        name: entry.alias.trim(),
        role: "客户侧关键参与人",
        notes: snippets.slice(0, 2).join("；"),
      };
    });

  const profiles = profile
    ? parseProfiles(profile.markdown).map((item) => ({
        ...item,
        taskId: task.taskId,
      }))
    : [];

  const result = await executeOntologySkill<AudioSkillResult>("ont.crm.visit_record_create_from_markdown", {
    visit_record_id: task.visitRecordId,
    customer_id: task.customerId,
    customer_name: task.customerName,
    contacts,
    speaker_profiles: profiles,
    sync_mode: "contacts_only",
  });
  if (!result.success) {
    throw new Error(result.error ?? "联系人同步失败");
  }

  deleteThreadMessagesByKinds(task.threadId, ["profile-card", "graph-card"]);

  profiles.forEach((profilePayload) => {
    insertMessage({
      id: nanoid(16),
      threadId: task.threadId,
      role: "assistant",
      kind: "profile-card",
      payload: profilePayload,
    });
  });

  const graphCard = buildGraphCard(task, profiles);
  insertMessage({
    id: nanoid(16),
    threadId: task.threadId,
    role: "assistant",
    kind: "graph-card",
    payload: graphCard,
  });

  if (!(task.payload?.wait_opportunity_confirmationMessageId as string | undefined)) {
    insertClarificationMessage(task, "wait_opportunity_confirmation", {
      title: "商机信息确认",
      question: "请输入客户意向产品，金额",
      placeholder: "例如：轻云、融合中心，10万",
      status: "pending",
    });
  }

  updateTask(task.taskId, {
    speakerSyncStatus: "completed",
    currentInterrupt: task.currentInterrupt === "wait_speaker_fix" ? null : task.currentInterrupt,
    interruptPayload: task.currentInterrupt === "wait_speaker_fix" ? null : task.interruptPayload,
    payload: {
      ...(task.payload || {}),
      speakerProfileReady: true,
      profileWorkflowCompleted: true,
    },
  });

  return {
    ready: true,
    profileMarkdown: profile?.markdown ?? null,
  };
}

async function waitForAudioCompletion(task: ConversationTaskState, timeoutMs = 10 * 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = getAudioJobByTask(task.taskId);
    if (!job) {
      throw new Error("未找到录音分析任务");
    }
    if (job.status === "succeeded" && job.outputTaskId) {
      return job.outputTaskId;
    }
    if (job.status === "failed") {
      throw new Error(job.error ?? "录音分析失败");
    }
    await sleep(2000);
  }
  throw new Error("等待录音分析超时");
}

const graph = new StateGraph(GraphAnnotation)
  .addNode("ingest_audio", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    updateTaskNode(state.taskId, "ingest_audio", "analyzing_audio");
    return {};
  })
  .addNode("wait_customer_name", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    const task = ensureTask(state.taskId);
    insertClarificationMessage(task, "wait_customer_name", {
      title: "客户名称澄清",
      question: "客户名称是什么？",
      placeholder: "请输入客户名称",
      status: "pending",
    });
    updateTask(task.taskId, {
      graphNode: "wait_customer_name",
      status: "waiting_customer_name",
      currentInterrupt: "wait_customer_name",
      interruptPayload: { question: "客户名称是什么？" },
    });
    const answer = interrupt({ kind: "customer_name", question: "客户名称是什么？" });
    const customerName = String(answer ?? "").trim();
    markClarificationResolved(ensureTask(task.taskId), "wait_customer_name");
    updateTask(task.taskId, {
      customerName,
      currentInterrupt: null,
      interruptPayload: null,
      status: "running",
    });
    return { customerName };
  })
  .addNode("run_company_research", async (state: GraphState) => {
    if (!state.taskId || !state.customerName) throw new Error("Missing research prerequisites");
    updateTaskNode(state.taskId, "run_company_research", "running");
    const task = ensureTask(state.taskId);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "正在生成公司研究",
      status: "info",
      body: "系统正在调用公司研究能力生成公司研究报告，请稍候。",
    });
    const result = await runCompanyResearch({
      companyName: state.customerName,
      artifactDir: task.artifactRoot,
      researchPurpose: "CRM 拜访记录录入与客户研究",
    });
    insertArtifactCard(task.taskId, task.threadId, {
      artifactType: "company_research",
      title: "公司研究已生成",
      fileName: result.fileName,
      filePath: result.filePath,
      subtitle: "company-research-pm + 搜索增强",
    });
    return {
      researchFilePath: result.filePath,
      researchPreview: result.preview,
    };
  })
  .addNode("upsert_visit_record_and_customer", async (state: GraphState) => {
    if (!state.taskId || !state.customerName) throw new Error("Missing visit upsert prerequisites");
    updateTaskNode(state.taskId, "upsert_visit_record_and_customer", "running");
    const task = ensureTask(state.taskId);
    const outputTaskId = await waitForAudioCompletion(task);
    const bundle = loadTongyiOutput(outputTaskId, OUTPUTS_DIR);
    const visitRecordId = state.visitRecordId ?? `visit_${nanoid(10)}`;
    const visitMarkdown = buildVisitMarkdown({
      customerName: state.customerName,
      visitRecordId,
      taskOutputId: outputTaskId,
      bundle,
    });
    const visitMarkdownPath = join(task.artifactRoot, "拜访纪要.md");
    writeFileSync(visitMarkdownPath, visitMarkdown, "utf-8");

    const result = await executeOntologySkill<AudioSkillResult>("ont.crm.visit_record_create_from_markdown", {
      visit_record_id: visitRecordId,
      customer_name: state.customerName,
      title: `${state.customerName} 拜访录音导入`,
      sequence_no: 1,
      visit_type: "uploaded_audio",
      content_markdown: visitMarkdown,
      visit_at: nowIso().slice(0, 10),
      source_channel: "tongyi_audio",
      task_output_id: outputTaskId,
    });
    if (!result.success) {
      throw new Error(result.error ?? "拜访记录入库失败");
    }
    updateTask(task.taskId, {
      customerName: state.customerName,
      customerId: result.data?.customer_id ?? null,
      visitRecordId: result.data?.visit_record_id ?? visitRecordId,
      tingwuTaskId: outputTaskId,
      payload: {
        ...task.payload,
        transcriptSummary: bundle.summaryText,
      },
    });
    return {
      customerId: result.data?.customer_id ?? null,
      visitRecordId: result.data?.visit_record_id ?? visitRecordId,
      tingwuTaskId: outputTaskId,
      visitMarkdownPath,
      transcriptText: buildTranscriptText(bundle),
    };
  })
  .addNode("analyze_visit_record", async (state: GraphState) => {
    if (!state.taskId || !state.visitRecordId) throw new Error("Missing visit record id");
    updateTaskNode(state.taskId, "analyze_visit_record", "running");
    const result = await executeOntologySkill<AudioSkillResult>("ont.crm.visit_record_analyze", {
      visit_record_id: state.visitRecordId,
    });
    if (!result.success) {
      throw new Error(result.error ?? "拜访记录分析失败");
    }
    const task = ensureTask(state.taskId);
    updateTask(task.taskId, {
      payload: {
        ...task.payload,
        visitAnalysis: result.data ?? {},
      },
    });
    return {
      visitSummary: result.data?.summary ?? "",
    };
  })
  .addNode("check_scene_enhancement", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    updateTaskNode(state.taskId, "check_scene_enhancement", "running");
    return {
      sceneEnabled: true,
    };
  })
  .addNode("generate_assessment_markdown", async (state: GraphState) => {
    if (!state.taskId || !state.customerName || !state.visitRecordId || !state.tingwuTaskId) {
      throw new Error("Missing scene runtime prerequisites");
    }
    updateTaskNode(state.taskId, "generate_assessment_markdown", "running");
    const task = ensureTask(state.taskId);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "正在生成信息化评估",
      status: "info",
      body: "系统正在基于录音分析结果整理信息化评估报告，请稍候。",
    });
    const result = await executeSceneRuntime<SceneRuntimeResult>("IT_ASSESSMENT", {
      ontology_id: "crm",
      customer_name: state.customerName,
      visit_record_id: state.visitRecordId,
      tingwu_task_id: state.tingwuTaskId,
      task_id: state.taskId,
      artifact_root: task.artifactRoot,
    });
    insertArtifactCard(task.taskId, task.threadId, {
      artifactType: "it_assessment_markdown",
      title: "信息化评估已生成",
      fileName: "信息化评估.md",
      filePath: result.assessment_markdown_path,
      subtitle: "scene IT_ASSESSMENT",
    });
    return {
      assessmentFilePath: result.assessment_markdown_path,
      assessmentPptSourcePath: result.assessment_ppt_source_path,
    };
  })
  .addNode("generate_company_analysis_ppt", async (state: GraphState) => {
    if (!state.taskId || !state.customerName || !state.researchFilePath) {
      throw new Error("Missing company analysis ppt prerequisites");
    }
    updateTaskNode(state.taskId, "generate_company_analysis_ppt", "running");
    const task = ensureTask(state.taskId);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "正在生成公司分析报告",
      status: "info",
      body: "系统正在按 EXT009 同样的方式调用 pptx 技能生成公司分析报告，请稍候。",
    });

    const companyAnalysisOutputPath = join(
      task.artifactRoot,
      safePptFileName(`${state.customerName}-公司分析报告`),
    );
    const companyAnalysisPpt = await runPptxWithRetry({
      taskPrompt: buildCompanyAnalysisPptTask(state.customerName, state.researchFilePath, companyAnalysisOutputPath),
      retryHint:
        "1. 必须使用 `let pres = new PptxGenJS();` 作为演示文稿变量名。 2. 不要定义依赖全局 pres 的辅助函数；如需辅助函数，请显式传入 slide。 3. 输出必须是完整可执行的 Node.js CommonJS 代码。",
    });
    if (!companyAnalysisPpt.success || isPptExecutionFailure(companyAnalysisPpt)) {
      throw new Error(companyAnalysisPpt.error ?? "company analysis ppt generation failed");
    }
    const companyAnalysisGeneratedPath = extractPptxPath(companyAnalysisPpt.spawnOutput || companyAnalysisPpt.substitutedBody || "");
    if (!companyAnalysisGeneratedPath || !existsSync(companyAnalysisGeneratedPath)) {
      throw new Error("未找到公司分析报告 PPTX");
    }
    insertArtifactCard(task.taskId, task.threadId, {
      artifactType: "company_analysis_pptx",
      title: "公司分析报告已生成",
      fileName: safePptFileName(`${state.customerName}-公司分析报告`),
      filePath: companyAnalysisGeneratedPath,
      subtitle: "按 EXT009 调用方式生成",
    });
    return {
      companyAnalysisPptPath: companyAnalysisGeneratedPath,
      companyAnalysisPptName: safePptFileName(`${state.customerName}-公司分析报告`),
    };
  })
  .addNode("generate_it_assessment_ppt", async (state: GraphState) => {
    if (!state.taskId || !state.customerName || !state.assessmentPptSourcePath) {
      throw new Error("Missing IT assessment ppt prerequisites");
    }
    updateTaskNode(state.taskId, "generate_it_assessment_ppt", "running");
    const task = ensureTask(state.taskId);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "正在生成信息化评估报告",
      status: "info",
      body: "系统正在按 EXT009 同样的方式调用 pptx 技能生成信息化评估报告，请稍候。",
    });

    const itAssessmentOutputPath = join(
      task.artifactRoot,
      safePptFileName(`${state.customerName}-信息化评估报告`),
    );
    const itAssessmentPpt = await runPptxWithRetry({
      taskPrompt: buildItAssessmentPptTask(state.customerName, state.assessmentPptSourcePath, itAssessmentOutputPath),
      retryHint:
        "1. 仅生成 3 页，禁止过度抽象。 2. 必须使用 `let pres = new PptxGenJS();`。 3. 不要定义依赖全局 pres 的辅助函数；如需辅助函数，请显式传入 slide。 4. 输出必须是完整可执行的 Node.js CommonJS 代码。",
    });
    if (!itAssessmentPpt.success || isPptExecutionFailure(itAssessmentPpt)) {
      throw new Error(itAssessmentPpt.error ?? "it assessment ppt generation failed");
    }
    const itAssessmentGeneratedPath = extractPptxPath(itAssessmentPpt.spawnOutput || itAssessmentPpt.substitutedBody || "");
    if (!itAssessmentGeneratedPath || !existsSync(itAssessmentGeneratedPath)) {
      throw new Error("未找到信息化评估报告 PPTX");
    }
    insertArtifactCard(task.taskId, task.threadId, {
      artifactType: "it_assessment_pptx",
      title: "信息化评估报告已生成",
      fileName: safePptFileName(`${state.customerName}-信息化评估报告`),
      filePath: itAssessmentGeneratedPath,
      subtitle: "按 EXT009 调用方式生成",
    });
    return {
      itAssessmentPptPath: itAssessmentGeneratedPath,
      itAssessmentPptName: safePptFileName(`${state.customerName}-信息化评估报告`),
    };
  })
  .addNode("wait_speaker_fix", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    const task = ensureTask(state.taskId);
    const alreadyReady = Boolean(task.payload?.speakerProfileReady);
    if (alreadyReady) {
      updateTask(state.taskId, {
        graphNode: "wait_speaker_fix",
        status: "running",
        currentInterrupt: null,
        interruptPayload: null,
      });
      return {};
    }
    updateTask(state.taskId, {
      graphNode: "wait_speaker_fix",
      status: "waiting_speaker_fix",
      currentInterrupt: "wait_speaker_fix",
      interruptPayload: { message: "等待发言人修正与画像分析完成" },
    });
    interrupt({
      kind: "speaker_fix",
      question: "请在详情页修正发言人并保存，系统将自动继续。",
    });
    return {};
  })
  .addNode("sync_contacts_from_speakers", async (state: GraphState) => {
    if (!state.taskId || !state.visitRecordId || !state.customerName) throw new Error("Missing speaker sync prerequisites");
    updateTaskNode(state.taskId, "sync_contacts_from_speakers", "running");
    const syncResult = await syncSpeakerProfilesForTask(state.taskId);
    return {
      profileMarkdown: syncResult.profileMarkdown,
    };
  })
  .addNode("push_profiles_and_graph", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    updateTaskNode(state.taskId, "push_profiles_and_graph", "running");
    const task = ensureTask(state.taskId);
    insertClarificationMessage(task, "wait_opportunity_confirmation", {
      title: "商机信息确认",
      question: "请输入客户意向产品，金额",
      placeholder: "例如：轻云、融合中心，10万",
      status: "pending",
    });
    return {};
  })
  .addNode("wait_opportunity_confirmation", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    updateTask(state.taskId, {
      graphNode: "wait_opportunity_confirmation",
      status: "waiting_opportunity_confirmation",
      currentInterrupt: "wait_opportunity_confirmation",
      interruptPayload: { question: "请输入客户意向产品，金额" },
    });
    const answer = interrupt({
      kind: "opportunity_confirmation",
      question: "请输入客户意向产品，金额",
    });
    const opportunityInputText = String(answer ?? "").trim();
    markClarificationResolved(ensureTask(state.taskId), "wait_opportunity_confirmation");
    return { opportunityInputText };
  })
  .addNode("save_opportunity", async (state: GraphState) => {
    if (!state.taskId || !state.customerId || !state.customerName || !state.opportunityInputText) {
      throw new Error("Missing opportunity creation prerequisites");
    }
    updateTaskNode(state.taskId, "save_opportunity", "running");
    const parsed = parseOpportunityInput(state.opportunityInputText);
    const result = await executeOntologySkill<AudioSkillResult>("ont.crm.opportunity_create", {
      customer_id: state.customerId,
      name: `${state.customerName} 拜访商机`,
      amount: parsed.amount ?? 0,
      product_notes: parsed.productNotes,
      source_task_id: state.taskId,
      stage: "需求分析",
      probability: 50,
    });
    if (!result.success) {
      throw new Error(result.error ?? "商机创建失败");
    }
    const task = ensureTask(state.taskId);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "商机已保存",
      status: "success",
      body: `已保存客户意向产品：${parsed.productNotes || "未填写"}；金额：${parsed.amount ?? 0} 元。`,
    });
    updateTask(task.taskId, {
      opportunityStatus: "completed",
      currentInterrupt: null,
      interruptPayload: null,
    });
    return {
      opportunityId: result.data?.opportunity_id ?? null,
    };
  })
  .addNode("complete_task", async (state: GraphState) => {
    if (!state.taskId) throw new Error("Missing taskId");
    updateTask(state.taskId, {
      graphNode: "complete_task",
      status: "completed",
    });
    return {};
  })
  .addEdge(START, "ingest_audio")
  .addEdge("ingest_audio", "wait_customer_name")
  .addEdge("wait_customer_name", "run_company_research")
  .addEdge("run_company_research", "upsert_visit_record_and_customer")
  .addEdge("upsert_visit_record_and_customer", "analyze_visit_record")
  .addEdge("analyze_visit_record", "check_scene_enhancement")
  .addEdge("check_scene_enhancement", "generate_assessment_markdown")
  .addEdge("generate_assessment_markdown", "generate_company_analysis_ppt")
  .addEdge("generate_company_analysis_ppt", "generate_it_assessment_ppt")
  .addEdge("generate_it_assessment_ppt", "wait_speaker_fix")
  .addEdge("wait_speaker_fix", "sync_contacts_from_speakers")
  .addEdge("sync_contacts_from_speakers", "push_profiles_and_graph")
  .addEdge("push_profiles_and_graph", "wait_opportunity_confirmation")
  .addEdge("wait_opportunity_confirmation", "save_opportunity")
  .addEdge("save_opportunity", "complete_task")
  .addEdge("complete_task", END)
  .compile({
    checkpointer: new SqliteSaver(),
  });

async function runAudioWorker(taskId: string, analysisMessageId: string) {
  const task = ensureTask(taskId);
  const audioJob = getAudioJobByTask(task.taskId);
  if (!audioJob) return;
  try {
    insertTaskStatus(task.taskId, task.threadId, {
      title: "正在分析录音",
      status: "info",
      body: "系统正在解析录音、提炼摘要与章节，请稍候。",
    });
    updateAudioJob(audioJob.id, { status: "analyzing", error: null });
    updateMessagePayload(task.threadId, analysisMessageId, {
      status: "analyzing",
      error: null,
    } satisfies Partial<AnalysisCardPayload>);

    const result = await runAudioAnalysis({
      audioPath: audioJob.audioPath,
    });

    updateAudioJob(audioJob.id, {
      status: "succeeded",
      outputTaskId: result.outputTaskId,
      error: null,
    });
    updateTask(task.taskId, {
      tingwuTaskId: result.outputTaskId,
    });
    updateMessagePayload(task.threadId, analysisMessageId, {
      status: "succeeded",
      taskId: result.outputTaskId,
      error: null,
    } satisfies Partial<AnalysisCardPayload>);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "录音分析已完成",
      status: "success",
      body: "录音摘要已生成，系统将继续执行客户研究和信息化分析。",
      actionLabel: "查看详情",
      actionUrl: `/meeting-viewer/?task=${result.outputTaskId}`,
      openInNewTab: true,
    });
    insertTaskStatus(task.taskId, task.threadId, {
      title: "下一步：修正发言人",
      status: "info",
      body: "你现在可以先打开录音详情页修正发言人姓名，并标记“我司成员”，此步骤不再依赖其他内容生成完成。",
      actionLabel: "查看详情",
      actionUrl: `/meeting-viewer/?task=${result.outputTaskId}`,
      openInNewTab: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateAudioJob(audioJob.id, {
      status: "failed",
      error: message,
    });
    updateTask(task.taskId, {
      status: "failed",
      graphNode: "ingest_audio",
      currentInterrupt: null,
      interruptPayload: null,
    });
    updateMessagePayload(task.threadId, analysisMessageId, {
      status: "failed",
      error: message,
    } satisfies Partial<AnalysisCardPayload>);
    insertTaskStatus(task.taskId, task.threadId, {
      title: "录音分析失败",
      status: "error",
      body: message,
    });
  }
}

export function startAudioWorker(taskId: string) {
  const task = ensureTask(taskId);
  if (!task.analysisMessageId) return;
  void runAudioWorker(taskId, task.analysisMessageId);
}

function graphConfigForTask(taskId: string, threadId: string) {
  return {
    configurable: {
      thread_id: taskId,
      checkpoint_ns: threadId,
    },
  };
}

async function handleGraphResult(taskId: string, result: Record<string, unknown>) {
  const task = ensureTask(taskId);
  const state = await graph.getState(graphConfigForTask(taskId, task.threadId));
  if ("__interrupt__" in result) {
    const interruptPayload = Array.isArray((result as { __interrupt__?: unknown[] }).__interrupt__)
      ? (result as { __interrupt__?: Array<{ value?: Record<string, unknown> }> }).__interrupt__?.[0]?.value ?? null
      : null;
    const kind = typeof interruptPayload === "object" && interruptPayload && "kind" in interruptPayload ? String(interruptPayload.kind) : state.tasks[0]?.name ?? null;
    const nextStatus =
      kind === "customer_name"
        ? "waiting_customer_name"
        : kind === "speaker_fix"
          ? "waiting_speaker_fix"
          : kind === "opportunity_confirmation"
            ? "waiting_opportunity_confirmation"
            : "running";
    updateTask(taskId, {
      status: nextStatus,
      currentInterrupt: kind === "customer_name" ? "wait_customer_name" : kind === "opportunity_confirmation" ? "wait_opportunity_confirmation" : "wait_speaker_fix",
      interruptPayload: interruptPayload,
      graphNode: state.next[0] ?? task.graphNode,
    });
    return;
  }

  if (state.next.length === 0) {
    updateTask(taskId, {
      status: "completed",
      currentInterrupt: null,
      interruptPayload: null,
      graphNode: "complete_task",
    });
  }
}

export async function runTaskGraph(taskId: string, input: GraphState | Command) {
  if (runningTasks.has(taskId)) return;
  runningTasks.add(taskId);
  try {
    const task = ensureTask(taskId);
    const result = await graph.invoke(input as never, graphConfigForTask(taskId, task.threadId));
    await handleGraphResult(taskId, result as Record<string, unknown>);
  } catch (error) {
    const task = ensureTask(taskId);
    const message = error instanceof Error ? error.message : String(error);
    updateTask(taskId, {
      status: "failed",
      currentInterrupt: null,
      interruptPayload: null,
    });
    insertTaskStatus(task.taskId, task.threadId, {
      title: "任务执行失败",
      status: "error",
      body: `当前任务在 ${task.graphNode || "未知节点"} 阶段失败：${message}`,
    });
  } finally {
    runningTasks.delete(taskId);
  }
}

export function queueStartTask(input: GraphState) {
  if (!input.taskId) throw new Error("Missing taskId");
  void runTaskGraph(input.taskId, input);
}

export function queueResumeTask(taskId: string, resumeValue: unknown) {
  void runTaskGraph(taskId, new Command({ resume: resumeValue }));
}

export function createAudioAnalysisJob(taskId: string, fileName: string, audioPath: string) {
  const jobId = nanoid(12);
  createAudioJob({
    id: jobId,
    taskId,
    fileName,
    audioPath,
    status: "queued",
  });
  return jobId;
}

export async function triggerSpeakerProfileWorkflow(taskId: string) {
  const task = ensureTask(taskId);
  updateTask(task.taskId, {
    speakerSyncStatus: "pending",
    payload: {
      ...(task.payload || {}),
      speakerProfileReady: true,
    },
  });

  const latest = ensureTask(taskId);
  if (!latest.customerId || !latest.visitRecordId) {
    return { success: true, deferred: true };
  }

  const result = await syncSpeakerProfilesForTask(taskId);

  if (latest.currentInterrupt === "wait_speaker_fix") {
    queueResumeTask(taskId, {
      source: "meeting_viewer",
      ready: true,
      immediate: true,
    });
  }

  return { success: true, deferred: false, result };
}
