const ABILITY_BASE_URL = process.env.ABILITY_BASE_URL ?? "http://127.0.0.1:3002";

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ABILITY_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? `Ability request failed: ${response.status}`);
  }
  return payload as T;
}

export async function getAbilityJson<T>(path: string, init?: RequestInit) {
  return requestJson<T>(path, init);
}

export async function executeOntologySkill<T>(skillId: string, params: Record<string, unknown>) {
  return requestJson<T>(`/api/ontology-skills/${encodeURIComponent(skillId)}/execute`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function executeSkillCore<T>(skillId: string, params: Record<string, unknown>, mode?: string) {
  return requestJson<T>(`/api/v2/skills/${encodeURIComponent(skillId)}/execute`, {
    method: "POST",
    body: JSON.stringify({ params, mode }),
  });
}

export async function cleanupCustomerData<T>(payload: Record<string, unknown>) {
  return requestJson<T>("/api/ontology-skills/cleanup-customer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listCrmCustomers<T>() {
  return requestJson<T>("/api/mock-data/customers");
}

export async function getCrmCustomerContext<T>(customerId: string) {
  return requestJson<T>(`/api/mock-data/customers/${encodeURIComponent(customerId)}/context`);
}

export async function getCrmCustomerAdvice<T>(customerId: string) {
  return requestJson<T>(`/api/mock-data/customers/${encodeURIComponent(customerId)}/advice`);
}

export async function getCrmVisitRecord<T>(visitRecordId: string) {
  return requestJson<T>(`/api/mock-data/visit-records/${encodeURIComponent(visitRecordId)}`);
}
