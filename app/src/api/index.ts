import type {
  OntologyShell, ObjectDraft, BehaviorDraft, RuleDraft, EventDraft, ScenarioDraft,
  YamlBundle, ValidationResult
} from '../types/ontology';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data as T;
}

// ── Ontologies ──────────────────────────────────────────────────────────────

export const api = {
  ontologies: {
    list: () => request<OntologyShell[]>('/ontologies'),
    get: (id: number) => request<OntologyShell>(`/ontologies/${id}`),
    create: (body: { ontology_code: string; display_name: string; description?: string }) =>
      request<OntologyShell>('/ontologies', { method: 'POST', body: JSON.stringify(body) }),
  },

  // ── Objects ──────────────────────────────────────────────────────────────
  objects: {
    list: (ontologyId: number) => request<ObjectDraft[]>(`/ontologies/${ontologyId}/objects`),
    create: (ontologyId: number, body: Partial<ObjectDraft>) =>
      request<ObjectDraft>(`/ontologies/${ontologyId}/objects`, { method: 'POST', body: JSON.stringify(body) }),
    update: (ontologyId: number, code: string, body: Partial<ObjectDraft>) =>
      request<ObjectDraft>(`/ontologies/${ontologyId}/objects/${code}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (ontologyId: number, code: string) =>
      request<void>(`/ontologies/${ontologyId}/objects/${code}`, { method: 'DELETE' }),
  },

  // ── Behaviors ────────────────────────────────────────────────────────────
  behaviors: {
    list: (ontologyId: number) => request<BehaviorDraft[]>(`/ontologies/${ontologyId}/behaviors`),
    create: (ontologyId: number, body: Partial<BehaviorDraft>) =>
      request<BehaviorDraft>(`/ontologies/${ontologyId}/behaviors`, { method: 'POST', body: JSON.stringify(body) }),
    update: (ontologyId: number, code: string, body: Partial<BehaviorDraft>) =>
      request<BehaviorDraft>(`/ontologies/${ontologyId}/behaviors/${code}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (ontologyId: number, code: string) =>
      request<void>(`/ontologies/${ontologyId}/behaviors/${code}`, { method: 'DELETE' }),
  },

  // ── Rules ────────────────────────────────────────────────────────────────
  rules: {
    list: (ontologyId: number) => request<RuleDraft[]>(`/ontologies/${ontologyId}/rules`),
    create: (ontologyId: number, body: Partial<RuleDraft>) =>
      request<RuleDraft>(`/ontologies/${ontologyId}/rules`, { method: 'POST', body: JSON.stringify(body) }),
    update: (ontologyId: number, code: string, body: Partial<RuleDraft>) =>
      request<RuleDraft>(`/ontologies/${ontologyId}/rules/${code}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (ontologyId: number, code: string) =>
      request<void>(`/ontologies/${ontologyId}/rules/${code}`, { method: 'DELETE' }),
  },

  // ── Events ───────────────────────────────────────────────────────────────
  events: {
    list: (ontologyId: number) => request<EventDraft[]>(`/ontologies/${ontologyId}/events`),
    create: (ontologyId: number, body: Partial<EventDraft>) =>
      request<EventDraft>(`/ontologies/${ontologyId}/events`, { method: 'POST', body: JSON.stringify(body) }),
    update: (ontologyId: number, code: string, body: Partial<EventDraft>) =>
      request<EventDraft>(`/ontologies/${ontologyId}/events/${code}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (ontologyId: number, code: string) =>
      request<void>(`/ontologies/${ontologyId}/events/${code}`, { method: 'DELETE' }),
  },

  // ── Scenarios ────────────────────────────────────────────────────────────
  scenarios: {
    list: (ontologyId: number) => request<ScenarioDraft[]>(`/ontologies/${ontologyId}/scenarios`),
    create: (ontologyId: number, body: Partial<ScenarioDraft>) =>
      request<ScenarioDraft>(`/ontologies/${ontologyId}/scenarios`, { method: 'POST', body: JSON.stringify(body) }),
    update: (ontologyId: number, code: string, body: Partial<ScenarioDraft>) =>
      request<ScenarioDraft>(`/ontologies/${ontologyId}/scenarios/${code}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (ontologyId: number, code: string) =>
      request<void>(`/ontologies/${ontologyId}/scenarios/${code}`, { method: 'DELETE' }),
  },

  // ── YAML & Validation ────────────────────────────────────────────────────
  yaml: (ontologyId: number) => request<YamlBundle>(`/ontologies/${ontologyId}/yaml`),
  validation: (ontologyId: number) => request<ValidationResult>(`/ontologies/${ontologyId}/validation`),
  seed: (ontologyId: number) => request<{ seeded: boolean; message: string }>(`/ontologies/${ontologyId}/seed`, { method: 'POST' }),
};
