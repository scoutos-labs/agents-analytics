import { db } from './db.js';

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

export function migrate(): void {
  db.exec(SCHEMA);
}
