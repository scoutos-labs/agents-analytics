import type { WorkspacePort } from '../../ports/workspace.js';
import type { Workspace, WorkspaceMembership } from '../../core/types.js';
import { db as defaultDb } from './db.js';
import type Database from 'better-sqlite3';

export class SqliteWorkspaceRepo implements WorkspacePort {
  constructor(private db: Database.Database = defaultDb) {}

  async create(workspace: Workspace): Promise<void> {
    this.db.prepare(
      'INSERT INTO workspaces (id, name, slug, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(workspace.id, workspace.name, workspace.slug, workspace.description, workspace.createdBy, workspace.createdAt.toISOString());
  }

  async findById(id: string): Promise<Workspace | null> {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
    return row ? this.toWorkspace(row) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE slug = ?').get(slug) as any;
    return row ? this.toWorkspace(row) : null;
  }

  async listByEntity(entityId: string): Promise<Workspace[]> {
    const rows = this.db.prepare(
      'SELECT w.* FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.entity_id = ?'
    ).all(entityId) as any[];
    return rows.map(r => this.toWorkspace(r));
  }

  async addMember(membership: WorkspaceMembership): Promise<void> {
    this.db.prepare(
      'INSERT OR REPLACE INTO workspace_members (workspace_id, entity_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).run(membership.workspaceId, membership.entityId, membership.role, membership.joinedAt.toISOString());
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    const rows = this.db.prepare(
      'SELECT * FROM workspace_members WHERE workspace_id = ?'
    ).all(workspaceId) as any[];
    return rows.map(r => this.toMembership(r));
  }

  async isMember(workspaceId: string, entityId: string): Promise<boolean> {
    const row = this.db.prepare(
      'SELECT 1 FROM workspace_members WHERE workspace_id = ? AND entity_id = ?'
    ).get(workspaceId, entityId) as any;
    return !!row;
  }

  private toWorkspace(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  }

  private toMembership(row: any): WorkspaceMembership {
    return {
      workspaceId: row.workspace_id,
      entityId: row.entity_id,
      role: row.role,
      joinedAt: new Date(row.joined_at),
    };
  }
}
