import { readFileSync } from "fs";
import { join } from "path";

import {
  CustomerRuntimeContextSchema,
  TongyiOutputFixtureSchema,
  type CustomerRuntimeContext,
  type TongyiOutputFixture,
} from "../schemas/contracts.js";

type AdapterOptions = {
  customerName?: string;
  visitTheme?: string;
  industryHint?: string | null;
};

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function inferMeetingType(classifications: Record<string, number>): string {
  const entries = Object.entries(classifications);
  if (entries.length === 0) return "meeting";
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "meeting";
}

function buildSentenceIndex(transcription: TongyiOutputFixture["transcription"]) {
  const sentenceMap = new Map<
    number,
    {
      sentence_id: number;
      paragraph_id: string;
      speaker_id: string;
      textParts: string[];
      start_ms: number;
      end_ms: number;
    }
  >();

  for (const paragraph of transcription.paragraphs) {
    const paragraphId = String(paragraph.paragraphId);
    const speakerId = String(paragraph.speakerId);

    for (const word of paragraph.words) {
      const existing = sentenceMap.get(word.sentenceId);
      if (!existing) {
        sentenceMap.set(word.sentenceId, {
          sentence_id: word.sentenceId,
          paragraph_id: paragraphId,
          speaker_id: speakerId,
          textParts: [word.text],
          start_ms: word.start,
          end_ms: word.end,
        });
        continue;
      }

      existing.textParts.push(word.text);
      existing.start_ms = Math.min(existing.start_ms, word.start);
      existing.end_ms = Math.max(existing.end_ms, word.end);
    }
  }

  return Array.from(sentenceMap.values())
    .sort((a, b) => a.sentence_id - b.sentence_id)
    .map((item) => ({
      sentence_id: item.sentence_id,
      paragraph_id: item.paragraph_id,
      speaker_id: item.speaker_id,
      text: item.textParts.join("").trim(),
      start_ms: item.start_ms,
      end_ms: item.end_ms,
    }));
}

function inferVisitTheme(
  fixture: TongyiOutputFixture,
  options: AdapterOptions,
): string {
  if (options.visitTheme) return options.visitTheme;

  const firstChapter = fixture.auto_chapters[0];
  if (firstChapter?.headline) {
    return firstChapter.headline;
  }

  if (fixture.meeting_assistance.keywords.length > 0) {
    return fixture.meeting_assistance.keywords.slice(0, 3).join(" / ");
  }

  return "客户拜访售前讨论";
}

export function loadTongyiOutputFixture(
  fixtureDir: string,
  options: AdapterOptions = {},
): {
  fixture: TongyiOutputFixture;
  context: CustomerRuntimeContext;
} {
  const summary = readFileSync(join(fixtureDir, "summary.txt"), "utf8");
  const summarization = readJsonFile(join(fixtureDir, "assets/summarization.json"));
  const autoChapters = readJsonFile(join(fixtureDir, "assets/autoChapters.json"));
  const meetingAssistance = readJsonFile(
    join(fixtureDir, "assets/meetingAssistance.json"),
  );
  const transcription = readJsonFile(join(fixtureDir, "assets/transcription.json"));

  const fixture = TongyiOutputFixtureSchema.parse({
    summary,
    summarization,
    auto_chapters: autoChapters,
    meeting_assistance: meetingAssistance,
    transcription,
    assets_path: join(fixtureDir, "assets"),
  });

  const sentences = buildSentenceIndex(fixture.transcription);
  const context = CustomerRuntimeContextSchema.parse({
    customer_name: options.customerName ?? "未知客户",
    visit_theme: inferVisitTheme(fixture, options),
    industry_hint: options.industryHint ?? null,
    meeting_type: inferMeetingType(fixture.meeting_assistance.classifications),
    keywords: fixture.meeting_assistance.keywords,
    summary: fixture.summary,
    paragraph_summary: fixture.summarization.paragraphSummary,
    conversational_summaries: fixture.summarization.conversationalSummary.map(
      (item) => ({
        speaker_name: item.speakerName ?? item.speakerId ?? "未知发言人",
        summary: item.summary,
      }),
    ),
    chapter_summaries: fixture.auto_chapters.map((chapter) => ({
      chapter_id: chapter.id,
      headline: chapter.headline,
      summary: chapter.summary,
      start_ms: chapter.start,
      end_ms: chapter.end,
    })),
    qa_pairs: fixture.summarization.questionsAnsweringSummary.map((item) => ({
      question: item.question,
      answer: item.answer,
      sentence_ids: item.sentenceIdsOfAnswer,
    })),
    action_items: fixture.meeting_assistance.actions.map((item) => ({
      action_id: item.id,
      text: item.text,
      sentence_id: item.sentenceId,
    })),
    evidence_index: {
      sentences,
      chapters: fixture.auto_chapters.map((chapter) => ({
        chapter_id: chapter.id,
        headline: chapter.headline,
        summary: chapter.summary,
        start_ms: chapter.start,
        end_ms: chapter.end,
      })),
      actions: fixture.meeting_assistance.actions.map((item) => ({
        action_id: item.id,
        text: item.text,
        sentence_id: item.sentenceId,
      })),
      questions: fixture.summarization.questionsAnsweringSummary.map((item) => ({
        question: item.question,
        answer: item.answer,
        sentence_ids: item.sentenceIdsOfAnswer,
      })),
    },
  });

  return { fixture, context };
}
