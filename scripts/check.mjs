// Kontrola hotového webu: spustí ho lokálně (wrangler pages dev, obsah ze seed.json)
// a projde všechny stránky ze sitemapy + stránku 404. Hlídá meta údaje, jeden H1,
// platné JSON-LD, duplicitní id, inline JS a styly, rozbité odkazy, kotvy a soubory,
// robots.txt, sitemapu a validitu HTML (html-validate). Spuštění: npm run check
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WRANGLER = 'wrangler@4.155.0';
const HTML_VALIDATE = 'html-validate@11.17.0';
const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
// jediný povolený vložený skript (HEAD_SCRIPT v render.js)
const HEAD_SCRIPT = 'document.documentElement.classList.add("js")';

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const tmp = mkdtempSync(join(tmpdir(), 'kontrola-'));
const server = spawn(
  'npx',
  ['--yes', WRANGLER, 'pages', 'dev', '--port', String(PORT), '--binding', `SITE_URL=${BASE}`, '--persist-to', join(tmp, 'state')],
  { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, detached: true }
);
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {
    // server už neběží
  }
  rmSync(tmp, { recursive: true, force: true });
};

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(BASE + '/robots.txt')).ok) return;
    } catch {
      // ještě nestartuje
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Web se lokálně nespustil:\n${log}`);
}

const get = (path) => fetch(BASE + path, { redirect: 'manual' });
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const meta = (html, key) => {
  const tag = html.match(new RegExp(`<meta (?:name|property)="${key}"[^>]*>`));
  return tag ? attr(tag[0], 'content') : undefined;
};
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const idsOf = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

function checkPage(path, html, { indexable }) {
  const where = path;
  if (!/^<!doctype html>/i.test(html)) fail(where, 'chybí <!doctype html>');
  if (!/<html lang="cs">/.test(html)) fail(where, 'chybí lang="cs"');
  if (!meta(html, 'viewport')) fail(where, 'chybí meta viewport');
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (!title?.trim()) fail(where, 'chybí <title>');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(where, `počet H1 je ${h1}, má být 1`);

  const ids = idsOf(html);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dup.length) fail(where, `duplicitní id: ${dup.join(', ')}`);

  if (/<[a-z][^>]*\son[a-z]+=/i.test(html)) fail(where, 'inline obsluha události (onclick= apod.)');
  if (/<[a-z][^>]*\sstyle="/i.test(html)) fail(where, 'atribut style="" v HTML');
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/ld\+json"/.test(m[1])) {
      try {
        const data = JSON.parse(m[2]);
        if (data['@context'] !== 'https://schema.org') fail(where, 'JSON-LD bez @context https://schema.org');
      } catch (e) {
        fail(where, `neplatné JSON-LD: ${e.message}`);
      }
    } else if (m[2] !== HEAD_SCRIPT) {
      fail(where, `neočekávaný vložený skript: ${m[2].slice(0, 60)}`);
    }
  }
  for (const img of html.match(/<img\b[^>]*>/g) || []) {
    if (attr(img, 'alt') === undefined) fail(where, `obrázek bez alt: ${img.slice(0, 80)}`);
  }

  if (!indexable) return { title };
  const description = meta(html, 'description');
  if (!description?.trim()) fail(where, 'chybí meta description');
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  if (canonical !== BASE + path) fail(where, `canonical ${canonical} ≠ ${BASE + path}`);
  if (!/^index/.test(meta(html, 'robots') || '')) fail(where, 'meta robots není index');
  for (const key of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) {
    if (!meta(html, key)) fail(where, `chybí ${key}`);
  }
  return { title, description };
}

// Interní odkazy a soubory (href, src, srcset) včetně kotev #id
function linksOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) out.add(decode(m[1]));
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) m[1].split(',').forEach((s) => out.add(decode(s.trim().split(/\s+/)[0])));
  return [...out].filter((u) => u.startsWith('#') || (u.startsWith('/') && !u.startsWith('//')));
}

try {
  await waitForServer();

  const robots = await (await get('/robots.txt')).text();
  if (!/^Sitemap: /m.test(robots)) fail('/robots.txt', 'chybí odkaz na sitemapu');
  if (/^Disallow: \/$/m.test(robots)) fail('/robots.txt', 'zakazuje celý web');
  const llms = await get('/llms.txt');
  if (!llms.ok) fail('/llms.txt', `stav ${llms.status}`);

  const sitemap = await (await get('/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]).replace(BASE, ''));
  if (!paths.includes('/')) fail('/sitemap.xml', 'chybí úvodní stránka');

  const pages = new Map(); // cesta → HTML
  const titles = new Map();
  const descriptions = new Map();
  for (const path of paths) {
    const res = await get(path);
    if (res.status !== 200) {
      fail(path, `adresa ze sitemapy vrací ${res.status}`);
      continue;
    }
    if (/noindex/.test(res.headers.get('x-robots-tag') || '')) fail(path, 'adresa ze sitemapy má noindex');
    const html = await res.text();
    pages.set(path, html);
    const { title, description } = checkPage(path, html, { indexable: true });
    if (titles.has(title)) fail(path, `stejný title jako ${titles.get(title)}`);
    titles.set(title, path);
    if (descriptions.has(description)) fail(path, `stejný description jako ${descriptions.get(description)}`);
    descriptions.set(description, path);
  }

  const missing = '/tato-stranka-neexistuje-xyz';
  const res404 = await get(missing);
  if (res404.status !== 404) fail(missing, `neexistující stránka vrací ${res404.status} místo 404`);
  const html404 = await res404.text();
  if (!/noindex/.test(res404.headers.get('x-robots-tag') || '')) fail(missing, 'stránka 404 nemá noindex');
  checkPage(missing, html404, { indexable: false });
  pages.set(missing, html404);

  // odkazy: každá cílová adresa jednou; přesměrování (301) je v pořádku, 4xx/5xx ne
  const status = new Map();
  for (const [from, html] of pages) {
    for (const link of linksOf(html)) {
      const [target, hash] = link.startsWith('#') ? [from, link.slice(1)] : link.split('#');
      if (!status.has(target)) status.set(target, (await get(target)).status);
      if (status.get(target) >= 400 && target !== missing) fail(from, `rozbitý odkaz ${link} (${status.get(target)})`);
      if (hash && pages.has(target) && !idsOf(pages.get(target)).includes(hash)) fail(from, `kotva ${link} na stránce neexistuje`);
    }
  }

  // validita HTML
  const dir = join(tmp, 'html');
  execFileSync('mkdir', ['-p', dir]);
  const files = [...pages].map(([path, html], i) => {
    const file = join(dir, `${i}${path.replace(/[^a-z0-9]+/gi, '-')}.html`);
    writeFileSync(file, html);
    return file;
  });
  try {
    execFileSync('npx', ['--yes', HTML_VALIDATE, '--config', 'scripts/htmlvalidate.json', ...files], { encoding: 'utf8' });
  } catch (e) {
    fail('html-validate', `\n${(e.stdout || e.message).replaceAll(dir + '/', '')}`);
  }

  console.log(`Zkontrolováno: ${pages.size} stránek, ${status.size} odkazů a souborů, robots.txt, sitemap.xml, llms.txt.`);
} catch (e) {
  fail('kontrola', e.message);
} finally {
  stop();
}

if (errors.length) {
  console.error(`\n✖ Nalezeno problémů: ${errors.length}\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('✔ Vše v pořádku.');
