import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../util.js';
import { AnalyticsService } from '../../src/services/analytics-service.js';
import type { TelemetryEvent } from '../../src/core/types.js';
import type { TestDb } from '../util.js';

describe('AnalyticsService', () => {
  let testDb: TestDb;
  let service: AnalyticsService;

  beforeEach(() => {
    testDb = createTestDb();
    service = new AnalyticsService(testDb.eventRepo);
  });

  afterEach(() => testDb.cleanup());

  function makeEvt(entityId: string, name: string, ts: Date, val = 1, dims?: Record<string, string>): TelemetryEvent {
    return { entityId, eventTime: ts, eventName: name, metricValue: val, dimensions: dims || {}, ingestionTime: new Date() };
  }

  it('returns time-series data for an event', async () => {
    const now = new Date();
    await testDb.eventRepo.insertMany([
      makeEvt('ent_a', 'click', now, 1),
      makeEvt('ent_a', 'click', now, 1),
      makeEvt('ent_a', 'click', now, 1),
    ]);

    const result = await service.timeseries({
      entityId: 'ent_a',
      eventName: 'click',
      from: new Date(now.getTime() - 3600 * 1000).toISOString(),
      to: new Date(now.getTime() + 3600 * 1000).toISOString(),
      intervalSeconds: 3600,
      aggregation: 'count',
    });

    expect(result.granularitySeconds).toBe(3600);
    expect(result.points.length).toBeGreaterThanOrEqual(1);
    expect(result.points[0].value).toBe(3);
  });

  it('respects aggregation type', async () => {
    const now = new Date();
    await testDb.eventRepo.insertMany([
      makeEvt('ent_a', 'purchase', now, 10),
      makeEvt('ent_a', 'purchase', now, 20),
    ]);

    const result = await service.timeseries({
      entityId: 'ent_a',
      eventName: 'purchase',
      from: new Date(now.getTime() - 3600 * 1000).toISOString(),
      to: new Date(now.getTime() + 3600 * 1000).toISOString(),
      intervalSeconds: 3600,
      aggregation: 'sum',
    });

    expect(result.points[0].value).toBe(30);
  });

  it('groups by dimension', async () => {
    const now = new Date();
    await testDb.eventRepo.insertMany([
      makeEvt('ent_a', 'click', now, 1, { region: 'us' }),
      makeEvt('ent_a', 'click', now, 1, { region: 'us' }),
      makeEvt('ent_a', 'click', now, 1, { region: 'eu' }),
    ]);

    const result = await service.timeseries({
      entityId: 'ent_a',
      eventName: 'click',
      from: new Date(now.getTime() - 3600 * 1000).toISOString(),
      to: new Date(now.getTime() + 3600 * 1000).toISOString(),
      intervalSeconds: 3600,
      aggregation: 'count',
      groupBy: 'region',
    });

    expect(result.points.length).toBe(2);
    const us = result.points.find(p => p.group === 'us');
    const eu = result.points.find(p => p.group === 'eu');
    expect(us!.value).toBe(2);
    expect(eu!.value).toBe(1);
  });

  it('returns empty for no data', async () => {
    const result = await service.timeseries({
      entityId: 'ent_none',
      eventName: 'never',
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      intervalSeconds: 3600,
      aggregation: 'count',
    });
    expect(result.points).toEqual([]);
  });
});
