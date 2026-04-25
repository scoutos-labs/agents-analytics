import type { WorkspacePort } from '../ports/workspace.js';
import type { IdentityPort } from '../ports/identity.js';
import type { Workspace, WorkspaceMembership } from '../core/types.js';
import { randomToken } from '../adapters/crypto/ed25519.js';

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string;
  createdBy: string;
}

export class WorkspaceService {
  constructor(
    private workspaceRepo: WorkspacePort,
    private identityRepo: IdentityPort,
  ) {}

  async create(input: CreateWorkspaceInput): Promise<{ workspaceId: string }> {
    const creator = await this.identityRepo.findById(input.createdBy);
    if (!creator) {
      throw new Error('Creator entity not found');
    }

    const existing = await this.workspaceRepo.findBySlug(input.slug);
    if (existing) {
      throw new Error('Slug already in use');
    }

    const workspaceId = `ws_${randomToken().slice(0, 12)}`;
    const workspace: Workspace = {
      id: workspaceId,
      name: input.name,
      slug: input.slug,
      description: input.description || '',
      createdBy: input.createdBy,
      createdAt: new Date(),
    };

    await this.workspaceRepo.create(workspace);

    // Creator is automatically an admin member
    await this.workspaceRepo.addMember({
      workspaceId,
      entityId: input.createdBy,
      role: 'admin',
      joinedAt: new Date(),
    });

    return { workspaceId };
  }

  async addMember(workspaceId: string, adminId: string, entityId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    const isAdmin = await this.workspaceRepo.isMember(workspaceId, adminId);
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    const entity = await this.identityRepo.findById(entityId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    await this.workspaceRepo.addMember({
      workspaceId,
      entityId,
      role,
      joinedAt: new Date(),
    });
  }

  async listForEntity(entityId: string): Promise<Workspace[]> {
    return this.workspaceRepo.listByEntity(entityId);
  }

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    return this.workspaceRepo.findById(workspaceId);
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    return this.workspaceRepo.getMembers(workspaceId);
  }
}
