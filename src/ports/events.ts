import type { TelemetryEvent, TimeSeriesPoint, AnalyticsQuery } from '../core/types.js';
import type { DiscoverRequest, DiscoverResult } from '../services/analytics-service.js';

export interface EventPort {
  insertMany(events: TelemetryEvent[]): Promise<void>;
  queryTimeSeries(q: AnalyticsQuery): Promise<TimeSeriesPoint[]>;
  discover(req: DiscoverRequest): Promise<DiscoverResult>;
}
