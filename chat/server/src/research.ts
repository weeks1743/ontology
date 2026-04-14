import { basename } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

import { executeSkillCore } from "./ability-client.js";
import { safeFileName } from "./utils.js";

type SkillCoreResult = {
  success: boolean;
  error?: string;
  substitutedBody?: string;
  spawnOutput?: unknown;
};

function stringifyOutput(output: unknown) {
  if (typeof output === "string") return output;
  return JSON.stringify(output, null, 2);
}

export async function runCompanyResearch(params: {
  companyName: string;
  artifactDir: string;
  researchPurpose: string;
}) {
  const searchInput = {
    query: `${params.companyName} 公司研究 产品战略 客户案例 数字化 转型`,
    limit: 8,
    sources: ["toutiao", "douyin", "moji"],
  };

  let searchSummary = "";
  try {
    const searchResult = await executeSkillCore<SkillCoreResult>("volcengine-web-search", searchInput);
    if (searchResult.success) {
      searchSummary = stringifyOutput(searchResult.spawnOutput ?? searchResult.substitutedBody ?? "");
    } else {
      throw new Error(searchResult.error ?? "volcengine-web-search failed");
    }
  } catch {
    const fallbackResult = await executeSkillCore<SkillCoreResult>("baidu-search", {
      query: `${params.companyName} 公司研究 产品战略 客户案例`,
      limit: 8,
    });
    if (!fallbackResult.success) {
      throw new Error(fallbackResult.error ?? "search skills failed");
    }
    searchSummary = stringifyOutput(fallbackResult.spawnOutput ?? fallbackResult.substitutedBody ?? "");
  }

  const researchResult = await executeSkillCore<SkillCoreResult>("company-research-pm", {
    company_name: params.companyName,
    research_purpose: params.researchPurpose,
    source_notes: searchSummary,
  });

  if (!researchResult.success) {
    throw new Error(researchResult.error ?? "company-research-pm failed");
  }

  const markdown = stringifyOutput(researchResult.spawnOutput ?? researchResult.substitutedBody ?? "");
  const fileName = `${safeFileName(params.companyName)}公司研究.md`;
  const filePath = `${params.artifactDir}/${fileName}`;
  writeFileSync(filePath, markdown, "utf-8");

  return {
    fileName,
    filePath,
    markdown,
    title: basename(filePath),
    preview: markdown.slice(0, 180),
  };
}

export function readMarkdownFile(path: string) {
  return readFileSync(path, "utf-8");
}
