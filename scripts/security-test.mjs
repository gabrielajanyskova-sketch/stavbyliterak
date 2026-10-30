// Run: node --experimental-vm-modules scripts/security-test.mjs
// Exercise the actual API against SQLite, including concurrent requests.
import { readFileSync } from 'node:fs';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SECURITY_HEADERS, RequestError, boundedRequest, requireFields, matchesFileType } from '../functions/_lib/security.js';
const security = exportsOfSecurity();
function exportsOfSecurity() { return new SyntheticModule(['SECURITY_HEADERS','RequestError','boundedRequest','requireFields','matchesFileType'], function () { for (const [k,v] of Object.entries({SECURITY_HEADERS,RequestError,boundedRequest,requireFields,matchesFileType})) this.setExport(k,v); }); }

let writes = 0;
const exportsOf = (values) => new SyntheticModule(Object.keys(values), function () {
  for (const [key, value] of Object.entries(values)) this.setExport(key, value);
});
const render = exportsOf({ BLOCK_TYPES: [], esc: String, catalogItems: () => [], money: Number, maxCount: () => 1 });
const dbModule = exportsOf({
  getSite: async () => ({}), getPages: async () => [],
  saveSite: async () => { writes++; }, savePage: async () => {}, renameAndSavePage: async () => {},
  deletePage: async () => {}, reorderPages: async () => {},
});
const api = new SourceTextModule(readFileSync(new URL('../functions/_lib/api.js', import.meta.url), 'utf8'));
await api.link((name) => name === './render.js' ? render : name === './security.js' ? security : dbModule);
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
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', Origin: 'https://example.test' };
  if (token) headers.Cookie = '__Host-stavby_admin=' + token;
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
  env.sql.prepare('INSERT INTO admin_sessions VALUES (?, ?)').run(await hash('a'.repeat(64)), new Date(Date.now() + 60000).toISOString());
  for (const value of ['{', 'null', '[]', '42']) {
    assert.equal((await call(env, '/api/admin/site', value, { raw: true, method: 'PUT', token: 'a'.repeat(64) })).status, 400);
  }
  assert.equal(writes, 0);
  assert.equal((await call(env, '/api/admin/site', {}, { method: 'PUT', token: 'a'.repeat(64) })).status, 400);
  assert.equal((await call(env, '/api/admin/site', validSite(), { method: 'PUT', token: 'a'.repeat(64) })).status, 200);
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

async function hash(token) { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex'); }
function validSite() { return {name:'Test',owner:'Owner',phone:'123',email:'a@example.test',address:'Street',ico:'123',home:{hero_title:'Title',hero_accent:'Accent',principles:[]},contact:{title:'Contact',text:'Text',services:[]},reviews:{title:'Reviews',items:[]}}; }
async function authorized() {
  const env = environment();
  const token = 'a'.repeat(64);
  env.sql.prepare('INSERT INTO admin_sessions VALUES (?, ?)').run(await hash(token), new Date(Date.now()+60000).toISOString());
  return {env,token};
}
test('session is HttpOnly, Secure and hashed, and logout revokes it', async () => {
  const env = environment(); code(env);
  const login = await call(env, '/api/admin/verify-code', {loginId:'challenge',code:'123456'});
  assert.deepEqual(await login.json(), {ok:true});
  const cookie = login.headers.get('Set-Cookie');
  for (const attr of ['HttpOnly','Secure','SameSite=Strict','Path=/']) assert.ok(cookie.includes(attr));
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(env.sql.prepare('SELECT token FROM admin_sessions').get().token, await hash(token));
  const read = () => handleApi(new Request('https://example.test/api/admin/content',{headers:{Cookie:cookie.split(';')[0]}}),env,'/api/admin/content');
  assert.equal((await read()).status,200);
  const logout = await call(env,'/api/admin/logout',{}, {token});
  assert.ok(logout.headers.get('Set-Cookie').includes('Max-Age=0'));
  assert.equal((await read()).status,401);
});
test('admin changes reject foreign or missing Origin', async () => {
  for (const origin of [null,'https://attacker.test']) {
    const headers = {'Content-Type':'application/json'};
    if (origin) headers.Origin=origin;
    const response = await handleApi(new Request('https://example.test/api/admin/login',{method:'POST',headers,body:'{}'}),environment(),'/api/admin/login');
    assert.equal(response.status,403);
  }
});
test('streamed body is bounded even without a Content-Length', async () => {
  const request = new Request('https://example.test',{method:'POST',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(20));c.enqueue(new Uint8Array(20));c.close();}}),duplex:'half'});
  await assert.rejects(boundedRequest(request,30),e=>e.status===413);
  const small=await boundedRequest(new Request('https://example.test',{method:'POST',body:'valid'}),30);
  assert.equal(await small.text(),'valid');
});
test('upload validates both original and thumbnail before any KV write', async () => {
  const {env,token}=await authorized(); let puts=0;
  env.IMAGES={put:async()=>{puts++;}};
  const send=async(file,thumb)=>{
    const form=new FormData();form.set('file',file,'image.webp'); if(thumb)form.set('thumb',thumb,'thumb.pdf');
    return handleApi(new Request('https://example.test/api/admin/images',{method:'POST',headers:{Origin:'https://example.test',Cookie:'__Host-stavby_admin='+token},body:form}),env,'/api/admin/images');
  };
  assert.equal((await send(new Blob(['<html>'],{type:'image/webp'}))).status,415);
  const webp=new Blob([new Uint8Array([82,73,70,70,12,0,0,0,87,69,66,80,86,80,56,32,0,0,0,0])],{type:'image/webp'});
  assert.equal((await send(webp,new Blob(['%PDF-1.7\n%%EOF'],{type:'application/pdf'}))).status,415);
  assert.equal(puts,0);
  env.sql.exec('CREATE TABLE images (key TEXT, name TEXT, content_type TEXT, size INTEGER, created_at TEXT)');
  assert.equal((await send(webp)).status,200);
  assert.equal(puts,1);
});
test('file signatures accept repository media and reject mismatched MIME', () => {
  for(const [path,type] of [['public/assets/img/logo.webp','image/webp'],['public/assets/img/favicon.png','image/png']]) {
    const b=readFileSync(new URL('../'+path,import.meta.url));
    const bytes=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
    assert.equal(matchesFileType(bytes,type),true);
    assert.equal(matchesFileType(bytes,'application/pdf'),false);
  }
});

test('atomic rename preserves data on a conflicting slug', async () => {
  const seedModule = new SyntheticModule(['default'], function(){this.setExport('default',{});});
  const database = new SourceTextModule(readFileSync(new URL('../functions/_lib/db.js',import.meta.url),'utf8'));
  await database.link(()=>seedModule); await database.evaluate();
  const env=environment();
  env.sql.exec("CREATE TABLE pages (slug TEXT PRIMARY KEY, data TEXT, position INTEGER, updated_at TEXT); INSERT INTO pages VALUES ('old','original',1,null), ('taken','other',2,null)");
  await assert.rejects(database.namespace.renameAndSavePage(env,'old','taken',{title:'Updated'}),/UNIQUE/);
  assert.equal(env.sql.prepare("SELECT data FROM pages WHERE slug='old'").get().data,'original');
  await database.namespace.renameAndSavePage(env,'old','new',{title:'Updated',aliases:['/old']});
  assert.equal(env.sql.prepare("SELECT COUNT(*) AS n FROM pages WHERE slug='old'").get().n,0);
  assert.deepEqual(JSON.parse(env.sql.prepare("SELECT data FROM pages WHERE slug='new'").get().data),{title:'Updated',aliases:['/old']});
});
test('expired and legacy bearer sessions are rejected', async()=>{
  const {env,token}=await authorized();
  env.sql.prepare('UPDATE admin_sessions SET expires_at=?').run(new Date(Date.now()-1000).toISOString());
  const path='/api/admin/content';
  assert.equal((await handleApi(new Request('https://example.test'+path,{headers:{Cookie:'__Host-stavby_admin='+token}}),env,path)).status,401);
  assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM admin_sessions').get().n,0);
  assert.equal((await handleApi(new Request('https://example.test'+path,{headers:{Authorization:'Bearer '+token}}),env,path)).status,401);
});
test('oversized JSON is rejected and unauthorized uploads are not read',async()=>{
  const {env,token}=await authorized();
  assert.equal((await call(env,'/api/admin/site','x'.repeat(2*1024*1024+1),{raw:true,method:'PUT',token})).status,413);
  const req=new Request('https://example.test/api/admin/images',{method:'POST',headers:{Origin:'https://example.test','Content-Length':'99999999'},body:'not multipart'});
  assert.equal((await handleApi(req,env,'/api/admin/images')).status,401);
  assert.equal(req.bodyUsed,false);
});
test('malformed multipart returns 400 without a write',async()=>{
  const {env,token}=await authorized();env.IMAGES={};
  const req=new Request('https://example.test/api/admin/images',{method:'POST',headers:{Origin:'https://example.test',Cookie:'__Host-stavby_admin='+token,'Content-Type':'multipart/form-data; boundary=broken'},body:'broken'});
  assert.equal((await handleApi(req,env,'/api/admin/images')).status,400);
});
