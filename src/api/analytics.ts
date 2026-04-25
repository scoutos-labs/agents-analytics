import { Hono } from 'hono';
import type { AnalyticsService } from '../services/analytics-service.js';
import type { SessionPort } from '../ports/session.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { EventPort } from '../ports/events.js';

export interface AnalyticsDeps {
  analyticsService: AnalyticsService;
  eventRepo: EventPort;
  sessionRepo: SessionPort;
}

export function createAnalyticsRouter(deps: AnalyticsDeps) {
  const app = new Hono();
  const auth = createAuthMiddleware(deps.sessionRepo);

  app.use(auth);

  app.get('/timeseries', async (c) => {
    const entityId = c.get('entityId') as string;
    const query = c.req.query();

    try {
      const result = await deps.analyticsService.timeseries({
        entityId: query.entity_id || entityId,
        workspaceId: query.workspace_id,
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

  app.get('/discover', async (c) => {
    const entityId = c.get('entityId') as string;
    const workspaceId = c.req.query('workspace_id');

    try {
      const result = await deps.analyticsService.discover({
        entityId: workspaceId ? undefined : entityId,
        workspaceId,
      });
      return c.json(result);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return app;
}
