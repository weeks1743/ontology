-- Migration: Add enhanced semantic fields for AI reasoning
-- Based on YAML_SEMANTIC_ASSESSMENT.md recommendations

-- ============================================================================
-- Objects Table: Add natural language mapping and enhanced lifecycle
-- ============================================================================
ALTER TABLE ontology_objects ADD COLUMN aliases TEXT DEFAULT '[]';
ALTER TABLE ontology_objects ADD COLUMN nl_examples TEXT DEFAULT '[]';
ALTER TABLE ontology_objects ADD COLUMN negative_examples TEXT DEFAULT '[]';
ALTER TABLE ontology_objects ADD COLUMN disambiguation_notes TEXT DEFAULT '';
ALTER TABLE ontology_objects ADD COLUMN lifecycle_enhanced TEXT DEFAULT NULL;

-- ============================================================================
-- Behaviors Table: Add I/O contracts, preconditions, and NL mapping
-- ============================================================================
ALTER TABLE ontology_behaviors ADD COLUMN aliases TEXT DEFAULT '[]';
ALTER TABLE ontology_behaviors ADD COLUMN nl_examples TEXT DEFAULT '[]';
ALTER TABLE ontology_behaviors ADD COLUMN inputs_schema TEXT DEFAULT NULL;
ALTER TABLE ontology_behaviors ADD COLUMN preconditions TEXT DEFAULT '[]';
ALTER TABLE ontology_behaviors ADD COLUMN result_schema TEXT DEFAULT NULL;
ALTER TABLE ontology_behaviors ADD COLUMN postconditions TEXT DEFAULT '[]';
ALTER TABLE ontology_behaviors ADD COLUMN side_effects TEXT DEFAULT '[]';

-- ============================================================================
-- Rules Table: Add structured expression and explanation metadata
-- ============================================================================
ALTER TABLE ontology_rules ADD COLUMN input_context TEXT DEFAULT '[]';
ALTER TABLE ontology_rules ADD COLUMN expression_structured TEXT DEFAULT NULL;
ALTER TABLE ontology_rules ADD COLUMN next_actions TEXT DEFAULT '[]';
ALTER TABLE ontology_rules ADD COLUMN failure_message_template TEXT DEFAULT NULL;
ALTER TABLE ontology_rules ADD COLUMN constraint_type TEXT DEFAULT 'hard';

-- ============================================================================
-- Events Table: Add payload schema and propagation semantics
-- ============================================================================
ALTER TABLE ontology_events ADD COLUMN payload_schema TEXT DEFAULT '[]';
ALTER TABLE ontology_events ADD COLUMN propagation_conditions TEXT DEFAULT '[]';
ALTER TABLE ontology_events ADD COLUMN triggered_behaviors TEXT DEFAULT '[]';
ALTER TABLE ontology_events ADD COLUMN trace_policy TEXT DEFAULT NULL;
ALTER TABLE ontology_events ADD COLUMN causality TEXT DEFAULT NULL;

-- ============================================================================
-- Scenarios Table: Add decision points and rollback logic
-- ============================================================================
ALTER TABLE ontology_scenarios ADD COLUMN start_conditions TEXT DEFAULT '[]';
ALTER TABLE ontology_scenarios ADD COLUMN decision_points_enhanced TEXT DEFAULT NULL;
ALTER TABLE ontology_scenarios ADD COLUMN rollback_compensation TEXT DEFAULT NULL;
ALTER TABLE ontology_scenarios ADD COLUMN observability_metrics TEXT DEFAULT '[]';
