import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, makeEntity } from '../util.js';
import { createApp } from '../../src/api/index.js';
import { IdentityService } from '../../src/services/identity-service.js';
import { SessionService } from '../../src/services/session-service.js';
import { IngestionService } from '../../src/services/ingestion-service.js';
import { AnalyticsService } from '../../src/services/analytics-service.js';
import { signEd25519, sha256 } from '../../src/adapters/crypto/ed25519.js';
import type { TestDb } from '../util.js';

describe('API Integration', () => {
  let testDb: TestDb;
  let app: ReturnType<typeof createApp>;
  let entity: ReturnType<typeof makeEntity>;
  let sessionToken: string;

  beforeEach(async () => {
    testDb = createTestDb();
    const identityService = new IdentityService(testDb.identityRepo);
    const sessionService = new SessionService(testDb.sessionRepo, testDb.identityRepo);
    const ingestionService = new IngestionService(testDb.eventRepo);
    const analyticsService = new AnalyticsService(testDb.eventRepo);

    app = createApp({
      identityService,
      sessionService,
      ingestionService,
      analyticsService,
      sessionRepo: testDb.sessionRepo,
      dashboardRepo: testDb.dashboardRepo,
    });

    entity = makeEntity();
    await testDb.identityRepo.register(entity);

    const timestamp = new Date().toISOString();
    const nonce = 'nonce_test';
    const signature = signEd25519(`${entity.id}:${nonce}:${timestamp}`, entity.keypair.privateKey);

    const sessionRes = await app.request('/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id: entity.id, nonce, timestamp, signature }),
    });
    const sessionBody = await sessionRes.json();
    sessionToken = sessionBody.token;
  });

  afterEach(() => testDb.cleanup());

  describe('POST /v1/identity/register', () => {
    it('registers a new entity', async () => {
      const kp = makeEntity();
      const timestamp = new Date().toISOString();
      const message = JSON.stringify({ publicKey: kp.publicKey, label: 'test', metadata: {}, timestamp });
      const signature = signEd25519(message, kp.keypair.privateKey);

      const res = await app.request('/v1/identity/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: kp.publicKey, label: 'test', metadata: {}, signature, timestamp }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.entityId).toMatch(/^ent_/);
    });

    it('rejects duplicate public key', async () => {
      const timestamp = new Date().toISOString();
      const message = JSON.stringify({ publicKey: entity.publicKey, label: 'dup', metadata: {}, timestamp });
      const signature = signEd25519(message, entity.keypair.privateKey);

      const res = await app.request('/v1/identity/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: entity.publicKey, label: 'dup', metadata: {}, signature, timestamp }),
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: expect.stringContaining('already registered') });
    });
  });

  describe('GET /v1/identity/:id', () => {
    it('returns registered entity', async () => {
      const res = await app.request(`/v1/identity/${entity.id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(entity.id);
      expect(body.label).toBe('test-entity');
    });

    it('returns 404 for unknown entity', async () => {
      const res = await app.request('/v1/identity/ent_missing');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /v1/session', () => {
    it('issues a session with valid signature', async () => {
      const timestamp = new Date().toISOString();
      const nonce = 'n2';
      const signature = signEd25519(`${entity.id}:${nonce}:${timestamp}`, entity.keypair.privateKey);

      const res = await app.request('/v1/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: entity.id, nonce, timestamp, signature }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.token).toMatch(/^sess_/);
    });

    it('rejects invalid entity', async () => {
      const res = await app.request('/v1/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_id: 'ent_unknown', nonce: 'n', timestamp: new Date().toISOString(), signature: 'bad' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/events', () => {
    it('accepts events with valid session', async () => {
      const res = await app.request('/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          events: [{ timestamp: new Date().toISOString(), name: 'click', value: 1 }],
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ accepted: 1 });
    });

    it('rejects without auth', async () => {
      const res = await app.request('/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [] }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /v1/analytics/timeseries', () => {
    it('returns data after events are submitted', async () => {
      const now = new Date();
      await app.request('/v1/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          events: [
            { timestamp: now.toISOString(), name: 'click', value: 1 },
            { timestamp: now.toISOString(), name: 'click', value: 1 },
          ],
        }),
      });

      const from = new Date(now.getTime() - 3600 * 1000).toISOString();
      const to = new Date(now.getTime() + 3600 * 1000).toISOString();

      const res = await app.request(`/v1/analytics/timeseries?event_name=click&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&interval=3600`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.points.length).toBeGreaterThanOrEqual(1);
      expect(body.points[0].value).toBe(2);
    });

    it('rejects without auth', async () => {
      const res = await app.request(`/v1/analytics/timeseries?event_name=click&from=${new Date().toISOString()}&to=${new Date().toISOString()}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /v1/dashboards', () => {
    it('creates a dashboard', async () => {
      const res = await app.request(`/v1/dashboards?token=${encodeURIComponent(sessionToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Dashboard',
          widgets: [{ type: 'timeseries_line', title: 'Clicks', query: { eventName: 'click', aggregation: 'count' } }],
          time_range: { preset: 'last_24h' },
          refresh_interval_seconds: 60,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.dashboard_id).toMatch(/^dash_/);
      expect(body.signed_url).toContain('/view/');
    });
  });

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.time).toBeDefined();
    });
  });
});
