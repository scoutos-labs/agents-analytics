import { Hono } from 'hono';
import type { IngestionService } from '../services/ingestion-service.js';
import type { SessionPort } from '../ports/session.js';
import { createAuthMiddleware } from '../middleware/auth.js';

export function createEventsRouter(service: IngestionService, sessionRepo: SessionPort) {
  const app = new Hono();
  const auth = createAuthMiddleware(sessionRepo);

  app.use(auth);

  app.post('/', async (c) => {
    const body = await c.req.json();
    const entityId = c.get('entityId') as string;

    try {
      const result = await service.submit({
        entityId,
        events: body.events || [],
      });
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return app;
}
