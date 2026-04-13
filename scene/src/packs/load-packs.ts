import { readFileSync, readdirSync } from "fs";
import { dirname, extname, join } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

import {
  IndustryTemplateSchema,
  type PackRegistry,
  type SceneIndustryTemplateRecord,
  type SceneScenarioTemplateRecord,
  type SceneSolutionBundleRecord,
  type SceneSolutionPackRecord,
  ScenarioTemplateSchema,
  SolutionBundleSchema,
  SolutionPackSchema,
} from "../schemas/contracts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACK_DIR = __dirname;

let cachedRegistry: PackRegistry | null = null;

export function loadPackRegistry(): PackRegistry {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  const registry: PackRegistry = {
    industries: [],
    scenarios: [],
    solutionPacks: [],
    bundles: [],
  };

  for (const entry of readdirSync(PACK_DIR)) {
    if (extname(entry) !== ".yaml") continue;
    const content = readFileSync(join(PACK_DIR, entry), "utf8");
    const parsed = parseYaml(content);

    switch (parsed.kind) {
      case "industry_template":
        registry.industries.push(IndustryTemplateSchema.parse(parsed));
        break;
      case "scenario_template":
        registry.scenarios.push(ScenarioTemplateSchema.parse(parsed));
        break;
      case "solution_pack":
        registry.solutionPacks.push(SolutionPackSchema.parse(parsed));
        break;
      case "solution_bundle":
        registry.bundles.push(SolutionBundleSchema.parse(parsed));
        break;
      default:
        throw new Error(`Unknown pack kind in ${entry}`);
    }
  }

  cachedRegistry = registry;
  return registry;
}

export function getIndustryTemplate(id: string) {
  return loadPackRegistry().industries.find((item) => item.id === id);
}

export function getScenarioTemplate(id: string) {
  return loadPackRegistry().scenarios.find((item) => item.id === id);
}

export function getSolutionPack(id: string) {
  return loadPackRegistry().solutionPacks.find((item) => item.id === id);
}

export function getSolutionBundle(id: string) {
  return loadPackRegistry().bundles.find((item) => item.id === id);
}

export function createPackRegistryFromSceneRecords(input: {
  industries: SceneIndustryTemplateRecord[];
  scenarios: SceneScenarioTemplateRecord[];
  solutionPacks: SceneSolutionPackRecord[];
  bundles: SceneSolutionBundleRecord[];
}): PackRegistry {
  return {
    industries: input.industries.map((item) =>
      IndustryTemplateSchema.parse({
        kind: "industry_template",
        id: item.industry_code,
        name: item.display_name,
        terminology: item.terminology,
        analysis_dimensions: item.analysis_dimensions,
        current_state_patterns: item.current_state_patterns,
        recommendation_patterns: item.recommendation_policies,
        evidence_rules: item.evidence_rules,
      }),
    ),
    scenarios: input.scenarios.map((item) =>
      ScenarioTemplateSchema.parse({
        kind: "scenario_template",
        id: item.scenario_code,
        name: item.display_name,
        business_goal: item.business_goal,
        required_inputs: item.required_inputs,
        section_contracts: item.section_contracts,
        fallback_policy: item.fallback_policy,
        observability_metrics: item.observability_metrics,
      }),
    ),
    solutionPacks: input.solutionPacks.map((item) =>
      SolutionPackSchema.parse({
        kind: "solution_pack",
        id: item.id,
        vendor: item.vendor,
        role: item.role,
        industry_id: item.industry_id,
        topic_signals: item.topic_signals,
        current_state_patterns: item.current_state_patterns,
        output_patterns: item.output_patterns,
        recommendation_patterns: item.recommendation_patterns,
        forbidden_claims: item.forbidden_claims,
        source_refs: item.source_refs,
      }),
    ),
    bundles: input.bundles.map((item) =>
      SolutionBundleSchema.parse({
        kind: "solution_bundle",
        id: item.id,
        primary_pack_id: item.primary_pack_id,
        secondary_pack_ids: item.secondary_pack_ids,
        assembly_rules: item.assembly_rules,
        narrative_bias: item.narrative_bias,
      }),
    ),
  };
}
