export interface ExternalSkillSelectionRequest {
  artifact_type: string;
}

export interface ExternalSkillSelectionResult {
  selected_skill_id: string;
  strategy: 'fixed';
}

export function selectExternalSkill(
  request: ExternalSkillSelectionRequest
): ExternalSkillSelectionResult {
  if (request.artifact_type === 'operating_advice') {
    return {
      selected_skill_id: 'kai-report-creator',
      strategy: 'fixed',
    };
  }

  return {
    selected_skill_id: 'kai-report-creator',
    strategy: 'fixed',
  };
}
