import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, makeEntity } from '../util.js';
import type { TestDb } from '../util.js';

describe('SqliteIdentityRepo', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => testDb.cleanup());

  it('registers and retrieves an entity', async () => {
    const entity = makeEntity();
    await testDb.identityRepo.register(entity);

    const found = await testDb.identityRepo.findById(entity.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(entity.id);
    expect(found!.publicKey).toBe(entity.publicKey);
    expect(found!.label).toBe('test-entity');
    expect(found!.metadata).toEqual({ env: 'test' });
  });

  it('finds by public key', async () => {
    const entity = makeEntity();
    await testDb.identityRepo.register(entity);

    const found = await testDb.identityRepo.findByPublicKey(entity.publicKey);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(entity.id);
  });

  it('returns null for missing entity', async () => {
    expect(await testDb.identityRepo.findById('ent_nonexistent')).toBeNull();
    expect(await testDb.identityRepo.findByPublicKey('key_123')).toBeNull();
  });

  it('revokes an entity', async () => {
    const entity = makeEntity();
    await testDb.identityRepo.register(entity);
    await testDb.identityRepo.revoke(entity.id);

    const found = await testDb.identityRepo.findById(entity.id);
    expect(found!.revokedAt).not.toBeNull();
  });

  it('rotates the public key', async () => {
    const entity = makeEntity();
    await testDb.identityRepo.register(entity);

    await testDb.identityRepo.rotateKey(entity.id, 'new-public-key-pem');
    const found = await testDb.identityRepo.findById(entity.id);
    expect(found!.publicKey).toBe('new-public-key-pem');
  });
});
