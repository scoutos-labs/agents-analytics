import type { EventPort } from '../../ports/events.js';
import type { TelemetryEvent, TimeSeriesPoint, AnalyticsQuery } from '../../core/types.js';
import { db as defaultDb } from './db.js';
import type Database from 'better-sqlite3';

export class SqliteEventRepo implements EventPort {
  constructor(private db: Database.Database = defaultDb) {}

  async insertMany(events: TelemetryEvent[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT INTO events (entity_id, event_time, event_name, metric_value, dimensions, ingestion_time, batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertManyTx = this.db.transaction((list: TelemetryEvent[]) => {
      for (const e of list) {
        insert.run(
          e.entityId,
          e.eventTime.toISOString(),
          e.eventName,
          e.metricValue,
          JSON.stringify(e.dimensions),
          e.ingestionTime.toISOString(),
          e.batchId ?? null
        );
      }
    });
    insertManyTx(events);
  }

  async queryTimeSeries(q: AnalyticsQuery): Promise<TimeSeriesPoint[]> {
    const fromIso = q.from.toISOString();
    const toIso = q.to.toISOString();
    const intervalSeconds = Math.max(1, q.intervalSeconds);

    if (q.workspaceId) {
      return this.queryWorkspaceTimeSeries(q, intervalSeconds, fromIso, toIso);
    }

    return this.queryEntityTimeSeries(q, intervalSeconds, fromIso, toIso);
  }

  private queryEntityTimeSeries(q: AnalyticsQuery, intervalSeconds: number, fromIso: string, toIso: string): TimeSeriesPoint[] {
    if (q.groupBy) {
      const colPath = `$.${q.groupBy}`;
      const sql = `
        SELECT datetime((strftime('%s', event_time) / ?) * ?, 'unixepoch') as bucket,
               json_extract(dimensions, ?) as group_name,
               ${this.aggregationSql(q.aggregation)} as value
        FROM events
        WHERE entity_id = ? AND event_name = ? AND event_time BETWEEN ? AND ?
        GROUP BY bucket, group_name
        ORDER BY bucket, group_name
      `;
      const rows = this.db.prepare(sql).all(intervalSeconds, intervalSeconds, colPath, q.entityId, q.eventName, fromIso, toIso) as any[];
      return rows.map(r => ({ bucket: r.bucket, value: r.value, group: r.group_name ?? undefined }));
    } else {
      const sql = `
        SELECT datetime((strftime('%s', event_time) / ?) * ?, 'unixepoch') as bucket,
               ${this.aggregationSql(q.aggregation)} as value
        FROM events
        WHERE entity_id = ? AND event_name = ? AND event_time BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket
      `;
      const rows = this.db.prepare(sql).all(intervalSeconds, intervalSeconds, q.entityId, q.eventName, fromIso, toIso) as any[];
      return rows.map(r => ({ bucket: r.bucket, value: r.value }));
    }
  }

  private queryWorkspaceTimeSeries(q: AnalyticsQuery, intervalSeconds: number, fromIso: string, toIso: string): TimeSeriesPoint[] {
    // Get all entity IDs in the workspace
    const entityRows = this.db.prepare(
      'SELECT entity_id FROM workspace_members WHERE workspace_id = ?'
    ).all(q.workspaceId) as any[];
    const entityIds = entityRows.map(r => r.entity_id);

    if (entityIds.length === 0) return [];

    // Build IN clause
    const placeholders = entityIds.map(() => '?').join(',');

    if (q.groupBy) {
      const colPath = `$.${q.groupBy}`;
      const sql = `
        SELECT datetime((strftime('%s', event_time) / ?) * ?, 'unixepoch') as bucket,
               json_extract(dimensions, ?) as group_name,
               ${this.aggregationSql(q.aggregation)} as value
        FROM events
        WHERE entity_id IN (${placeholders}) AND event_name = ? AND event_time BETWEEN ? AND ?
        GROUP BY bucket, group_name
        ORDER BY bucket, group_name
      `;
      const rows = this.db.prepare(sql).all(intervalSeconds, intervalSeconds, colPath, ...entityIds, q.eventName, fromIso, toIso) as any[];
      return rows.map(r => ({ bucket: r.bucket, value: r.value, group: r.group_name ?? undefined }));
    } else {
      const sql = `
        SELECT datetime((strftime('%s', event_time) / ?) * ?, 'unixepoch') as bucket,
               ${this.aggregationSql(q.aggregation)} as value
        FROM events
        WHERE entity_id IN (${placeholders}) AND event_name = ? AND event_time BETWEEN ? AND ?
        GROUP BY bucket
        ORDER BY bucket
      `;
      const rows = this.db.prepare(sql).all(intervalSeconds, intervalSeconds, ...entityIds, q.eventName, fromIso, toIso) as any[];
      return rows.map(r => ({ bucket: r.bucket, value: r.value }));
    }
  }

  private aggregationSql(agg: AnalyticsQuery['aggregation']): string {
    switch (agg) {
      case 'sum': return 'SUM(metric_value)';
      case 'avg': return 'AVG(metric_value)';
      case 'count':
      default: return 'COUNT(*)';
    }
  }
}
