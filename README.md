# AgentSig Analytics

An agent-native telemetry and analytics platform. Any entity with an Ed25519 keypair can register, obtain a session token, stream structured events, and get real-time dashboards — solo or as part of a fleet.

Built on **portable identity** (no passwords, no OAuth) and **workspace-level analytics** so you can observe one agent or an entire organization.

## Architecture

| Layer | What it does |
|-------|-------------|
| **Identity Service** | Ed25519 public-key registration with signed challenges. No accounts database. |
| **Session Service** | Short-lived bearer tokens, renewable without re-signing every request. |
| **Ingestion Service** | Batch event acceptance with ±5min clock-drift tolerance. |
| **Analytics Service** | SQLite-native time-series rollups with JSON dimension extraction. Count, sum, avg, group-by. |
| **Discovery API** | Ask the system "what events and dimensions exist?" then auto-generate dashboards. |
| **Workspace Service** | Multi-tenant organizations. Aggregate data across a fleet of agents. |
| **Dashboard Viewer** | Svelte SPA with Chart.js. Embeddable via signed URLs. |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build the dashboard UI
cd dashboard && npm ci && npm run build && cd ..

# 3. Compile TypeScript
npm run build

# 4. Start server
PORT=3000 node dist/index.js

# 5. Generate demo workspace data
PORT=3000 node scripts/generate-workspace-demo.mjs
# Open the printed URL in your browser
```

## Docker

```bash
docker compose up --build
```

SQLite is mounted on a persistent volume at `/data` inside the container.

## API Walkthrough

### 1. Generate a keypair

```js
import { generateKeypair } from './src/adapters/crypto/ed25519.js';
const { publicKey, privateKey } = generateKeypair();
```

### 2. Register an entity

```bash
curl -X POST http://localhost:3000/v1/identity/register \
  -H "Content-Type: application/json" \
  -d '{
    "public_key": "-----BEGIN PUBLIC KEY-----\nMCow...",
    "label": "invoice-bot",
    "metadata": {"team":"finance"},
    "signature": "base64signature",
    "timestamp": "2026-04-25T12:00:00Z"
  }'
```

Returns `{ "entityId": "ent_..." }`.

### 3. Start a session

```bash
curl -X POST http://localhost:3000/v1/session \
  -H "Content-Type: application/json" \
  -d '{
    "entity_id": "ent_...",
    "nonce": "random-string",
    "timestamp": "2026-04-25T12:00:00Z",
    "signature": "base64signature-of(entity_id:nonce:timestamp)",
    "ttl_seconds": 3600
  }'
```

Returns `{ "token": "sess_...", "expiresAt": "..." }`. Use this token as `Authorization: Bearer sess_...`.

### 4. Submit events

```bash
curl -X POST http://localhost:3000/v1/events \
  -H "Authorization: Bearer sess_..." \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {"timestamp": "2026-04-25T12:01:00Z", "name": "tool.invoke", "value": 1, "dimensions": {"tool": "web_scrape"}}
    ]
  }'
```

### 5. Create a workspace (optional — for fleet view)

```bash
# Create workspace (admin is auto-added)
curl -X POST http://localhost:3000/v1/workspaces \
  -H "Authorization: Bearer sess_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Operations","slug":"ops"}'
# Returns { "workspaceId": "ws_..." }

# Add other agents to workspace
curl -X POST http://localhost:3000/v1/workspaces/ws_.../members \
  -H "Authorization: Bearer sess_..." \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"ent_other_agent","role":"member"}'
```

### 6. Discover what data exists (auto-discovery)

```bash
# Before building a dashboard, ask what events and dimensions are available
curl -s "http://localhost:3000/v1/analytics/discover?workspace_id=ws_..." \
  -H "Authorization: Bearer sess_..."
```

Returns a map of event names, dimensions, and entity counts so you can generate dashboards programmatically rather than hardcoding widget configurations.

### 7. Create a dashboard

```bash
curl -X POST "http://localhost:3000/v1/dashboards?token=sess_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agent Overview",
    "workspace_id": "ws_...",
    "widgets": [
      {
        "type": "timeseries_line",
        "title": "Tool Invocations",
        "query": {"eventName": "tool.invoke", "aggregation": "count", "groupBy": "tool"}
      }
    ],
    "time_range": {"preset": "last_24h"},
    "refresh_interval_seconds": 60
  }'
```

Returns a `signed_url` you can open in a browser or embed in an iframe. Workspace dashboards aggregate data across all member agents.

## Key endpoints

| Endpoint | What it does |
|----------|-------------|
| `POST /v1/identity/register` | Register an entity with Ed25519 key |
| `POST /v1/session` | Start a session (get bearer token) |
| `POST /v1/events` | Batch event submission |
| `GET /v1/analytics/timeseries` | Query time-series aggregations |
| `GET /v1/analytics/discover` | Discover event names and dimensions |
| `POST /v1/dashboards` | Create embeddable dashboard |
| `POST /v1/workspaces` | Create a workspace |
| `POST /v1/workspaces/:id/members` | Add agent to workspace |

Full OpenAPI 3.0 spec at `/v1/openapi.yaml` and interactive Swagger UI at `/v1/docs`.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/generate-fake-data.mjs` | Single agent demo (~800 events) |
| `scripts/generate-workspace-demo.mjs` | Multi-agent fleet demo (5 agents, ~4,000 events, 1 workspace) |
| `scripts/test-e2e.mjs` | End-to-end validation |

## Testing

```bash
npm test              # Run all 76 tests
npm run test:watch    # Watch mode
```

Covers crypto, identity, session, ingestion, analytics, workspace services, middleware, and full HTTP integration.

## Ports & Adapters

All database access is behind interfaces in `src/ports/`. To swap SQLite for Postgres or ClickHouse:

1. Implement `IdentityPort`, `SessionPort`, `EventPort`, `DashboardPort`, `WorkspacePort` for your database.
2. Swap the import in `src/index.ts`.
3. Zero changes to services or HTTP routes.

## Deployment

The included `Dockerfile` is multi-stage and production-ready. Mount a persistent volume at `/data` for SQLite durability.

- **Railway / Render**: The `render.yaml` blueprint configures Docker deployment with a persistent disk.
- **Kubernetes**: Use a `PersistentVolumeClaim` at `/data` and expose port `3000`.

## Resources

- **Repo**: https://github.com/scoutos-labs/agents-analytics
- **OpenAPI**: `GET /v1/openapi.yaml` (when running)
- **API Docs**: `GET /v1/docs` (Swagger UI)
- **Landing**: `GET /` (marketing page)
