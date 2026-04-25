#!/usr/bin/env node
/**
 * Generate a full workspace demo with multiple agents.
 * Run: PORT=4444 node scripts/generate-workspace-demo.mjs
 *
 * Environment:
 *   PORT        - Server port (default: 3000)
 *   API_BASE    - Full base URL (default: http://localhost:${PORT})
 *
 * Creates:
 *  - 1 admin entity
 *  - 1 workspace ("Operations Team")
 *  - 5 agent entities (invoice-bot, scraper, rpa-bot, security-auditor, compliance-checker)
 *  - ~4,000 events across all agents
 *  - 1 workspace-level fleet dashboard
 */

import crypto from 'crypto';
import http from 'http';

const API_BASE = process.env.API_BASE || `http://localhost:${PORT}`;
const PORT = process.env.PORT || '3000';

function request(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

function generateKeypair() {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function sign(message, privateKey) {
  return crypto.sign(null, Buffer.from(message, 'utf-8'), privateKey).toString('base64');
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function registerEntity(name, label) {
  const { publicKey, privateKey } = generateKeypair();
  const timestamp = new Date().toISOString();
  const metadata = { env: 'production', team: 'operations' };
  const regMessage = JSON.stringify({ publicKey, label, metadata, timestamp });
  const regSignature = sign(regMessage, privateKey);

  const reg = await request('/v1/identity/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { public_key: publicKey, label, metadata, signature: regSignature, timestamp },
  });

  if (reg.status !== 201) {
    throw new Error(`Failed to register ${name}: ${JSON.stringify(reg.body)}`);
  }

  return { entityId: reg.body.entityId, publicKey, privateKey, label };
}

async function startSession(entityId, privateKey) {
  const nonce = 'demo-' + Math.random().toString(36).slice(2);
  const timestamp = new Date().toISOString();
  const message = `${entityId}:${nonce}:${timestamp}`;
  const signature = sign(message, privateKey);

  const sess = await request('/v1/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { entity_id: entityId, nonce, timestamp, signature, ttl_seconds: 86400 },
  });

  if (sess.status !== 201) {
    throw new Error(`Failed to start session: ${JSON.stringify(sess.body)}`);
  }

  return sess.body.token;
}

async function submitEvents(entityId, token, eventCount = 100) {
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const tools = ['web_scrape', 'api_call', 'db_query', 'file_read', 'ocr_parse'];
  const statuses = ['success', 'success', 'success', 'success', 'retry', 'timeout', 'error'];

  const events = [];

  // Agent-specific event patterns
  const agentType = entityId.slice(-3); // rough hash
  const skew = entityId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 1000; // per-agent noise

  for (let i = 0; i < eventCount; i++) {
    const t = now - rand(0, 2 * DAY) - skew;
    const isError = Math.random() > 0.9;
    events.push({
      timestamp: new Date(t).toISOString(),
      name: isError ? 'error' : pick(['tool.invoke', 'tool.invoke', 'tool.invoke', 'purchase', 'login']),
      value: isError ? 1 : rand(50 + skew, 800 + skew),
      dimensions: {
        tool: pick(tools),
        status: isError ? 'error' : pick(statuses),
        region: pick(['us-east', 'eu-west', 'asia-south']),
        model: pick(['gpt-4', 'claude-3', 'local-llama']),
        agent: entityId,
      },
    });
  }

  // Submit in batches of 500
  for (let i = 0; i < events.length; i += 500) {
    const batch = events.slice(i, i + 500);
    const res = await request('/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: { events: batch },
    });
    if (res.status !== 200) {
      console.error(`Batch failed for ${entityId}:`, res.body);
    }
  }
}

// === Main Demo Flow ===
console.log('🚀 Generating workspace demo...\n');

// 1. Create admin entity
console.log('Creating admin entity...');
const admin = await registerEntity('admin', 'ops-admin');
const adminToken = await startSession(admin.entityId, admin.privateKey);
console.log(`  Admin: ${admin.entityId}`);

// 2. Create workspace
console.log('Creating workspace...');
const wsRes = await request('/v1/workspaces', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
  body: {
    name: 'Operations Team',
    slug: 'ops-team',
    description: 'Multi-agent fleet for invoice processing, scraping, compliance',
  },
});
const workspaceId = wsRes.body.workspaceId;
console.log(`  Workspace: ${workspaceId}`);

// 3. Create agents and add to workspace
const agentDefs = [
  { name: 'invoice-bot', label: 'Invoice Processor' },
  { name: 'scraper', label: 'Web Scraper' },
  { name: 'rpa-bot', label: 'RPA Operator' },
  { name: 'security-auditor', label: 'Security Auditor' },
  { name: 'compliance-checker', label: 'Compliance Checker' },
];

const agents = [];
for (const def of agentDefs) {
  console.log(`Creating agent: ${def.name}...`);
  const agent = await registerEntity(def.name, def.label);
  const token = await startSession(agent.entityId, agent.privateKey);
  agents.push({ ...agent, token });

  // Add to workspace
  await request(`/v1/workspaces/${workspaceId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: { entity_id: agent.entityId, role: 'member' },
  });
}

// 4. Generate events for all agents
console.log('\nGenerating events...');
for (const agent of agents) {
  console.log(`  ${agent.label}...`);
  await submitEvents(agent.entityId, agent.token, 800);
}
console.log(' Events generated!\n');

// 5. Create workspace dashboard
console.log('Creating workspace dashboard...');
const dashRes = await request(`/v1/dashboards?token=${encodeURIComponent(adminToken)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: {
    title: '🏢 Operations Fleet Dashboard',
    workspace_id: workspaceId,
    widgets: [
      {
        type: 'timeseries_line',
        title: 'Tool Invocations by Agent',
        query: { eventName: 'tool.invoke', aggregation: 'count', groupBy: 'agent' },
      },
      {
        type: 'timeseries_line',
        title: 'Errors by Region',
        query: { eventName: 'error', aggregation: 'count', groupBy: 'region' },
      },
      {
        type: 'timeseries_line',
        title: 'Purchases ($)',
        query: { eventName: 'purchase', aggregation: 'sum' },
      },
      {
        type: 'timeseries_line',
        title: 'Avg Latency by Model',
        query: { eventName: 'tool.invoke', aggregation: 'avg', groupBy: 'model' },
      },
    ],
    time_range: { preset: 'last_7d' },
    refresh_interval_seconds: 30,
  },
});

if (dashRes.status !== 201) {
  console.error('Dashboard creation failed:', dashRes.body);
} else {
  console.log(`\n✅ DONE!`);
  console.log(`\nWorkspace:  ${workspaceId}`);
  console.log(`Admin:       ${admin.entityId}`);
  console.log(`Admin Token: ${adminToken}`);
  console.log(`Agents:      ${agents.map(a => a.label).join(', ')}`);
  console.log(`\n📊 WORKSPACE DASHBOARD:`);
  console.log(`   ${dashRes.body.signed_url}\n`);
  console.log(`Or via API:`);
  console.log(`   GET /v1/analytics/timeseries?workspace_id=${workspaceId}&event_name=tool.invoke&...`);
}
