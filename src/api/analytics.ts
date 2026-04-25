import { Hono } from 'hono';
import type { AnalyticsService } from '../services/analytics-service.js';
import type { SessionPort } from '../ports/session.js';
import { createAuthMiddleware } from '../middleware/auth.js';

export function createAnalyticsRouter(service: AnalyticsService, sessionRepo: SessionPort) {
  const app = new Hono();
  const auth = createAuthMiddleware(sessionRepo);

  app.use(auth);

  app.get('/timeseries', async (c) => {
    const entityId = c.get('entityId') as string;
    const query = c.req.query();

    try {
      const result = await service.timeseries({
        entityId,
        eventName: query.event_name,
        from: query.from,
        to: query.to,
        intervalSeconds: query.interval ? parseInt(query.interval) : 3600,
        aggregation: (query.aggregation as any) || 'count',
        groupBy: query.group_by,
      });
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return app;
}
