import type { SessionPort } from '../ports/session.js';
import type { IdentityPort } from '../ports/identity.js';
import { verifyEd25519, sha256, randomToken } from '../adapters/crypto/ed25519.js';
import type { Session } from '../core/types.js';

export interface StartSessionInput {
  entityId: string;
  nonce: string;
  timestamp: string;
  signature: string;
  ttlSeconds?: number;
  scope?: string[];
}

export class SessionService {
  constructor(
    private sessionRepo: SessionPort,
    private identityRepo: IdentityPort
  ) {}

  async start(input: StartSessionInput): Promise<{ token: string; expiresAt: Date }> {
    const entity = await this.identityRepo.findById(input.entityId);
    if (!entity || entity.revokedAt) {
      throw new Error('Entity not found or revoked');
    }

    const message = `${input.entityId}:${input.nonce}:${input.timestamp}`;
    const valid = verifyEd25519(message, input.signature, entity.publicKey);
    if (!valid) {
      throw new Error('Invalid signature');
    }

    const ts = new Date(input.timestamp);
    const now = new Date();
    if (Math.abs(now.getTime() - ts.getTime()) > 5 * 60 * 1000) {
      throw new Error('Timestamp too old');
    }

    const ttl = Math.min(input.ttlSeconds || 3600, 86400); // max 24h
    const rawToken = `sess_${randomToken()}`;
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(now.getTime() + ttl * 1000);
    const refreshableUntil = new Date(now.getTime() + ttl * 1000 + 5 * 60 * 1000);

    const session: Omit<Session, 'tokenHash'> & { tokenHash: string } = {
      tokenHash,
      entityId: entity.id,
      scope: input.scope || ['events:write', 'dashboard:read'],
      expiresAt,
      refreshableUntil,
      createdAt: now,
    };

    await this.sessionRepo.create(session);
    return { token: rawToken, expiresAt };
  }

  async renew(token: string): Promise<{ token: string; expiresAt: Date }> {
    const hash = sha256(token);
    const existing = await this.sessionRepo.findByTokenHash(hash);
    if (!existing) throw new Error('Session not found');

    const now = new Date();
    if (now > existing.refreshableUntil) {
      throw new Error('Session not refreshable');
    }

    // Issue new token
    const ttl = Math.min((existing.expiresAt.getTime() - existing.createdAt.getTime()) / 1000, 86400);
    const rawToken = `sess_${randomToken()}`;
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(now.getTime() + ttl * 1000);
    const refreshableUntil = new Date(now.getTime() + ttl * 1000 + 5 * 60 * 1000);

    await this.sessionRepo.create({
      tokenHash,
      entityId: existing.entityId,
      scope: existing.scope,
      expiresAt,
      refreshableUntil,
      createdAt: now,
    });

    // Revoke old
    await this.sessionRepo.revoke(hash);
    return { token: rawToken, expiresAt };
  }
}
