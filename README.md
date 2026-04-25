# AgentSig Analytics

An agent-native telemetry and analytics platform. Any entity with an Ed25519 keypair can register, obtain a session token, and begin streaming structured events. Data is stored in SQLite (ports-and-adapters ready for Postgres/ClickHouse). A Svelte dashboard renders time-series charts via embeddable signed URLs.

## Architecture

- **Identity Service** – Ed25519 public-key registration with signed challenges.
- **Session Service** – Time-bound bearer tokens, renewable without re-signing every request.
- **Ingestion Service** – Batch event acceptance with ±5min clock-drift tolerance.
- **Analytics Service** – SQLite-backed time-series rollups with JSON dimension extraction.
- **Dashboard Viewer** – Svelte SPA served at `/view/:dashboardId` using Chart.js.

## Quick Start

```bash
# Install dependencies
npm install

# (Optional) Run DB migrations manually
npm run db:migrate

# Start dev server
npm run dev
```

## Docker

```bash
docker compose up --build
```

SQLite is mounted on a persistent volume at `/data` inside the container.

## API Walkthrough

### 1. Generate a keypair

Use Node.js native `crypto`:

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

### 5. Create a dashboard

```bash
curl -X POST "http://localhost:3000/v1/dashboards?token=sess_..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agent Overview",
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

Returns a `signed_url` you can open in a browser or embed in an iframe.

## Ports & Adapters

All database access is behind interfaces in `src/ports/`. To swap SQLite for Postgres:

1. Implement `IdentityPort`, `SessionPort`, `EventPort`, `DashboardPort` for Postgres.
2. Swap the import in `src/index.ts`.
3. Zero changes to services or HTTP routes.

## Deployment (Railway / K8s)

The included `Dockerfile` is multi-stage and production-ready. Mount a persistent volume at `/data` for SQLite durability.

- **Railway**: Add a volume mount at `/data`. Set `PUBLIC_URL` to your Railway domain.
- **Kubernetes**: Use a `PersistentVolumeClaim` at `/data` and expose port `3000`.
