import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { loadTongyiOutputFixture } from "../adapters/tongyi-output.js";
import { buildPptAssemblyContract } from "../assembler/build-ppt-contract.js";
import { resolveScene } from "../resolver/resolve-scene.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = resolve(
  __dirname,
  "../../fixtures/donggang/GwIdThW9NIJM",
);

const { context } = loadTongyiOutputFixture(fixtureDir, {
  customerName: "东港集团",
  visitTheme: "固定资产管理售前拜访",
  industryHint: "IT 企业软件",
});

const resolution = resolveScene(context);
const contract = buildPptAssemblyContract(context, resolution);

console.log(
  JSON.stringify(
    {
      resolution,
      contract,
    },
    null,
    2,
  ),
);
