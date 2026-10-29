// API pro poptávkový formulář a administraci (/admin).
import { BLOCK_TYPES, esc, catalogItems, money, maxCount } from './render.js';
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

// Počítadlo pokusů na IP v okně (sdílí ho přihlášení do adminu i formulář, liší se předponou klíče).
// Vrací true, když je limit vyčerpaný; jinak pokus započítá.
async function overLimit(env, key, limit, windowMs) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT attempt_count, window_start FROM login_attempts WHERE ip = ?').bind(key).first();
  const active = !!row && now - new Date(row.window_start).getTime() < windowMs;
  if (active && row.attempt_count >= limit) return true;
  if (active) await env.DB.prepare('UPDATE login_attempts SET attempt_count = attempt_count + 1 WHERE ip = ?').bind(key).run();
  else {
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, attempt_count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(ip) DO UPDATE SET attempt_count = 1, window_start = excluded.window_start`
    )
      .bind(key, new Date(now).toISOString())
      .run();
  }
  return false;
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

async function submitContact(request, env) {
  const b = await body(request);
  const field = (k, max = 200) => String(b[k] || '').trim().slice(0, max);
  const name = field('jmeno');
  const phone = field('telefon', 40);
  const email = field('email', 120);
  // stačí jméno a e-mail nebo telefon (starší otevřené stránky posílaly jen telefon)
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || (!validEmail && !phone)) return json({ error: 'missing_fields' }, 400);
  if (field('web')) return json({ ok: true }); // past na roboty (skryté pole)
  if (!mailConfigured(env)) return json({ error: 'mail_not_configured' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.DB && (await overLimit(env, 'contact:' + ip, CONTACT_LIMIT, CONTACT_WINDOW_MS))) return json({ error: 'too_many_requests' }, 429);

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
    return json({ error: 'send_failed' }, 502);
  }
  return json({ ok: true });
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
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
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
  const ok = !!env.ADMIN_PASSWORD && typeof b.password === 'string' && sameText(b.password.trim(), String(env.ADMIN_PASSWORD).trim());
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
  // úklid prošlých přihlášení, kódů a starých počítadel
  const nowIso = new Date(now).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(nowIso),
    env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(nowIso),
    env.DB.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(new Date(now - 24 * 3600 * 1000).toISOString()),
  ]);

  // Druhý krok e-mailem, pokud je nastavené odesílání — samotné uniklé heslo pak nestačí.
  if (!mailConfigured(env)) return json({ ok: true, token: await issueSession(env) });

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
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'missing_file' }, 400);
  const ext = FILE_TYPES[file.type];
  if (!ext) return json({ error: 'unsupported_type' }, 415);
  if (file.size > MAX_FILE_BYTES) return json({ error: 'too_large' }, 413);
  const key = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.IMAGES.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  const thumb = form.get('thumb');
  if (thumb && typeof thumb !== 'string' && FILE_TYPES[thumb.type] && thumb.size <= MAX_FILE_BYTES) {
    await env.IMAGES.put('sm/' + key, await thumb.arrayBuffer(), { metadata: { contentType: thumb.type } });
  }
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
  if (!env.IMAGES) return new Response('Not found', { status: 404 });
  let obj = await env.IMAGES.getWithMetadata(key, 'arrayBuffer');
  // starší soubory bez zmenšeniny → plná velikost
  if ((!obj || !obj.value) && key.startsWith('sm/')) obj = await env.IMAGES.getWithMetadata(key.slice(3), 'arrayBuffer');
  if (!obj || !obj.value) return new Response('Not found', { status: 404 });
  return new Response(obj.value, {
    headers: {
      'Content-Type': (obj.metadata && obj.metadata.contentType) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ---------- router ----------

export async function handleApi(request, env, path) {
  const m = request.method;
  if (path === '/api/health') return json({ ok: true, db: !!env.DB, images: !!env.IMAGES, mail: mailConfigured(env), adresy: !!env.MAPY_API_KEY });
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
