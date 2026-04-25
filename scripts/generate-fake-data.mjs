#!/usr/bin/env node
/**
 * Generate fake telemetry data for AgentSig Analytics demo.
 * Run: node scripts/generate-fake-data.mjs
 * Then visit the printed dashboard URL.
 */

import crypto from 'crypto';
import http from 'http';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const PORT = process.env.AGENTSIG_PORT || '3000';

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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
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

// --- 1. Register entity ---
const { publicKey, privateKey } = generateKeypair();
const timestamp = new Date().toISOString();
const label = 'invoice-bot-prod';
const metadata = { team: 'finance', version: '2.4.1' };
const regMessage = JSON.stringify({ publicKey, label, metadata, timestamp });
const regSignature = sign(regMessage, privateKey);

console.log('Registering entity...');
const reg = await request('/v1/identity/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { public_key: publicKey, label, metadata, signature: regSignature, timestamp },
});

if (reg.status !== 201) {
  console.error('Registration failed:', reg.status, reg.body);
  process.exit(1);
}

const { entityId } = JSON.parse(reg.body);
console.log(`  Entity: ${entityId}`);

// --- 2. Start session ---
const nonce = 'demo-' + Math.random().toString(36).slice(2);
const sessTimestamp = new Date().toISOString();
const sessMessage = `${entityId}:${nonce}:${sessTimestamp}`;
const sessSignature = sign(sessMessage, privateKey);

console.log('Starting session...');
const sess = await request('/v1/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: {
    entity_id: entityId,
    nonce,
    timestamp: sessTimestamp,
    signature: sessSignature,
    ttl_seconds: 86400,
  },
});

if (sess.status !== 201) {
  console.error('Session failed:', sess.status, sess.body);
  process.exit(1);
}

const { token } = JSON.parse(sess.body);
console.log(`  Token: ${token.slice(0, 20)}...`);

// --- 3. Generate fake events ---
const now = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const events = [];
const tools = ['web_scrape', 'api_call', 'db_query', 'file_read', 'ocr_parse'];
const statuses = ['success', 'success', 'success', 'success', 'retry', 'timeout', 'error'];

// Generate 48 hours of data, one event every ~3 minutes
for (let t = now - 2 * DAY; t < now; t += rand(100, 300) * 1000) {
  const isError = Math.random() > 0.85;
  events.push({
    timestamp: new Date(t).toISOString(),
    name: isError ? 'error' : 'tool.invoke',
    value: isError ? 1 : rand(50, 800),
    dimensions: {
      tool: pick(tools),
      status: isError ? 'error' : pick(statuses),
      region: pick(['us-east', 'eu-west', 'asia-south']),
      model: pick(['gpt-4', 'claude-3', 'local-llama']),
    },
  });
}

// Add some purchase events with dollar amounts
for (let t = now - 2 * DAY; t < now; t += rand(2, 6) * HOUR) {
  events.push({
    timestamp: new Date(t).toISOString(),
    name: 'purchase',
    value: rand(10, 500),
    dimensions: { currency: 'USD', vendor: pick(['stripe', 'paddle', 'gumroad']) },
  });
}

console.log(`Submitting ${events.length} events...`);

// Submit in batches of 500
const BATCH = 500;
for (let i = 0; i < events.length; i += BATCH) {
  const batch = events.slice(i, i + BATCH);
  const res = await request('/v1/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: { events: batch },
  });
  if (res.status !== 200) {
    console.error(`Batch ${i / BATCH} failed:`, res.status, res.body);
  }
  process.stdout.write('.');
}
console.log(' Done');

// --- 4. Create dashboard ---
console.log('Creating dashboard...');
const dashRes = await request(`/v1/dashboards?token=${encodeURIComponent(token)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: {
    title: '🤖 Invoice Bot — Live Telemetry',
    widgets: [
      {
        type: 'timeseries_line',
        title: 'Tool Invocations',
        query: { eventName: 'tool.invoke', aggregation: 'count', groupBy: 'tool' },
      },
      {
        type: 'timeseries_line',
        title: 'Tool Latency (ms avg)',
        query: { eventName: 'tool.invoke', aggregation: 'avg' },
      },
      {
        type: 'timeseries_line',
        title: 'Errors',
        query: { eventName: 'error', aggregation: 'count', groupBy: 'status' },
      },
      {
        type: 'timeseries_line',
        title: 'Purchases ($)',
        query: { eventName: 'purchase', aggregation: 'sum' },
      },
    ],
    time_range: { preset: 'last_7d' },
    refresh_interval_seconds: 30,
  },
});

if (dashRes.status !== 201) {
  console.error('Dashboard failed:', dashRes.status, dashRes.body);
  process.exit(1);
}

const dash = JSON.parse(dashRes.body);
console.log(`\n✅ Done!`);
console.log(`\nEntity ID:  ${entityId}`);
console.log(`Session:    ${token}`);
console.log(`\n📊 OPEN DASHBOARD:`);
console.log(`   ${dash.signed_url}\n`);
