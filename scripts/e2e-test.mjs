import crypto from 'crypto';
import http from 'http';

function request(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

// Generate keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const timestamp = new Date().toISOString();

// Register
const canonical = JSON.stringify({ publicKey, label: 'test-agent', metadata: {}, timestamp });
const signature = crypto.sign(null, Buffer.from(canonical), privateKey).toString('base64');

console.log('Registering...');
const reg = await request('/v1/identity/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { public_key: publicKey, label: 'test-agent', metadata: {}, signature, timestamp },
});
console.log('Register:', reg.status, reg.body);
const { entityId } = JSON.parse(reg.body);

// Start session
const nonce = 'nonce-' + Math.random().toString(36).slice(2);
const sessionMsg = `${entityId}:${nonce}:${timestamp}`;
const sessionSig = crypto.sign(null, Buffer.from(sessionMsg), privateKey).toString('base64');

console.log('Starting session...');
const sess = await request('/v1/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { entity_id: entityId, nonce, timestamp, signature: sessionSig, ttl_seconds: 3600 },
});
console.log('Session:', sess.status, sess.body);
const { token } = JSON.parse(sess.body);

// Submit event
console.log('Submitting event...');
const ev = await request('/v1/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: {
    events: [
      { timestamp: new Date().toISOString(), name: 'tool.invoke', value: 1, dimensions: { tool: 'scrape' } },
    ],
  },
});
console.log('Event:', ev.status, ev.body);

// Create dashboard
console.log('Creating dashboard...');
const dash = await request('/v1/dashboards?token=' + encodeURIComponent(token), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: {
    title: 'Agent Overview',
    widgets: [{ type: 'timeseries_line', title: 'Invocations', query: { eventName: 'tool.invoke', aggregation: 'count' } }],
    time_range: { preset: 'last_24h' },
    refresh_interval_seconds: 60,
  },
});
console.log('Dashboard:', dash.status, dash.body);

// Query analytics
console.log('Querying analytics...');
const now = new Date();
const from = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
const to = now.toISOString();
const analytics = await request(`/v1/analytics/timeseries?event_name=tool.invoke&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&interval=60`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('Analytics:', analytics.status, analytics.body);
