import { z } from "zod";

export const EvidenceRefSchema = z.object({
  type: z.enum(["sentence", "chapter", "action"]),
  id: z.string(),
  label: z.string(),
  sentenceId: z.number().optional(),
  chapterId: z.number().optional(),
  actionId: z.number().optional(),
});

export const TongyiQuestionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  sentence_ids: z.array(z.number()),
});

export const ChapterSummarySchema = z.object({
  chapter_id: z.number(),
  headline: z.string(),
  summary: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
});

export const ActionItemSchema = z.object({
  action_id: z.number(),
  text: z.string(),
  sentence_id: z.number().optional(),
});

export const IndexedSentenceSchema = z.object({
  sentence_id: z.number(),
  paragraph_id: z.string(),
  speaker_id: z.string(),
  text: z.string(),
  start_ms: z.number(),
  end_ms: z.number(),
});

export const EvidenceIndexSchema = z.object({
  sentences: z.array(IndexedSentenceSchema),
  chapters: z.array(ChapterSummarySchema),
  actions: z.array(ActionItemSchema),
  questions: z.array(TongyiQuestionAnswerSchema),
});

export const TongyiOutputFixtureSchema = z.object({
  summary: z.string(),
  summarization: z.object({
    paragraphSummary: z.string().default(""),
    conversationalSummary: z
      .array(
        z.object({
          speakerId: z.string().optional(),
          speakerName: z.string().optional(),
          summary: z.string(),
        }),
      )
      .default([]),
    questionsAnsweringSummary: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
          sentenceIdsOfAnswer: z.array(z.number()).default([]),
        }),
      )
      .default([]),
  }),
  auto_chapters: z.array(
    z.object({
      id: z.number(),
      headline: z.string(),
      summary: z.string(),
      start: z.number(),
      end: z.number(),
    }),
  ),
  meeting_assistance: z.object({
    actions: z
      .array(
        z.object({
          id: z.number(),
          text: z.string(),
          sentenceId: z.number().optional(),
        }),
      )
      .default([]),
    classifications: z.record(z.number()).default({}),
    keywords: z.array(z.string()).default([]),
  }),
  transcription: z.object({
    audioInfo: z
      .object({
        duration: z.number(),
        language: z.string().optional(),
      })
      .optional(),
    paragraphs: z.array(
      z.object({
        paragraphId: z.union([z.string(), z.number()]),
        speakerId: z.union([z.string(), z.number()]),
        words: z.array(
          z.object({
            id: z.number().optional(),
            sentenceId: z.number(),
            start: z.number(),
            end: z.number(),
            text: z.string(),
          }),
        ),
      }),
    ),
  }),
  assets_path: z.string(),
});

export const CustomerRuntimeContextSchema = z.object({
  customer_name: z.string(),
  visit_theme: z.string(),
  industry_hint: z.string().nullable(),
  meeting_type: z.string(),
  keywords: z.array(z.string()),
  summary: z.string(),
  paragraph_summary: z.string(),
  conversational_summaries: z.array(
    z.object({
      speaker_name: z.string(),
      summary: z.string(),
    }),
  ),
  chapter_summaries: z.array(ChapterSummarySchema),
  qa_pairs: z.array(TongyiQuestionAnswerSchema),
  action_items: z.array(ActionItemSchema),
  evidence_index: EvidenceIndexSchema,
});

const CurrentStatePatternSchema = z.object({
  id: z.string(),
  label: z.string(),
  match_any: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const IndustryTemplateSchema = z.object({
  kind: z.literal("industry_template"),
  id: z.string(),
  name: z.string(),
  terminology: z.array(z.string()),
  analysis_dimensions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
    }),
  ),
  current_state_patterns: z.array(CurrentStatePatternSchema),
  recommendation_patterns: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
    }),
  ),
  evidence_rules: z.object({
    min_refs_per_section: z.number(),
    allowed_ref_types: z.array(z.enum(["sentence", "chapter", "action"])),
  }),
});

export const ScenarioTemplateSchema = z.object({
  kind: z.literal("scenario_template"),
  id: z.string(),
  name: z.string(),
  business_goal: z.string(),
  required_inputs: z.array(z.string()),
  section_contracts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      objective: z.string(),
    }),
  ),
  fallback_policy: z.object({
    generic_pack_id: z.string(),
    min_pack_score: z.number(),
  }),
  observability_metrics: z.array(z.string()),
});

export const SolutionPackSchema = z.object({
  kind: z.literal("solution_pack"),
  id: z.string(),
  vendor: z.string(),
  role: z.enum(["primary", "secondary", "fallback"]),
  industry_id: z.string(),
  topic_signals: z.array(z.string()),
  current_state_patterns: z.array(z.string()),
  output_patterns: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      body: z.string(),
    }),
  ),
  recommendation_patterns: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
    }),
  ),
  forbidden_claims: z.array(z.string()),
  source_refs: z.array(z.string()),
});

export const SolutionBundleSchema = z.object({
  kind: z.literal("solution_bundle"),
  id: z.string(),
  primary_pack_id: z.string(),
  secondary_pack_ids: z.array(z.string()),
  assembly_rules: z.array(z.string()),
  narrative_bias: z.array(z.string()),
});

export const PackMatchSchema = z.object({
  pack_id: z.string(),
  score: z.number(),
  matched_signals: z.array(z.string()),
  evidence_refs: z.array(EvidenceRefSchema),
});

export const SceneResolutionSchema = z.object({
  industry_id: z.string(),
  scenario_id: z.string(),
  primary_pack_id: z.string(),
  secondary_pack_ids: z.array(z.string()),
  bundle_id: z.string().nullable(),
  confidence: z.number(),
  reasons: z.array(z.string()),
  fallback_used: z.boolean(),
  pack_matches: z.array(PackMatchSchema),
  industry_confidence: z.number(),
  scenario_confidence: z.number(),
});

export const PptSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()),
  evidence_refs: z.array(EvidenceRefSchema),
});

export const PptAssemblyContractSchema = z.object({
  audience: z.string(),
  goal: z.string(),
  sections: z.array(PptSectionSchema),
  evidence_map: z.record(z.array(EvidenceRefSchema)),
  knowledge_sources: z.array(z.string()),
  style_hint: z.string(),
});

export const SceneAppContextSchema = z.object({
  ontology_id: z.string(),
  ontology_code: z.string(),
  display_name: z.string(),
  industry_mode: z.string(),
  active_scene_id: z.string().nullable(),
});

export const SceneIndustryTemplateRecordSchema = z.object({
  id: z.string(),
  ontology_id: z.string(),
  industry_code: z.string(),
  display_name: z.string(),
  terminology: z.array(z.string()),
  analysis_dimensions: z.array(z.record(z.any())),
  current_state_patterns: z.array(z.record(z.any())),
  section_policies: z.array(z.record(z.any())),
  recommendation_policies: z.array(z.record(z.any())),
  evidence_rules: z.record(z.any()),
});

export const SceneScenarioTemplateRecordSchema = z.object({
  id: z.string(),
  ontology_id: z.string(),
  industry_template_id: z.string(),
  scenario_code: z.string(),
  display_name: z.string(),
  business_goal: z.string(),
  required_inputs: z.array(z.string()),
  section_contracts: z.array(z.record(z.any())),
  fallback_policy: z.record(z.any()),
  observability_metrics: z.array(z.string()),
});

export const SceneSolutionPackRecordSchema = z.object({
  id: z.string(),
  ontology_id: z.string(),
  scenario_template_id: z.string(),
  display_name: z.string(),
  vendor: z.string(),
  role: z.enum(["primary", "secondary", "fallback"]),
  industry_id: z.string(),
  topic_signals: z.array(z.string()),
  current_state_patterns: z.array(z.string()),
  output_patterns: z.array(z.record(z.any())),
  recommendation_patterns: z.array(z.record(z.any())),
  forbidden_claims: z.array(z.string()),
  source_refs: z.array(z.string()),
});

export const SceneSolutionBundleRecordSchema = z.object({
  id: z.string(),
  ontology_id: z.string(),
  scenario_template_id: z.string(),
  display_name: z.string(),
  primary_pack_id: z.string(),
  secondary_pack_ids: z.array(z.string()),
  assembly_rules: z.array(z.string()),
  narrative_bias: z.array(z.string()),
});

export const SceneSkillBindingSchema = z.object({
  id: z.string(),
  ontology_id: z.string(),
  scenario_template_id: z.string(),
  slot_code: z.string(),
  slot_label: z.string(),
  description: z.string(),
  skill_id: z.string(),
  skill_source: z.enum(["ontology", "external"]),
  input_mapping: z.record(z.string()),
  output_mapping: z.record(z.any()),
  is_required: z.boolean(),
});

export const SceneCaseFixtureSchema = z.object({
  id: z.string(),
  ontology_id: z.string(),
  scenario_template_id: z.string(),
  case_name: z.string(),
  case_type: z.string(),
  fixture_path: z.string(),
  customer_name: z.string(),
  industry_hint: z.string().nullable(),
  visit_theme: z.string(),
  description: z.string(),
  is_default: z.boolean(),
});

export const SceneRunResultSchema = z.object({
  case_fixture_id: z.string(),
  selected_bindings: z.array(SceneSkillBindingSchema),
  scene_resolution: SceneResolutionSchema,
  ppt_assembly_contract: PptAssemblyContractSchema,
  evidence_map: z.record(z.array(EvidenceRefSchema)),
  fallback_used: z.boolean(),
  created_at: z.string(),
});

export const SceneWorkspaceSchema = z.object({
  app: SceneAppContextSchema,
  ontology: z.record(z.any()),
  ontology_definition: z.object({
    objects: z.array(z.record(z.any())),
    behaviors: z.array(z.record(z.any())),
    rules: z.array(z.record(z.any())),
    events: z.array(z.record(z.any())),
    scenarios: z.array(z.record(z.any())),
  }),
  skill_catalog: z.array(z.record(z.any())),
  industry_templates: z.array(SceneIndustryTemplateRecordSchema),
  scenario_templates: z.array(SceneScenarioTemplateRecordSchema),
  solution_packs: z.array(SceneSolutionPackRecordSchema),
  solution_bundles: z.array(SceneSolutionBundleRecordSchema),
  skill_bindings: z.array(SceneSkillBindingSchema),
  case_fixtures: z.array(SceneCaseFixtureSchema),
  recent_runs: z.array(SceneRunResultSchema),
  stats: z.object({
    industry_template_count: z.number(),
    scenario_template_count: z.number(),
    solution_pack_count: z.number(),
    binding_count: z.number(),
    case_count: z.number(),
    recent_run_count: z.number(),
  }),
  warnings: z.array(z.string()),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type TongyiOutputFixture = z.infer<typeof TongyiOutputFixtureSchema>;
export type CustomerRuntimeContext = z.infer<typeof CustomerRuntimeContextSchema>;
export type IndustryTemplate = z.infer<typeof IndustryTemplateSchema>;
export type ScenarioTemplate = z.infer<typeof ScenarioTemplateSchema>;
export type SolutionPack = z.infer<typeof SolutionPackSchema>;
export type SolutionBundle = z.infer<typeof SolutionBundleSchema>;
export type PackMatch = z.infer<typeof PackMatchSchema>;
export type SceneResolution = z.infer<typeof SceneResolutionSchema>;
export type PptSection = z.infer<typeof PptSectionSchema>;
export type PptAssemblyContract = z.infer<typeof PptAssemblyContractSchema>;
export type SceneAppContext = z.infer<typeof SceneAppContextSchema>;
export type SceneIndustryTemplateRecord = z.infer<typeof SceneIndustryTemplateRecordSchema>;
export type SceneScenarioTemplateRecord = z.infer<typeof SceneScenarioTemplateRecordSchema>;
export type SceneSolutionPackRecord = z.infer<typeof SceneSolutionPackRecordSchema>;
export type SceneSolutionBundleRecord = z.infer<typeof SceneSolutionBundleRecordSchema>;
export type SceneSkillBinding = z.infer<typeof SceneSkillBindingSchema>;
export type SceneCaseFixture = z.infer<typeof SceneCaseFixtureSchema>;
export type SceneRunResult = z.infer<typeof SceneRunResultSchema>;
export type SceneWorkspace = z.infer<typeof SceneWorkspaceSchema>;

export type PackRegistry = {
  industries: IndustryTemplate[];
  scenarios: ScenarioTemplate[];
  solutionPacks: SolutionPack[];
  bundles: SolutionBundle[];
};
