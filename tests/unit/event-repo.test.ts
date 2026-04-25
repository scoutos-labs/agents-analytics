import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../util.js';
import type { TestDb } from '../util.js';
import type { TelemetryEvent } from '../../src/core/types.js';

describe('SqliteEventRepo', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => testDb.cleanup());

  function makeEvent(entityId: string, name: string, ts: Date, value?: number, dims?: Record<string, string>): TelemetryEvent {
    return {
      entityId,
      eventTime: ts,
      eventName: name,
      metricValue: value ?? 1,
      dimensions: dims || {},
      ingestionTime: new Date(),
    };
  }

  it('inserts and queries time-series', async () => {
    const now = new Date();
    const events: TelemetryEvent[] = [
      makeEvent('ent_a', 'click', new Date(now.getTime() - 1000 * 60)),
      makeEvent('ent_a', 'click', new Date(now.getTime() - 1000 * 60), 1, { region: 'us' }),
      makeEvent('ent_a', 'click', new Date(now.getTime() - 1000 * 60 * 5), 1, { region: 'eu' }),
      makeEvent('ent_b', 'click', new Date(now.getTime() - 1000 * 60)),
    ];
    await testDb.eventRepo.insertMany(events);

    const result = await testDb.eventRepo.queryTimeSeries({
      entityId: 'ent_a',
      eventName: 'click',
      from: new Date(now.getTime() - 1000 * 60 * 10),
      to: now,
      intervalSeconds: 3600,
      aggregation: 'count',
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    const totalCount = result.reduce((sum, p) => sum + p.value, 0);
    expect(totalCount).toBe(3);
  });

  it('groups by dimension', async () => {
    const now = new Date();
    const events: TelemetryEvent[] = [
      makeEvent('ent_a', 'click', now, 1, { region: 'us' }),
      makeEvent('ent_a', 'click', now, 1, { region: 'us' }),
      makeEvent('ent_a', 'click', now, 1, { region: 'eu' }),
    ];
    await testDb.eventRepo.insertMany(events);

    const result = await testDb.eventRepo.queryTimeSeries({
      entityId: 'ent_a',
      eventName: 'click',
      from: new Date(now.getTime() - 3600 * 1000),
      to: new Date(now.getTime() + 3600 * 1000),
      intervalSeconds: 3600,
      aggregation: 'count',
      groupBy: 'region',
    });

    expect(result.length).toBe(2);
    const us = result.find(r => r.group === 'us');
    const eu = result.find(r => r.group === 'eu');
    expect(us?.value).toBe(2);
    expect(eu?.value).toBe(1);
  });

  it('supports sum aggregation', async () => {
    const now = new Date();
    await testDb.eventRepo.insertMany([
      makeEvent('ent_a', 'purchase', now, 10),
      makeEvent('ent_a', 'purchase', now, 20),
    ]);

    const result = await testDb.eventRepo.queryTimeSeries({
      entityId: 'ent_a',
      eventName: 'purchase',
      from: new Date(now.getTime() - 3600 * 1000),
      to: new Date(now.getTime() + 3600 * 1000),
      intervalSeconds: 3600,
      aggregation: 'sum',
    });

    expect(result.length).toBe(1);
    expect(result[0].value).toBe(30);
  });

  it('filters by time range', async () => {
    const now = new Date();
    await testDb.eventRepo.insertMany([
      makeEvent('ent_a', 'view', new Date(now.getTime() - 1000 * 60)),
      makeEvent('ent_a', 'view', new Date(now.getTime() - 1000 * 60 * 60 * 2)),
    ]);

    const result = await testDb.eventRepo.queryTimeSeries({
      entityId: 'ent_a',
      eventName: 'view',
      from: new Date(now.getTime() - 1000 * 60 * 30),
      to: now,
      intervalSeconds: 3600,
      aggregation: 'count',
    });

    expect(result.length).toBe(1);
    expect(result[0].value).toBe(1);
  });

  it('returns empty for no matches', async () => {
    const result = await testDb.eventRepo.queryTimeSeries({
      entityId: 'ent_a',
      eventName: 'nothing',
      from: new Date(0),
      to: new Date(),
      intervalSeconds: 3600,
      aggregation: 'count',
    });
    expect(result).toEqual([]);
  });
});
