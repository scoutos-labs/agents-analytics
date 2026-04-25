import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';

export const defaultDbPath = process.env.DB_PATH || resolve('data', 'agentsig.db');
mkdirSync(dirname(defaultDbPath), { recursive: true });

export const db = new Database(defaultDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb(): void {
  // Placeholder for any runtime init beyond migrations
}
