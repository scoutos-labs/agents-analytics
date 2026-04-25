import type { Workspace, WorkspaceMembership } from '../core/types.js';

export interface WorkspacePort {
  create(workspace: Workspace): Promise<void>;
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  listByEntity(entityId: string): Promise<Workspace[]>;

  addMember(membership: WorkspaceMembership): Promise<void>;
  getMembers(workspaceId: string): Promise<WorkspaceMembership[]>;
  isMember(workspaceId: string, entityId: string): Promise<boolean>;
}
