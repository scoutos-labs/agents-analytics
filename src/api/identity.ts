import { Hono } from 'hono';
import type { IdentityService } from '../services/identity-service.js';
import { registerRateLimit } from '../middleware/rate-limit.js';

export function createIdentityRouter(service: IdentityService) {
  const app = new Hono();

  app.use(registerRateLimit);

  app.post('/register', async (c) => {
    const body = await c.req.json();
    try {
      const result = await service.register({
        publicKey: body.public_key,
        label: body.label || 'unnamed',
        metadata: body.metadata || {},
        signature: body.signature,
        timestamp: body.timestamp,
      });
      return c.json(result, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.get('/:entityId', async (c) => {
    try {
      const entity = await service.find(c.req.param('entityId'));
      if (!entity) return c.json({ error: 'Not found' }, 404);
      return c.json({
        id: entity.id,
        label: entity.label,
        metadata: entity.metadata,
        created_at: entity.createdAt,
        revoked_at: entity.revokedAt,
      });
    } catch (err: any) {
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  return app;
}
