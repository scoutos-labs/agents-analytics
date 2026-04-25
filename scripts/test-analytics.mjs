#!/usr/bin/env node
/**
 * Test analytics queries - helper for debugging
 */
import http from 'http';

const token = process.argv[2];
const wsId = process.argv[3];

function req(path) {
  return new Promise((resolve) => {
    const r = http.request({ hostname: 'localhost', port: 3000, path, headers: { Authorization: 'Bearer ' + token } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    r.end();
  });
}

const now = new Date();
const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
const to = now.toISOString();

console.log('Testing workspace query with wsId:', wsId);
const wsPath = `/v1/analytics/timeseries?workspace_id=${wsId}&event_name=tool.invoke&from=${from}&to=${to}&interval=3600`;
console.log('Path:', wsPath);
const ws = await req(wsPath);
console.log('Workspace result:', JSON.stringify(ws, null, 2));

console.log('\nTesting entity query...');
const entPath = `/v1/analytics/timeseries?event_name=tool.invoke&from=${from}&to=${to}&interval=3600`;
const ent = await req(entPath);
console.log('Entity result:', JSON.stringify(ent, null, 2));
