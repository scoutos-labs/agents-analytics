#!/usr/bin/env node
import http from 'http';
import fs from 'fs';

const PORT = process.env.PORT || '3000';
function req(path, token) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: 'localhost', port: PORT, path, headers: token ? { Authorization: `Bearer ${token}` } : {} }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    r.on('error', reject);
    r.end();
  });
}

const output = fs.readFileSync('/tmp/demo-output.txt', 'utf-8');
const lines = output.split('\n');
let token = '';
let wsId = '';
let dashUrl = '';

for (const line of lines) {
  if (line.includes('Admin Token:')) token = line.split('Admin Token:')[1].trim();
  if (line.includes('Workspace:')) wsId = line.split('Workspace:')[1].trim();
  if (line.includes('http://localhost')) dashUrl = line.trim();
}

console.log('TOKEN:', token.slice(0, 30) + '...');
console.log('WS_ID:', wsId);
console.log('DASH:', dashUrl);

const dashId = dashUrl.match(/view\/([a-z0-9_]+)/)?.[1];
console.log('DASH_ID:', dashId);

// Dashboard config
const dash = await req(`/v1/dashboards/${dashId}`, token);
console.log('\n1. Dashboard config workspaceId:', dash.workspaceId || 'MISSING');

// Analytics
const now = new Date();
const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
const to = now.toISOString();
const analytics = await req(`/v1/analytics/timeseries?workspace_id=${wsId}&event_name=tool.invoke&from=${from}&to=${to}&interval=3600`, token);
console.log('2. Workspace analytics points:', analytics.points?.length || 0);

// Entity analytics
const ent = await req(`/v1/analytics/timeseries?event_name=tool.invoke&from=${from}&to=${to}&interval=3600`, token);
console.log('3. Entity analytics points:', ent.points?.length || 0);
