const SCENE_BASE_URL = process.env.SCENE_BASE_URL ?? "http://127.0.0.1:3003";

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export async function executeSceneRuntime<T>(scenarioCode: string, payload: Record<string, unknown>) {
  const response = await fetch(`${SCENE_BASE_URL}/api/runtime/scenarios/${encodeURIComponent(scenarioCode)}/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `Scene runtime failed: ${response.status}`);
  }
  return data as T;
}
