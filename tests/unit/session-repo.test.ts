import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, generateSession } from '../util.js';
import { sha256, randomToken } from '../../src/adapters/crypto/ed25519.js';
import type { TestDb } from '../util.js';

describe('SqliteSessionRepo', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => testDb.cleanup());

  it('creates and finds a session', async () => {
    const hash = sha256(randomToken());
    const session = generateSession('ent_1', hash);
    await testDb.sessionRepo.create(session);

    const found = await testDb.sessionRepo.findByTokenHash(hash);
    expect(found).not.toBeNull();
    expect(found!.entityId).toBe('ent_1');
    expect(found!.scope).toEqual(['events:write']);
  });

  it('returns null for missing hash', async () => {
    expect(await testDb.sessionRepo.findByTokenHash('nope')).toBeNull();
  });

  it('revokes a session', async () => {
    const hash = sha256(randomToken());
    await testDb.sessionRepo.create(generateSession('ent_1', hash));
    await testDb.sessionRepo.revoke(hash);

    expect(await testDb.sessionRepo.findByTokenHash(hash)).toBeNull();
  });

  it('prunes expired sessions', async () => {
    const hash1 = sha256(randomToken());
    const hash2 = sha256(randomToken());

    await testDb.sessionRepo.create(generateSession('ent_1', hash1, {
      expires: new Date(Date.now() - 1000),
      refreshable: new Date(Date.now() - 500),
    }));
    await testDb.sessionRepo.create(generateSession('ent_1', hash2, {
      expires: new Date(Date.now() + 3600 * 1000),
      refreshable: new Date(Date.now() + 3900 * 1000),
    }));

    expect(await testDb.sessionRepo.findByTokenHash(hash1)).not.toBeNull(); // SQLite date check needs to run
    const pruned = testDb.sessionRepo.pruneExpired();
    expect(pruned).toBe(1);
    expect(await testDb.sessionRepo.findByTokenHash(hash1)).toBeNull();
    expect(await testDb.sessionRepo.findByTokenHash(hash2)).not.toBeNull();
  });
});
