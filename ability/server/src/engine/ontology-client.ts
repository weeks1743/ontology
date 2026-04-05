// 调用主系统 API 获取本体定义

const ONTOLOGY_API_BASE = 'http://localhost:3001/api';

export interface OntologyBehavior {
  id: string;
  code: string;
  name: string;
  description: string;
  owner_object?: string;
  trigger_type?: string;
  referenced_rules?: string[];
  emits_events?: string[];
  side_effects?: Array<{
    type: string;
    target_object: string;
    description: string;
  }>;
}

export interface OntologyRule {
  id: string;
  code: string;
  name: string;
  description: string;
  applicable_objects?: string[];
  applicable_behaviors?: string[];
  expression: string;
  severity: 'error' | 'warning' | 'info';
  failure_message: string;
}

export interface OntologyObject {
  id: string;
  code: string;
  name: string;
  description: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

export interface OntologyEvent {
  id: string;
  code: string;
  name: string;
  description: string;
  producer_object?: string;
  producer_behavior?: string;
}

// 获取本体的所有 behaviors
export async function getOntologyBehaviors(ontologyId: string): Promise<OntologyBehavior[]> {
  try {
    const response = await fetch(`${ONTOLOGY_API_BASE}/ontologies/${ontologyId}/behaviors`);
    if (!response.ok) {
      throw new Error(`Failed to fetch behaviors: ${response.statusText}`);
    }
    return await response.json() as OntologyBehavior[];
  } catch (error) {
    console.error('Error fetching ontology behaviors:', error);
    throw error;
  }
}

// 获取本体的所有 rules
export async function getOntologyRules(ontologyId: string): Promise<OntologyRule[]> {
  try {
    const response = await fetch(`${ONTOLOGY_API_BASE}/ontologies/${ontologyId}/rules`);
    if (!response.ok) {
      throw new Error(`Failed to fetch rules: ${response.statusText}`);
    }
    return await response.json() as OntologyRule[];
  } catch (error) {
    console.error('Error fetching ontology rules:', error);
    throw error;
  }
}

// 获取本体的所有 objects
export async function getOntologyObjects(ontologyId: string): Promise<OntologyObject[]> {
  try {
    const response = await fetch(`${ONTOLOGY_API_BASE}/ontologies/${ontologyId}/objects`);
    if (!response.ok) {
      throw new Error(`Failed to fetch objects: ${response.statusText}`);
    }
    return await response.json() as OntologyObject[];
  } catch (error) {
    console.error('Error fetching ontology objects:', error);
    throw error;
  }
}

// 获取本体的所有 events
export async function getOntologyEvents(ontologyId: string): Promise<OntologyEvent[]> {
  try {
    const response = await fetch(`${ONTOLOGY_API_BASE}/ontologies/${ontologyId}/events`);
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }
    return await response.json() as OntologyEvent[];
  } catch (error) {
    console.error('Error fetching ontology events:', error);
    throw error;
  }
}

// 获取本体的完整定义
export async function getOntologyDefinition(ontologyId: string) {
  const [behaviors, rules, objects, events] = await Promise.all([
    getOntologyBehaviors(ontologyId),
    getOntologyRules(ontologyId),
    getOntologyObjects(ontologyId),
    getOntologyEvents(ontologyId),
  ]);

  return {
    behaviors,
    rules,
    objects,
    events,
  };
}
