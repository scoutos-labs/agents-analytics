import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../util.js';
import { IngestionService } from '../../src/services/ingestion-service.js';
import type { TestDb } from '../util.js';

describe('IngestionService', () => {
  let testDb: TestDb;
  let service: IngestionService;

  beforeEach(() => {
    testDb = createTestDb();
    service = new IngestionService(testDb.eventRepo);
  });

  afterEach(() => testDb.cleanup());

  it('accepts valid events', async () => {
    const result = await service.submit({
      entityId: 'ent_1',
      events: [
        { timestamp: new Date().toISOString(), name: 'click', value: 1, dimensions: { region: 'us' } },
        { timestamp: new Date().toISOString(), name: 'click', value: 1 },
      ],
    });
    expect(result.accepted).toBe(2);
  });

  it('filters out future events beyond drift window', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const result = await service.submit({
      entityId: 'ent_1',
      events: [{ timestamp: future, name: 'click' }],
    });
    expect(result.accepted).toBe(0);
  });

  it('filters out events older than retention', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const result = await service.submit({
      entityId: 'ent_1',
      events: [{ timestamp: old, name: 'click' }],
    });
    expect(result.accepted).toBe(0);
  });

  it('uses default metric value of 1', async () => {
    const now = new Date();
    await service.submit({
      entityId: 'ent_1',
      events: [{ timestamp: now.toISOString(), name: 'view' }],
    });

    const rows = await testDb.eventRepo.queryTimeSeries({
      entityId: 'ent_1',
      eventName: 'view',
      from: new Date(now.getTime() - 3600 * 1000),
      to: new Date(now.getTime() + 3600 * 1000),
      intervalSeconds: 3600,
      aggregation: 'sum',
    });

    expect(rows[0].value).toBe(1);
  });

  it('accepts empty event list', async () => {
    const result = await service.submit({ entityId: 'ent_1', events: [] });
    expect(result.accepted).toBe(0);
  });
});
