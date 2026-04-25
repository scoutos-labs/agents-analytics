import { Hono } from 'hono';
import type { WorkspaceService } from '../services/workspace-service.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import type { SessionPort } from '../ports/session.js';

export function createWorkspaceRouter(workspaceService: WorkspaceService, sessionRepo: SessionPort) {
  const app = new Hono();
  const auth = createAuthMiddleware(sessionRepo);

  app.use(auth);

  app.post('/', async (c) => {
    const body = await c.req.json();
    const entityId = c.get('entityId') as string;

    try {
      const result = await workspaceService.create({
        name: body.name,
        slug: body.slug,
        description: body.description,
        createdBy: entityId,
      });
      return c.json(result, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.get('/', async (c) => {
    const entityId = c.get('entityId') as string;
    try {
      const workspaces = await workspaceService.listForEntity(entityId);
      return c.json({ workspaces });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.get('/:id', async (c) => {
    const ws = await workspaceService.getWorkspace(c.req.param('id'));
    if (!ws) return c.json({ error: 'Not found' }, 404);
    return c.json(ws);
  });

  app.get('/:id/members', async (c) => {
    try {
      const members = await workspaceService.getMembers(c.req.param('id'));
      return c.json({ members });
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  app.post('/:id/members', async (c) => {
    const body = await c.req.json();
    const adminId = c.get('entityId') as string;
    try {
      await workspaceService.addMember(c.req.param('id'), adminId, body.entity_id, body.role || 'member');
      return c.json({ ok: true }, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  return app;
}
