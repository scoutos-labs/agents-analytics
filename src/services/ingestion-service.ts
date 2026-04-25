import type { EventPort } from '../ports/events.js';
import type { TelemetryEvent } from '../core/types.js';

export interface SubmitEventInput {
  entityId: string;
  events: {
    timestamp: string;
    name: string;
    value?: number;
    dimensions?: Record<string, string>;
  }[];
}

export interface BatchAttestationInput {
  entityId: string;
  batchId: string;
  merkleRoot: string;
  eventCount: number;
  timeRange: { from: string; to: string };
}

export class IngestionService {
  constructor(private eventRepo: EventPort) {}

  async submit(input: SubmitEventInput): Promise<{ accepted: number }> {
    const now = new Date();
    const accepted: TelemetryEvent[] = [];

    for (const e of input.events) {
      const eventTime = new Date(e.timestamp);
      // Allow ±5 minute server drift for future timestamps; reject extreme future
      if (eventTime.getTime() > now.getTime() + 5 * 60 * 1000) continue;
      // Reject too old (outside 30 days — adjust as needed)
      if (eventTime.getTime() < now.getTime() - 30 * 24 * 60 * 60 * 1000) continue;

      accepted.push({
        entityId: input.entityId,
        eventTime,
        eventName: e.name,
        metricValue: e.value ?? 1,
        dimensions: e.dimensions || {},
        ingestionTime: now,
      });
    }

    if (accepted.length > 0) {
      this.eventRepo.insertMany(accepted);
    }

    return { accepted: accepted.length };
  }
}
