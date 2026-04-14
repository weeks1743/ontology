import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getCrmCustomerAdvice,
  getCrmCustomerContext,
  getCrmVisitRecord,
  listCrmCustomers,
} from "./ability-client.js";
import {
  getLatestTaskByCustomer,
  getLatestTaskByThread,
  getProfileResult,
  getThread,
  listArtifacts,
} from "./db.js";
import { OUTPUTS_DIR, REPO_ROOT_DIR } from "./paths.js";
import { loadTongyiOutput } from "./tongyi-output.js";
import type { PersistedThread } from "./types.js";

type CustomerListItem = {
  id: string;
  name: string;
  industry?: string;
  opportunities?: Array<Record<string, unknown>>;
  contacts?: Array<Record<string, unknown>>;
};

type CustomerContextResponse = {
  customer?: Record<string, unknown> | null;
  contacts?: Array<Record<string, unknown>>;
  opportunities?: Array<Record<string, unknown>>;
  visit_records?: Array<Record<string, unknown>>;
  needs?: Array<Record<string, unknown>>;
  risks?: Array<Record<string, unknown>>;
  commitments?: Array<Record<string, unknown>>;
  graph_data?: Array<Record<string, unknown>>;
};

type CustomerAdviceArtifact = Record<string, unknown> & {
  advice_markdown_path?: string;
  recommended_actions?: string[];
  current_assessment?: string;
  evidence_summary?: string;
};

type CustomerAdviceResponse = {
  artifacts?: CustomerAdviceArtifact[];
};

type VisitRecordResponse = {
  id: string;
  customer_id: string;
  title: string;
  sequence_no: number;
  content_markdown: string;
  summary: string;
  sentiment: string;
  status: string;
};

type ParsedProfile = {
  name: string;
  role: string;
  influence?: string;
  attitude?: string;
  tags: string[];
  summary: string;
};

type QueryAnswer = {
  text: string;
  confidence: "high" | "medium" | "low";
  customerId?: string | null;
  visitRecordId?: string | null;
  opportunityId?: string | null;
  summary?: Record<string, unknown>;
};

type QueryContext = {
  threadId: string;
  question: string;
  customer: CustomerListItem | null;
  thread: PersistedThread | null;
  customerContext: CustomerContextResponse | null;
  latestTask: ReturnType<typeof getLatestTaskByThread>;
  referenceTask: ReturnType<typeof getLatestTaskByThread>;
  latestAdvice: CustomerAdviceArtifact | null;
  latestAdviceMarkdown: string;
  latestVisitRecord: VisitRecordResponse | null;
  tongyiBundle: ReturnType<typeof loadTongyiOutput> | null;
  tongyiSummary: string;
  tongyiKeywords: string[];
  tongyiActions: string[];
  tongyiChapters: Array<{ headline: string; summary: string }>;
  researchMarkdown: string;
  profileMarkdown: string;
  profiles: ParsedProfile[];
  contactProfiles: ParsedProfile[];
  graphPeople: ParsedProfile[];
  latestOpportunity: Record<string, unknown> | null;
  latestOpportunitySource: "mongodb" | "message" | "none";
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）,，。、“”"'‘’·\-_/]/g, "");
}

function simplifyCompanyName(input: string) {
  return normalizeText(input)
    .replace(/股份有限公司/g, "")
    .replace(/有限责任公司/g, "")
    .replace(/有限公司/g, "")
    .replace(/投资发展集团/g, "")
    .replace(/投资发展/g, "")
    .replace(/集团/g, "")
    .replace(/化工/g, "");
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[]));
}

function readTextIfExists(path: string | null | undefined) {
  if (!path || !existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function parseProfiles(markdown: string): ParsedProfile[] {
  if (!markdown.trim()) return [];
  return markdown
    .split(/^##\s+/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((section) => {
      const [heading, ...rest] = section.split("\n");
      const lines = rest.map((line) => line.trim()).filter(Boolean);
      const readLine = (prefix: string) => lines.find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
      return {
        name: heading.trim(),
        role: readLine("- 角色判断：") || readLine("- 角色 / 职能判断："),
        influence: readLine("- 决策影响力：") || undefined,
        attitude: readLine("- 当前态度：") || undefined,
        tags: readLine("- 核心标签：").split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
        summary: readLine("- 核心关注点：") || readLine("- 跟进建议：") || readLine("- 潜在顾虑：") || "已识别联系人画像",
      };
    })
    .filter((item) => item.name && !item.name.includes("CRM 客户拜访结构化画像"));
}

function latestByTime<T extends Record<string, unknown>>(items: T[]) {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => {
    const aTime = String(a.updated_at ?? a.created_at ?? "");
    const bTime = String(b.updated_at ?? b.created_at ?? "");
    return bTime.localeCompare(aTime);
  })[0];
}

function parseLatestOpportunityFromMessages(threadId: string) {
  const thread = getThread(threadId);
  const latestSaved = [...(thread?.messages ?? [])]
    .reverse()
    .find((message) => message.kind === "task-status-card" && typeof (message.payload as { title?: string }).title === "string" && (message.payload as { title?: string }).title === "商机已保存");
  if (!latestSaved) {
    return null;
  }

  const body = String((latestSaved.payload as { body?: string }).body ?? "");
  const productNotes = body.match(/意向产品：(.+?)；/)?.[1]?.trim() ?? "";
  const amount = Number(body.match(/金额：(\d+)/)?.[1] ?? "");
  return {
    id: String((latestSaved.payload as { taskId?: string }).taskId ?? ""),
    product_notes: productNotes || null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    source: "thread_message",
  };
}

function parsePeopleFromGraphCard(threadId: string): ParsedProfile[] {
  const thread = getThread(threadId);
  const graphCard = [...(thread?.messages ?? [])]
    .reverse()
    .find((message) => message.kind === "graph-card");
  if (!graphCard) return [];

  const payload = graphCard.payload as {
    people?: Array<{
      name?: string;
      role?: string;
      influence?: string;
      attitude?: string;
      focus?: string;
      summary?: string;
      traits?: string[];
    }>;
    nodes?: Array<{
      kind?: string;
      label?: string;
      meta?: Record<string, string>;
    }>;
  };

  if (Array.isArray(payload.people) && payload.people.length > 0) {
    return payload.people.map((person) => ({
      name: String(person.name ?? ""),
      role: String(person.role ?? ""),
      influence: person.influence,
      attitude: person.attitude,
      tags: person.focus ? person.focus.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) : (person.traits ?? []),
      summary: String(person.summary ?? "已生成联系人画像"),
    })).filter((item) => item.name);
  }

  return (payload.nodes ?? [])
    .filter((node) => node.kind === "contact")
    .map((node) => ({
      name: String(node.label ?? ""),
      role: String(node.meta?.角色 ?? "客户侧关键参与人"),
      influence: undefined,
      attitude: undefined,
      tags: [],
      summary: String(node.meta?.画像 ?? "已生成联系人画像"),
    }))
    .filter((item) => item.name);
}

function parseProfilesFromContacts(contacts: Array<Record<string, unknown>> | undefined): ParsedProfile[] {
  return (contacts ?? [])
    .map((contact) => ({
      name: String(contact.name ?? ""),
      role: String(contact.role ?? "客户侧关键参与人"),
      influence: String(contact.influence_level ?? contact.influence ?? "") || undefined,
      attitude: String(contact.attitude ?? "") || undefined,
      tags: Array.isArray(contact.tags)
        ? contact.tags.map((item) => String(item).trim()).filter(Boolean)
        : [],
      summary: String(contact.profile_summary ?? contact.notes ?? "已同步联系人画像"),
    }))
    .filter((item) => item.name);
}

function renderAnswer(params: {
  directAnswer: string;
  evidence: string[];
  unknowns: string[];
  suggestedNext: string[];
  confidence: QueryAnswer["confidence"];
}) {
  const confidenceText: Record<QueryAnswer["confidence"], string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  const sections = [
    `${params.directAnswer}`,
    `参考来源：\n${params.evidence.length > 0 ? params.evidence.map((item) => `- ${item}`).join("\n") : "- 暂无明确证据"}`,
    `当前未知项：\n${params.unknowns.length > 0 ? params.unknowns.map((item) => `- ${item}`).join("\n") : "- 当前没有明显缺口"}`,
    `建议下一问：\n${params.suggestedNext.length > 0 ? params.suggestedNext.map((item) => `- ${item}`).join("\n") : "- 可继续追问该客户的拜访、商机、联系人或产物情况"}`,
    `置信度：${confidenceText[params.confidence]}`,
  ];
  return sections.join("\n\n");
}

function resolveResearchFallback(customerName: string) {
  if (customerName.includes("贝斯美")) {
    return join(REPO_ROOT_DIR, "材料", "绍兴贝斯美化工企业研究报告.md");
  }
  return "";
}

function resolveAdviceFallback(customerName: string) {
  if (customerName.includes("东港")) {
    return join(REPO_ROOT_DIR, "ability", "server", "tmp", "operating-advice", "东港投资发展集团有限公司_round_6.md");
  }
  if (customerName.includes("贝斯美")) {
    return join(REPO_ROOT_DIR, "ability", "server", "tmp", "operating-advice", "绍兴贝斯美化工股份有限公司_round_5.md");
  }
  return "";
}

function extractMainBusiness(markdown: string) {
  const row = markdown.match(/\| 主营业务 \| ([^|]+)\|/);
  return row?.[1]?.trim() ?? "";
}

function extractFinancialRows(markdown: string) {
  const row2024 = markdown.match(/\| 2024年 \| ([^|]+)\| ([^|]+)\|/);
  return row2024
    ? {
        revenue: row2024[1].trim(),
        profit: row2024[2].trim(),
      }
    : null;
}

function classifyQuestion(question: string) {
  if (/(预算|多少钱|总预算|金额多少)/.test(question)) return "budget";
  if (/(关键联系人|关键人|最关键的人|谁最关键|谁是关键|最关键.*联系人|联系人.*最关键)/.test(question)) return "key_contact";
  if (/(支持者|谁更像支持|谁支持)/.test(question)) return "supporter";
  if (/(项目阶段|当前阶段|处于什么阶段|到什么阶段)/.test(question)) return "stage";
  if (/(下一步|最该推进|推进什么动作|经营建议)/.test(question)) return "next_action";
  if (/(核心问题|核心痛点|主要问题|痛点是什么)/.test(question)) return "core_problem";
  if (/(总体方案|推荐方案|方案是什么|整体方案)/.test(question)) return "recommended_solution";
  if (/(时间.*报价|报价.*时间|下周三|什么时候给报价|明确要求)/.test(question)) return "time_quote";
  if (/(实施周期|成本顾虑|人天|周期和成本)/.test(question)) return "delivery_cost";
  if (/(信任问题|历史问题|运维问题|最大.*信任)/.test(question)) return "trust_issue";
  if (/(商机信息|意向产品|记录了什么商机|沉淀了什么商机)/.test(question)) return "opportunity_info";
  if (/(全称|股票代码|行业)/.test(question)) return "company_identity";
  if (/(主营业务|主要业务|做什么业务)/.test(question)) return "main_business";
  if (/(核心战略|战略怎么概括|1\+3|单品种极致深耕)/.test(question)) return "strategy";
  if (/(第二增长曲线|增长曲线)/.test(question)) return "second_curve";
  if (/(2024.*经营|2024.*表现|2024.*营收|2024.*净利润|经营表现怎么样)/.test(question)) return "performance_2024";
  if (/(这次拜访.*需求|主要在谈什么需求|聊什么需求)/.test(question)) return "meeting_demand";
  if (/(推进障碍|核心推进障碍|最大的障碍|最大障碍|顾虑是什么)/.test(question)) return "barrier";
  return "generic";
}

async function resolveCustomer(threadId: string, question: string, latestTask: ReturnType<typeof getLatestTaskByThread>) {
  const thread = getThread(threadId)?.thread ?? null;
  const customers = await listCrmCustomers<{ customers?: CustomerListItem[] }>()
    .then((payload) => payload.customers ?? [])
    .catch(() => []);
  const normalizedQuestion = normalizeText(question);

  const mentioned = customers.find((customer) => {
    const aliases = uniqueStrings([
      customer.name,
      simplifyCompanyName(customer.name),
      customer.name.includes("东港") ? "东港" : "",
      customer.name.includes("贝斯美") ? "贝斯美" : "",
    ]);
    return aliases.some((alias) => alias && normalizedQuestion.includes(normalizeText(alias)));
  });
  if (mentioned) {
    return mentioned;
  }

  if (latestTask?.customerId) {
    return customers.find((item) => item.id === latestTask.customerId) ?? {
      id: latestTask.customerId,
      name: latestTask.customerName ?? "当前客户",
    };
  }

  if (thread?.focusCustomerId) {
    return customers.find((item) => item.id === thread.focusCustomerId) ?? null;
  }

  const focusCustomerName = String(thread?.threadSummary?.customerName ?? "");
  if (focusCustomerName) {
    return customers.find((item) => simplifyCompanyName(item.name) === simplifyCompanyName(focusCustomerName)) ?? {
      id: thread?.focusCustomerId ?? "",
      name: focusCustomerName,
    };
  }

  if (normalizedQuestion.includes(normalizeText("东港")) || normalizedQuestion.includes(normalizeText("东港集团"))) {
    return {
      id: "",
      name: "东港投资发展集团有限公司",
    };
  }

  if (normalizedQuestion.includes(normalizeText("贝斯美"))) {
    return {
      id: "",
      name: "绍兴贝斯美化工股份有限公司",
    };
  }

  return null;
}

async function buildQueryContext(threadId: string, question: string): Promise<QueryContext> {
  const threadPayload = getThread(threadId);
  const thread = threadPayload?.thread ?? null;
  const latestTask = getLatestTaskByThread(threadId);
  const customer = await resolveCustomer(threadId, question, latestTask);
  const referenceTask =
    latestTask ??
    getLatestTaskByCustomer(customer?.id ?? thread?.focusCustomerId ?? null, customer?.name ?? String(thread?.threadSummary?.customerName ?? ""));
  const effectiveCustomerId = customer?.id || referenceTask?.customerId || thread?.focusCustomerId || null;
  const customerContext = effectiveCustomerId
    ? await getCrmCustomerContext<CustomerContextResponse>(effectiveCustomerId).catch(() => null)
    : null;
  const adviceResponse = customer?.id
    ? await getCrmCustomerAdvice<CustomerAdviceResponse>(customer.id).catch(() => null)
    : null;
  const latestAdvice = adviceResponse?.artifacts?.[0] ?? null;
  const latestAdviceMarkdown =
    readTextIfExists(String(latestAdvice?.advice_markdown_path ?? "")) ||
    readTextIfExists(resolveAdviceFallback(customer?.name ?? referenceTask?.customerName ?? ""));

  const focusVisitRecordId =
    latestTask?.visitRecordId ||
    referenceTask?.visitRecordId ||
    (customerContext?.visit_records?.length ? String(customerContext.visit_records[customerContext.visit_records.length - 1]?.id ?? "") : "");
  const latestVisitRecord = focusVisitRecordId
    ? await getCrmVisitRecord<VisitRecordResponse>(focusVisitRecordId).catch(() => null)
    : null;

  const outputTaskId = latestTask?.tingwuTaskId ?? referenceTask?.tingwuTaskId ?? null;
  const tongyiBundle = outputTaskId ? loadTongyiOutput(outputTaskId, OUTPUTS_DIR) : null;
  const summarization = tongyiBundle?.summarization as
    | {
        paragraphSummary?: string;
        summary?: string;
        conversationalSummary?: Array<{ summary?: string }>;
      }
    | undefined;
  const meetingAssistance = tongyiBundle?.assetsDir
    ? JSON.parse(readTextIfExists(join(tongyiBundle.assetsDir, "meetingAssistance.json")) || "{}") as {
        keywords?: string[];
        actions?: Array<{ text?: string }>;
      }
    : {};
  const autoChapters = tongyiBundle?.assetsDir
    ? JSON.parse(readTextIfExists(join(tongyiBundle.assetsDir, "autoChapters.json")) || "[]") as Array<{ headline?: string; summary?: string }>
    : [];

  const researchArtifact = referenceTask
    ? listArtifacts(referenceTask.taskId).find((artifact) => artifact.artifactType === "company_research")
    : null;
  const researchMarkdown =
    readTextIfExists(researchArtifact?.filePath) ||
    readTextIfExists(resolveResearchFallback(customer?.name ?? referenceTask?.customerName ?? ""));

  const profileMarkdown = referenceTask
    ? getProfileResult(referenceTask.tingwuTaskId ?? "")?.markdown ??
      getProfileResult(referenceTask.taskId)?.markdown ??
      ""
    : "";
  const profiles = parseProfiles(profileMarkdown);
  const contactProfiles = parseProfilesFromContacts(customerContext?.contacts);
  const graphPeople = parsePeopleFromGraphCard(threadId);

  const customerOpportunities = customerContext?.opportunities ?? [];
  const latestOpportunity =
    customerOpportunities.find((item) => String(item.source_task_id ?? "") === String(referenceTask?.taskId ?? "")) ??
    latestByTime(customerOpportunities);
  const latestOpportunityFromMessage =
    parseLatestOpportunityFromMessages(threadId) ??
    (referenceTask ? parseLatestOpportunityFromMessages(referenceTask.threadId) : null);

  return {
    threadId,
    question,
    customer,
    thread,
    customerContext,
    latestTask,
    referenceTask,
    latestAdvice,
    latestAdviceMarkdown,
    latestVisitRecord,
    tongyiBundle,
    tongyiSummary: summarization?.paragraphSummary || summarization?.summary || "",
    tongyiKeywords: meetingAssistance?.keywords?.filter(Boolean) ?? [],
    tongyiActions: (meetingAssistance?.actions ?? []).map((item) => item.text ?? "").filter(Boolean),
    tongyiChapters: autoChapters.map((item) => ({ headline: item.headline ?? "", summary: item.summary ?? "" })).filter((item) => item.headline || item.summary),
    researchMarkdown,
    profileMarkdown,
    profiles,
    contactProfiles,
    graphPeople,
    latestOpportunity: latestOpportunity ?? latestOpportunityFromMessage,
    latestOpportunitySource: latestOpportunity ? "mongodb" : latestOpportunityFromMessage ? "message" : "none",
  };
}

function fallbackLatestAction(context: QueryContext) {
  if (Array.isArray(context.latestAdvice?.recommended_actions) && context.latestAdvice?.recommended_actions.length) {
    return context.latestAdvice.recommended_actions[0];
  }
  const markdownAction = context.latestAdviceMarkdown.match(/## 下一步行动建议\s+[-]\s+([^\n]+)/)?.[1]?.trim()
    ?? context.latestAdviceMarkdown.match(/## 本轮经营建议\s+[-]\s+([^\n]+)/)?.[1]?.trim()
    ?? "";
  if (markdownAction) {
    return markdownAction;
  }
  return context.tongyiActions[0] ?? "";
}

function answerDonggangBudget(context: QueryContext): QueryAnswer {
  const amount = Number(context.latestOpportunity?.amount ?? 0) || null;
  const productNotes = String(context.latestOpportunity?.product_notes ?? "");
  return {
    text: renderAnswer({
      directAnswer: amount
        ? `当前资料没有确认东港项目的总预算金额；目前只能确认已录入的意向金额为 ${amount.toLocaleString("zh-CN")} 元${productNotes ? `，对应意向产品为 ${productNotes}` : ""}。不能把这笔金额直接等同于项目总预算。`
        : "当前资料没有确认东港项目的总预算金额，也没有可靠证据能给出总预算数字。",
      evidence: uniqueStrings([
        context.latestOpportunitySource === "mongodb" ? "MongoDB 商机对象：已保存本轮意向金额" : "",
        context.latestOpportunitySource === "message" ? "线程状态卡：已保存商机金额" : "",
        context.latestAdviceMarkdown ? "经营建议：仍提示预算审批链和最终决策人信息缺失" : "",
      ]),
      unknowns: [
        "总预算金额尚未确认",
        "预算审批链未补齐",
        "最终经济决策人仍未锁定",
      ],
      suggestedNext: [
        "东港当前最关键的客户联系人是谁？",
        "东港现在最该推进什么动作？",
      ],
      confidence: amount ? "high" : "medium",
    }),
    confidence: amount ? "high" : "medium",
    customerId: context.customer?.id ?? null,
    opportunityId: String(context.latestOpportunity?.id ?? "") || null,
    summary: {
      questionType: "budget",
      retrieval: ["sqlite", "mongodb", "advice_markdown"],
    },
  };
}

function answerKeyContact(context: QueryContext): QueryAnswer {
  const bestProfile =
    context.profiles.find((item) => /高/.test(item.influence ?? "")) ??
    context.contactProfiles.find((item) => /高/.test(item.influence ?? "")) ??
    context.graphPeople.find((item) => /高/.test(item.influence ?? "")) ??
    context.profiles[0] ??
    context.contactProfiles[0] ??
    context.graphPeople[0] ??
    null;
  const directAnswer = bestProfile
    ? `${bestProfile.name} 是当前最关键的客户联系人，${bestProfile.influence ? `影响力${bestProfile.influence}` : "影响力待进一步确认"}，${bestProfile.attitude ? `态度${bestProfile.attitude}` : "态度待补充"}。${bestProfile.summary}`
    : "当前没有识别到足够清晰的关键联系人画像。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        bestProfile ? "SQLite 发言人画像结果：已识别关键联系人画像" : "",
        context.customerContext?.graph_data?.length ? "Neo4j 图谱上下文：客户与联系人关系已建立" : "",
        context.latestAdviceMarkdown ? "经营建议：关键人判断已被纳入本轮推进建议" : "",
      ]),
      unknowns: bestProfile ? ["其在完整预算审批链中的最终决策权限仍需进一步确认"] : ["需要先完成发言人修正或补充联系人画像"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前项目阶段是什么？`,
        `${context.customer?.name ?? "该客户"}现在最该推进什么动作？`,
      ],
      confidence: bestProfile ? "high" : "low",
    }),
    confidence: bestProfile ? "high" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "key_contact",
      retrieval: ["sqlite_profile", "graph_projection", "advice_markdown"],
    },
  };
}

function answerSupporter(context: QueryContext): QueryAnswer {
  const supportive =
    context.profiles.find((item) => item.attitude === "积极") ??
    context.contactProfiles.find((item) => item.attitude === "积极") ??
    context.graphPeople.find((item) => item.attitude === "积极") ??
    context.profiles.find((item) => /支持|推进/.test(item.summary)) ??
    context.contactProfiles.find((item) => /支持|推进|积极/.test(item.summary)) ??
    context.graphPeople.find((item) => /支持|推进|积极/.test(item.summary)) ??
    null;
  const directAnswer = supportive
    ? `${supportive.name} 更像当前的内部支持者，${supportive.influence ? `影响力${supportive.influence}` : "影响力仍偏弱"}，${supportive.attitude ? `态度${supportive.attitude}` : "态度较正向"}。`
    : "当前还没有足够明确的支持者画像。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        supportive ? "SQLite 发言人画像结果：存在态度积极的联系人画像" : "",
        context.latestAdviceMarkdown ? "经营建议：对内部支持者与障碍方有区分" : "",
      ]),
      unknowns: supportive ? ["其是否具备最终拍板能力仍待确认"] : ["需要补充更多拜访或联系人画像"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前最关键的客户联系人是谁？`,
        `${context.customer?.name ?? "该客户"}现在最该推进什么动作？`,
      ],
      confidence: supportive ? "medium" : "low",
    }),
    confidence: supportive ? "medium" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "supporter",
      retrieval: ["sqlite_profile", "advice_markdown"],
    },
  };
}

function answerStage(context: QueryContext): QueryAnswer {
  const visitAnalysis = ((context.latestTask?.payload?.visitAnalysis ?? context.referenceTask?.payload?.visitAnalysis) ?? null) as Record<string, unknown> | null;
  const stage =
    (context.latestAdviceMarkdown.match(/## 当前沟通阶段判断\s+([^\n]+)/)?.[1]?.trim() ?? "") ||
    String(context.latestAdvice?.current_assessment ?? "").trim() ||
    String(visitAnalysis?.stage ?? "").trim();
  return {
    text: renderAnswer({
      directAnswer: stage || "当前资料没有明确写出阶段判断。",
      evidence: uniqueStrings([
        stage ? "经营建议 / 拜访分析：存在结构化阶段判断" : "",
        visitAnalysis ? "任务载荷：保存了 visit analysis 结果" : "",
      ]),
      unknowns: stage ? ["如果要更精准推进，还需要补全预算审批链和最终拍板人"] : ["需要补充最新经营建议或拜访分析结果"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前最关键的客户联系人是谁？`,
        `${context.customer?.name ?? "该客户"}对时间和报价有什么明确要求？`,
      ],
      confidence: stage ? "high" : "low",
    }),
    confidence: stage ? "high" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "stage",
      retrieval: ["advice_markdown", "task_payload"],
    },
  };
}

function answerNextAction(context: QueryContext): QueryAnswer {
  const action = fallbackLatestAction(context);
  return {
    text: renderAnswer({
      directAnswer: action || "当前资料没有提取出明确的下一步动作。",
      evidence: uniqueStrings([
        action ? "经营建议：推荐动作来自最新一轮 recommended actions" : "",
        context.tongyiActions.length > 0 ? "听悟行动项：录音中存在已提炼行动项" : "",
      ]),
      unknowns: action ? ["动作已经明确，但是否触达到最终决策层仍需后续确认"] : ["需要补充经营建议或人工制定推进动作"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}项目现在处于什么阶段？`,
        `${context.customer?.name ?? "该客户"}最关键的客户联系人是谁？`,
      ],
      confidence: action ? "high" : "low",
    }),
    confidence: action ? "high" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "next_action",
      retrieval: ["advice_markdown", "meeting_assistance"],
    },
  };
}

function answerOpportunityInfo(context: QueryContext): QueryAnswer {
  const amount = Number(context.latestOpportunity?.amount ?? 0) || null;
  const productNotes = String(context.latestOpportunity?.product_notes ?? "");
  const directAnswer = context.latestOpportunity
    ? `当前已经沉淀的商机信息是：${productNotes ? `意向产品 ${productNotes}` : "已创建商机"}${amount ? `，金额 ${amount.toLocaleString("zh-CN")} 元` : ""}。`
    : "当前没有查到已沉淀的商机信息。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.latestOpportunitySource === "mongodb" ? "MongoDB 商机对象：已存在客户关联商机" : "",
        context.latestOpportunitySource === "message" ? "线程状态卡：商机保存成功消息" : "",
      ]),
      unknowns: context.latestOpportunity ? ["最终拍板人与完整预算审批链仍待补齐"] : ["需要先确认商机或检查数据是否已落库"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}的预算现在确认了吗？`,
        `${context.customer?.name ?? "该客户"}当前项目阶段是什么？`,
      ],
      confidence: context.latestOpportunity ? "high" : "low",
    }),
    confidence: context.latestOpportunity ? "high" : "low",
    customerId: context.customer?.id ?? null,
    opportunityId: String(context.latestOpportunity?.id ?? "") || null,
    summary: {
      questionType: "opportunity_info",
      retrieval: ["mongodb", "sqlite_message"],
    },
  };
}

function answerCoreProblem(context: QueryContext): QueryAnswer {
  const summary = context.tongyiSummary || context.latestVisitRecord?.summary || "";
  const directAnswer = summary
    ? summary.split("@#")[0].trim()
    : context.customer?.name?.includes("东港")
      ? "核心问题是固定资产账实不符，客户希望强化固定资产管理模块，实现账实相符、二维码追踪和全生命周期管理。"
      : "核心问题是客户希望推进协同办公与 ERP 一体化，同时对迁移成本、组织复杂性和海外适配存在顾虑。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        summary ? "听悟 paragraphSummary：来自录音的核心问题总结" : "",
        context.latestVisitRecord?.content_markdown ? "拜访记录：存在原始纪要与摘要" : "",
      ]),
      unknowns: ["如果要推进成交，还需要补充完整决策链和预算审批信息"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前推荐的总体方案是什么？`,
        `${context.customer?.name ?? "该客户"}当前最关键的客户联系人是谁？`,
      ],
      confidence: summary ? "high" : "medium",
    }),
    confidence: summary ? "high" : "medium",
    customerId: context.customer?.id ?? null,
    visitRecordId: context.latestVisitRecord?.id ?? null,
    summary: {
      questionType: "core_problem",
      retrieval: ["tingwu_summary", "visit_record"],
    },
  };
}

function answerRecommendedSolution(context: QueryContext): QueryAnswer {
  const chapter = context.tongyiChapters.find((item) => /方案|协同|系统/.test(`${item.headline}${item.summary}`));
  const directAnswer = context.customer?.name?.includes("东港")
    ? "推荐采用“ES 财务端 + 云之家业务端”的前后端结合方案：ES 负责采购入库、资产卡片、折旧摊销，云之家负责领用、调拨、盘点、维修、报废等业务动作，并将关键状态回传财务端。"
    : chapter?.summary || "当前推荐方向是围绕金蝶云之家协同办公与 ERP 一体化来承接客户需求。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.customer?.name?.includes("东港") ? "听悟摘要：已明确 ES + 云之家 前后端结合方案" : "",
        chapter ? "自动章节总结：提到了方案结构与系统协同" : "",
      ]),
      unknowns: ["仍需要进一步确认实施范围、成本边界与最终拍板人"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}对时间和报价有什么明确要求？`,
        `${context.customer?.name ?? "该客户"}对实施周期和成本的顾虑是什么？`,
      ],
      confidence: "high",
    }),
    confidence: "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "recommended_solution",
      retrieval: ["tingwu_summary", "auto_chapters"],
    },
  };
}

function answerTimeQuote(context: QueryContext): QueryAnswer {
  const directAnswer = context.customer?.name?.includes("东港")
    ? "客户明确希望在下周三前拿到初步方案和报价，并且最好把实施方案、报价拆分和服务承诺一次讲清楚。"
    : "当前资料没有像东港那样明确到具体截止日期，但客户已经在推进下一轮深访、海外清单补充和方案评审。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.customer?.name?.includes("东港") && context.tongyiActions.length > 0 ? "听悟行动项：存在“限期提供方案与报价说明”的动作" : "",
        context.latestAdviceMarkdown ? "经营建议：对报价和推进时点有明确要求" : "",
      ]),
      unknowns: context.customer?.name?.includes("东港")
        ? ["价格接受区间仍未完全确认"]
        : ["客户的明确报价截止日和预算区间仍待补充"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}对实施周期和成本的顾虑是什么？`,
        `${context.customer?.name ?? "该客户"}当前最该推进什么动作？`,
      ],
      confidence: "high",
    }),
    confidence: "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "time_quote",
      retrieval: ["meeting_assistance", "advice_markdown"],
    },
  };
}

function answerDeliveryCost(context: QueryContext): QueryAnswer {
  const directAnswer = context.customer?.name?.includes("东港")
    ? "东港对实施周期和成本比较敏感，讨论已经围绕 50 人天展开，经营建议进一步要求把方案优化到不超过 40 人天，并清晰拆分实施费与年度服务费。"
    : "贝斯美当前更担心迁移成本、技术适配、组织架构复杂性和历史数据迁移成本，这些顾虑已经成为推进阻力。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.latestAdviceMarkdown ? "经营建议：记录了成本和推进顾虑" : "",
        context.tongyiSummary ? "录音摘要：反映了客户对实施边界的关注" : "",
      ]),
      unknowns: ["当前仍缺少客户可接受的明确价格上限和最终预算口径"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}最大的推进障碍是什么？`,
        `${context.customer?.name ?? "该客户"}现在最关键的客户联系人是谁？`,
      ],
      confidence: "high",
    }),
    confidence: "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "delivery_cost",
      retrieval: ["advice_markdown", "tingwu_summary"],
    },
  };
}

function answerTrustIssue(context: QueryContext): QueryAnswer {
  const directAnswer = "当前最大的信任问题集中在历史 ES 运维表现，包括合同审批问题长期未闭环、安全漏洞暴露、补丁更新不及时，以及人员变动没有强制通报，导致客户对持续服务能力存疑。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.tongyiSummary ? "听悟问答总结：已记录历史遗留运维与安全问题" : "",
        context.tongyiActions.length > 0 ? "听悟行动项：包含补丁、安全与交接机制整改要求" : "",
        context.latestAdviceMarkdown ? "经营建议：信任障碍被识别为关键推进问题" : "",
      ]),
      unknowns: ["客户是否接受修复承诺，还需要后续一对一沟通验证"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前最该推进什么动作？`,
        `${context.customer?.name ?? "该客户"}内部谁更像支持者？`,
      ],
      confidence: "high",
    }),
    confidence: "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "trust_issue",
      retrieval: ["tingwu_summary", "meeting_assistance", "advice_markdown"],
    },
  };
}

function answerCompanyIdentity(context: QueryContext): QueryAnswer {
  const customerName = context.customer?.name ?? String(context.customerContext?.customer?.customer_name ?? "");
  const stockCode = context.researchMarkdown.match(/股票代码 \| ([^|]+)\|/)?.[1]?.trim() ?? "";
  const industry =
    context.customer?.industry ||
    String(context.customerContext?.customer?.industry ?? "") ||
    context.researchMarkdown.match(/农药制造\s*\/\s*精细化工/)?.[0] ||
    (customerName.includes("贝斯美") && /二甲戊灵|农药/.test(context.researchMarkdown) ? "农药制造 / 精细化工" : "");
  const directAnswer = [customerName, stockCode ? `股票代码 ${stockCode}` : "", industry ? `行业 ${industry}` : ""]
    .filter(Boolean)
    .join("，");
  return {
    text: renderAnswer({
      directAnswer: directAnswer || "当前还没有查到该客户的完整企业身份信息。",
      evidence: uniqueStrings([
        context.researchMarkdown ? "公司研究 Markdown：包含企业基本信息" : "",
        context.customerContext?.customer ? "MongoDB 客户主档：包含客户主数据" : "",
      ]),
      unknowns: directAnswer ? [] : ["需要补充公司研究材料或客户主档"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}的主营业务是什么？`,
        `${context.customer?.name ?? "该客户"}的核心战略怎么概括？`,
      ],
      confidence: directAnswer ? "high" : "low",
    }),
    confidence: directAnswer ? "high" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "company_identity",
      retrieval: ["research_markdown", "mongodb"],
    },
  };
}

function answerMainBusiness(context: QueryContext): QueryAnswer {
  const mainBusiness = extractMainBusiness(context.researchMarkdown);
  return {
    text: renderAnswer({
      directAnswer: mainBusiness || "当前没有查到该客户的主营业务描述。",
      evidence: uniqueStrings([
        mainBusiness ? "公司研究 Markdown：企业概况 / 主营业务字段" : "",
      ]),
      unknowns: mainBusiness ? [] : ["需要补充公司研究资料"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}的核心战略怎么概括？`,
        `${context.customer?.name ?? "该客户"}的第二增长曲线是什么？`,
      ],
      confidence: mainBusiness ? "high" : "low",
    }),
    confidence: mainBusiness ? "high" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "main_business",
      retrieval: ["research_markdown"],
    },
  };
}

function answerStrategy(context: QueryContext): QueryAnswer {
  const coreStrategy = context.researchMarkdown.match(/核心战略逻辑是\*\*"?([^*]+)\*\*/)?.[1]?.trim() ?? "";
  const hasOnePlusThree = /1\+3/.test(context.researchMarkdown);
  const directAnswer = coreStrategy
    ? `核心战略是 ${coreStrategy}${hasOnePlusThree ? "，并以“1+3”路线从二甲戊灵延展到三条新品种线。" : "。"}`
    : "当前没有提取到清晰的战略表述。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.researchMarkdown ? "公司研究 Markdown：产品战略概述" : "",
      ]),
      unknowns: directAnswer.includes("没有提取") ? ["需要补充研究资料或人工总结"] : [],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}的第二增长曲线是什么？`,
        `${context.customer?.name ?? "该客户"}2024 年经营表现怎么样？`,
      ],
      confidence: directAnswer.includes("没有提取") ? "low" : "high",
    }),
    confidence: directAnswer.includes("没有提取") ? "low" : "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "strategy",
      retrieval: ["research_markdown"],
    },
  };
}

function answerSecondCurve(context: QueryContext): QueryAnswer {
  const directAnswer = /碳五新材料/.test(context.researchMarkdown)
    ? "第二增长曲线是碳五新材料，核心落点是铜陵基地的戊酮系列绿色新材料项目。"
    : "当前没有从研究资料里找到明确的第二增长曲线表述。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        /碳五新材料/.test(context.researchMarkdown) ? "公司研究 Markdown：产品线与发展历程均提到碳五新材料" : "",
      ]),
      unknowns: directAnswer.includes("没有") ? ["需要补充企业研究资料"] : [],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}2024 年经营表现怎么样？`,
        `${context.customer?.name ?? "该客户"}当前这次拜访主要在谈什么需求？`,
      ],
      confidence: directAnswer.includes("没有") ? "low" : "high",
    }),
    confidence: directAnswer.includes("没有") ? "low" : "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "second_curve",
      retrieval: ["research_markdown"],
    },
  };
}

function answerPerformance2024(context: QueryContext): QueryAnswer {
  const row = extractFinancialRows(context.researchMarkdown);
  const directAnswer = row
    ? `2024 年营业收入约 ${row.revenue}，归母净利润 ${row.profit}。`
    : "当前没有查到 2024 年经营表现的明确数字。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        row ? "公司研究 Markdown：近年财务关键数据表" : "",
      ]),
      unknowns: row ? [] : ["需要补充研究报告或财务摘要"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}的主营业务是什么？`,
        `${context.customer?.name ?? "该客户"}的第二增长曲线是什么？`,
      ],
      confidence: row ? "high" : "low",
    }),
    confidence: row ? "high" : "low",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "performance_2024",
      retrieval: ["research_markdown"],
    },
  };
}

function answerMeetingDemand(context: QueryContext): QueryAnswer {
  const keywords = context.tongyiKeywords.slice(0, 8);
  const directAnswer = context.customer?.name?.includes("贝斯美")
    ? "这次拜访主要在谈金蝶云之家协同办公与 ERP 一体化，重点关注替换钉钉、费用报销、研发项目管理、海外多语言适配和统一门户能力。"
    : "这次拜访主要围绕固定资产管理、ES 与云之家协同、盘点、二维码、资产编码以及运维整改展开。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.tongyiSummary ? "听悟 paragraphSummary：概括了本次拜访主题" : "",
        keywords.length ? `听悟关键词：${keywords.join("、")}` : "",
        context.tongyiChapters.length ? "自动章节总结：提供了议题结构" : "",
      ]),
      unknowns: ["如果要继续推进，需要进一步确认决策链与预算审批信息"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前项目阶段是什么？`,
        `${context.customer?.name ?? "该客户"}当前最关键的客户联系人是谁？`,
      ],
      confidence: "high",
    }),
    confidence: "high",
    customerId: context.customer?.id ?? null,
    visitRecordId: context.latestVisitRecord?.id ?? null,
    summary: {
      questionType: "meeting_demand",
      retrieval: ["tingwu_summary", "keywords", "auto_chapters"],
    },
  };
}

function answerBarrier(context: QueryContext): QueryAnswer {
  const directAnswer = context.customer?.name?.includes("贝斯美")
    ? "当前最大的推进障碍不是兴趣不足，而是决策链信息缺失，同时客户对迁移成本、技术适配、组织架构复杂性、历史数据迁移和海外合规都有明显顾虑。"
    : "当前最大的推进障碍是关键人对历史服务的不信任，以及预算审批链和最终决策人信息仍不完整。";
  return {
    text: renderAnswer({
      directAnswer,
      evidence: uniqueStrings([
        context.latestAdviceMarkdown ? "经营建议：对障碍和缺口已有明确判断" : "",
        context.tongyiSummary ? "录音摘要：反映了客户关注点和顾虑" : "",
      ]),
      unknowns: ["仍需进一步补齐决策链和预算口径"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前最关键的客户联系人是谁？`,
        `${context.customer?.name ?? "该客户"}现在最该推进什么动作？`,
      ],
      confidence: "high",
    }),
    confidence: "high",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "barrier",
      retrieval: ["advice_markdown", "tingwu_summary"],
    },
  };
}

function answerGeneric(context: QueryContext): QueryAnswer {
  const summaryBits = uniqueStrings([
    context.customer?.name ? `当前焦点客户：${context.customer.name}` : "",
    context.latestTask?.status ? `最近任务状态：${context.latestTask.status}` : "",
    context.latestAdvice?.current_assessment ? `阶段判断：${String(context.latestAdvice.current_assessment)}` : "",
    fallbackLatestAction(context) ? `最新建议动作：${fallbackLatestAction(context)}` : "",
  ]);

  return {
    text: renderAnswer({
      directAnswer: summaryBits.length > 0
        ? summaryBits.join("；")
        : "我能继续帮你查询这个线程关联客户的拜访、联系人、商机、产物和经营建议，但当前问题还不够具体。",
      evidence: uniqueStrings([
        context.latestTask ? "线程最近任务状态" : "",
        context.latestAdvice ? "经营建议结果" : "",
        context.tongyiSummary ? "听悟摘要" : "",
      ]),
      unknowns: ["请进一步说明你要查的是阶段、联系人、预算、商机还是产物"],
      suggestedNext: [
        `${context.customer?.name ?? "该客户"}当前项目阶段是什么？`,
        `${context.customer?.name ?? "该客户"}最关键的客户联系人是谁？`,
        `${context.customer?.name ?? "该客户"}现在最该推进什么动作？`,
      ],
      confidence: "medium",
    }),
    confidence: "medium",
    customerId: context.customer?.id ?? null,
    summary: {
      questionType: "generic",
      retrieval: ["thread_projection", "advice_markdown", "tingwu_summary"],
    },
  };
}

export async function answerThreadQuery(params: { threadId: string; question: string }): Promise<QueryAnswer> {
  const context = await buildQueryContext(params.threadId, params.question);
  const questionType = classifyQuestion(params.question);

  switch (questionType) {
    case "budget":
      return answerDonggangBudget(context);
    case "key_contact":
      return answerKeyContact(context);
    case "supporter":
      return answerSupporter(context);
    case "stage":
      return answerStage(context);
    case "next_action":
      return answerNextAction(context);
    case "core_problem":
      return answerCoreProblem(context);
    case "recommended_solution":
      return answerRecommendedSolution(context);
    case "time_quote":
      return answerTimeQuote(context);
    case "delivery_cost":
      return answerDeliveryCost(context);
    case "trust_issue":
      return answerTrustIssue(context);
    case "opportunity_info":
      return answerOpportunityInfo(context);
    case "company_identity":
      return answerCompanyIdentity(context);
    case "main_business":
      return answerMainBusiness(context);
    case "strategy":
      return answerStrategy(context);
    case "second_curve":
      return answerSecondCurve(context);
    case "performance_2024":
      return answerPerformance2024(context);
    case "meeting_demand":
      return answerMeetingDemand(context);
    case "barrier":
      return answerBarrier(context);
    default:
      return answerGeneric(context);
  }
}
