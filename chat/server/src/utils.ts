import { mkdirSync } from "node:fs";
import { extname } from "node:path";

export const DEFAULT_THREAD_TITLE = "新对话";

export function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}

export function nowIso() {
  return new Date().toISOString();
}

export function clipTitle(text: string, limit = 24) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trimEnd()}...`;
}

export function deriveThreadTitle(text: string, attachments: Array<{ fileName: string }>) {
  if (text.trim()) return clipTitle(text);
  const firstAttachment = attachments[0]?.fileName;
  if (firstAttachment) return clipTitle(firstAttachment);
  return DEFAULT_THREAD_TITLE;
}

export function isSupportedAudioFile(fileName: string) {
  return [".m4a", ".mp3"].includes(extname(fileName).toLowerCase());
}

export function safeFileName(input: string) {
  return input.replace(/[^\w\u4e00-\u9fa5.-]+/g, "_");
}

export function decodeMaybeLatin1FileName(input: string) {
  try {
    const decoded = Buffer.from(input, "latin1").toString("utf8");
    const mojibakeLike = /[ÃÂäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(input);
    return mojibakeLike ? decoded : input;
  } catch {
    return input;
  }
}

export function tryParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeCompanyNameForId(name: string) {
  return safeFileName(name.toLowerCase()).slice(0, 32);
}

export function parseOpportunityInput(input: string) {
  const amountMatch = input.match(/(\d+(?:\.\d+)?)\s*万/);
  const amount = amountMatch ? Math.round(Number(amountMatch[1]) * 10000) : null;
  const cleaned = input.replace(/(\d+(?:\.\d+)?)\s*万/g, "").trim();
  const products = cleaned
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    amount,
    productNotes: products.join("、"),
    products,
  };
}
