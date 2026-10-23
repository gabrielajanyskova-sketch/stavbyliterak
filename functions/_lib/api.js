// API pro poptávkový formulář a administraci (/admin).
import { BLOCK_TYPES } from './render.js';
import { getSite, getPages, saveSite, savePage, renamePage, deletePage, reorderPages } from './db.js';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function mailConfigured(env) {
  return !!(env.RESEND_API_KEY && env.MAIL_FROM && env.NOTIFY_EMAIL);
}

async function sendMail(env, { subject, html, replyTo = null }) {
  const payload = { from: env.MAIL_FROM, to: [env.NOTIFY_EMAIL], subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// ---------- poptávkový formulář ----------

// Bez nastaveného e-mailu vrátí 503 a prohlížeč otevře mailto — poptávka se tak nikdy neztratí.
async function submitContact(request, env) {
  const b = await body(request);
  const field = (k, max = 200) => String(b[k] || '').trim().slice(0, max);
  const name = field('jmeno');
  const phone = field('telefon', 40);
  if (!name || !phone) return json({ error: 'missing_fields' }, 400);
  if (field('web')) return json({ ok: true }); // past na roboty (skryté pole)
  if (!mailConfigured(env)) return json({ error: 'mail_not_configured' }, 503);

  const rows = [
    ['Služba', field('sluzba')],
    ['Jméno', name],
    ['Telefon', phone],
    ['Místo', field('misto')],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5b636c">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join('');
  try {
    await sendMail(env, {
      subject: `Poptávka z webu — ${field('sluzba')} — ${name}`,
      html: `<table style="font-family:sans-serif;font-size:15px">${rows}</table><p style="font-family:sans-serif;font-size:15px;white-space:pre-wrap">${escapeHtml(field('zprava', 5000))}</p>`,
    });
  } catch (err) {
    console.error('contact mail failed', err);
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true });
}

// ---------- přihlášení do adminu ----------

const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function randomToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + n);
}

function bearer(request) {
  return (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
}

async function isAdmin(request, env) {
  const token = bearer(request);
  if (!token) return false;
  const row = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token = ?').bind(token).first();
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
    return false;
  }
  return true;
}

async function issueSession(env) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)')
    .bind(token, new Date(Date.now() + SESSION_TTL_MS).toISOString())
    .run();
  return token;
}

async function login(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const row = await env.DB.prepare('SELECT attempt_count, window_start FROM login_attempts WHERE ip = ?').bind(ip).first();
  const windowActive = !!row && now - new Date(row.window_start).getTime() < LOGIN_ATTEMPT_WINDOW_MS;
  if (windowActive && row.attempt_count >= LOGIN_ATTEMPT_LIMIT) return json({ error: 'too_many_attempts' }, 429);

  const b = await body(request);
  // mezery na okrajích (častý omyl při kopírování hesla do Cloudflare) nevadí
  const ok = !!env.ADMIN_PASSWORD && typeof b.password === 'string' && b.password.trim() === String(env.ADMIN_PASSWORD).trim();
  if (!ok) {
    if (windowActive) {
      await env.DB.prepare('UPDATE login_attempts SET attempt_count = attempt_count + 1 WHERE ip = ?').bind(ip).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO login_attempts (ip, attempt_count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(ip) DO UPDATE SET attempt_count = 1, window_start = excluded.window_start`
      )
        .bind(ip, new Date(now).toISOString())
        .run();
    }
    return json({ error: env.ADMIN_PASSWORD ? 'wrong_password' : 'not_configured' }, 401);
  }
  if (row) await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();

  // Druhý krok e-mailem, pokud je nastavené odesílání — samotné uniklé heslo pak nestačí.
  if (!mailConfigured(env)) return json({ ok: true, token: await issueSession(env) });

  const loginId = crypto.randomUUID();
  const code = randomCode();
  await env.DB.prepare('INSERT INTO login_codes (login_id, code, expires_at, attempts) VALUES (?, ?, ?, 0)')
    .bind(loginId, code, new Date(now + LOGIN_CODE_TTL_MS).toISOString())
    .run();
  try {
    await sendMail(env, {
      subject: 'Přihlašovací kód do administrace webu',
      html: `<p style="font-family:sans-serif;font-size:16px">Kód pro přihlášení do administrace:</p>
<p style="font-family:sans-serif;font-size:30px;font-weight:bold;letter-spacing:6px">${code}</p>
<p style="font-family:sans-serif;font-size:13px;color:#5b636c">Platí 10 minut. Pokud jste se nepřihlašovali, kód nikomu nedávejte a změňte heslo.</p>`,
    });
  } catch (err) {
    console.error('login code mail failed', err);
    return json({ error: 'mail_failed' }, 502);
  }
  return json({ ok: true, requiresCode: true, loginId });
}

async function verifyCode(request, env) {
  const b = await body(request);
  const loginId = String(b.loginId || '');
  const code = String(b.code || '').trim();
  const row = await env.DB.prepare('SELECT code, expires_at, attempts FROM login_codes WHERE login_id = ?').bind(loginId).first();
  if (!row) return json({ error: 'invalid_code' }, 401);
  if (new Date(row.expires_at).getTime() < Date.now() || row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
    await env.DB.prepare('DELETE FROM login_codes WHERE login_id = ?').bind(loginId).run();
    return json({ error: 'code_expired' }, 401);
  }
  if (row.code !== code) {
    await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE login_id = ?').bind(loginId).run();
    return json({ error: 'invalid_code' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_codes WHERE login_id = ?').bind(loginId).run();
  return json({ ok: true, token: await issueSession(env) });
}

async function logout(request, env) {
  const token = bearer(request);
  if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}

// ---------- čištění obsahu z adminu ----------

const RESERVED = new Set(['api', 'admin', 'assets', 'img', 'sitemap.xml', 'robots.txt', 'index']);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const str = (v, max = 2000) => String(v ?? '').slice(0, max);
const bool = (v) => v === true;

function cleanItems(list, fields) {
  return (Array.isArray(list) ? list : []).slice(0, 100).map((i) => {
    const o = {};
    for (const f of fields) o[f] = str(i && i[f], 5000).trim();
    return o;
  });
}

const ITEM_FIELDS = {
  bullets: ['text'],
  numbered: ['title', 'text'],
  steps: ['title', 'text'],
  grid: ['title', 'text'],
  faq: ['title', 'text'],
  catalog: ['title', 'text', 'spec', 'count'],
};

function cleanBlock(b) {
  if (!b || !BLOCK_TYPES.includes(b.type)) return null;
  const out = { type: b.type };
  if (b.type === 'heading') {
    out.text = str(b.text, 200).trim();
    if (b.level === 3) out.level = 3;
    const anchor = str(b.anchor, 60).trim().toLowerCase();
    if (anchor && SLUG_RE.test(anchor)) out.anchor = anchor;
  } else if (b.type === 'text') {
    out.text = str(b.text, 20000);
  } else if (b.type === 'note') {
    out.text = str(b.text, 5000);
    out.style = b.style === 'info' ? 'info' : 'todo';
  } else if (b.type === 'image') {
    out.src = str(b.src, 500).trim();
    out.caption = str(b.caption, 300).trim();
  } else {
    out.items = cleanItems(b.items, ITEM_FIELDS[b.type]);
  }
  return out;
}

function cleanPage(p) {
  return {
    published: bool(p.published),
    in_nav: bool(p.in_nav),
    nav_label: str(p.nav_label, 60).trim(),
    in_chooser: bool(p.in_chooser),
    chooser_title: str(p.chooser_title, 100).trim(),
    chooser_hint: str(p.chooser_hint, 200).trim(),
    meta_title: str(p.meta_title, 200).trim(),
    meta_description: str(p.meta_description, 400).trim(),
    crumb: str(p.crumb, 100).trim(),
    title: str(p.title, 150).trim() || 'Bez názvu',
    lead: str(p.lead, 1000).trim(),
    theme: p.theme === 'thermal' ? 'thermal' : '',
    facts: cleanItems(p.facts, ['label', 'value']).slice(0, 12),
    photo: str(p.photo, 500).trim(),
    photo_caption: str(p.photo_caption, 200).trim(),
    ask_title: str(p.ask_title, 100).trim(),
    ask_note: str(p.ask_note, 500).trim(),
    form_service: str(p.form_service, 100).trim(),
    aliases: (Array.isArray(p.aliases) ? p.aliases : [])
      .map((a) => str(a, 200).trim())
      .filter((a) => a.startsWith('/') && a !== '/')
      .slice(0, 20),
    blocks: (Array.isArray(p.blocks) ? p.blocks : []).slice(0, 200).map(cleanBlock).filter(Boolean),
  };
}

function cleanSite(s) {
  const h = s.home || {};
  const c = s.contact || {};
  return {
    name: str(s.name, 100).trim(),
    owner: str(s.owner, 100).trim(),
    phone: str(s.phone, 40).trim(),
    email: str(s.email, 100).trim(),
    address: str(s.address, 200).trim(),
    ico: str(s.ico, 20).trim(),
    home: {
      meta_title: str(h.meta_title, 200),
      meta_description: str(h.meta_description, 400),
      hero_title: str(h.hero_title, 100),
      hero_accent: str(h.hero_accent, 100),
      hero_meta: str(h.hero_meta, 150),
      chooser_label: str(h.chooser_label, 100),
      about_label: str(h.about_label, 100),
      about_title: str(h.about_title, 200),
      about_text: str(h.about_text, 3000),
      principles: cleanItems(h.principles, ['label', 'title', 'text']).slice(0, 6),
      promo_page: str(h.promo_page, 60),
      promo_label: str(h.promo_label, 100),
      promo_title: str(h.promo_title, 150),
      promo_text: str(h.promo_text, 2000),
      promo_button: str(h.promo_button, 60),
    },
    contact: {
      title: str(c.title, 150),
      text: str(c.text, 1000),
      services: (Array.isArray(c.services) ? c.services : []).map((x) => str(x, 100).trim()).filter(Boolean).slice(0, 30),
    },
  };
}

// ---------- obsah ----------

async function getContent(env) {
  return json({ site: await getSite(env), pages: await getPages(env, { includeDrafts: true }) });
}

async function putSite(request, env) {
  await saveSite(env, cleanSite(await body(request)));
  return json({ ok: true });
}

async function createPage(request, env) {
  const b = await body(request);
  const slug = str(b.slug, 60).trim().toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) return json({ error: 'invalid_slug' }, 400);
  const exists = await env.DB.prepare('SELECT 1 FROM pages WHERE slug = ?').bind(slug).first();
  if (exists) return json({ error: 'slug_exists' }, 409);
  const max = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM pages').first();
  const title = str(b.title, 150).trim() || 'Nová stránka';
  const page = cleanPage({
    title,
    crumb: title,
    nav_label: title,
    ask_title: title,
    published: false,
    blocks: [{ type: 'text', text: 'Text stránky…' }],
  });
  await savePage(env, slug, page, max.m + 1);
  return json({ ok: true, slug });
}

async function updatePage(request, env, slug) {
  const b = await body(request);
  const row = await env.DB.prepare('SELECT position FROM pages WHERE slug = ?').bind(slug).first();
  if (!row) return json({ error: 'not_found' }, 404);
  let target = slug;
  const newSlug = str(b.slug, 60).trim().toLowerCase();
  if (newSlug && newSlug !== slug) {
    if (!SLUG_RE.test(newSlug) || RESERVED.has(newSlug)) return json({ error: 'invalid_slug' }, 400);
    if (await env.DB.prepare('SELECT 1 FROM pages WHERE slug = ?').bind(newSlug).first()) return json({ error: 'slug_exists' }, 409);
    await renamePage(env, slug, newSlug);
    target = newSlug;
    // stará adresa dál funguje jako přesměrování
    b.aliases = [...new Set([...(Array.isArray(b.aliases) ? b.aliases : []), '/' + slug])];
  }
  await savePage(env, target, cleanPage(b), row.position);
  return json({ ok: true, slug: target });
}

async function removePage(env, slug) {
  await deletePage(env, slug);
  return json({ ok: true });
}

async function orderPages(request, env) {
  const b = await body(request);
  const slugs = (Array.isArray(b.slugs) ? b.slugs : []).map((s) => str(s, 60)).filter((s) => SLUG_RE.test(s));
  await reorderPages(env, slugs);
  return json({ ok: true });
}

// ---------- fotky (Workers KV) ----------

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function listImages(env) {
  const { results } = await env.DB.prepare('SELECT key, name, content_type, size, created_at FROM images ORDER BY created_at DESC').all();
  return json({ images: results.map((r) => Object.assign(r, { url: '/img/' + r.key })) });
}

async function uploadImage(request, env) {
  if (!env.IMAGES) return json({ error: 'images_not_configured' }, 503);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'missing_file' }, 400);
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return json({ error: 'unsupported_type' }, 415);
  if (file.size > MAX_IMAGE_BYTES) return json({ error: 'too_large' }, 413);
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.IMAGES.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  await env.DB.prepare('INSERT INTO images (key, name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, str(form.get('name') || file.name, 200), file.type, file.size, new Date().toISOString())
    .run();
  return json({ ok: true, key, url: '/img/' + key });
}

async function deleteImage(env, key) {
  if (env.IMAGES) await env.IMAGES.delete(key);
  await env.DB.prepare('DELETE FROM images WHERE key = ?').bind(key).run();
  return json({ ok: true });
}

export async function serveImage(env, key) {
  if (!env.IMAGES) return new Response('Not found', { status: 404 });
  const obj = await env.IMAGES.getWithMetadata(key, 'arrayBuffer');
  if (!obj || !obj.value) return new Response('Not found', { status: 404 });
  return new Response(obj.value, {
    headers: {
      'Content-Type': (obj.metadata && obj.metadata.contentType) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// ---------- router ----------

export async function handleApi(request, env, path) {
  const m = request.method;
  if (path === '/api/health') return json({ ok: true, db: !!env.DB, images: !!env.IMAGES, mail: mailConfigured(env) });
  if (path === '/api/contact' && m === 'POST') return submitContact(request, env);

  if (!path.startsWith('/api/admin/')) return json({ error: 'not_found' }, 404);
  if (!env.DB) return json({ error: 'db_not_configured' }, 503);

  if (path === '/api/admin/login' && m === 'POST') return login(request, env);
  if (path === '/api/admin/verify-code' && m === 'POST') return verifyCode(request, env);
  if (path === '/api/admin/logout' && m === 'POST') return logout(request, env);

  if (!(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);

  if (path === '/api/admin/content' && m === 'GET') return getContent(env);
  if (path === '/api/admin/site' && m === 'PUT') return putSite(request, env);
  if (path === '/api/admin/pages' && m === 'POST') return createPage(request, env);
  if (path === '/api/admin/pages-order' && m === 'PUT') return orderPages(request, env);
  const pm = path.match(/^\/api\/admin\/pages\/([a-z0-9-]+)$/);
  if (pm && m === 'PUT') return updatePage(request, env, pm[1]);
  if (pm && m === 'DELETE') return removePage(env, pm[1]);
  if (path === '/api/admin/images' && m === 'GET') return listImages(env);
  if (path === '/api/admin/images' && m === 'POST') return uploadImage(request, env);
  const im = path.match(/^\/api\/admin\/images\/([\w.-]+)$/);
  if (im && m === 'DELETE') return deleteImage(env, im[1]);

  return json({ error: 'not_found' }, 404);
}
