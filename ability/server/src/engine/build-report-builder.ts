// build-report-builder.ts
// 生成构建报告

import { nanoid } from 'nanoid';
import { BuildReport } from '../types/manifest.js';
import { DefinitionSnapshot } from '../types/snapshot.js';

export interface BuildResult {
  build_id: string;
  build_version: string;
  ontology_id: string;
  build_mode: 'full' | 'incremental';
  status: 'success' | 'failed' | 'partial';
  duration_ms: number;
  generated_count: number;
  updated_count: number;
  skipped_count: number;
  new_skills: string[];
  updated_skills: string[];
  skipped_skills: string[];
  skill_details: BuildReport['skill_details'];
  error_message?: string;
  test_plan_summary: BuildReport['test_plan_summary'];
}

export function buildBuildReport(result: BuildResult, snapshot: DefinitionSnapshot): BuildReport {
  return {
    build_id: result.build_id,
    build_version: result.build_version,
    ontology_id: result.ontology_id,
    summary: {
      status: result.status,
      build_mode: result.build_mode,
      duration_ms: result.duration_ms,
      snapshot_hash: snapshot.snapshot_hash,
      generated_at: new Date().toISOString(),
    },
    input_snapshot: {
      objects: snapshot.objects.length,
      behaviors: snapshot.behaviors.length,
      rules: snapshot.rules.length,
      events: snapshot.events.length,
      scenarios: snapshot.scenarios.length,
      validation_errors: snapshot.validation.errors.length,
      validation_warnings: snapshot.validation.warnings.length,
    },
    skill_results: {
      behavior_skills: result.skill_details.filter(d => d.skill_type === 'behavior').length,
      scenario_skills: result.skill_details.filter(d => d.skill_type === 'scenario').length,
      query_skills: result.skill_details.filter(d => d.skill_type === 'query').length,
      total: result.skill_details.length,
      new_skills: result.new_skills,
      updated_skills: result.updated_skills,
      skipped_skills: result.skipped_skills,
    },
    skill_details: result.skill_details,
    test_plan_summary: result.test_plan_summary,
  };
}
