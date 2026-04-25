import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../util.js';
import { IdentityService } from '../../src/services/identity-service.js';
import { generateKeypair, signEd25519, randomToken } from '../../src/adapters/crypto/ed25519.js';
import type { TestDb } from '../util.js';

describe('IdentityService', () => {
  let testDb: TestDb;
  let service: IdentityService;

  beforeEach(() => {
    testDb = createTestDb();
    service = new IdentityService(testDb.identityRepo);
  });

  afterEach(() => testDb.cleanup());

  function makeRegisterInput(priv?: string, pub?: string) {
    const { publicKey, privateKey } = priv && pub
      ? { publicKey: pub, privateKey: priv }
      : generateKeypair();

    const timestamp = new Date().toISOString();
    const message = JSON.stringify({ publicKey, label: 'agent', metadata: {}, timestamp });
    const signature = signEd25519(message, privateKey);

    return { publicKey, privateKey, timestamp, message, signature };
  }

  it('registers a new entity with valid signature', async () => {
    const { publicKey, timestamp, signature } = makeRegisterInput();
    const result = await service.register({
      publicKey,
      label: 'agent',
      metadata: {},
      signature,
      timestamp,
    });

    expect(result.entityId).toMatch(/^ent_/);
    const found = await testDb.identityRepo.findById(result.entityId);
    expect(found).not.toBeNull();
  });

  it('rejects invalid signature', async () => {
    const { publicKey, timestamp } = makeRegisterInput();
    const { privateKey: wrongPriv } = generateKeypair();
    await expect(
      service.register({
        publicKey,
        label: 'agent',
        metadata: {},
        signature: signEd25519('wrong-message', wrongPriv),
        timestamp,
      })
    ).rejects.toThrow('Invalid signature');
  });

  it('rejects stale timestamps', async () => {
    const { publicKey, privateKey } = generateKeypair();
    const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const message = JSON.stringify({ publicKey, label: 'agent', metadata: {}, timestamp: oldTimestamp });
    const signature = signEd25519(message, privateKey);

    await expect(
      service.register({
        publicKey,
        label: 'agent',
        metadata: {},
        signature,
        timestamp: oldTimestamp,
      })
    ).rejects.toThrow('Timestamp');
  });

  it('rejects duplicate public key', async () => {
    const { publicKey, privateKey, timestamp } = makeRegisterInput();
    const msg1 = JSON.stringify({ publicKey, label: 'agent', metadata: {}, timestamp });
    const sig1 = signEd25519(msg1, privateKey);
    await service.register({ publicKey, label: 'agent', metadata: {}, signature: sig1, timestamp });

    const timestamp2 = new Date().toISOString();
    const msg2 = JSON.stringify({ publicKey, label: 'agent2', metadata: {}, timestamp: timestamp2 });
    const sig2 = signEd25519(msg2, privateKey);

    await expect(
      service.register({ publicKey, label: 'agent2', metadata: {}, signature: sig2, timestamp: timestamp2 })
    ).rejects.toThrow('already registered');
  });

  it('finds registered entity', async () => {
    const { publicKey, timestamp, signature } = makeRegisterInput();
    const { entityId } = await service.register({ publicKey, label: 'agent', metadata: {}, signature, timestamp });
    const found = await service.find(entityId);
    expect(found!.publicKey).toBe(publicKey);
    expect(found!.label).toBe('agent');
  });

  it('returns null for missing entity', async () => {
    expect(await service.find('ent_nonexistent')).toBeNull();
  });
});
