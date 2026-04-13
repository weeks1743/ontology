import test from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import {
  buildPptAssemblyContract,
  loadTongyiOutputFixture,
  resolveScene,
  type CustomerRuntimeContext,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = resolve(
  __dirname,
  "../fixtures/donggang/GwIdThW9NIJM",
);

function loadDonggangContext() {
  return loadTongyiOutputFixture(fixtureDir, {
    customerName: "东港集团",
    visitTheme: "固定资产管理售前拜访",
    industryHint: "IT 企业软件",
  }).context;
}

function stripSignals(
  context: CustomerRuntimeContext,
  patterns: string[],
): CustomerRuntimeContext {
  const regex = new RegExp(patterns.join("|"));
  const clone = structuredClone(context);
  const removePatterns = (value: string) => patterns.reduce((acc, pattern) => acc.split(pattern).join(""), value);
  clone.keywords = clone.keywords.filter((item) => !regex.test(item));
  clone.summary = removePatterns(clone.summary);
  clone.paragraph_summary = removePatterns(clone.paragraph_summary);
  clone.chapter_summaries = clone.chapter_summaries
    .filter((item) => !regex.test(item.headline + item.summary))
    .map((item) => ({
      ...item,
      headline: removePatterns(item.headline),
      summary: removePatterns(item.summary),
    }));
  clone.qa_pairs = clone.qa_pairs
    .filter((item) => !regex.test(item.question + item.answer))
    .map((item) => ({
      ...item,
      question: removePatterns(item.question),
      answer: removePatterns(item.answer),
    }));
  clone.action_items = clone.action_items
    .filter((item) => !regex.test(item.text))
    .map((item) => ({
      ...item,
      text: removePatterns(item.text),
    }));
  clone.evidence_index.sentences = clone.evidence_index.sentences
    .filter((item) => !regex.test(item.text))
    .map((item) => ({
      ...item,
      text: removePatterns(item.text),
    }));
  clone.evidence_index.chapters = structuredClone(clone.chapter_summaries);
  clone.evidence_index.questions = structuredClone(clone.qa_pairs);
  clone.evidence_index.actions = structuredClone(clone.action_items);
  return clone;
}

test("adapter loads Donggang fixture and builds sentence-level evidence index", () => {
  const context = loadDonggangContext();

  assert.equal(context.customer_name, "东港集团");
  assert.equal(context.visit_theme, "固定资产管理售前拜访");
  assert.ok(context.chapter_summaries.length > 10);
  assert.ok(context.qa_pairs.length > 10);
  assert.ok(context.action_items.length > 5);
  assert.ok(context.evidence_index.sentences.length > 100);
});

test("resolver matches IT industry, presales scene, and Donggang bundle", () => {
  const context = loadDonggangContext();
  const resolution = resolveScene(context);

  assert.equal(resolution.industry_id, "it_enterprise_software");
  assert.equal(resolution.scenario_id, "presales_visit_ppt");
  assert.equal(resolution.primary_pack_id, "kingdee_fixed_assets_pack");
  assert.deepEqual(resolution.secondary_pack_ids, ["yunzhijia_asset_ops_pack"]);
  assert.equal(resolution.bundle_id, "donggang_asset_management_bundle");
  assert.equal(resolution.fallback_used, false);
});

test("assembler creates four fixed sections with evidence mapping", () => {
  const context = loadDonggangContext();
  const resolution = resolveScene(context);
  const contract = buildPptAssemblyContract(context, resolution);

  assert.equal(contract.sections.length, 4);
  assert.deepEqual(
    contract.sections.map((item) => item.title),
    ["客户基本情况", "信息化现状分析", "信息化输出", "信息化建议"],
  );

  for (const section of contract.sections) {
    assert.ok(section.evidence_refs.length >= 1, `${section.title} should have evidence refs`);
  }

  const currentState = contract.sections.find((item) => item.id === "current_state");
  assert.ok(currentState);
  assert.ok(
    currentState.bullets.some((item) => item.includes("账实不符")),
    "current state should mention asset mismatch",
  );
});

test("resolver degrades to single-pack result when Yunzhijia signals are removed", () => {
  const context = stripSignals(loadDonggangContext(), ["云之家", "轻应用", "OA", "台账", "领用", "调拨", "二维码"]);
  const resolution = resolveScene(context);

  assert.equal(resolution.primary_pack_id, "kingdee_fixed_assets_pack");
  assert.equal(resolution.secondary_pack_ids.length, 0);
  assert.equal(resolution.bundle_id, null);
});

test("resolver falls back to generic IT pack for vendor-neutral IT context", () => {
  const context: CustomerRuntimeContext = {
    customer_name: "泛化制造集团",
    visit_theme: "流程与资产治理沟通",
    industry_hint: "IT 企业软件",
    meeting_type: "meeting",
    keywords: ["信息化", "系统", "管理", "流程"],
    summary: "基于现有会议摘要与客户信息，场景层需要输出一份 vendor-neutral 的信息化建议。",
    paragraph_summary: "客户希望先梳理系统边界、接口和流程治理，再考虑后续具体产品选型。",
    conversational_summaries: [
      {
        speaker_name: "发言人1",
        summary: "客户更关注流程治理和系统分层，不希望过早绑定具体厂商。",
      },
    ],
    chapter_summaries: [
      {
        chapter_id: 1,
        headline: "流程治理与系统边界梳理",
        summary: "讨论如何先梳理对象、流程和接口，再进入产品选型。",
        start_ms: 0,
        end_ms: 1000,
      },
    ],
    qa_pairs: [
      {
        question: "我们当前最想先解决什么问题？",
        answer: "先梳理流程、接口和系统边界，再推进信息化方案。",
        sentence_ids: [1],
      },
    ],
    action_items: [
      {
        action_id: 1,
        text: "输出一版 vendor-neutral 的信息化分层建议",
        sentence_id: 1,
      },
    ],
    evidence_index: {
      sentences: [
        {
          sentence_id: 1,
          paragraph_id: "1",
          speaker_id: "1",
          text: "先梳理流程、接口和系统边界，再推进信息化方案。",
          start_ms: 0,
          end_ms: 100,
        },
      ],
      chapters: [
        {
          chapter_id: 1,
          headline: "流程治理与系统边界梳理",
          summary: "讨论如何先梳理对象、流程和接口，再进入产品选型。",
          start_ms: 0,
          end_ms: 1000,
        },
      ],
      actions: [
        {
          action_id: 1,
          text: "输出一版 vendor-neutral 的信息化分层建议",
          sentence_id: 1,
        },
      ],
      questions: [
        {
          question: "我们当前最想先解决什么问题？",
          answer: "先梳理流程、接口和系统边界，再推进信息化方案。",
          sentence_ids: [1],
        },
      ],
    },
  };

  const resolution = resolveScene(context);
  assert.equal(resolution.primary_pack_id, "it_generic_presales_pack");
  assert.equal(resolution.fallback_used, true);
});
