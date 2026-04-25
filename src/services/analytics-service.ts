import type { EventPort } from '../ports/events.js';
import type { TimeSeriesPoint, AnalyticsQuery, TelemetryEvent } from '../core/types.js';

export interface TimeseriesRequest {
  entityId?: string;
  workspaceId?: string;
  eventName: string;
  from: string;
  to: string;
  intervalSeconds?: number;
  aggregation?: 'count' | 'sum' | 'avg';
  groupBy?: string;
}

export interface DiscoverRequest {
  entityId?: string;
  workspaceId?: string;
}

export interface DiscoverResult {
  entities: { id: string; eventCount: number }[];
  eventNames: { name: string; count: number }[];
  dimensions: Record<string, string[]>;
  timeRange: { earliest: string; latest: string };
  totalEvents: number;
}

export class AnalyticsService {
  constructor(private eventRepo: EventPort) {}

  async timeseries(req: TimeseriesRequest): Promise<{ points: TimeSeriesPoint[]; granularitySeconds: number }> {
    const interval = req.intervalSeconds || 3600;
    const query: AnalyticsQuery = {
      entityId: req.entityId,
      workspaceId: req.workspaceId,
      eventName: req.eventName,
      from: new Date(req.from),
      to: new Date(req.to),
      intervalSeconds: interval,
      aggregation: req.aggregation || 'count',
      groupBy: req.groupBy,
    };

    const points = await this.eventRepo.queryTimeSeries(query);
    return { points, granularitySeconds: interval };
  }

  async discover(req: DiscoverRequest): Promise<DiscoverResult> {
    return this.eventRepo.discover(req);
  }
}
