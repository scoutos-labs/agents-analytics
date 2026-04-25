import Database from 'better-sqlite3';
import { SqliteIdentityRepo } from '../src/adapters/sqlite/identity-repo.js';
import { SqliteSessionRepo } from '../src/adapters/sqlite/session-repo.js';
import { SqliteEventRepo } from '../src/adapters/sqlite/event-repo.js';
import { SqliteDashboardRepo } from '../src/adapters/sqlite/dashboard-repo.js';
import { SqliteWorkspaceRepo } from '../src/adapters/sqlite/workspace-repo.js';
import type { IdentityPort } from '../src/ports/identity.js';
import type { SessionPort } from '../src/ports/session.js';
import type { EventPort } from '../src/ports/events.js';
import type { DashboardPort } from '../src/ports/dashboard.js';
import { generateKeypair } from '../src/adapters/crypto/ed25519.js';
import type { Entity } from '../src/core/types.js';
import { WorkspacePort } from '../src/ports/workspace.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  label TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '[]',
  expires_at DATETIME NOT NULL,
  refreshable_until DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  event_time DATETIME NOT NULL,
  event_name TEXT NOT NULL,
  metric_value REAL NOT NULL DEFAULT 1.0,
  dimensions TEXT NOT NULL DEFAULT '{}',
  ingestion_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  batch_id TEXT
);

CREATE TABLE IF NOT EXISTS dashboards (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  workspace_id TEXT,
  config TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_events_entity_time ON events(entity_id, event_time);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events(event_name, event_time);
CREATE INDEX IF NOT EXISTS idx_events_entity_name_time ON events(entity_id, event_name, event_time);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_dashboards_entity ON dashboards(entity_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON dashboards(workspace_id);
`;

export interface TestDb {
  db: Database.Database;
  identityRepo: IdentityPort;
  sessionRepo: SessionPort;
  eventRepo: EventPort;
  dashboardRepo: DashboardPort;
  workspaceRepo: WorkspacePort;
  cleanup: () => void;
}

export function createTestDb(): TestDb {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  return {
    db,
    identityRepo: new SqliteIdentityRepo(db),
    sessionRepo: new SqliteSessionRepo(db),
    eventRepo: new SqliteEventRepo(db),
    dashboardRepo: new SqliteDashboardRepo(db),
    workspaceRepo: new SqliteWorkspaceRepo(db),
    cleanup: () => db.close(),
  };
}

export interface TestKeypair {
  publicKey: string;
  privateKey: string;
}

export function makeKeypair(): TestKeypair {
  return generateKeypair();
}

export function makeEntity(entityId?: string): Entity & { keypair: TestKeypair } {
  const keypair = makeKeypair();
  return {
    id: entityId || `ent_${Math.random().toString(36).slice(2)}`,
    publicKey: keypair.publicKey,
    label: 'test-entity',
    metadata: { env: 'test' },
    createdAt: new Date(),
    revokedAt: null,
    keypair,
  };
}

export function generateSession(entityId: string, hash: string, opts?: Partial<{ expires: Date; refreshable: Date }>) {
  const now = new Date();
  return {
    tokenHash: hash,
    entityId,
    scope: ['events:write'],
    expiresAt: opts?.expires ?? new Date(now.getTime() + 3600 * 1000),
    refreshableUntil: opts?.refreshable ?? new Date(now.getTime() + 3900 * 1000),
    createdAt: now,
  };
}
