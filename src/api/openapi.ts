import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export function createOpenApiRouter() {
  const app = new Hono();

  app.get('/openapi.yaml', (c) => {
    const yaml = readFileSync(resolve('openapi.yaml'), 'utf-8');
    return c.body(yaml, 200, { 'Content-Type': 'text/yaml' });
  });

  app.get('/docs', (c) => {
    const url = new URL(c.req.url);
    const yamlUrl = `${url.protocol}//${url.host}/v1/openapi.yaml`;
    const html = `
<!DOCTYPE html>
<html><head>
<title>AgentSig API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({ url: '${yamlUrl}', dom_id: '#swagger-ui', presets: [SwaggerUIBundle.presets.apis] });
</script>
</body></html>
`;
    return c.html(html);
  });

  return app;
}
