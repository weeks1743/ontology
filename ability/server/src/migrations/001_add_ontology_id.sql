-- Migration: Add ontology_id to existing CRM skills
-- Date: 2026-04-04
-- Description: Update all existing ontology skills to belong to 'crm-v1' ontology

-- Update all existing ontology category skills to have ontology_id = 'crm-v1'
UPDATE skills
SET ontology_id = 'crm-v1'
WHERE category = 'ontology' AND ontology_id IS NULL;