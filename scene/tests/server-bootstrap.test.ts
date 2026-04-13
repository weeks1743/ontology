import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createSceneDb } from "../server/src/db.js";
import { seedMockData } from "../server/src/seed.js";
import {
  getOntologies,
  getIndustries,
  getScenarios,
  getSections,
  getBindings,
  getTestCases,
  runTestCase,
} from "../server/src/repository.js";

test("scene sqlite bootstrap seeds CRM workspace with 3 industries", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "scene-studio-"));
  const db = createSceneDb(join(tempDir, "scene.db"));

  try {
    seedMockData(db, "crm", "CRM客户关系管理");

    const ontologies = getOntologies(db);
    assert.equal(ontologies.length, 1);
    assert.equal(ontologies[0].ontology_id, "crm");

    const industries = getIndustries(db, ontologies[0].id);
    assert.equal(industries.length, 3); // IT, Biology, Food

    // Check IT industry
    const itIndustry = industries.find(i => i.code === "IT");
    assert.ok(itIndustry);
    assert.equal(itIndustry.name, "信息技术");

    // Check IT scenarios
    const itScenarios = getScenarios(db, itIndustry.id);
    assert.ok(itScenarios.length > 0);

    // Check IT sections
    const itSections = getSections(db, itScenarios[0].id);
    assert.ok(itSections.length >= 4); // At least 4 sections

    // Check bindings
    const bindings = getBindings(db, itSections[0].id);
    assert.ok(bindings.length > 0);

    // Check test cases
    const testCases = getTestCases(db, itScenarios[0].id);
    assert.ok(testCases.length > 0);
  } finally {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("running test case returns mock results", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "scene-run-"));
  const db = createSceneDb(join(tempDir, "scene.db"));

  try {
    seedMockData(db, "crm", "CRM客户关系管理");

    const ontologies = getOntologies(db);
    const industries = getIndustries(db, ontologies[0].id);
    const itIndustry = industries.find(i => i.code === "IT");
    const scenarios = getScenarios(db, itIndustry!.id);
    const testCases = getTestCases(db, scenarios[0].id);

    const result = runTestCase(db, testCases[0].id);

    assert.equal(result.test_case_id, testCases[0].id);
    assert.ok(result.sections_generated.length > 0);
    assert.ok(result.execution_time_ms > 0);
    assert.equal(result.success, true);
  } finally {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
});
