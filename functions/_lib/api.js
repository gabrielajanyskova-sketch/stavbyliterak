// API pro poptávkový formulář a administraci (/admin).
import { BLOCK_TYPES, esc, catalogItems, money, maxCount } from './render.js';
import { getSite, getPages, saveSite, savePage, renameAndSavePage, deletePage, reorderPages } from './db.js';

import { SECURITY_HEADERS, RequestError, boundedRequest, requireFields, matchesFileType } from './security.js';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function body(request) {
  let data;
  try { data = await request.json(); }
  catch { throw new RequestError('invalid_json'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestError('invalid_json');
  return data;
}

function mailConfigured(env) {
  return !!(env.RESEND_API_KEY && env.MAIL_FROM && env.NOTIFY_EMAIL);
}

async function sendMail(env, { subject, html, text = null, replyTo = null, attachments = null, to = env.NOTIFY_EMAIL }) {
  const payload = { from: env.MAIL_FROM, to: [to], subject, html };
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;
  if (attachments) payload.attachments = attachments;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

// ---------- poptávkový formulář ----------

// Bez nastaveného e-mailu vrátí 503 a prohlížeč otevře mailto — poptávka se tak nikdy neztratí.
const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_MS = 10 * 60 * 1000;

// Počítadlo pokusů na IP v okně (sdílí ho přihlášení do adminu, formulář i našeptávač,
// liší se předponou klíče). Stav: kolik pokusů je v aktuálním okně.
// Vrací true, když je limit vyčerpaný; jinak pokus započítá.
async function overLimit(env, key, limit, windowMs) {
  // D1 provede kontrolu i zvýšení v jediném zápisu; paralelní požadavky
  // tak nemohou všechny projít se stejným původním počtem pokusů.
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO login_attempts (ip, attempt_count, window_start) VALUES (?, 1, ?)
     ON CONFLICT(ip) DO UPDATE SET
       attempt_count = CASE WHEN window_start <= ? THEN 1 ELSE attempt_count + 1 END,
       window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END
     WHERE window_start <= ? OR attempt_count < ?
     RETURNING attempt_count`
  ).bind(key, now, cutoff, cutoff, cutoff, limit).first();
  return !row;
}

// Text poptávky z formulářů je po řádcích: „Nadpis:“ začíná oddíl, „- klíč: hodnota“
// nebo krátké „Klíč: hodnota“ je řádek tabulky, cokoli jiného je volný text.
function messageSections(text) {
  const sections = [];
  let current = { title: '', rows: [] };
  const flush = () => {
    if (current.title || current.rows.length) sections.push(current);
    current = { title: '', rows: [] };
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const item = line.startsWith('-');
    if (!item && line.endsWith(':') && line.length < 80) {
      flush();
      current.title = line.slice(0, -1);
      continue;
    }
    const body = line.replace(/^-\s*/, '');
    const pair = /^([^:]{1,60}):\s+(.+)$/.exec(body);
    const last = current.rows[current.rows.length - 1];
    if (pair && (item || (pair[1].length <= 25 && !/[,.]/.test(pair[1])))) current.rows.push([pair[1], pair[2]]);
    else if (last && !last[0] && !item) last[1] += '\n' + body;
    else current.rows.push(['', body]);
  }
  flush();
  return sections;
}

const MAIL_FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Barvy e-mailu: tmavé jako web (pan Literák má rád tmavý režim). Barvy jsou přímo v atributech,
// aby je pošta nepřebarvovala; meta color-scheme říká klientům, že e-mail už tmavý je.
const M = { bg: '#101316', card: '#1d2126', panel: '#262b31', line: '#353d45', text: '#e6e9ec', muted: '#9aa3ab', amber: '#f39a1e' };

function mailRow(label, value) {
  const cell = `padding:9px 0;border-bottom:1px solid ${M.line};vertical-align:top`;
  if (!label) return `<tr><td colspan="2" style="${cell};color:${M.text};white-space:pre-wrap">${value}</td></tr>`;
  return `<tr><td style="${cell};padding-right:16px;color:${M.muted};width:36%">${esc(cap(label))}</td><td style="${cell};color:${M.text};font-weight:600">${value}</td></tr>`;
}

// Řádky, které se ukážou nahoře jako výrazné dlaždice (plocha, termín, cena…)
const KEY_ROWS = /^(plocha lešení|termín|orientační cena pronájmu|cena pronájmu|vratná záloha)$/i;

function inquiryHtml(q, withImage) {
  const phoneDigits = q.phone.replace(/[^\d+]/g, '');
  const callable = phoneDigits.replace(/\D/g, '').length >= 9; // „vrána“ ani překlep nedělá tlačítko Zavolat
  const link = (href, text) => `<a href="${href}" style="color:${M.text};text-decoration:underline">${text}</a>`;
  const contact = [
    ['Jméno', esc(q.name)],
    q.email ? ['E-mail', link(`mailto:${esc(q.email)}`, esc(q.email))] : null,
    q.phone ? ['Telefon', callable ? link(`tel:${esc(phoneDigits)}`, esc(q.phone)) : esc(q.phone)] : null,
    q.place ? ['Místo', esc(q.place)] : null,
  ].filter(Boolean);
  const heading = (t) => `<p style="margin:28px 0 8px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${M.amber};font-weight:700">${esc(t)}</p>`;
  const table = (rows) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:15px;line-height:1.45">${rows.join('')}</table>`;
  const sections = messageSections(q.message).filter((sec) => !/^-?\s*e-mail$/i.test(sec.title));
  const keys = sections.flatMap((sec) => sec.rows.filter(([k]) => KEY_ROWS.test(k)));
  const tiles = keys.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:separate;border-spacing:0 8px"><tr>${keys
        .slice(0, 3)
        .map(([k, v]) => `<td style="background:${M.panel};border-left:3px solid ${M.amber};padding:12px 14px;vertical-align:top;width:${Math.floor(100 / Math.min(3, keys.length))}%"><p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${M.muted}">${esc(cap(k))}</p><p style="margin:4px 0 0;font-size:17px;line-height:1.3;font-weight:700;color:${M.amber}">${esc(v)}</p></td>`)
        .join('<td style="width:8px"></td>')}</tr></table>`
    : '';
  const body = sections
    .map((sec) => {
      const rows = sec.rows.filter(([k]) => !/^e-mail$/i.test(k)).map(([k, v]) => mailRow(k, esc(v)));
      return heading(sec.title || 'Zpráva') + (rows.length ? table(rows) : '');
    })
    .join('');
  const image = withImage
    ? heading('Nákres') +
      `<img src="cid:nakres" alt="Půdorys domu a náhled lešení" width="704" style="display:block;width:100%;max-width:704px;height:auto;border:1px solid ${M.line}">` +
      `<p style="margin:8px 0 0;font-size:13px;color:${M.muted}">Půdorys se stěnami a orientační náhled lešení, jak ho zákazník naklikal.</p>`
    : '';
  const button = (href, label, primary) =>
    `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;text-decoration:none;font-weight:700;font-size:15px;${
      primary ? `background:${M.amber};color:#15181c` : `background:${M.panel};color:${M.text};border:1px solid ${M.line}`
    }">${label}</a>`;
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:${M.bg}" bgcolor="${M.bg}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${M.bg}" style="background:${M.bg};${MAIL_FONT}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="760" cellspacing="0" cellpadding="0" bgcolor="${M.card}" style="width:100%;max-width:760px;background:${M.card}">
<tr><td style="padding:24px 28px 20px;border-bottom:4px solid ${M.amber}">
<p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${M.amber};font-weight:700">Nová poptávka z webu</p>
<p style="margin:6px 0 0;font-size:24px;line-height:1.2;color:#ffffff;font-weight:800;text-transform:uppercase;letter-spacing:.02em">${esc(q.service || 'Poptávka')}</p>
</td></tr>
<tr><td style="padding:4px 28px 28px">
${tiles}
${heading('Zákazník')}${table(contact.map(([k, v]) => mailRow(k, v)))}
<p style="margin:18px 0 0">${q.email ? button(`mailto:${esc(q.email)}`, 'Odpovědět e-mailem', true) : ''}${callable ? button(`tel:${esc(phoneDigits)}`, 'Zavolat zákazníkovi', !q.email) : ''}</p>
${body}${image}
</td></tr>
<tr><td style="padding:16px 28px;background:${M.bg};font-size:12px;color:${M.muted};border-top:1px solid ${M.line}">Odesláno z formuláře na webu stavbyliterak.cz.${q.email ? ' Odpověď na tento e-mail půjde přímo zákazníkovi.' : ''}</td></tr>
</table></td></tr></table></body></html>`;
}

function inquiryText(q) {
  return [`Služba: ${q.service}`, `Jméno: ${q.name}`, q.email ? `E-mail: ${q.email}` : '', q.phone ? `Telefon: ${q.phone}` : '', q.place ? `Místo: ${q.place}` : '', '', q.message]
    .filter((l, i) => l || i === 5)
    .join('\n');
}

// Formulář odeslaný bez JavaScriptu (klasický POST) dostane místo JSON krátkou textovou odpověď.
async function formReply(env, data, status) {
  let text = 'Díky, poptávka odešla. Ozvu se co nejdřív.';
  if (data.error === 'missing_fields') text = 'Vyplňte prosím jméno a e-mail nebo telefon. Vraťte se zpět a formulář doplňte.';
  else if (data.error) {
    const site = await getSite(env);
    text = `Poptávku se nepodařilo odeslat. Zavolejte prosím na ${site.phone} nebo napište na ${site.email}.`;
  }
  return new Response(`${text}\n\nZpět na web: vraťte se v prohlížeči o stránku zpět.\n`, {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function submitContact(request, env) {
  const isForm = /form/i.test(request.headers.get('Content-Type') || '');
  const reply = (data, status = 200) => (isForm ? formReply(env, data, status) : json(data, status));
  let b = {};
  try {
    b = isForm ? Object.fromEntries(await request.formData()) : await request.json();
  } catch {
    // poškozená data — stejně jako prázdný formulář
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return reply({ error: 'missing_fields' }, 400);
  const field = (k, max = 200) => String(b[k] || '').trim().slice(0, max);
  const name = field('jmeno');
  const phone = field('telefon', 40);
  const email = field('email', 120);
  // stačí jméno a e-mail nebo telefon (starší otevřené stránky posílaly jen telefon)
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || (!validEmail && !phone)) return reply({ error: 'missing_fields' }, 400);
  if (field('web')) return reply({ ok: true }); // past na roboty (skryté pole)
  if (!mailConfigured(env)) return reply({ error: 'mail_not_configured' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.DB && (await overLimit(env, 'contact:' + ip, CONTACT_LIMIT, CONTACT_WINDOW_MS))) return reply({ error: 'too_many_requests' }, 429);

  const inquiry = {
    service: field('sluzba'),
    name,
    phone,
    place: field('misto'),
    email: validEmail ? email : '',
    message: field('zprava', 5000),
  };
  // nákres z konfigurátoru lešení (JPEG/PNG z prohlížeče) jde do e-mailu jako vložený obrázek
  const drawing = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.nakres || ''));
  const image = drawing && drawing[2].length < 1_500_000 ? { type: drawing[1], data: drawing[2] } : null;
  try {
    await sendMail(env, {
      replyTo: inquiry.email || null, // „Odpovědět“ půjde rovnou zákazníkovi
      subject: `Poptávka z webu — ${inquiry.service} — ${name}`,
      html: inquiryHtml(inquiry, !!image),
      text: inquiryText(inquiry),
      attachments: image ? [{ filename: `nakres.${image.type === 'png' ? 'png' : 'jpg'}`, content: image.data, content_id: 'nakres' }] : null,
    });
  } catch (err) {
    console.error('contact mail failed', err);
    return reply({ error: 'send_failed' }, 502);
  }
  return reply({ ok: true });
}

// ---------- našeptávač adres ----------

// Adresy z Mapy.com (klíč MAPY_API_KEY je jen na serveru). Bez klíče vrátí prázdný seznam
// a pole funguje jako obyčejný text. Z jedné IP nejvýš 60 dotazů za 10 minut (kvóta Mapy.com).
const SUGGEST_LIMIT = 60;
const SUGGEST_WINDOW_MS = 10 * 60 * 1000;

async function suggestAddress(request, env) {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
  if (!env.MAPY_API_KEY || q.length < 3) return json({ items: [] });
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.DB && (await overLimit(env, 'adresa:' + ip, SUGGEST_LIMIT, SUGGEST_WINDOW_MS))) return json({ items: [] });
  const url = new URL('https://api.mapy.com/v1/suggest');
  url.search = new URLSearchParams([
    ['query', q],
    ['lang', 'cs'],
    ['limit', '6'],
    ['locality', 'cz'],
    ['type', 'regional.address'],
    ['type', 'regional.street'],
    ['type', 'regional.municipality_part'],
    ['type', 'regional.municipality'],
  ]).toString();
  try {
    const res = await fetch(url, { headers: { 'X-Mapy-Api-Key': env.MAPY_API_KEY }, cf: { cacheTtl: 86400, cacheEverything: true } });
    if (!res.ok) throw new Error(`Mapy ${res.status}`);
    const data = await res.json();
    const items = (data.items || [])
      .map((i) => [i.name, String(i.location || '').replace(/,?\s*Česko$/, '')].filter(Boolean).join(', '))
      .filter((v, i, all) => v && all.indexOf(v) === i);
    return new Response(JSON.stringify({ items }), {
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err) {
    console.error('address suggest failed', err);
    return json({ items: [] });
  }
}

// ---------- cena půjčovny ----------

// Spočítá cenu pronájmu a zálohy za vybrané vybavení. Ceny jednotlivých položek
// zůstávají na serveru — prohlížeč dostane jen součty.
async function gastroQuote(request, env) {
  const b = await body(request);
  const page = (await getPages(env)).find((p) => p.slug === String(b.slug || ''));
  if (!page) return json({ error: 'not_found' }, 404);
  const items = catalogItems(page);
  const key = b.typ === 'den' ? 'price_day' : 'price_weekend';
  let rent = 0;
  let deposit = 0;
  const missing = [];
  for (const [title, qty] of Object.entries(b.items && typeof b.items === 'object' ? b.items : {}).slice(0, 100)) {
    const item = items.find((i) => i.title === title);
    const n = item ? Math.min(maxCount(item), Math.max(0, parseInt(qty, 10) || 0)) : 0;
    if (!n) continue;
    const price = money(item[key]);
    if (price === null) missing.push(title);
    else rent += price * n;
    deposit += (money(item.deposit) || 0) * n;
  }
  return json({ rent, deposit, missing });
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

// Porovnání bez předčasného konce — doba odpovědi neprozradí, kolik znaků hesla sedí.
function sameText(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function cookieName(request) {
  return new URL(request.url).protocol === 'https:' ? '__Host-stavby_admin' : 'stavby_admin_local';
}

function sessionToken(request) {
  const name = cookieName(request) + '=';
  return (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(name))?.slice(name.length) || '';
}

async function tokenHash(token) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(v => v.toString(16).padStart(2, '0')).join('');
}

function sessionCookie(request, token, age = SESSION_TTL_MS / 1000) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}

async function isAdmin(request, env) {
  const token = sessionToken(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const hash = await tokenHash(token);
  const row = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token = ?').bind(hash).first();
  if (!row) return false;
  if (!(new Date(row.expires_at).getTime() > Date.now())) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(hash).run();
    return false;
  }
  return true;
}

async function issueSession(request, env) {
  const token = randomToken();
  await env.DB.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)')
    .bind(await tokenHash(token), new Date(Date.now() + SESSION_TTL_MS).toISOString()).run();
  const response = json({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(request, token));
  return response;
}

async function login(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  // Rezervujeme pokus před ověřením, včetně souběžných požadavků.
  if (await overLimit(env, ip, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_MS)) return json({ error: 'too_many_attempts' }, 429);

  const b = await body(request);
  // mezery na okrajích (častý omyl při kopírování hesla do Cloudflare) nevadí
  const ok = !!env.ADMIN_PASSWORD && typeof b.password === 'string' && sameText(b.password.trim(), String(env.ADMIN_PASSWORD).trim());
  if (!ok) {
    return json({ error: env.ADMIN_PASSWORD ? 'wrong_password' : 'not_configured' }, 401);
  }

  // úklid prošlých přihlášení, kódů a starých počítadel
  const nowIso = new Date(now).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(nowIso),
    env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(nowIso),
    env.DB.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(new Date(now - 24 * 3600 * 1000).toISOString()),
  ]);

  // Druhý krok e-mailem, pokud je nastavené odesílání — samotné uniklé heslo pak nestačí.
  if (!mailConfigured(env)) {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
    return issueSession(request, env);
  }

  const loginId = crypto.randomUUID();
  const code = randomCode();
  await env.DB.prepare('INSERT INTO login_codes (login_id, code, expires_at, attempts) VALUES (?, ?, ?, 0)')
    .bind(loginId, code, new Date(now + LOGIN_CODE_TTL_MS).toISOString())
    .run();
  try {
    await sendMail(env, {
      // kódy můžou chodit jinam než poptávky (LOGIN_EMAIL), např. správci webu
      to: env.LOGIN_EMAIL || env.NOTIFY_EMAIL,
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
  // Každý pokus obsadí jednu pozici atomicky. Úspěšný kód spotřebuje
  // podmíněné DELETE RETURNING, takže relaci dostane jediný požadavek.
  const row = await env.DB.prepare(
    `UPDATE login_codes SET attempts = attempts + 1
     WHERE login_id = ? AND expires_at > ? AND attempts < ?
     RETURNING code`
  ).bind(loginId, new Date().toISOString(), LOGIN_CODE_MAX_ATTEMPTS).first();
  if (!row) return json({ error: 'code_expired' }, 401);
  if (!sameText(row.code, code)) return json({ error: 'invalid_code' }, 401);
  const consumed = await env.DB.prepare(
    'DELETE FROM login_codes WHERE login_id = ? AND code = ? RETURNING login_id'
  ).bind(loginId, code).first();
  if (!consumed) return json({ error: 'invalid_code' }, 401);
  return issueSession(request, env);
}

async function logout(request, env) {
  const token = sessionToken(request);
  if (/^[a-f0-9]{64}$/.test(token)) await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(await tokenHash(token)).run();
  const response = json({ ok: true });
  response.headers.set('Set-Cookie', sessionCookie(request, '', 0));
  return response;
}

// ---------- čištění obsahu z adminu ----------

const RESERVED = new Set(['api', 'admin', 'assets', 'img', 'index']);
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
  catalog: ['title', 'text', 'spec', 'warn', 'count', 'photo', 'price_weekend', 'price_day', 'deposit'],
  gallery: ['src', 'caption', 'alt'],
  table: ['title', 'text'],
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
  } else if (b.type === 'gallery') {
    out.items = cleanItems(b.items, ITEM_FIELDS.gallery).filter((i) => i.src);
    if (b.fit === 'contain') out.fit = 'contain';
  } else if (b.type === 'scaffold') {
    // kalkulačka nemá nastavení
  } else if (b.type === 'table') {
    out.head1 = str(b.head1, 100).trim();
    out.head2 = str(b.head2, 100).trim();
    out.items = cleanItems(b.items, ITEM_FIELDS.table);
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
    nav_extra: bool(p.nav_extra),
    nav_label: str(p.nav_label, 60).trim(),
    in_chooser: bool(p.in_chooser),
    chooser_title: str(p.chooser_title, 100).trim(),
    chooser_hint: str(p.chooser_hint, 200).trim(),
    showcase_photo: str(p.showcase_photo, 500).trim(),
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
  const r = s.reviews || {};
  return {
    name: str(s.name, 100).trim(),
    owner: str(s.owner, 100).trim(),
    phone: str(s.phone, 40).trim(),
    email: str(s.email, 100).trim(),
    address: str(s.address, 200).trim(),
    ico: str(s.ico, 20).trim(),
    geo: str(s.geo, 60).trim(),
    home: {
      meta_title: str(h.meta_title, 200),
      meta_description: str(h.meta_description, 400),
      hero_title: str(h.hero_title, 100),
      hero_accent: str(h.hero_accent, 100),
      hero_meta: str(h.hero_meta, 150),
      hero_photo: str(h.hero_photo, 500).trim(),
      hero_photo_alt: str(h.hero_photo_alt, 200).trim(),
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
      promo_photo: str(h.promo_photo, 500).trim(),
      promo_photo_alt: str(h.promo_photo_alt, 200).trim(),
    },
    reviews: {
      title: str(r.title, 150).trim(),
      rating: str(r.rating, 4).trim().replace(',', '.'),
      count: str(r.count, 10).trim(),
      google_url: str(r.google_url, 1000).trim(),
      write_url: str(r.write_url, 1000).trim(),
      items: cleanItems(r.items, ['name', 'stars', 'date', 'text']).slice(0, 12),
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
  const data = await body(request);
  requireFields(data, ['name', 'owner', 'phone', 'email', 'address', 'ico'], [], ['home', 'contact', 'reviews']);
  requireFields(data.home, ['hero_title', 'hero_accent'], ['principles']);
  requireFields(data.contact, ['title', 'text'], ['services']);
  requireFields(data.reviews, ['title'], ['items']);
  for (const item of data.home.principles) requireFields(item, ['label', 'title', 'text']);
  for (const item of data.reviews.items) requireFields(item, ['name', 'stars', 'date', 'text']);
  if (data.contact.services.some(v => typeof v !== 'string')) throw new RequestError('invalid_fields');
  if (!data.name.trim() || !data.owner.trim()) throw new RequestError('invalid_fields');
  await saveSite(env, cleanSite(data));
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
  requireFields(b, ['title'], ['blocks', 'aliases']);
  if (!b.title.trim() || typeof b.published !== 'boolean' || b.aliases.some(v => typeof v !== 'string') || b.blocks.some(v => !v || !BLOCK_TYPES.includes(v.type))) throw new RequestError('invalid_fields');
  for (const block of b.blocks) {
    if (['heading', 'text', 'note'].includes(block.type)) requireFields(block, ['text']);
    else if (block.type === 'image') requireFields(block, ['src']);
    else if (block.type !== 'scaffold') {
      requireFields(block, [], ['items']);
      for (const item of block.items) requireFields(item, [], [], []);
    }
  }
  const row = await env.DB.prepare('SELECT position FROM pages WHERE slug = ?').bind(slug).first();
  if (!row) return json({ error: 'not_found' }, 404);
  let target = slug;
  const newSlug = str(b.slug, 60).trim().toLowerCase();
  if (newSlug && newSlug !== slug) {
    if (!SLUG_RE.test(newSlug) || RESERVED.has(newSlug)) return json({ error: 'invalid_slug' }, 400);
    if (await env.DB.prepare('SELECT 1 FROM pages WHERE slug = ?').bind(newSlug).first()) return json({ error: 'slug_exists' }, 409);
    target = newSlug;
    // stará adresa dál funguje jako přesměrování
    b.aliases = [...new Set(['/' + slug, ...b.aliases])];
  }
  if (target !== slug) {
    try { await renameAndSavePage(env, slug, target, cleanPage(b)); }
    catch (err) {
      if (/UNIQUE constraint failed: pages.slug/i.test(String(err))) return json({ error: 'slug_exists' }, 409);
      throw err;
    }
  } else await savePage(env, target, cleanPage(b), row.position);
  return json({ ok: true, slug: target });
}

async function removePage(env, slug) {
  await deletePage(env, slug);
  return json({ ok: true });
}

async function orderPages(request, env) {
  const b = await body(request);
  if (!Array.isArray(b.slugs) || b.slugs.length > 1000 || b.slugs.some(s => typeof s !== 'string' || !SLUG_RE.test(s)) || new Set(b.slugs).size !== b.slugs.length) throw new RequestError('invalid_fields');
  const slugs = b.slugs;
  await reorderPages(env, slugs);
  return json({ ok: true });
}

// ---------- fotky a dokumenty (Workers KV) ----------
// Ke každé fotce se ukládá i zmenšenina pod klíčem sm/<klíč> (na náhledy v galeriích).

const FILE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'application/pdf': 'pdf' };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function listImages(env) {
  const { results } = await env.DB.prepare('SELECT key, name, content_type, size, created_at FROM images ORDER BY created_at DESC').all();
  return json({ images: results.map((r) => Object.assign(r, { url: '/img/' + r.key })) });
}

async function uploadImage(request, env) {
  if (!env.IMAGES) return json({ error: 'images_not_configured' }, 503);
  let form;
  try { form = await request.formData(); }
  catch { throw new RequestError('invalid_fields'); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'missing_file' }, 400);
  const ext = FILE_TYPES[file.type];
  if (!ext) return json({ error: 'unsupported_type' }, 415);
  if (file.size > MAX_FILE_BYTES) return json({ error: 'too_large' }, 413);
  const bytes = await file.arrayBuffer();
  if (!matchesFileType(bytes, file.type)) return json({ error: 'unsupported_type' }, 415);
  const thumb = form.get('thumb');
  let thumbBytes;
  if (thumb !== null) {
    if (typeof thumb === 'string' || !thumb.type.startsWith('image/') || !FILE_TYPES[thumb.type]) return json({ error: 'unsupported_type' }, 415);
    if (thumb.size > MAX_FILE_BYTES) return json({ error: 'too_large' }, 413);
    thumbBytes = await thumb.arrayBuffer();
    if (!matchesFileType(thumbBytes, thumb.type)) return json({ error: 'unsupported_type' }, 415);
  }
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.IMAGES.put(key, bytes, { metadata: { contentType: file.type } });
  if (thumbBytes) await env.IMAGES.put('sm/' + key, thumbBytes, { metadata: { contentType: thumb.type } });
  const name = str(form.get('name') || file.name, 200);
  await env.DB.prepare('INSERT INTO images (key, name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, name, file.type, file.size, new Date().toISOString())
    .run();
  return json({ ok: true, key, name, url: '/img/' + key });
}

async function deleteImage(env, key) {
  if (env.IMAGES) await Promise.all([env.IMAGES.delete(key), env.IMAGES.delete('sm/' + key)]);
  await env.DB.prepare('DELETE FROM images WHERE key = ?').bind(key).run();
  return json({ ok: true });
}

export async function serveImage(env, key) {
  if (!env.IMAGES) return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
  let obj = await env.IMAGES.getWithMetadata(key, 'arrayBuffer');
  // starší soubory bez zmenšeniny → plná velikost
  if ((!obj || !obj.value) && key.startsWith('sm/')) obj = await env.IMAGES.getWithMetadata(key.slice(3), 'arrayBuffer');
  if (!obj || !obj.value) return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
  return new Response(obj.value, {
    headers: {
      ...SECURITY_HEADERS,
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'; sandbox",
      'Content-Type': (obj.metadata && obj.metadata.contentType) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// ---------- router ----------

export async function handleApi(request, env, path) {
  try {
    return await routeApi(request, env, path);
  } catch (err) {
    if (err instanceof RequestError) return json({ error: err.code }, err.status);
    throw err;
  }
}

async function routeApi(request, env, path) {
  const m = request.method;
  if (path.startsWith('/api/admin/') && !['GET', 'HEAD'].includes(m)) {
    if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);
  }
  // Check upload authentication before reading a potentially large body.
  if (path === '/api/admin/images' && m === 'POST') {
    if (!env.DB || !(await isAdmin(request, env))) return json({ error: 'unauthorized' }, 401);
  }
  if (!['GET', 'HEAD'].includes(m)) {
    const limit = path === '/api/admin/images' ? 21 * 1024 * 1024
      : path === '/api/contact' ? 2 * 1024 * 1024
      : path === '/api/admin/site' || /^\/api\/admin\/pages\//.test(path) ? 2 * 1024 * 1024 : 64 * 1024;
    request = await boundedRequest(request, limit);
  }
  // veřejně jen to, že web běží; jestli jsou nastavené klíče (e-maily, Mapy.com), vidí jen přihlášený admin
  if (path === '/api/health') {
    const status = { ok: true, db: !!env.DB, images: !!env.IMAGES };
    if (env.DB && (await isAdmin(request, env))) Object.assign(status, { mail: mailConfigured(env), adresy: !!env.MAPY_API_KEY });
    return json(status);
  }
  if (path === '/api/contact' && m === 'POST') return submitContact(request, env);
  if (path === '/api/gastro-quote' && m === 'POST') return gastroQuote(request, env);
  if (path === '/api/adresa' && m === 'GET') return suggestAddress(request, env);

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
