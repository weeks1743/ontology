import {
  type CustomerRuntimeContext,
  type EvidenceRef,
  type PackRegistry,
  type PptAssemblyContract,
  PptAssemblyContractSchema,
  type PptSection,
  type SceneResolution,
} from "../schemas/contracts.js";
import {
  getScenarioTemplate,
  getSolutionBundle,
  getSolutionPack,
} from "../packs/load-packs.js";

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "");
}

function includesNormalized(text: string, term: string): boolean {
  return normalizeText(text).includes(normalizeText(term));
}

function dedupeEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });
}

function collectEvidence(
  context: CustomerRuntimeContext,
  patterns: string[],
  limit = 6,
): EvidenceRef[] {
  const refs: EvidenceRef[] = [];

  for (const question of context.qa_pairs) {
    if (!patterns.some((pattern) => includesNormalized(question.question + question.answer, pattern))) {
      continue;
    }
    for (const sentenceId of question.sentence_ids.slice(0, 2)) {
      refs.push({
        type: "sentence",
        id: `sentence:${sentenceId}`,
        label: question.question,
        sentenceId,
      });
    }
  }

  for (const chapter of context.chapter_summaries) {
    if (!patterns.some((pattern) => includesNormalized(chapter.headline + chapter.summary, pattern))) {
      continue;
    }
    refs.push({
      type: "chapter",
      id: `chapter:${chapter.chapter_id}`,
      label: chapter.headline,
      chapterId: chapter.chapter_id,
    });
  }

  for (const action of context.action_items) {
    if (!patterns.some((pattern) => includesNormalized(action.text, pattern))) {
      continue;
    }
    refs.push({
      type: "action",
      id: `action:${action.action_id}`,
      label: action.text,
      actionId: action.action_id,
    });
  }

  return dedupeEvidence(refs).slice(0, limit);
}

function findPackEvidence(resolution: SceneResolution, packId: string): EvidenceRef[] {
  return resolution.pack_matches.find((item) => item.pack_id === packId)?.evidence_refs ?? [];
}

function buildCustomerProfileSection(context: CustomerRuntimeContext): PptSection {
  const refs = collectEvidence(context, ["固定资产", "金蝶", "云之家", "项目背景", "资产管理"], 4);
  const summary = `${context.customer_name} 当前围绕“${context.visit_theme}”开展售前沟通，会议被识别为 ${context.meeting_type} 类，核心议题集中在固定资产治理、前后端系统分层与实施节奏。`;

  return {
    id: "customer_profile",
    title: "客户基本情况",
    summary,
    bullets: [
      `客户：${context.customer_name}`,
      `主题：${context.visit_theme}`,
      `会议类型：${context.meeting_type}`,
      `高频关键词：${context.keywords.slice(0, 6).join("、")}`,
    ],
    evidence_refs: refs,
  };
}

function buildCurrentStateSection(context: CustomerRuntimeContext): PptSection {
  const mismatchRefs = collectEvidence(
    context,
    ["账实不符", "历史资产", "盘点", "初始化", "编码规则"],
    4,
  );
  const splitRefs = collectEvidence(
    context,
    ["ES系统", "财务视角", "云之家", "轻应用", "台账", "接口"],
    4,
  );
  const officeRefs = collectEvidence(context, ["办公品", "低值易耗品", "OA", "库存体系"], 4);
  const opsRefs = collectEvidence(
    context,
    ["补丁", "漏洞", "停服", "单点登录", "公网", "遗留问题"],
    4,
  );

  return {
    id: "current_state",
    title: "信息化现状分析",
    summary: "客户当前最核心的断点不是单点功能缺失，而是固定资产治理、财务主账与业务动作承接之间存在结构性断层。",
    bullets: [
      "资产治理层面仍存在账实不符、历史资产难追溯、编码与初始化口径不统一的问题。",
      "财务主账与业务前端分层诉求已经非常明确，ES/金蝶负责财务控制，云之家更适合承接台账与轻应用动作。",
      "办公品与低值易耗品不宜强行并入固定资产主账，需单独库存与流程体系承接。",
      "系统运维与安全治理存在明显薄弱环节，补丁更新、停服影响和交接机制都已进入客户高敏感区。",
    ],
    evidence_refs: dedupeEvidence([
      ...mismatchRefs,
      ...splitRefs,
      ...officeRefs,
      ...opsRefs,
    ]),
  };
}

function buildInformationOutputSection(
  context: CustomerRuntimeContext,
  resolution: SceneResolution,
  registry?: PackRegistry,
): PptSection {
  const primaryPack =
    registry?.solutionPacks.find((item) => item.id === resolution.primary_pack_id) ??
    getSolutionPack(resolution.primary_pack_id);
  if (!primaryPack) {
    throw new Error(`Primary pack not found: ${resolution.primary_pack_id}`);
  }

  const secondaryPacks = resolution.secondary_pack_ids
    .map((packId) => registry?.solutionPacks.find((item) => item.id === packId) ?? getSolutionPack(packId))
    .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack));
  const bundle = resolution.bundle_id
    ? registry?.bundles.find((item) => item.id === resolution.bundle_id) ?? getSolutionBundle(resolution.bundle_id)
    : null;

  const packBullets = [
    ...primaryPack.output_patterns.map((item) => item.body),
    ...secondaryPacks.flatMap((pack) => pack.output_patterns.map((item) => item.body)),
  ];

  if (bundle) {
    packBullets.push(
      "通过接口打通金蝶卡片与云之家台账，形成“财务主账 + 业务轻应用”一体化闭环，兼顾控制力与一线体验。",
    );
  }

  return {
    id: "target_output",
    title: "信息化输出",
    summary: bundle
      ? "建议采用金蝶主账 + 云之家业务前端的联合方案，避免单系统包打天下。"
      : `建议围绕 ${primaryPack.vendor} 方案包形成本次信息化输出框架。`,
    bullets: packBullets,
    evidence_refs: dedupeEvidence([
      ...findPackEvidence(resolution, primaryPack.id),
      ...secondaryPacks.flatMap((pack) => findPackEvidence(resolution, pack.id)),
      ...collectEvidence(context, ["接口", "二维码", "台账", "固定资产"], 4),
    ]),
  };
}

function buildRecommendationSection(
  context: CustomerRuntimeContext,
  resolution: SceneResolution,
  registry?: PackRegistry,
): PptSection {
  const primaryPack =
    registry?.solutionPacks.find((item) => item.id === resolution.primary_pack_id) ??
    getSolutionPack(resolution.primary_pack_id);
  if (!primaryPack) {
    throw new Error(`Primary pack not found: ${resolution.primary_pack_id}`);
  }

  const secondaryPacks = resolution.secondary_pack_ids
    .map((packId) => registry?.solutionPacks.find((item) => item.id === packId) ?? getSolutionPack(packId))
    .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack));

  const implementationRefs = collectEvidence(
    context,
    ["下周三", "初步方案", "实施时间", "招投标"],
    4,
  );
  const governanceRefs = collectEvidence(
    context,
    ["补丁", "漏洞", "停服", "交接", "发函", "通知"],
    4,
  );
  const baselineRefs = collectEvidence(
    context,
    ["2026年6月", "盘点", "初始化", "历史资产", "编码规则"],
    4,
  );

  const packRecommendations = [
    ...primaryPack.recommendation_patterns.map((item) => item.body),
    ...secondaryPacks.flatMap((pack) => pack.recommendation_patterns.map((item) => item.body)),
  ];

  return {
    id: "recommendations",
    title: "信息化建议",
    summary: "建议把本项目按“治理先行、分阶段上线、接口闭环、运维托底”的路径推进，先稳住主账和基线，再放大业务端价值。",
    bullets: [
      ...packRecommendations,
      "尽快按客户要求在下周三前形成方案对比与报价边界，先锁架构与范围，再压实施周期。",
      "把补丁、安全、停服影响、交接通知和遗留问题闭环纳入实施治理机制，避免上线后再次损耗客户信任。",
    ],
    evidence_refs: dedupeEvidence([
      ...baselineRefs,
      ...implementationRefs,
      ...governanceRefs,
    ]),
  };
}

export function buildPptAssemblyContract(
  context: CustomerRuntimeContext,
  resolution: SceneResolution,
  registry?: PackRegistry,
): PptAssemblyContract {
  const scenario =
    registry?.scenarios.find((item) => item.id === resolution.scenario_id) ??
    getScenarioTemplate(resolution.scenario_id);
  if (!scenario) {
    throw new Error(`Scenario not found: ${resolution.scenario_id}`);
  }

  const sections = [
    buildCustomerProfileSection(context),
    buildCurrentStateSection(context),
    buildInformationOutputSection(context, resolution, registry),
    buildRecommendationSection(context, resolution, registry),
  ];

  const evidenceMap = Object.fromEntries(
    sections.map((section) => [section.id, section.evidence_refs]),
  );

  return PptAssemblyContractSchema.parse({
    audience: "售前顾问、客户管理层、项目决策相关方",
    goal: scenario.business_goal,
    sections,
    evidence_map: evidenceMap,
    knowledge_sources: [
      `tongyi_fixture:${context.customer_name}`,
      resolution.primary_pack_id,
      ...resolution.secondary_pack_ids,
      ...(resolution.bundle_id ? [resolution.bundle_id] : []),
    ],
    style_hint: resolution.bundle_id ? "enterprise-dual-engine" : "enterprise-focused",
  });
}
