import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { IdentityService } from '../services/identity-service.js';
import type { SessionService } from '../services/session-service.js';
import type { IngestionService } from '../services/ingestion-service.js';
import type { AnalyticsService } from '../services/analytics-service.js';
import type { WorkspaceService } from '../services/workspace-service.js';
import type { SessionPort } from '../ports/session.js';
import type { DashboardPort } from '../ports/dashboard.js';

import { createIdentityRouter } from './identity.js';
import { createSessionRouter } from './session.js';
import { createEventsRouter } from './events.js';
import { createAnalyticsRouter } from './analytics.js';
import { createDashboardRouter, createViewerRoute } from './dashboard.js';
import { createOpenApiRouter } from './openapi.js';
import { createWorkspaceRouter } from './workspace.js';

export interface ApiDeps {
  identityService: IdentityService;
  sessionService: SessionService;
  ingestionService: IngestionService;
  analyticsService: AnalyticsService;
  workspaceService: WorkspaceService;
  sessionRepo: SessionPort;
  dashboardRepo: DashboardPort;
}

export function createApp(deps: ApiDeps) {
  const app = new Hono();

  // Health
  app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

  // Landing page
  app.get('/', serveStatic({ path: './landing/index.html' }));
  app.use('/landing/*', serveStatic({ root: './' }));

  // API v1
  app.route('/v1/identity', createIdentityRouter(deps.identityService));
  app.route('/v1/session', createSessionRouter(deps.sessionService));
  app.route('/v1/events', createEventsRouter(deps.ingestionService, deps.sessionRepo));
  app.route('/v1/analytics', createAnalyticsRouter(deps.analyticsService, deps.sessionRepo));
  app.route('/v1/dashboards', createDashboardRouter(deps.dashboardRepo, deps.sessionRepo));
  app.route('/v1/workspaces', createWorkspaceRouter(deps.workspaceService, deps.sessionRepo));
  app.route('/v1', createOpenApiRouter());

  // Dashboard viewer + static assets
  app.route('/view', createViewerRoute(deps.dashboardRepo));
  app.use('/assets/*', serveStatic({ root: './public/dashboard' }));

  return app;
}
