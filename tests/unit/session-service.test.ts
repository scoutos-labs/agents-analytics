import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, makeEntity, generateSession } from '../util.js';
import { SessionService } from '../../src/services/session-service.js';
import { signEd25519, sha256, randomToken } from '../../src/adapters/crypto/ed25519.js';
import type { TestDb } from '../util.js';

describe('SessionService', () => {
  let testDb: TestDb;
  let service: SessionService;
  let entity: ReturnType<typeof makeEntity>;

  beforeEach(async () => {
    testDb = createTestDb();
    service = new SessionService(testDb.sessionRepo, testDb.identityRepo);
    entity = makeEntity();
    await testDb.identityRepo.register(entity);
  });

  afterEach(() => testDb.cleanup());

  function signSession(entityId: string, timestamp: string, nonce: string) {
    const message = `${entityId}:${nonce}:${timestamp}`;
    return signEd25519(message, entity.keypair.privateKey);
  }

  it('starts a session with valid signature', async () => {
    const timestamp = new Date().toISOString();
    const nonce = randomToken();
    const signature = signSession(entity.id, timestamp, nonce);

    const result = await service.start({
      entityId: entity.id,
      nonce,
      timestamp,
      signature,
      ttlSeconds: 3600,
    });

    expect(result.token).toMatch(/^sess_/);
    expect(result.expiresAt > new Date()).toBe(true);

    const found = await testDb.sessionRepo.findByTokenHash(sha256(result.token));
    expect(found).not.toBeNull();
    expect(found!.entityId).toBe(entity.id);
  });

  it('rejects unknown entity', async () => {
    await expect(
      service.start({
        entityId: 'ent_foo',
        nonce: 'abc',
        timestamp: new Date().toISOString(),
        signature: 'bad',
      })
    ).rejects.toThrow('Entity not found');
  });

  it('rejects invalid signature', async () => {
    await expect(
      service.start({
        entityId: entity.id,
        nonce: 'abc',
        timestamp: new Date().toISOString(),
        signature: signEd25519('wrong', makeEntity().keypair.privateKey),
      })
    ).rejects.toThrow('Invalid signature');
  });

  it('rejects stale timestamp', async () => {
    const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await expect(
      service.start({
        entityId: entity.id,
        nonce: 'n1',
        timestamp: oldTimestamp,
        signature: signEd25519(`${entity.id}:n1:${oldTimestamp}`, entity.keypair.privateKey),
      })
    ).rejects.toThrow('Timestamp too old');
  });

  it('renews a session', async () => {
    const timestamp = new Date().toISOString();
    const nonce = randomToken();
    const signature = signSession(entity.id, timestamp, nonce);

    const { token } = await service.start({
      entityId: entity.id,
      nonce,
      timestamp,
      signature,
      ttlSeconds: 3600,
    });

    const renewed = await service.renew(token);
    expect(renewed.token).not.toBe(token);
    expect(renewed.token.startsWith('sess_')).toBe(true);

    expect(await testDb.sessionRepo.findByTokenHash(sha256(token))).toBeNull();
    expect(await testDb.sessionRepo.findByTokenHash(sha256(renewed.token))).not.toBeNull();
  });

  it('rejects renewing expired session', async () => {
    const hash = sha256(randomToken());
    await testDb.sessionRepo.create(
      generateSession(entity.id, hash, {
        expires: new Date(Date.now() - 1000),
        refreshable: new Date(Date.now() - 1000),
      })
    );

    await expect(service.renew(randomToken())).rejects.toThrow('Session not found');
  });

  it('caps ttl at 24 hours', async () => {
    const timestamp = new Date().toISOString();
    const result = await service.start({
      entityId: entity.id,
      nonce: 'n',
      timestamp,
      signature: signSession(entity.id, timestamp, 'n'),
      ttlSeconds: 999999,
    });

    const found = await testDb.sessionRepo.findByTokenHash(sha256(result.token));
    const maxDuration = found!.expiresAt.getTime() - found!.createdAt.getTime();
    expect(maxDuration).toBeLessThanOrEqual(86400 * 1000);
  });
});
