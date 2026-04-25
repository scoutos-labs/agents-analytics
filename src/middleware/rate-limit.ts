import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getKey(identifier: string, windowMs: number): string {
  const bucket = Math.floor(Date.now() / windowMs);
  return `${identifier}:${bucket}`;
}

function isRateLimited(identifier: string, maxRequests: number, windowMs: number): boolean {
  const key = getKey(identifier, windowMs);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return true;
  }
  return false;
}

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

export function rateLimit(maxRequests: number, windowMs: number) {
  return createMiddleware(async (c: Context, next: Next) => {
    // Skip rate limiting in test environment to avoid cross-test interference
    if (process.env.NODE_ENV === 'test') {
      await next();
      return;
    }

    const entityId = c.get('entityId') as string | undefined;
    const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const identifier = entityId || clientIp;

    if (isRateLimited(identifier, maxRequests, windowMs)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    await next();
  });
}

// Convenience presets
export const eventsRateLimit = rateLimit(1000, 60_000);    // 1000 events per minute
export const sessionRateLimit = rateLimit(10, 60_000);     // 10 session starts per minute
export const registerRateLimit = rateLimit(10, 60_000);      // 10 registrations per minute
