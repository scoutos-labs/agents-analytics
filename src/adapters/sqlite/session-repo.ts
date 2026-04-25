import type { SessionPort } from '../../ports/session.js';
import type { Session } from '../../core/types.js';
import { db as defaultDb } from './db.js';
import type Database from 'better-sqlite3';

export class SqliteSessionRepo implements SessionPort {
  constructor(private db: Database.Database = defaultDb) {}

  async create(session: Session): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO sessions (token_hash, entity_id, scope, expires_at, refreshable_until, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      session.tokenHash,
      session.entityId,
      JSON.stringify(session.scope),
      session.expiresAt.toISOString(),
      session.refreshableUntil.toISOString(),
      session.createdAt.toISOString()
    );
  }

  async findByTokenHash(hash: string): Promise<Session | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hash) as any;
    if (!row) return null;
    return {
      tokenHash: row.token_hash,
      entityId: row.entity_id,
      scope: JSON.parse(row.scope),
      expiresAt: new Date(row.expires_at),
      refreshableUntil: new Date(row.refreshable_until),
      createdAt: new Date(row.created_at),
    };
  }

  async revoke(tokenHash: string): Promise<void> {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  pruneExpired(): number {
    const info = this.db.prepare("DELETE FROM sessions WHERE julianday(expires_at) < julianday('now')").run();
    return info.changes;
  }
}
