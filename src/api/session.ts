import { Hono } from 'hono';
import type { SessionService } from '../services/session-service.js';
import { sessionRateLimit } from '../middleware/rate-limit.js';

export function createSessionRouter(service: SessionService) {
  const app = new Hono();

  app.use(sessionRateLimit);

  app.post('/', async (c) => {
    const body = await c.req.json();
    try {
      const result = await service.start({
        entityId: body.entity_id,
        nonce: body.nonce,
        timestamp: body.timestamp,
        signature: body.signature,
        ttlSeconds: body.ttl_seconds,
        scope: body.scope,
      });
      return c.json(result, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.post('/renew', async (c) => {
    const body = await c.req.json();
    try {
      const result = await service.renew(body.token);
      return c.json(result, 200);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return app;
}
