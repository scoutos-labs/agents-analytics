import type { IdentityPort } from '../ports/identity.js';
import { verifyEd25519, randomToken } from '../adapters/crypto/ed25519.js';
import type { Entity } from '../core/types.js';

export interface RegisterInput {
  publicKey: string; // PEM or base64 raw 32-byte
  label: string;
  metadata: Record<string, string>;
  signature: string; // base64 signature of the canonical message
  timestamp: string; // ISO
}

function canonicalRegisterMessage(input: Omit<RegisterInput, 'signature'>): string {
  return JSON.stringify({ publicKey: input.publicKey, label: input.label, metadata: input.metadata, timestamp: input.timestamp });
}

export class IdentityService {
  constructor(private repo: IdentityPort) {}

  async register(input: RegisterInput): Promise<{ entityId: string }> {
    const message = canonicalRegisterMessage(input);
    const valid = verifyEd25519(message, input.signature, input.publicKey);
    if (!valid) {
      throw new Error('Invalid signature');
    }

    // Check drift (±5 min)
    const ts = new Date(input.timestamp);
    const now = new Date();
    if (Math.abs(now.getTime() - ts.getTime()) > 5 * 60 * 1000) {
      throw new Error('Timestamp too old or in future');
    }

    const existing = await this.repo.findByPublicKey(input.publicKey);
    if (existing) {
      throw new Error('Public key already registered');
    }

    const entityId = `ent_${randomToken().slice(0, 16)}`;
    const entity: Entity = {
      id: entityId,
      publicKey: input.publicKey,
      label: input.label,
      metadata: input.metadata,
      createdAt: new Date(),
      revokedAt: null,
    };

    await this.repo.register(entity);
    return { entityId };
  }

  async find(entityId: string): Promise<Entity | null> {
    return this.repo.findById(entityId);
  }
}
