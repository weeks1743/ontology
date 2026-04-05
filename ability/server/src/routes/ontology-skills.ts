import { Router } from 'express';
import { nanoid } from 'nanoid';
import { rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { skillGenerator } from '../engine/skill-generator.js';
import { loadSnapshot, BuildBlockedError } from '../engine/snapshot-loader.js';
import { buildBuildReport } from '../engine/build-report-builder.js';
import { buildTestPlan } from '../engine/test-plan-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const getSkillsDir = (ontologyId: string) =>
  join(__dirname, '../../../skills/ontology', ontologyId);

// POST /api/ontology-skills/build
router.post('/build', async (req, res) => {
  try {
    const { ontology_id, force_full } = req.body;

    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    // Load snapshot (throws BuildBlockedError if validation errors)
    let snapshot;
    try {
      snapshot = await loadSnapshot(ontology_id);
    } catch (err) {
      if (err instanceof BuildBlockedError) {
        return res.status(422).json({
          error: 'Build blocked due to ontology validation errors',
          validation_errors: err.errors,
        });
      }
      throw err;
    }

    // Determine build mode
    const lastBuild = db.prepare(
      `SELECT id FROM skill_builds WHERE ontology_id=? ORDER BY created_at DESC LIMIT 1`
    ).get(ontology_id) as any;

    const buildMode = (force_full || !lastBuild) ? 'full' : 'incremental';

    const startedAt = new Date().toISOString();

    // Generate skills
    const buildResult = await skillGenerator.generateAll(snapshot, ontology_id, buildMode);

    const finishedAt = new Date().toISOString();

    // Write skill_builds record
    db.prepare(`
      INSERT INTO skill_builds
        (id, ontology_id, build_version, snapshot_hash, build_mode, status,
         generated_count, updated_count, skipped_count, error_message,
         started_at, finished_at, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      buildResult.build_id,
      ontology_id,
      buildResult.build_version,
      snapshot.snapshot_hash,
      buildResult.build_mode,
      buildResult.status,
      buildResult.generated_count,
      buildResult.updated_count,
      buildResult.skipped_count,
      buildResult.error_message || null,
      startedAt,
      finishedAt,
      startedAt
    );

    // Build and write report
    const report = buildBuildReport(buildResult, snapshot);
    db.prepare(`
      INSERT INTO skill_build_reports (id, build_id, build_version, ontology_id, content, created_at)
      VALUES (?,?,?,?,?,?)
    `).run(
      nanoid(),
      buildResult.build_id,
      buildResult.build_version,
      ontology_id,
      JSON.stringify(report),
      finishedAt
    );

    // Build and write test plan (async: LLM-driven test data generation)
    const skillsDir = getSkillsDir(ontology_id);
    const { plan, cases } = await buildTestPlan(skillsDir, buildResult.build_version, ontology_id, snapshot.snapshot_hash);

    db.prepare(`
      INSERT INTO skill_test_plans (id, build_version, ontology_id, snapshot_hash, total_cases, created_at)
      VALUES (?,?,?,?,?,?)
    `).run(
      plan.id,
      plan.build_version,
      plan.ontology_id,
      plan.snapshot_hash,
      plan.total_cases,
      plan.created_at
    );

    for (const tc of cases) {
      db.prepare(`
        INSERT INTO skill_test_cases
          (id, plan_id, skill_id, skill_slug, case_code, case_name_zh, case_type,
           description_zh, params, expected_result, db_assertions, sequence, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        tc.id,
        tc.plan_id,
        tc.skill_id,
        tc.skill_slug,
        tc.case_code,
        tc.case_name_zh,
        tc.case_type,
        tc.description_zh || null,
        JSON.stringify(tc.params),
        tc.expected_result ? JSON.stringify(tc.expected_result) : null,
        tc.db_assertions ? JSON.stringify(tc.db_assertions) : null,
        tc.sequence,
        tc.created_at
      );
    }

    res.json({
      success: true,
      build_version: buildResult.build_version,
      build_id: buildResult.build_id,
      build_mode: buildResult.build_mode,
      generated_count: buildResult.generated_count,
      updated_count: buildResult.updated_count,
      skipped_count: buildResult.skipped_count,
      test_cases_count: cases.length,
    });
  } catch (error) {
    console.error('Error triggering build:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/ontology-skills/all?ontology_id=...
router.delete('/all', (req, res) => {
  try {
    const { ontology_id } = req.query;

    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    // Delete filesystem skill directory
    const skillsDir = getSkillsDir(ontology_id as string);
    if (existsSync(skillsDir)) {
      rmSync(skillsDir, { recursive: true, force: true });
    }

    // Delete skills from DB
    const result = db.prepare(
      `DELETE FROM skills WHERE category='ontology' AND ontology_id=?`
    ).run(ontology_id as string);

    // Delete build records
    db.prepare(
      `DELETE FROM skill_builds WHERE ontology_id=?`
    ).run(ontology_id as string);

    res.json({ success: true, deleted_count: result.changes });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ontology-skills/builds/:ontologyId
router.get('/builds/:ontologyId', (req, res) => {
  try {
    const { ontologyId } = req.params;

    const builds = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM skills WHERE ontology_id=b.ontology_id AND build_version=b.build_version) AS skill_count
      FROM skill_builds b
      WHERE b.ontology_id=?
      ORDER BY b.created_at DESC
      LIMIT 20
    `).all(ontologyId);

    res.json(builds);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ontology-skills/builds/:buildVersion/report
router.get('/builds/:buildVersion/report', (req, res) => {
  try {
    const { buildVersion } = req.params;

    const row = db.prepare(
      `SELECT content FROM skill_build_reports WHERE build_version=? ORDER BY created_at DESC LIMIT 1`
    ).get(buildVersion) as any;

    if (!row) {
      return res.status(404).json({ error: `No report found for build version '${buildVersion}'` });
    }

    res.json(JSON.parse(row.content));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/ontology-skills/builds/:buildVersion/test-plan
router.get('/builds/:buildVersion/test-plan', (req, res) => {
  try {
    const { buildVersion } = req.params;

    const plan = db.prepare(
      `SELECT * FROM skill_test_plans WHERE build_version=? ORDER BY created_at DESC LIMIT 1`
    ).get(buildVersion) as any;

    if (!plan) {
      return res.status(404).json({ error: `No test plan found for build version '${buildVersion}'` });
    }

    const cases = db.prepare(
      `SELECT * FROM skill_test_cases WHERE plan_id=? ORDER BY sequence ASC`
    ).all(plan.id) as any[];

    const parsedCases = cases.map(tc => ({
      ...tc,
      params: JSON.parse(tc.params),
      expected_result: tc.expected_result ? JSON.parse(tc.expected_result) : null,
      db_assertions: tc.db_assertions ? JSON.parse(tc.db_assertions) : null,
    }));

    res.json({ ...plan, cases: parsedCases });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ontology-skills/:skillId/execute
router.post('/:skillId/execute', async (req, res) => {
  try {
    const { skillId } = req.params;
    const params = req.body;

    const { skillExecutor } = await import('../engine/skill-executor.js');
    const result = await skillExecutor.execute(skillId, params);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Legacy: POST /api/ontology-skills/generate (keep for backward compat)
router.post('/generate', async (req, res) => {
  try {
    const { ontology_id } = req.body;
    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    let snapshot;
    try {
      snapshot = await loadSnapshot(ontology_id);
    } catch (err) {
      if (err instanceof BuildBlockedError) {
        return res.status(422).json({
          error: 'Build blocked due to ontology validation errors',
          validation_errors: (err as BuildBlockedError).errors,
        });
      }
      throw err;
    }

    const buildResult = await skillGenerator.generateAll(snapshot, ontology_id, 'full');

    res.json({
      success: true,
      message: `Successfully generated ${buildResult.generated_count} ontology skills`,
      generated_count: buildResult.generated_count,
    });
  } catch (error) {
    console.error('Error generating ontology skills:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/ontology-skills/clear-data
router.post('/clear-data', async (req, res) => {
  try {
    const { ontology_id } = req.body;
    if (!ontology_id) {
      return res.status(400).json({ error: 'ontology_id is required' });
    }

    const { mongoClient, neo4jClient, chromaClient } = await import('../database/index.js');

    // Clear MongoDB collections
    const mongoResult = await mongoClient.clearOntologyCollections(ontology_id);

    // Clear Neo4j nodes
    const neo4jResult = await neo4jClient.clearOntologyNodes(ontology_id);

    // Clear ChromaDB collections
    const chromaResult = await chromaClient.clearOntologyCollections(ontology_id);

    res.json({
      success: true,
      ontology_id,
      cleared: {
        mongodb: {
          collections: mongoResult.collections,
          documents_deleted: mongoResult.deletedCount,
        },
        neo4j: {
          nodes_deleted: neo4jResult.nodesDeleted,
          relationships_deleted: neo4jResult.relationshipsDeleted,
        },
        chroma: {
          collections: chromaResult.collections,
          documents_deleted: chromaResult.deletedCount,
        },
      },
    });
  } catch (error) {
    console.error('Error clearing ontology data:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
