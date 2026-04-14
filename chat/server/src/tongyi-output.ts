import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type TongyiParagraphWord = {
  text?: string;
};

type TongyiParagraph = {
  speakerId?: string | number;
  paragraphId?: string | number;
  words?: TongyiParagraphWord[];
};

type TongyiBundle = {
  transcription?: {
    paragraphs?: TongyiParagraph[];
  };
  summarization?: {
    paragraphSummary?: string;
    summary?: string;
  };
};

function readJson(path: string) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function loadTongyiOutput(taskOutputId: string, outputsDir: string) {
  const taskDir = join(outputsDir, taskOutputId);
  const assetsDir = join(taskDir, "assets");
  const transcription = readJson(join(assetsDir, "transcription.json")) as TongyiBundle["transcription"] | null;
  const summarization = readJson(join(assetsDir, "summarization.json")) as TongyiBundle["summarization"] | null;
  const summaryText = existsSync(join(taskDir, "summary.txt")) ? readFileSync(join(taskDir, "summary.txt"), "utf-8") : "";

  return {
    taskDir,
    assetsDir,
    transcription,
    summarization,
    summaryText,
  };
}

export function buildTranscriptText(bundle: ReturnType<typeof loadTongyiOutput>) {
  const paragraphs = bundle.transcription?.paragraphs ?? [];
  return paragraphs
    .map((paragraph) => {
      const speaker = `发言人${String(paragraph.speakerId ?? "未知")}`;
      const text = (paragraph.words ?? []).map((word) => word.text ?? "").join("").trim();
      return text ? `${speaker}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function buildVisitMarkdown(params: {
  customerName: string;
  visitRecordId: string;
  taskOutputId: string;
  bundle: ReturnType<typeof loadTongyiOutput>;
}) {
  const transcriptText = buildTranscriptText(params.bundle);
  const summary =
    params.bundle.summarization?.paragraphSummary ||
    params.bundle.summarization?.summary ||
    params.bundle.summaryText ||
    "暂无摘要";

  return [
    "---",
    `visit_record_id: ${params.visitRecordId}`,
    `customer_name: ${params.customerName}`,
    `visit_type: uploaded_audio`,
    `source_channel: tongyi_audio`,
    "---",
    "",
    `# ${params.customerName} 拜访录音整理`,
    "",
    "## 录音摘要",
    "",
    summary,
    "",
    "## 原始转写",
    "",
    transcriptText || "暂无转写内容",
    "",
    `## 来源任务`,
    "",
    `- 听悟任务ID：${params.taskOutputId}`,
    "",
  ].join("\n");
}

export function extractSpeakerParagraphs(bundle: ReturnType<typeof loadTongyiOutput>) {
  const paragraphs = bundle.transcription?.paragraphs ?? [];
  const bySpeaker = new Map<string, string[]>();
  for (const paragraph of paragraphs) {
    const speaker = `发言人${String(paragraph.speakerId ?? "未知")}`;
    const text = (paragraph.words ?? []).map((word) => word.text ?? "").join("").trim();
    if (!text) continue;
    const list = bySpeaker.get(speaker) ?? [];
    list.push(text);
    bySpeaker.set(speaker, list);
  }
  return bySpeaker;
}

export function buildResearchSummary(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("---"))
    .slice(0, 6)
    .join(" ");
}

