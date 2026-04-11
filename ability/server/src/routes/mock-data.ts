import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { analyzeProfile } from '../engine/profile-analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data/mock-crm-customers');

const router = Router();

// POST /api/mock-data/init
router.post('/init', async (req, res) => {
  try {
    const { mongoClient, neo4jClient, chromaClient } = await import('../database/index.js');
    const ontologyId = 'crm';

    // Clear existing data
    await mongoClient.clearOntologyCollections(ontologyId);
    await neo4jClient.clearOntologyNodes(ontologyId);

    // Import MongoDB seed
    const seedPath = join(DATA_DIR, 'mongodb_seed.json');
    const seedData = JSON.parse(readFileSync(seedPath, 'utf-8'));

    let mongoCount = 0;

    // Insert customers
    for (const customer of seedData.customers) {
      const doc = { ...customer, ontology_id: ontologyId, vector_status: 'pending' as const };
      await mongoClient.insertDocument(`${ontologyId}_customers`, doc);
      mongoCount++;
    }

    // Insert contacts
    for (const contact of seedData.contacts) {
      await mongoClient.insertDocument(`${ontologyId}_contacts`, contact);
      mongoCount++;
    }

    // Insert opportunities
    for (const opp of seedData.opportunities) {
      await mongoClient.insertDocument(`${ontologyId}_opportunities`, opp);
      mongoCount++;
    }

    // Insert needs
    for (const need of seedData.needs) {
      await mongoClient.insertDocument(`${ontologyId}_needs`, need);
      mongoCount++;
    }

    // Insert risks
    for (const risk of seedData.risks) {
      await mongoClient.insertDocument(`${ontologyId}_risks`, risk);
      mongoCount++;
    }

    // Insert commitments
    for (const commitment of seedData.commitments) {
      await mongoClient.insertDocument(`${ontologyId}_commitments`, commitment);
      mongoCount++;
    }

    // Insert sales reps
    for (const rep of seedData.sales_reps) {
      await mongoClient.insertDocument(`${ontologyId}_sales_reps`, { ...rep, ontology_id: ontologyId });
      mongoCount++;
    }

    // Insert leads
    if (seedData.leads) {
      for (const lead of seedData.leads) {
        await mongoClient.insertDocument(`${ontologyId}_leads`, { ...lead, ontology_id: ontologyId });
        mongoCount++;
      }
    }

    // Insert quotes
    if (seedData.quotes) {
      for (const quote of seedData.quotes) {
        await mongoClient.insertDocument(`${ontologyId}_quotes`, { ...quote, ontology_id: ontologyId });
        mongoCount++;
      }
    }

    // Import Neo4j seed
    const cypherPath = join(DATA_DIR, 'neo4j_seed.cypher');
    const cypherContent = readFileSync(cypherPath, 'utf-8');
    const statements = cypherContent.split(';').map(s => s.trim()).filter(Boolean);

    let neo4jCount = 0;
    if (neo4jClient.isOnline()) {
      for (const statement of statements) {
        try {
          await neo4jClient.runQuery(statement);
          neo4jCount++;
        } catch (e) {
          console.warn('[mock-data] Neo4j statement failed:', (e as Error).message);
        }
      }
    }

    // Import ChromaDB documents
    let chromaCount = 0;
    try {
      const chromaPath = join(DATA_DIR, 'chroma_documents.json');
      const chromaData = JSON.parse(readFileSync(chromaPath, 'utf-8'));

      for (const doc of chromaData) {
        try {
          const docId = doc.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const docText = doc.description || doc.name || doc.title || JSON.stringify(doc);
          await chromaClient.upsertDocument(`${ontologyId}_opportunities`, docId, docText, doc);
          chromaCount++;
        } catch (e) {
          console.warn('[mock-data] ChromaDB upsert failed:', (e as Error).message);
        }
      }
    } catch (e) {
      console.warn('[mock-data] ChromaDB import failed:', (e as Error).message);
    }

    // Insert visit records into MongoDB
    let visitCount = 0;
    for (const vr of seedData.visit_records) {
      try {
        const fileRelPath = vr.file as string;
        const filePath = join(DATA_DIR, fileRelPath);
        const contentMarkdown = readFileSync(filePath, 'utf-8');

        await mongoClient.insertDocument(`${ontologyId}_visit_records`, {
          id: vr.id,
          customer_id: vr.customer_id,
          opportunity_id: vr.opportunity_id,
          sequence_no: vr.sequence_no,
          title: vr.title,
          content_markdown: contentMarkdown,
          visit_type: 'uploaded_markdown',
          source_channel: 'seed_data',
          status: '已分析',
          summary: '',
          key_signals: [],
          sentiment: '中性',
          ontology_id: ontologyId,
          visit_at: `2026-04-0${vr.sequence_no + 8}`,
          created_at: new Date().toISOString(),
        });
        visitCount++;
      } catch (e) {
        console.warn('[mock-data] Visit record import failed:', (e as Error).message);
      }
    }

    // Update customer visit_record_ids
    for (const customer of seedData.customers) {
      const customerVisits = seedData.visit_records
        .filter((vr: any) => vr.customer_id === customer.id)
        .map((vr: any) => vr.id);

      await mongoClient.updateByFilter(`${ontologyId}_customers`, { id: customer.id }, {
        visit_record_ids: customerVisits,
      });
    }

    res.json({
      success: true,
      counts: {
        mongo_documents: mongoCount,
        neo4j_statements: neo4jCount,
        chroma_documents: chromaCount,
        visit_records: visitCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/mock-data/customers
router.get('/customers', async (req, res) => {
  try {
    const { mongoClient, neo4jClient } = await import('../database/index.js');
    const ontologyId = 'crm';

    const customers = await mongoClient.findMany(`${ontologyId}_customers`, {});

    const result = await Promise.all(customers.map(async (customer: any) => {
      const contacts = await mongoClient.findMany(`${ontologyId}_contacts`, { customer_id: customer.id });
      const opportunities = await mongoClient.findMany(`${ontologyId}_opportunities`, { customer_id: customer.id });

      let graphSummary = '';
      if (neo4jClient.isOnline()) {
        try {
          const graphData = await neo4jClient.runQuery(
            `MATCH (c:Customer {id: $id})
             OPTIONAL MATCH (c)-[:HAS_CONTACT]->(contact:Contact)
             OPTIONAL MATCH (c)-[:HAS_OPPORTUNITY]->(opp:Opportunity)
             RETURN c.name AS name, count(DISTINCT contact) AS contactCount, count(DISTINCT opp) AS oppCount`,
            { id: customer.id }
          );
          if (graphData.length > 0) {
            graphSummary = `${graphData[0].contactCount} contacts, ${graphData[0].oppCount} opportunities in graph`;
          }
        } catch {}
      }

      return {
        id: customer.id,
        name: customer.customer_name || customer.name,
        industry: customer.industry,
        region: customer.region,
        owner_sales: customer.owner_sales,
        contact_count: contacts.length,
        opportunity_count: opportunities.length,
        opportunities: opportunities.map((o: any) => ({
          id: o.id,
          name: o.name,
          stage: o.stage,
          amount: o.amount,
        })),
        contacts: contacts.map((c: any) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          attitude: c.attitude,
        })),
        graph_summary: graphSummary,
      };
    }));

    res.json({ customers: result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/mock-data/customers/:id/context
router.get('/customers/:id/context', async (req, res) => {
  try {
    const { mongoClient, neo4jClient, chromaClient } = await import('../database/index.js');
    const ontologyId = 'crm';
    const customerId = req.params.id;

    const customer = await mongoClient.findOne(`${ontologyId}_customers`, { id: customerId });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const contacts = await mongoClient.findMany(`${ontologyId}_contacts`, { customer_id: customerId });
    const opportunities = await mongoClient.findMany(`${ontologyId}_opportunities`, { customer_id: customerId });
    const visitRecords = await mongoClient.findMany(`${ontologyId}_visit_records`, { customer_id: customerId }, { sort: { sequence_no: 1 } });
    const needs = await mongoClient.findMany(`${ontologyId}_needs`, { customer_id: customerId });
    const risks = await mongoClient.findMany(`${ontologyId}_risks`, { customer_id: customerId });
    const commitments = await mongoClient.findMany(`${ontologyId}_commitments`, { customer_id: customerId });

    let graphData: any[] = [];
    if (neo4jClient.isOnline()) {
      graphData = await neo4jClient.runQuery(
        `MATCH (c:Customer {id: $id})
         OPTIONAL MATCH (c)-[:HAS_CONTACT]->(contact:Contact)
         OPTIONAL MATCH (c)-[:HAS_OPPORTUNITY]->(opp:Opportunity)
         OPTIONAL MATCH (c)-[:HAS_VISIT_RECORD]->(v:VisitRecord)
         OPTIONAL MATCH (c)-[:SERVES]-(rep:SalesRep)
         RETURN c, collect(DISTINCT contact) AS contacts, collect(DISTINCT opp) AS opportunities,
                collect(DISTINCT v) AS visits, collect(DISTINCT rep) AS reps`,
        { id: customerId }
      );
    }

    res.json({
      customer,
      contacts,
      opportunities,
      visit_records: visitRecords.map((r: any) => ({
        id: r.id,
        title: r.title,
        sequence_no: r.sequence_no,
        status: r.status,
        sentiment: r.sentiment,
        summary: r.summary,
      })),
      needs,
      risks,
      commitments,
      graph_data: graphData,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/mock-data/customers/:id/advice
router.get('/customers/:id/advice', (req, res) => {
  try {
    const customerId = req.params.id;
    const artifacts = db.prepare(`
      SELECT * FROM operating_advice_artifacts
      WHERE customer_id=?
      ORDER BY round_no DESC
    `).all(customerId) as any[];

    res.json({ artifacts: artifacts.map(a => ({
      ...a,
      based_on_visit_record_ids: JSON.parse(a.based_on_visit_record_ids || '[]'),
      recommended_actions: JSON.parse(a.recommended_actions || '[]'),
      llm_advice: a.llm_advice ? JSON.parse(a.llm_advice) : null,
    })) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/mock-data/visit-records/:id
router.get('/visit-records/:id', async (req, res) => {
  try {
    const { mongoClient } = await import('../database/index.js');
    const record = await mongoClient.findOne('crm_visit_records', { id: req.params.id });
    if (!record) {
      return res.status(404).json({ error: 'Visit record not found' });
    }
    res.json({
      id: record.id,
      customer_id: record.customer_id,
      title: record.title,
      sequence_no: record.sequence_no,
      content_markdown: record.content_markdown || '',
      summary: record.summary || '',
      sentiment: record.sentiment || '中性',
      status: record.status || '未知',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/mock-data/profile-analysis
router.post('/profile-analysis', async (req, res) => {
  try {
    const {
      scenario,
      transcript,
      speaker_aliases,
      customer_id,
      customer_name,
      visit_record_id,
      visit_title,
    } = req.body || {};

    if (!scenario || !['interview', 'crm_visit'].includes(scenario)) {
      return res.status(400).json({ error: 'Invalid scenario' });
    }

    if (!transcript || !String(transcript).trim()) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const result = await analyzeProfile({
      scenario,
      transcript: String(transcript),
      speakerAliases: speaker_aliases || {},
      customerId: customer_id,
      customerName: customer_name,
      visitRecordId: visit_record_id,
      visitTitle: visit_title,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
