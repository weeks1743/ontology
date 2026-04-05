// 快照加载器 - 从本体系统获取定义快照

import { DefinitionSnapshot } from '../types/snapshot.js';

const ONTOLOGY_API_BASE = 'http://localhost:3001/api';

export class BuildBlockedError extends Error {
  constructor(public readonly errors: any[]) {
    super(`Build blocked: ontology has ${errors.length} validation error(s)`);
    this.name = 'BuildBlockedError';
  }
}

export async function loadSnapshot(ontologyId: string): Promise<DefinitionSnapshot> {
  const url = `${ONTOLOGY_API_BASE}/ontologies/${ontologyId}/definition-snapshot`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(
      `Cannot connect to ontology server at ${ONTOLOGY_API_BASE}. ` +
      `Make sure the ontology server is running on port 3001. Details: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to load snapshot for '${ontologyId}': ${response.status} ${body}`);
  }

  const snapshot = await response.json() as DefinitionSnapshot;

  // Block build if there are validation errors
  if (snapshot.validation.errors.length > 0) {
    throw new BuildBlockedError(snapshot.validation.errors);
  }

  return snapshot;
}
