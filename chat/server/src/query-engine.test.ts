import test from "node:test";
import assert from "node:assert/strict";

import { answerThreadQuery } from "./query-engine.js";

const noThreadId = "adhoc-query-thread";

const besmeiCases = [
  {
    name: "identity",
    question: "贝斯美的全称、股票代码和行业是什么？",
    expected: ["绍兴贝斯美化工股份有限公司", "300796", "农药制造 / 精细化工"],
  },
  {
    name: "main business",
    question: "贝斯美的主营业务是什么？",
    expected: ["二甲戊灵全产业链", "碳五新材料", "农药出海贸易"],
  },
  {
    name: "strategy",
    question: "贝斯美的核心战略怎么概括？",
    expected: ["单品种极致深耕", "副产物横向增值", "1+3"],
  },
  {
    name: "second curve",
    question: "贝斯美的第二增长曲线是什么？",
    expected: ["碳五新材料", "铜陵"],
  },
  {
    name: "performance 2024",
    question: "贝斯美 2024 年的经营表现怎么样？",
    expected: ["13.28亿元", "亏损约3,286万元"],
  },
  {
    name: "meeting demand",
    question: "当前贝斯美这次拜访主要在谈什么需求？",
    expected: ["云之家", "ERP", "替换钉钉", "费用报销", "研发项目管理", "海外"],
  },
  {
    name: "stage",
    question: "贝斯美当前项目阶段是什么？",
    expected: ["需求初步探索", "方案评估"],
  },
  {
    name: "key contact",
    question: "贝斯美当前最关键的客户联系人是谁？",
    expected: ["财务沈总", "影响力高", "态度谨慎"],
  },
  {
    name: "barrier",
    question: "贝斯美当前最核心的推进障碍是什么？",
    expected: ["决策链信息缺失", "迁移成本", "技术适配", "组织架构复杂性", "历史数据迁移", "海外合规"],
  },
  {
    name: "opportunity",
    question: "贝斯美当前已经沉淀了什么商机意向？",
    expected: ["轻云、融合中心、报表秀秀", "300,000"],
  },
];

const donggangCases = [
  {
    name: "core problem",
    question: "东港这次项目的核心问题是什么？",
    expected: ["固定资产账实不符", "固定资产管理模块"],
  },
  {
    name: "recommended solution",
    question: "东港当前推荐的总体方案是什么？",
    expected: ["ES 财务端", "云之家业务端"],
  },
  {
    name: "stage",
    question: "东港项目现在处于什么阶段？",
    expected: ["方案评估", "供应商筛选"],
  },
  {
    name: "key contact",
    question: "东港最关键的客户联系人是谁？",
    expected: ["李毅", "影响力高", "态度谨慎"],
  },
  {
    name: "supporter",
    question: "东港内部谁更像支持者？",
    expected: ["张丽", "态度积极"],
  },
  {
    name: "time quote",
    question: "东港对时间和报价有什么明确要求？",
    expected: ["下周三", "初步方案", "报价"],
  },
  {
    name: "delivery cost",
    question: "东港对实施周期和成本的顾虑是什么？",
    expected: ["50 人天", "40 人天", "实施费", "年度服务费"],
  },
  {
    name: "trust issue",
    question: "东港对我们最大的信任问题是什么？",
    expected: ["合同审批", "安全漏洞", "补丁更新", "人员变动"],
  },
  {
    name: "opportunity",
    question: "东港现在已经记录了什么商机信息？",
    expected: ["轻云、融合中心", "100,000"],
  },
  {
    name: "budget",
    question: "东港预算有多少钱？",
    expected: ["总预算金额", "100,000", "预算审批链", "不能把这笔金额直接等同于项目总预算"],
  },
];

async function assertQuestion(question: string, expected: string[]) {
  const result = await answerThreadQuery({ threadId: noThreadId, question });
  for (const fragment of expected) {
    assert.ok(
      result.text.includes(fragment),
      `Expected answer for "${question}" to include "${fragment}".\nActual:\n${result.text}`,
    );
  }
}

test("Besmei query matrix", async (t) => {
  for (const item of besmeiCases) {
    await t.test(item.name, async () => {
      await assertQuestion(item.question, item.expected);
    });
  }
});

test("Donggang query matrix", async (t) => {
  for (const item of donggangCases) {
    await t.test(item.name, async () => {
      await assertQuestion(item.question, item.expected);
    });
  }
});
