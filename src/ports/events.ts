import type { TelemetryEvent, TimeSeriesPoint, AnalyticsQuery } from '../core/types.js';

export interface EventPort {
  insertMany(events: TelemetryEvent[]): Promise<void>;
  queryTimeSeries(q: AnalyticsQuery): Promise<TimeSeriesPoint[]>;
}
