import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { createTestDb, generateSession } from '../util.js';
import { sha256, randomToken } from '../../src/adapters/crypto/ed25519.js';
import type { TestDb } from '../util.js';

describe('Auth Middleware', () => {
  let testDb: TestDb;
  let app: Hono;

  beforeEach(() => {
    testDb = createTestDb();
    const middleware = createAuthMiddleware(testDb.sessionRepo);
    app = new Hono();
    app.use('/protected', middleware);
    app.get('/protected', (c) => c.json({ entityId: c.get('entityId'), scope: c.get('scope') }));
  });

  afterEach(() => testDb.cleanup());

  it('allows valid bearer token', async () => {
    const token = `sess_${randomToken()}`;
    const hash = sha256(token);
    await testDb.sessionRepo.create(generateSession('ent_1', hash));

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entityId).toBe('ent_1');
    expect(body.scope).toEqual(['events:write']);
  });

  it('allows valid query token', async () => {
    const token = `sess_${randomToken()}`;
    const hash = sha256(token);
    await testDb.sessionRepo.create(generateSession('ent_1', hash));

    const res = await app.request(`/protected?token=${token}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entityId).toBe('ent_1');
  });

  it('rejects missing token', async () => {
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Missing token' });
  });

  it('rejects invalid token', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid token' });
  });

  it('rejects expired token', async () => {
    const token = `sess_${randomToken()}`;
    const hash = sha256(token);
    await testDb.sessionRepo.create(
      generateSession('ent_1', hash, {
        expires: new Date(Date.now() - 1000),
        refreshable: new Date(Date.now() - 500),
      })
    );

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Session expired' });
  });
});
