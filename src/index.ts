import { serve } from '@hono/node-server';
import { migrate } from './adapters/sqlite/migrations.js';
import { SqliteIdentityRepo } from './adapters/sqlite/identity-repo.js';
import { SqliteSessionRepo } from './adapters/sqlite/session-repo.js';
import { SqliteEventRepo } from './adapters/sqlite/event-repo.js';
import { SqliteDashboardRepo } from './adapters/sqlite/dashboard-repo.js';
import { SqliteWorkspaceRepo } from './adapters/sqlite/workspace-repo.js';

import { IdentityService } from './services/identity-service.js';
import { SessionService } from './services/session-service.js';
import { IngestionService } from './services/ingestion-service.js';
import { AnalyticsService } from './services/analytics-service.js';
import { WorkspaceService } from './services/workspace-service.js';

import { createApp } from './api/index.js';

// Run migrations on startup
migrate();

// Adapters (ports implemented)
const identityRepo = new SqliteIdentityRepo();
const sessionRepo = new SqliteSessionRepo();
const eventRepo = new SqliteEventRepo();
const dashboardRepo = new SqliteDashboardRepo();
const workspaceRepo = new SqliteWorkspaceRepo();

// Services
const identityService = new IdentityService(identityRepo);
const sessionService = new SessionService(sessionRepo, identityRepo);
const ingestionService = new IngestionService(eventRepo);
const analyticsService = new AnalyticsService(eventRepo);
const workspaceService = new WorkspaceService(workspaceRepo, identityRepo);

// App
const app = createApp({
  identityService,
  sessionService,
  ingestionService,
  analyticsService,
  workspaceService,
  sessionRepo,
  dashboardRepo,
});

const port = parseInt(process.env.PORT || '3000', 10);

serve({
  fetch: app.fetch,
  port,
});

console.log(`AgentSig analytics running on port ${port}`);

// Prune expired sessions every 5 minutes
setInterval(() => {
  const n = sessionRepo.pruneExpired();
  if (n > 0) console.log(`Pruned ${n} expired sessions`);
}, 5 * 60 * 1000);
