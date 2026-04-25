import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';

const MAX_BODY_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function bodySizeLimit(maxBytes: number = MAX_BODY_SIZE_BYTES) {
  return createMiddleware(async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length');

    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > maxBytes) {
        return c.json({ error: 'Request body too large' }, 413);
      }
    }

    await next();
  });
}
