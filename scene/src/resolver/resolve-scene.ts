import {
  type CustomerRuntimeContext,
  type EvidenceRef,
  type PackRegistry,
  type PackMatch,
  type SceneResolution,
  SceneResolutionSchema,
  type SolutionPack,
} from "../schemas/contracts.js";
import {
  getIndustryTemplate,
  getScenarioTemplate,
  getSolutionBundle,
  getSolutionPack,
  loadPackRegistry,
} from "../packs/load-packs.js";

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "");
}

function includesNormalized(text: string, term: string): boolean {
  return normalizeText(text).includes(normalizeText(term));
}

function buildCorpus(context: CustomerRuntimeContext): string[] {
  return [
    ...context.keywords,
    context.summary,
    context.paragraph_summary,
    ...context.chapter_summaries.flatMap((item) => [item.headline, item.summary]),
    ...context.qa_pairs.flatMap((item) => [item.question, item.answer]),
    ...context.action_items.map((item) => item.text),
    ...context.evidence_index.sentences.map((item) => item.text),
  ];
}

function uniqueEvidence(refs: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  const output: EvidenceRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    output.push(ref);
  }
  return output;
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

  return uniqueEvidence(refs).slice(0, limit);
}

function matchSignals(context: CustomerRuntimeContext, signals: string[]) {
  const corpus = buildCorpus(context);
  const matchedSignals = signals.filter((signal) =>
    corpus.some((entry) => includesNormalized(entry, signal)),
  );
  return Array.from(new Set(matchedSignals));
}

function scorePack(context: CustomerRuntimeContext, pack: SolutionPack): PackMatch {
  const matchedSignals = matchSignals(context, pack.topic_signals);
  let score =
    pack.topic_signals.length === 0
      ? 0
      : Math.min(1, matchedSignals.length / pack.topic_signals.length + (matchedSignals.length >= 2 ? 0.15 : 0));

  const anchorSignals: Record<string, string[]> = {
    kingdee_fixed_assets_pack: ["金蝶", "固定资产", "财务", "卡片"],
    yunzhijia_asset_ops_pack: ["云之家", "轻应用", "OA", "台账", "领用", "调拨"],
  };

  const anchors = anchorSignals[pack.id];
  if (anchors && !matchedSignals.some((signal) => anchors.includes(signal))) {
    score *= 0.4;
  }

  return {
    pack_id: pack.id,
    score,
    matched_signals: matchedSignals,
    evidence_refs: collectEvidence(context, matchedSignals, 5),
  };
}

function scoreIndustry(context: CustomerRuntimeContext, terminology: string[]) {
  const matchedSignals = matchSignals(context, terminology);
  const confidence = Math.min(1, matchedSignals.length / Math.max(terminology.length, 1) * 3);
  return { matchedSignals, confidence };
}

function scoreScenario(context: CustomerRuntimeContext) {
  const scenarioSignals = ["固定资产", "资产", "信息化", "方案", "实施", "报价", "管理"];
  const matchedSignals = matchSignals(context, scenarioSignals);
  const confidence = Math.min(1, matchedSignals.length / 4);
  return { matchedSignals, confidence };
}

export function resolveScene(
  context: CustomerRuntimeContext,
  registry: PackRegistry = loadPackRegistry(),
): SceneResolution {
  const industry = getIndustryTemplate("it_enterprise_software");
  const scenario = getScenarioTemplate("presales_visit_ppt");
  const bundle = getSolutionBundle("donggang_asset_management_bundle");
  const kingdeePack = getSolutionPack("kingdee_fixed_assets_pack");
  const yunPack = getSolutionPack("yunzhijia_asset_ops_pack");
  const genericPack = getSolutionPack("it_generic_presales_pack");

  const industryFromRegistry = registry.industries.find((item) => item.id === "it_enterprise_software");
  const scenarioFromRegistry = registry.scenarios.find((item) => item.id === "presales_visit_ppt");
  const bundleFromRegistry = registry.bundles.find((item) => item.id === "donggang_asset_management_bundle");
  const kingdeeFromRegistry = registry.solutionPacks.find((item) => item.id === "kingdee_fixed_assets_pack");
  const yunFromRegistry = registry.solutionPacks.find((item) => item.id === "yunzhijia_asset_ops_pack");
  const genericFromRegistry = registry.solutionPacks.find((item) => item.id === "it_generic_presales_pack");

  const activeIndustry = industryFromRegistry ?? industry;
  const activeScenario = scenarioFromRegistry ?? scenario;
  const activeBundle = bundleFromRegistry ?? bundle;
  const activeKingdeePack = kingdeeFromRegistry ?? kingdeePack;
  const activeYunPack = yunFromRegistry ?? yunPack;
  const activeGenericPack = genericFromRegistry ?? genericPack;

  if (!activeIndustry || !activeScenario || !activeBundle || !activeKingdeePack || !activeYunPack || !activeGenericPack) {
    throw new Error("Scene pack registry is incomplete");
  }

  if (registry.solutionPacks.length < 3) {
    throw new Error("Expected at least three solution packs");
  }

  const industryScore = scoreIndustry(context, activeIndustry.terminology);
  const scenarioScore = scoreScenario(context);
  const kingdeeMatch = scorePack(context, activeKingdeePack);
  const yunMatch = scorePack(context, activeYunPack);
  const minPackScore = activeScenario.fallback_policy.min_pack_score;

  const fallbackUsed =
    kingdeeMatch.score < minPackScore && yunMatch.score < minPackScore;

  let primaryPackId = activeGenericPack.id;
  let secondaryPackIds: string[] = [];
  let bundleId: string | null = null;
  const reasons: string[] = [];
  const packMatches: PackMatch[] = [kingdeeMatch, yunMatch];

  if (fallbackUsed) {
    primaryPackId = activeGenericPack.id;
    reasons.push("未稳定命中金蝶或云之家方案包，回退到 IT 通用售前包");
  } else if (kingdeeMatch.score >= minPackScore && yunMatch.score >= minPackScore) {
    primaryPackId = activeBundle.primary_pack_id;
    secondaryPackIds = activeBundle.secondary_pack_ids;
    bundleId = activeBundle.id;
    reasons.push(
      `命中金蝶主包：${kingdeeMatch.matched_signals.join("、") || "多项固定资产/财务信号"}`,
    );
    reasons.push(
      `命中云之家辅包：${yunMatch.matched_signals.join("、") || "多项轻应用/台账信号"}`,
    );
    reasons.push("形成东港固定资产管理联合方案 bundle");
  } else if (kingdeeMatch.score >= yunMatch.score) {
    primaryPackId = activeKingdeePack.id;
    reasons.push(
      `优先采用金蝶主包：${kingdeeMatch.matched_signals.join("、") || "固定资产财务主账信号更强"}`,
    );
  } else {
    primaryPackId = activeYunPack.id;
    reasons.push(
      `优先采用云之家单包：${yunMatch.matched_signals.join("、") || "轻应用业务承接信号更强"}`,
    );
  }

  const confidence = Number(
    (
      industryScore.confidence * 0.25 +
      scenarioScore.confidence * 0.25 +
      Math.max(kingdeeMatch.score, yunMatch.score) * 0.5
    ).toFixed(4),
  );

  return SceneResolutionSchema.parse({
    industry_id: activeIndustry.id,
    scenario_id: activeScenario.id,
    primary_pack_id: primaryPackId,
    secondary_pack_ids: secondaryPackIds,
    bundle_id: bundleId,
    confidence,
    reasons,
    fallback_used: fallbackUsed,
    pack_matches: packMatches,
    industry_confidence: industryScore.confidence,
    scenario_confidence: scenarioScore.confidence,
  });
}
