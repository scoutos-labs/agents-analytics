import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, makeEntity } from '../util.js';
import { WorkspaceService } from '../../src/services/workspace-service.js';
import { IdentityService } from '../../src/services/identity-service.js';
import type { TestDb } from '../util.js';

describe('WorkspaceService', () => {
  let testDb: TestDb;
  let wsService: WorkspaceService;
  let identityService: IdentityService;
  let admin: ReturnType<typeof makeEntity>;

  beforeEach(async () => {
    testDb = createTestDb();
    identityService = new IdentityService(testDb.identityRepo);
    wsService = new WorkspaceService(testDb.workspaceRepo, testDb.identityRepo);
    admin = makeEntity();
    await testDb.identityRepo.register(admin);
  });

  afterEach(() => testDb.cleanup());

  it('creates a workspace', async () => {
    const result = await wsService.create({
      name: 'Operations',
      slug: 'ops',
      description: 'Main workspace',
      createdBy: admin.id,
    });

    expect(result.workspaceId).toMatch(/^ws_/);
    const found = await wsService.getWorkspace(result.workspaceId);
    expect(found!.name).toBe('Operations');
    expect(found!.slug).toBe('ops');
  });

  it('auto-adds creator as admin', async () => {
    const result = await wsService.create({
      name: 'Operations',
      slug: 'ops',
      createdBy: admin.id,
    });

    const members = await wsService.getMembers(result.workspaceId);
    expect(members).toHaveLength(1);
    expect(members[0].entityId).toBe(admin.id);
    expect(members[0].role).toBe('admin');
  });

  it('rejects duplicate slug', async () => {
    await wsService.create({ name: 'Ops', slug: 'unique', createdBy: admin.id });
    await expect(
      wsService.create({ name: 'Ops2', slug: 'unique', createdBy: admin.id })
    ).rejects.toThrow('already in use');
  });

  it('rejects workspace for non-existent creator', async () => {
    await expect(
      wsService.create({ name: 'Ops', slug: 'test', createdBy: 'ent_missing' })
    ).rejects.toThrow('Creator entity not found');
  });

  it('lists workspaces for entity', async () => {
    await wsService.create({ name: 'Ops1', slug: 'ops1', createdBy: admin.id });
    await wsService.create({ name: 'Ops2', slug: 'ops2', createdBy: admin.id });

    const list = await wsService.listForEntity(admin.id);
    expect(list).toHaveLength(2);
  });

  it('adds member and tracks membership', async () => {
    const ws = await wsService.create({ name: 'Ops', slug: 'ops', createdBy: admin.id });
    const member = makeEntity();
    await testDb.identityRepo.register(member);

    await wsService.addMember(ws.workspaceId, admin.id, member.id, 'member');

    const members = await wsService.getMembers(ws.workspaceId);
    expect(members).toHaveLength(2);
    const found = members.find(m => m.entityId === member.id);
    expect(found?.role).toBe('member');
  });

  it('rejects addMember for non-admin', async () => {
    const ws = await wsService.create({ name: 'Ops', slug: 'ops', createdBy: admin.id });
    const nonAdmin = makeEntity();
    await testDb.identityRepo.register(nonAdmin);

    await expect(
      wsService.addMember(ws.workspaceId, nonAdmin.id, 'ent_any', 'member')
    ).rejects.toThrow('Admin access required');
  });
});
