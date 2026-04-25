import { Hono } from 'hono';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { SessionPort } from '../ports/session.js';
import type { DashboardPort } from '../ports/dashboard.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { randomToken } from '../adapters/crypto/ed25519.js';

export function createDashboardRouter(dashboardRepo: DashboardPort, sessionRepo: SessionPort) {
  const app = new Hono();
  const auth = createAuthMiddleware(sessionRepo);

  app.use(auth);

  app.post('/', async (c) => {
    const entityId = c.get('entityId') as string;
    const body = await c.req.json();

    const config = {
      id: `dash_${randomToken().slice(0, 12)}`,
      entityId,
      workspaceId: body.workspace_id || undefined,
      title: body.title || 'Dashboard',
      widgets: body.widgets || [],
      timeRange: body.time_range || { preset: 'last_24h' },
      refreshIntervalSeconds: body.refresh_interval_seconds || 60,
      createdAt: new Date(),
    };

    dashboardRepo.save(config);

    const baseUrl = process.env.PUBLIC_URL || `${new URL(c.req.url).origin}`;
    const signedUrl = `${baseUrl}/view/${config.id}?token=${c.req.query('token') || ''}`;

    return c.json({
      dashboard_id: config.id,
      signed_url: signedUrl,
      created_at: config.createdAt,
    }, 201);
  });

  app.get('/:id', async (c) => {
    const cfg = await dashboardRepo.findById(c.req.param('id'));
    if (!cfg) return c.json({ error: 'Not found' }, 404);
    return c.json(cfg);
  });

  return app;
}

// Standalone viewer route mounted at /view/:id
export function createViewerRoute(dashboardRepo: DashboardPort) {
  const app = new Hono();

  app.get('/:id', async (c) => {
    const htmlPath = resolve('public', 'dashboard', 'index.html');
    try {
      const html = await readFile(htmlPath, 'utf-8');
      return c.html(html);
    } catch {
      return c.text('Dashboard UI not built. Run dashboard build.', 404);
    }
  });

  return app;
}
