import type { EventPort } from '../../ports/events.js';
import type { TelemetryEvent, TimeSeriesPoint, AnalyticsQuery } from '../../core/types.js';
import type { DiscoverRequest, DiscoverResult } from '../../services/analytics-service.js';
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

  async discover(req: DiscoverRequest): Promise<DiscoverResult> {
    let entityIds: string[] = [];
    
    if (req.workspaceId) {
      const rows = this.db.prepare('SELECT entity_id FROM workspace_members WHERE workspace_id = ?').all(req.workspaceId) as any[];
      entityIds = rows.map(r => r.entity_id);
    } else if (req.entityId) {
      entityIds = [req.entityId];
    }

    if (entityIds.length === 0) {
      return { entities: [], eventNames: [], dimensions: {}, timeRange: { earliest: '', latest: '' }, totalEvents: 0 };
    }

    const placeholders = entityIds.map(() => '?').join(',');

    // Total events
    const totalRow = this.db.prepare(`SELECT COUNT(*) as c FROM events WHERE entity_id IN (${placeholders})`).get(...entityIds) as any;
    const totalEvents = totalRow.c;

    // Event names
    const nameRows = this.db.prepare(`SELECT event_name, COUNT(*) as c FROM events WHERE entity_id IN (${placeholders}) GROUP BY event_name ORDER BY c DESC`).all(...entityIds) as any[];
    const eventNames = nameRows.map(r => ({ name: r.event_name, count: r.c }));

    // Time range
    const timeRow = this.db.prepare(`SELECT MIN(event_time) as earliest, MAX(event_time) as latest FROM events WHERE entity_id IN (${placeholders})`).get(...entityIds) as any;
    const timeRange = { earliest: timeRow.earliest || '', latest: timeRow.latest || '' };

    // Entities with counts
    const entityRows = this.db.prepare(`SELECT entity_id, COUNT(*) as c FROM events WHERE entity_id IN (${placeholders}) GROUP BY entity_id`).all(...entityIds) as any[];
    const entities = entityRows.map(r => ({ id: r.entity_id, eventCount: r.c }));

    // Dimensions - sample a few recent events and extract keys
    const sampleRows = this.db.prepare(`SELECT dimensions FROM events WHERE entity_id IN (${placeholders}) ORDER BY event_time DESC LIMIT 500`).all(...entityIds) as any[];
    const dims = new Map<string, Set<string>>();
    for (const row of sampleRows) {
      try {
        const parsed = JSON.parse(row.dimensions);
        for (const [key, val] of Object.entries(parsed)) {
          if (!dims.has(key)) dims.set(key, new Set());
          dims.get(key)!.add(String(val));
        }
      } catch {}
    }

    const dimensions: Record<string, string[]> = {};
    for (const [key, set] of dims) {
      dimensions[key] = Array.from(set).slice(0, 20); // Limit cardinality
    }

    return { entities, eventNames, dimensions, timeRange, totalEvents };
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
    const entityRows = this.db.prepare('SELECT entity_id FROM workspace_members WHERE workspace_id = ?').all(q.workspaceId) as any[];
    const entityIds = entityRows.map(r => r.entity_id);

    if (entityIds.length === 0) return [];

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
