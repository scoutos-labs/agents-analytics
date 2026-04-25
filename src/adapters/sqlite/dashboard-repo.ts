import type { DashboardPort } from '../../ports/dashboard.js';
import type { DashboardConfig } from '../../core/types.js';
import { db as defaultDb } from './db.js';
import type Database from 'better-sqlite3';

export class SqliteDashboardRepo implements DashboardPort {
  constructor(private db: Database.Database = defaultDb) {}

  async save(config: DashboardConfig): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO dashboards (id, entity_id, config, created_at) VALUES (?, ?, ?, ?)'
    );
    stmt.run(
      config.id,
      config.entityId,
      JSON.stringify(config),
      config.createdAt.toISOString()
    );
  }

  async findById(id: string): Promise<DashboardConfig | null> {
    const row = this.db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as any;
    if (!row) return null;
    const parsed = JSON.parse(row.config);
    parsed.createdAt = new Date(parsed.createdAt);
    return parsed as DashboardConfig;
  }

  async listByEntity(entityId: string): Promise<DashboardConfig[]> {
    const rows = this.db.prepare('SELECT config FROM dashboards WHERE entity_id = ? ORDER BY created_at DESC').all(entityId) as any[];
    return rows.map(r => {
      const parsed = JSON.parse(r.config);
      parsed.createdAt = new Date(parsed.createdAt);
      return parsed as DashboardConfig;
    });
  }
}
