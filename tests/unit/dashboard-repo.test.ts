import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../util.js';
import type { TestDb } from '../util.js';
import type { DashboardConfig } from '../../src/core/types.js';

describe('SqliteDashboardRepo', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => testDb.cleanup());

  function makeDashboard(id: string, entityId: string, title = 'Test'): DashboardConfig {
    return {
      id,
      entityId,
      title,
      widgets: [],
      timeRange: { preset: 'last_24h' },
      refreshIntervalSeconds: 60,
      createdAt: new Date(),
    };
  }

  it('saves and finds a dashboard', async () => {
    const dash = makeDashboard('dash_1', 'ent_a', 'Overview');
    await testDb.dashboardRepo.save(dash);

    const found = await testDb.dashboardRepo.findById('dash_1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Overview');
    expect(found!.entityId).toBe('ent_a');
  });

  it('returns null for missing dashboard', async () => {
    expect(await testDb.dashboardRepo.findById('dash_missing')).toBeNull();
  });

  it('lists dashboards by entity', async () => {
    await testDb.dashboardRepo.save(makeDashboard('dash_1', 'ent_a'));
    await testDb.dashboardRepo.save(makeDashboard('dash_2', 'ent_a'));
    await testDb.dashboardRepo.save(makeDashboard('dash_3', 'ent_b'));

    const listA = await testDb.dashboardRepo.listByEntity('ent_a');
    const listB = await testDb.dashboardRepo.listByEntity('ent_b');

    expect(listA).toHaveLength(2);
    expect(listB).toHaveLength(1);
  });

  it('updates existing dashboard by id', async () => {
    const dash = makeDashboard('dash_1', 'ent_a', 'First');
    await testDb.dashboardRepo.save(dash);

    const updated = makeDashboard('dash_1', 'ent_a', 'Updated');
    await testDb.dashboardRepo.save(updated);

    const found = await testDb.dashboardRepo.findById('dash_1');
    expect(found!.title).toBe('Updated');
  });
});
