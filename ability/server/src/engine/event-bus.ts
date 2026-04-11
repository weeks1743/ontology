/**
 * Event Bus for CRM ontology skill chain.
 * Singleton that loads subscriptions from ontology events and emits events
 * to trigger subscriber behaviors via skillExecutor.
 */

import { nanoid } from 'nanoid';
import { db } from '../db.js';

const MAX_CHAIN_DEPTH = 5;

interface Subscriber {
  skillId: string;
  behaviorCode: string;
}

/**
 * Known hardcoded behavior codes that don't exist in the skills table.
 * These are handled directly by executeBehaviorSkill() in skill-executor.ts.
 */
const HARDCODED_BEHAVIORS: Record<string, string> = {
  'VisitRecord.CreateFromMarkdown': 'hardcoded.visit_record.create_from_markdown',
  'VisitRecord.Analyze': 'hardcoded.visit_record.analyze',
  'Customer.GenerateOperatingAdvice': 'hardcoded.customer.generate_operating_advice',
};

async function resolveSubscriberSkillId(subscriber: Subscriber, ontologyId: string): Promise<string | null> {
  if (subscriber.skillId) return subscriber.skillId;

  // Check hardcoded behaviors first
  if (HARDCODED_BEHAVIORS[subscriber.behaviorCode]) {
    return HARDCODED_BEHAVIORS[subscriber.behaviorCode];
  }

  // Look up all ontology skills and check manifests
  const skills = db.prepare(
    `SELECT id, path FROM skills WHERE ontology_id=? AND skill_type='behavior'`
  ).all(ontologyId) as any[];

  for (const skill of skills) {
    try {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const manifestPath = join(skill.path, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (manifest.behavior_code === subscriber.behaviorCode) {
        return skill.id;
      }
    } catch {
      continue;
    }
  }

  return null;
}

interface EmitContext {
  chainId: string;
  depth: number;
  ontologyId: string;
}

class EventBus {
  private subscriptions: Map<string, Subscriber[]> = new Map();

  /**
   * Load event subscriptions from an ontology's event definitions.
   * Events have a `subscribers` field listing behavior skill slugs.
   */
  async loadSubscriptions(ontologyId: string) {
    this.subscriptions.clear();

    try {
      // Query skills table for ontology event definitions
      // Events are stored as skills with skill_type='event'
      const events = db.prepare(
        `SELECT id, name, skill_slug FROM skills WHERE ontology_id=? AND skill_type='event'`
      ).all(ontologyId) as any[];

      // For each event, look up its subscribers from the snapshot metadata
      // Subscribers are behavior skill slugs listed in the event's metadata
      for (const event of events) {
        const subscribers: Subscriber[] = [];
        let meta: any = {};
        try {
          meta = JSON.parse(event.metadata || '{}');
        } catch {}

        const subscriberSlugs: string[] = meta.subscribers || [];
        for (const slug of subscriberSlugs) {
          // Look up the subscriber skill by slug
          const subscriberSkill = db.prepare(
            `SELECT id, name, skill_slug, path FROM skills WHERE ontology_id=? AND skill_slug=?`
          ).get(ontologyId, slug) as any;

          if (subscriberSkill) {
            // Read manifest to get behavior_code
            let behaviorCode = slug;
            try {
              const { readFileSync } = await import('fs');
              const { join } = await import('path');
              const manifestPath = join(subscriberSkill.path, 'manifest.json');
              const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
              behaviorCode = manifest.behavior_code || slug;
            } catch {
              // Fallback: use slug as behavior code
            }

            subscribers.push({
              skillId: subscriberSkill.id,
              behaviorCode,
            });
          }
        }

        if (subscribers.length > 0) {
          this.subscriptions.set(event.name, subscribers);
        }
      }

      console.log(`[event-bus] Loaded subscriptions for ${this.subscriptions.size} events in ontology ${ontologyId}`);
    } catch (error) {
      console.error('[event-bus] Failed to load subscriptions:', error);
    }
  }

  /**
   * Directly register subscribers for an event code (used for hardcoded CRM events).
   */
  registerSubscription(eventCode: string, subscriber: Subscriber) {
    const list = this.subscriptions.get(eventCode) || [];
    list.push(subscriber);
    this.subscriptions.set(eventCode, list);
  }

  /**
   * Emit an event, triggering all registered subscribers.
   * Each subscriber is executed via skillExecutor with the given payload.
   */
  async emitEvent(
    eventCode: string,
    payload: Record<string, any>,
    sourceSkillId: string,
    context: EmitContext
  ) {
    const subscribers = this.subscriptions.get(eventCode) || [];
    if (subscribers.length === 0) {
      console.log(`[event-bus] No subscribers for event: ${eventCode}`);
      return;
    }

    if (context.depth >= MAX_CHAIN_DEPTH) {
      console.warn(`[event-bus] Max chain depth (${MAX_CHAIN_DEPTH}) reached, stopping`);
      return;
    }

    console.log(`[event-bus] Emitting "${eventCode}" to ${subscribers.length} subscriber(s), chain=${context.chainId}, depth=${context.depth}`);

    // Dynamic import to avoid circular dependency
    const { skillExecutor } = await import('../engine/skill-executor.js');

    for (const subscriber of subscribers) {
      const logId = nanoid();
      const now = new Date().toISOString();

      // Resolve skill ID at runtime if not already set
      const resolvedSkillId = await resolveSubscriberSkillId(subscriber, context.ontologyId);
      if (!resolvedSkillId) {
        console.warn(`[event-bus] Could not resolve skill ID for ${subscriber.behaviorCode}`);
        continue;
      }

      try {
        console.log(`[event-bus] Executing subscriber: ${subscriber.behaviorCode} (skill=${resolvedSkillId})`);

        // Propagate chain_id so subscriber reuses the same chain
        const enrichedPayload = { ...payload, chain_id: context.chainId };
        const result = await skillExecutor.execute(resolvedSkillId, enrichedPayload);

        // Write success log
        db.prepare(`
          INSERT INTO event_bus_logs
            (id, event_code, source_skill_id, subscriber_skill_id, subscriber_behavior_code,
             status, input_params, output_result, error_message, chain_id, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          logId,
          eventCode,
          sourceSkillId,
          resolvedSkillId,
          subscriber.behaviorCode,
          result.success ? 'success' : 'error',
          JSON.stringify(payload),
          JSON.stringify(result.data || {}),
          result.error || null,
          context.chainId,
          now
        );

        // If this subscriber also emits events, the chain continues
        // The depth is tracked via the context
      } catch (error) {
        console.error(`[event-bus] Subscriber ${subscriber.behaviorCode} failed:`, error);

        db.prepare(`
          INSERT INTO event_bus_logs
            (id, event_code, source_skill_id, subscriber_skill_id, subscriber_behavior_code,
             status, input_params, output_result, error_message, chain_id, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          logId,
          eventCode,
          sourceSkillId,
          resolvedSkillId,
          subscriber.behaviorCode,
          'error',
          JSON.stringify(payload),
          null,
          (error as Error).message,
          context.chainId,
          now
        );
      }
    }
  }

  /**
   * Get all logs for a given chain ID.
   */
  getChainLogs(chainId: string): any[] {
    return db.prepare(
      `SELECT * FROM event_bus_logs WHERE chain_id=? ORDER BY created_at ASC`
    ).all(chainId) as any[];
  }

  /**
   * Get all events (for debugging).
   */
  getAllEvents(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

export const eventBus = new EventBus();
