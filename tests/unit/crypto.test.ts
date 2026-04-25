import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  signEd25519,
  verifyEd25519,
  sha256,
  randomToken,
} from '../../src/adapters/crypto/ed25519.js';

describe('Crypto Adapter', () => {
  describe('generateKeypair', () => {
    it('generates PEM-encoded Ed25519 keypair', () => {
      const kp = generateKeypair();
      expect(kp.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(kp.privateKey).toContain('BEGIN PRIVATE KEY');
      expect(kp.publicKey.length).toBeGreaterThan(60);
      expect(kp.privateKey.length).toBeGreaterThan(60);
    });

    it('generates unique keypairs each time', () => {
      const a = generateKeypair();
      const b = generateKeypair();
      expect(a.publicKey).not.toBe(b.publicKey);
      expect(a.privateKey).not.toBe(b.privateKey);
    });
  });

  describe('signEd25519 / verifyEd25519', () => {
    it('roundtrips: sign then verify with same keypair', () => {
      const { publicKey, privateKey } = generateKeypair();
      const message = 'hello agentsig';
      const signature = signEd25519(message, privateKey);
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);

      const valid = verifyEd25519(message, signature, publicKey);
      expect(valid).toBe(true);
    });

    it('rejects tampered message', () => {
      const { publicKey, privateKey } = generateKeypair();
      const message = 'original message';
      const signature = signEd25519(message, privateKey);

      const valid = verifyEd25519('tampered message', signature, publicKey);
      expect(valid).toBe(false);
    });

    it('rejects signature from different key', () => {
      const { privateKey: privA } = generateKeypair();
      const { publicKey: pubB } = generateKeypair();
      const message = 'hello';
      const signature = signEd25519(message, privA);

      const valid = verifyEd25519(message, signature, pubB);
      expect(valid).toBe(false);
    });

    it('handles Buffer input', () => {
      const { publicKey, privateKey } = generateKeypair();
      const buf = Buffer.from('binary data', 'utf-8');
      const signature = signEd25519(buf, privateKey);
      const valid = verifyEd25519(buf, signature, publicKey);
      expect(valid).toBe(true);
    });

    it('rejects invalid base64 public key', () => {
      const valid = verifyEd25519('test', 'bm90YXJlYWxzaWduYXR1cmU=', 'invalid_key');
      expect(valid).toBe(false);
    });

    it('rejects malformed signature', () => {
      const { publicKey } = generateKeypair();
      const valid = verifyEd25519('test', 'not-base64!!!', publicKey);
      expect(valid).toBe(false);
    });
  });

  describe('sha256', () => {
    it('produces deterministic 64-character hex digest', () => {
      const digest = sha256('agentsig');
      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
      expect(sha256('agentsig')).toBe(digest);
    });

    it('produces different hashes for different inputs', () => {
      expect(sha256('a')).not.toBe(sha256('b'));
    });
  });

  describe('randomToken', () => {
    it('generates a random 64-character hex string', () => {
      const t = randomToken();
      expect(t).toHaveLength(64);
      expect(t).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique tokens each call', () => {
      const a = randomToken();
      const b = randomToken();
      expect(a).not.toBe(b);
    });
  });
});
