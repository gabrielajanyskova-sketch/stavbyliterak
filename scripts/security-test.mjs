// Run: node --experimental-vm-modules scripts/security-test.mjs
// Exercise the actual API against SQLite, including concurrent requests.
import { readFileSync } from 'node:fs';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { test } from 'node:test';

let writes = 0;
const exportsOf = (values) => new SyntheticModule(Object.keys(values), function () {
  for (const [key, value] of Object.entries(values)) this.setExport(key, value);
});
const render = exportsOf({ BLOCK_TYPES: [], esc: String, catalogItems: () => [], money: Number, maxCount: () => 1 });
const dbModule = exportsOf({
  getSite: async () => ({}), getPages: async () => [],
  saveSite: async () => { writes++; }, savePage: async () => {}, renamePage: async () => {},
  deletePage: async () => {}, reorderPages: async () => {},
});
const api = new SourceTextModule(readFileSync(new URL('../functions/_lib/api.js', import.meta.url), 'utf8'));
await api.link((name) => name === './render.js' ? render : dbModule);
await api.evaluate();
const { handleApi } = api.namespace;
function environment() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE login_attempts (ip TEXT PRIMARY KEY, attempt_count INTEGER, window_start TEXT);
    CREATE TABLE login_codes (login_id TEXT PRIMARY KEY, code TEXT, expires_at TEXT, attempts INTEGER DEFAULT 0);
    CREATE TABLE admin_sessions (token TEXT PRIMARY KEY, expires_at TEXT);`);
  return {
    ADMIN_PASSWORD: 'test-only', sql,
    DB: { prepare(query) {
      let args = [];
      return { bind(...values) { args = values; return this; },
        async first() { await new Promise(setImmediate); return sql.prepare(query).get(...args) || null; },
        async run() { await new Promise(setImmediate); return sql.prepare(query).run(...args); } };
    } },
  };
}
function call(env, path, value, { raw = false, token, method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return handleApi(new Request('https://example.test' + path, { method, headers, body: raw ? value : JSON.stringify(value) }), env, path);
}
function code(env, expires = Date.now() + 60000) {
  env.sql.prepare('INSERT INTO login_codes VALUES (?, ?, ?, 0)').run('challenge', '123456', new Date(expires).toISOString());
}
test('parallel login requests cannot exceed eight password attempts', async () => {
  const env = environment();
  const responses = await Promise.all(Array.from({ length: 30 }, () => call(env, '/api/admin/login', { password: 'wrong' })));
  assert.equal(responses.filter(r => r.status === 401).length, 8);
  assert.equal(responses.filter(r => r.status === 429).length, 22);
});
test('expired rate-limit window permits attempts again', async () => {
  const env = environment();
  env.sql.prepare('INSERT INTO login_attempts VALUES (?, 8, ?)').run('192.0.2.1', new Date(Date.now() - 16 * 60000).toISOString());
  assert.equal((await call(env, '/api/admin/login', { password: 'wrong' })).status, 401);
});
test('parallel valid OTP requests issue exactly one session', async () => {
  const env = environment(); code(env);
  const responses = await Promise.all(Array.from({ length: 20 }, () => call(env, '/api/admin/verify-code', { loginId: 'challenge', code: '123456' })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM admin_sessions').get().n, 1);
});
test('five wrong OTP attempts exhaust the challenge, also concurrently', async () => {
  const env = environment(); code(env);
  await Promise.all(Array.from({ length: 20 }, () => call(env, '/api/admin/verify-code', { loginId: 'challenge', code: 'wrong' })));
  assert.equal(env.sql.prepare('SELECT attempts FROM login_codes').get().attempts, 5);
  assert.equal((await call(env, '/api/admin/verify-code', { loginId: 'challenge', code: '123456' })).status, 401);
});
test('expired OTP cannot create a session', async () => {
  const env = environment(); code(env, Date.now() - 1000);
  assert.equal((await call(env, '/api/admin/verify-code', { loginId: 'challenge', code: '123456' })).status, 401);
});
test('malformed or nonobject JSON cannot overwrite site settings', async () => {
  const env = environment();
  env.sql.prepare('INSERT INTO admin_sessions VALUES (?, ?)').run('test-session', new Date(Date.now() + 60000).toISOString());
  for (const value of ['{', 'null', '[]', '42']) {
    assert.equal((await call(env, '/api/admin/site', value, { raw: true, method: 'PUT', token: 'test-session' })).status, 400);
  }
  assert.equal(writes, 0);
  assert.equal((await call(env, '/api/admin/site', {}, { method: 'PUT', token: 'test-session' })).status, 200);
  assert.equal(writes, 1);
});
test('null contact input returns a client error', async () => {
  assert.equal((await call(environment(), '/api/contact', null)).status, 400);
});

test('rental quote ignores stale responses and clears price during changes', async () => {
  const { runInNewContext } = await import('node:vm');
  const source = readFileSync(new URL('../public/assets/js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('    let quoteTimer;');
  const end = source.indexOf('    // upozornění', start);
  const nodes = new Map();
  const priceBox = { hidden: true, querySelector(key) { if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); } };
  const requests = [];
  let scheduled;
  const context = {
    booking: { dataset: { quote: 'gastropujcovna' }, typ: { value: 'den' }, dovoz: { checked: false } }, priceBox,
    picked: () => [['item', 1]], multi: () => false, typLabel: () => 'den', kc: String,
    clearTimeout() {}, setTimeout(fn) { scheduled = fn; },
    fetch: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
  };
  runInNewContext('let quote = null;\n' + source.slice(start, end) + '\nglobalThis.updateQuote = updateQuote;', context);
  context.updateQuote(); const first = scheduled();
  context.updateQuote(); const second = scheduled();
  requests[1].resolve({ ok: true, json: async () => ({ rent: 200, deposit: 50, missing: [] }) });
  await second;
  assert.equal(nodes.get('[data-rent]').textContent, '200');
  requests[0].resolve({ ok: true, json: async () => ({ rent: 100, deposit: 25, missing: [] }) });
  await first;
  assert.equal(nodes.get('[data-rent]').textContent, '200');
  context.updateQuote(); const third = scheduled();
  assert.equal(priceBox.hidden, true);
  context.updateQuote(); const fourth = scheduled();
  requests[3].resolve({ ok: true, json: async () => ({ rent: 400, deposit: 50, missing: [] }) });
  await fourth;
  requests[2].reject(new Error('old request failed'));
  await third;
  assert.equal(nodes.get('[data-rent]').textContent, '400');
  assert.equal(priceBox.hidden, false);
});
