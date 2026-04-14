import { existsSync, readdirSync, statSync } from "node:fs";
import { basename } from "node:path";
import { spawn } from "node:child_process";

import { OUTPUTS_DIR, VERIFY_SCRIPT, VENV_PYTHON } from "./paths.js";
import { sleep } from "./utils.js";

export type AudioJobResult = {
  outputTaskId: string;
};

function resolvePythonBinary() {
  return existsSync(VENV_PYTHON) ? VENV_PYTHON : process.execPath;
}

function resolveFinishedTaskId(knownIds: Set<string>, startedAtMs: number, stdout: string) {
  if (!existsSync(OUTPUTS_DIR)) return null;
  const dirs = readdirSync(OUTPUTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${OUTPUTS_DIR}/${entry.name}`);
  const newDirs = dirs.filter((dir) => !knownIds.has(basename(dir)));
  if (newDirs.length === 1) return basename(newDirs[0]);
  if (newDirs.length > 1) {
    return basename(newDirs.sort().at(-1)!);
  }

  const lines = stdout.split("\n").reverse();
  for (const line of lines) {
    if (!line.includes("dataId")) continue;
    return line.split(":").at(-1)?.trim().replace(/^["']|["']$/g, "") ?? null;
  }
  const newer = dirs
    .map((dir) => ({ dir, mtimeMs: statSync(dir).mtimeMs }))
    .filter((entry) => entry.mtimeMs >= startedAtMs - 2000)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return newer.length > 0 ? basename(newer[0].dir) : null;
}

export async function runAudioAnalysis(params: { audioPath: string }) {
  const appId = process.env.TINGWU_APP_ID?.trim() ?? "";
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim() ?? "";
  if (!appId || !apiKey) {
    throw new Error("缺少环境变量：请配置 DASHSCOPE_API_KEY 与 TINGWU_APP_ID");
  }

  const startedAtMs = Date.now();
  const knownIds = new Set(
    existsSync(OUTPUTS_DIR)
      ? readdirSync(OUTPUTS_DIR, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
      : [],
  );

  const pythonBinary = resolvePythonBinary();
  const commandArgs = [
    VERIFY_SCRIPT,
    "--app-id",
    appId,
    "--audio",
    params.audioPath,
    "--output-dir",
    OUTPUTS_DIR,
  ];

  const processResult = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const proc = spawn(pythonBinary, commandArgs, {
      env: {
        ...process.env,
        DASHSCOPE_API_KEY: apiKey,
      },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
  });

  if (processResult.code !== 0) {
    throw new Error(processResult.stderr.trim() || processResult.stdout.trim() || "录音分析失败");
  }

  await sleep(500);
  const outputTaskId = resolveFinishedTaskId(knownIds, startedAtMs, processResult.stdout);
  if (!outputTaskId) {
    throw new Error("分析完成但未识别到任务 ID");
  }

  return { outputTaskId };
}
