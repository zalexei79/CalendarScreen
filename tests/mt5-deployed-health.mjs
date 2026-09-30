// Read-only deployment checks. Only the public browser key is sent; no user session or trade import.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const env = fs.readFileSync('.env.local', 'utf8');
const value = name => env.split(/\r?\n/).map(line => line.trim()).find(line => line.startsWith(name + '='))?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '');
const url = value('VITE_SUPABASE_URL') + '/functions/v1/mt5';
const key = value('VITE_SUPABASE_ANON_KEY');
assert.ok(key);
const options = await fetch(url, { method: 'OPTIONS', signal: AbortSignal.timeout(20000) });
assert.equal(options.status, 200);
console.log('Deployed MT5 preflight: PASS');
const denied = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ action: 'status' }) });
assert.equal(denied.status, 410);
assert.equal((await denied.json()).error, 'CLOUD_DISABLED');
console.log('Paid cloud integration disabled: PASS');
