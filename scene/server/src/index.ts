import cors from "cors";
import express from "express";
import { createSceneDb } from "./db.js";
import { seedMockData } from "./seed.js";
import * as repo from "./repository.js";
import { executeScenarioRuntime } from "./runtime.js";

const PORT = Number(process.env.PORT ?? "3003");
const app = express();
const db = createSceneDb();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "scene-server", port: PORT });
});

// Ontology Management
app.get("/api/ontologies", async (_req, res) => {
  try {
    const ontologies = repo.getOntologies(db);
    res.json(ontologies);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/ontologies", async (req, res) => {
  try {
    const { ontology_id, ontology_name } = req.body;
    const ontology = repo.ensureOntology(db, ontology_id, ontology_name);

    // Seed mock data for new ontology
    seedMockData(db, ontology_id, ontology_name);

    res.json(ontology);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/ontologies/:id", async (req, res) => {
  try {
    const ontology = repo.getOntologyById(db, req.params.id);
    if (!ontology) {
      return res.status(404).json({ error: "Ontology not found" });
    }
    res.json(ontology);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/ontologies/:id/selected-industry", async (req, res) => {
  try {
    const code = repo.getSelectedIndustryCode(db, req.params.id);
    res.json({ selected_industry_code: code });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/ontologies/:id/selected-industry", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "code is required" });
    repo.setSelectedIndustryCode(db, req.params.id, code);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Industry Templates
app.get("/api/ontologies/:id/industries", async (req, res) => {
  try {
    const ontology = repo.getOntologyById(db, req.params.id);
    if (!ontology) {
      return res.status(404).json({ error: "Ontology not found" });
    }

    const industries = repo.getIndustries(db, ontology.id);
    res.json(industries);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/ontologies/:id/industries", async (req, res) => {
  try {
    const ontology = repo.getOntologyById(db, req.params.id);
    if (!ontology) {
      return res.status(404).json({ error: "Ontology not found" });
    }

    const industry = repo.createIndustry(db, {
      scene_ontology_id: ontology.id,
      ...req.body,
    });
    res.json(industry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/industries/:id", async (req, res) => {
  try {
    const industry = repo.getIndustryById(db, Number(req.params.id));
    if (!industry) {
      return res.status(404).json({ error: "Industry not found" });
    }
    res.json(industry);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/industries/:id", async (req, res) => {
  try {
    const industry = repo.updateIndustry(db, Number(req.params.id), req.body);
    res.json(industry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/industries/:id", async (req, res) => {
  try {
    repo.deleteIndustry(db, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Scenario Templates
app.get("/api/industries/:id/scenarios", async (req, res) => {
  try {
    const scenarios = repo.getScenarios(db, Number(req.params.id));
    res.json(scenarios);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/industries/:id/scenarios", async (req, res) => {
  try {
    const scenario = repo.createScenario(db, {
      industry_id: Number(req.params.id),
      ...req.body,
    });
    res.json(scenario);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/scenarios/:id", async (req, res) => {
  try {
    const scenario = repo.getScenarioById(db, Number(req.params.id));
    if (!scenario) {
      return res.status(404).json({ error: "Scenario not found" });
    }
    res.json(scenario);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/scenarios/:id", async (req, res) => {
  try {
    const scenario = repo.updateScenario(db, Number(req.params.id), req.body);
    res.json(scenario);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/scenarios/:id", async (req, res) => {
  try {
    repo.deleteScenario(db, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Content Sections
app.get("/api/scenarios/:id/sections", async (req, res) => {
  try {
    const sections = repo.getSections(db, Number(req.params.id));
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/scenarios/:id/sections", async (req, res) => {
  try {
    const section = repo.createSection(db, {
      scenario_id: Number(req.params.id),
      ...req.body,
    });
    res.json(section);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/sections/:id", async (req, res) => {
  try {
    const section = repo.getSectionById(db, Number(req.params.id));
    if (!section) {
      return res.status(404).json({ error: "Section not found" });
    }
    res.json(section);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/sections/:id", async (req, res) => {
  try {
    const section = repo.updateSection(db, Number(req.params.id), req.body);
    res.json(section);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/sections/:id", async (req, res) => {
  try {
    repo.deleteSection(db, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Skill Bindings
app.get("/api/sections/:id/bindings", async (req, res) => {
  try {
    const bindings = repo.getBindings(db, Number(req.params.id));
    res.json(bindings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/sections/:id/bindings", async (req, res) => {
  try {
    const binding = repo.createBinding(db, {
      section_id: Number(req.params.id),
      ...req.body,
    });
    res.json(binding);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/bindings/:id", async (req, res) => {
  try {
    const binding = repo.getBindingById(db, Number(req.params.id));
    if (!binding) {
      return res.status(404).json({ error: "Binding not found" });
    }
    res.json(binding);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put("/api/bindings/:id", async (req, res) => {
  try {
    const binding = repo.updateBinding(db, Number(req.params.id), req.body);
    res.json(binding);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/bindings/:id", async (req, res) => {
  try {
    repo.deleteBinding(db, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// Test Cases
app.get("/api/scenarios/:id/test-cases", async (req, res) => {
  try {
    const testCases = repo.getTestCases(db, Number(req.params.id));
    res.json(testCases);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/scenarios/:id/test-cases", async (req, res) => {
  try {
    const testCase = repo.createTestCase(db, {
      scenario_id: Number(req.params.id),
      ...req.body,
    });
    res.json(testCase);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/test-cases/:id/run", async (req, res) => {
  try {
    const testCase = repo.getTestCaseById(db, Number(req.params.id));
    if (!testCase) {
      return res.status(404).json({ error: "Test case not found" });
    }

    // Mock execution result
    const result = {
      test_case_id: testCase.id,
      test_case_name: testCase.name,
      status: "success",
      executed_at: new Date().toISOString(),
      mock_output: {
        sections_generated: testCase.expected_sections || [],
        execution_time_ms: Math.floor(Math.random() * 2000) + 500,
        skills_called: ["company-research", "ont.crm.analyze_visit"],
      },
      message: "Mock execution completed successfully"
    };

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/runtime/scenarios/:code/execute", async (req, res) => {
  try {
    const scenarioCode = req.params.code;
    const {
      ontology_id,
      customer_name,
      visit_record_id,
      tingwu_task_id,
      artifact_root,
      task_id,
    } = req.body || {};

    if (!ontology_id || !customer_name || !visit_record_id || !tingwu_task_id || !artifact_root || !task_id) {
      return res.status(400).json({ error: "Missing required runtime params" });
    }

    const result = await executeScenarioRuntime(db, {
      ontologyId: String(ontology_id),
      scenarioCode,
      customerName: String(customer_name),
      visitRecordId: String(visit_record_id),
      tingwuTaskId: String(tingwu_task_id),
      artifactRoot: String(artifact_root),
      taskId: String(task_id),
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Scene server listening on http://localhost:${PORT}`);
});
