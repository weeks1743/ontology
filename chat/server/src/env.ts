import { existsSync, readFileSync } from "node:fs";

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return null;
  const [key, ...rest] = trimmed.split("=");
  const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  return {
    key: key.trim(),
    value,
  };
}

export function loadEnvFiles(paths: string[]) {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (!process.env[parsed.key] && parsed.value) {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}
