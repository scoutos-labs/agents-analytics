import type { IdentityPort } from '../../ports/identity.js';
import type { Entity } from '../../core/types.js';
import { db as defaultDb } from './db.js';
import type Database from 'better-sqlite3';

export class SqliteIdentityRepo implements IdentityPort {
  constructor(private db: Database.Database = defaultDb) {}

  async register(entity: Entity): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO entities (id, public_key, label, metadata, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      entity.id,
      entity.publicKey,
      entity.label,
      JSON.stringify(entity.metadata),
      entity.createdAt.toISOString(),
      entity.revokedAt ? entity.revokedAt.toISOString() : null
    );
  }

  async findById(id: string): Promise<Entity | null> {
    const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as any;
    return row ? this.toEntity(row) : null;
  }

  async findByPublicKey(publicKey: string): Promise<Entity | null> {
    const row = this.db.prepare('SELECT * FROM entities WHERE public_key = ?').get(publicKey) as any;
    return row ? this.toEntity(row) : null;
  }

  async rotateKey(entityId: string, newPublicKey: string): Promise<void> {
    this.db.prepare('UPDATE entities SET public_key = ? WHERE id = ?').run(newPublicKey, entityId);
  }

  async revoke(entityId: string): Promise<void> {
    this.db.prepare('UPDATE entities SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?').run(entityId);
  }

  private toEntity(row: any): Entity {
    return {
      id: row.id,
      publicKey: row.public_key,
      label: row.label,
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    };
  }
}
