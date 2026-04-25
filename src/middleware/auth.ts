import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import type { SessionPort } from '../ports/session.js';
import { sha256 } from '../adapters/crypto/ed25519.js';

export function createAuthMiddleware(sessionRepo: SessionPort) {
  return createMiddleware(async (c: Context, next: Next) => {
    const header = c.req.header('authorization');
    let token = header?.replace(/^Bearer\s+/i, '');
    if (!token) {
      token = c.req.query('token') || '';
    }

    if (!token) {
      return c.json({ error: 'Missing token' }, 401);
    }

    const hash = sha256(token);
    const session = await sessionRepo.findByTokenHash(hash);
    if (!session) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const now = new Date();
    if (now > session.expiresAt) {
      return c.json({ error: 'Session expired' }, 401);
    }

    c.set('entityId', session.entityId);
    c.set('scope', session.scope);
    await next();
  });
}
