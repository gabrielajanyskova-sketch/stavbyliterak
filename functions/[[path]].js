// Cloudflare Pages Function: stránky se skládají z obsahu v D1 (spravuje se v /admin),
// statické soubory (styly, písma, obrázky, admin) servíruje Pages samo přes next().
import { ensureDb, getSite, getPages } from './_lib/db.js';
import { renderHome, renderPage, renderNotFound, renderSitemap, renderRobots, renderLlms, pageUrl, czTypo, HEAD_SCRIPT } from './_lib/render.js';
import { handleApi, serveImage, json } from './_lib/api.js';

const STATIC = /^\/(assets\/|admin(\.html)?$|favicon|manifest\.webmanifest$)/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Strict-Transport-Security': 'max-age=31536000',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

// Stránka smí spouštět jen vlastní skripty a jeden vložený (podle otisku) — případně
// podstrčený kód v obsahu by se nespustil. Styly jsou vložené přímo, proto 'unsafe-inline'.
let headScriptHash;
async function csp() {
  headScriptHash ??= crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(HEAD_SCRIPT))
    .then((d) => btoa(String.fromCharCode(...new Uint8Array(d))));
  return [
    "default-src 'self'",
    `script-src 'self' 'sha256-${await headScriptHash}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' mailto:",
    "frame-ancestors 'self'",
  ].join('; ');
}

async function respond(body, type, { status = 200, noindex = false } = {}) {
  const headers = { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache', ...SECURITY_HEADERS };
  if (type === 'text/html') {
    body = czTypo(body);
    headers['Content-Security-Policy'] = await csp();
  }
  if (noindex) headers['X-Robots-Tag'] = 'noindex';
  return new Response(body, { status, headers });
}

// Pojistka pro adresy z původního webu (Webnode), které nejsou v „aliases“ u stránek:
// podle slov v adrese pošle návštěvníka i Google trvale (301) na odpovídající stránku,
// aby se při přechodu neztratily pozice ve vyhledávání. Pořadí je důležité.
const OLD_URL_HINTS = [
  [/termo|tepeln/, 'termovize'],
  [/zakladac|travnik/, 'zemni-prace', '#zakladac'],
  [/zemni|vykop|autodoprav/, 'zemni-prace'],
  [/hlinik|pergol|zimni-zahrad|zabradl|oploc|zaskl/, 'hlinikovy-program'],
  [/lesen/, 'leseni'],
  [/protipozar|pozarn/, 'stavebni-prace'],
  [/gastro|oslav|svatb|party/, 'gastropujcovna'],
  [/certifik|osvedc/, 'certifikaty'],
  [/stavebni|elektro|instalat|malb|zednic|sadrokart|podlah|hodinovy/, 'stavebni-prace'],
  [/kontakt/, '', '#kontakt'],
  [/reference|recenz|o-nas|o-mne/, ''],
];

function guessOldUrl(path, pages) {
  let p = path;
  try {
    p = decodeURIComponent(path);
  } catch {
    // poškozené kódování adresy — hledá se v ní tak, jak přišla
  }
  p = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [re, slug, hash = ''] of OLD_URL_HINTS) {
    if (!re.test(p)) continue;
    if (slug && !pages.some((x) => x.slug === slug)) continue;
    return pageUrl(slug) + hash;
  }
  return null;
}

// Styly se vkládají přímo do stránky (žádný požadavek navíc, který by blokoval vykreslení)
// a main.js i leseni.js dostanou v adrese otisk obsahu, takže se můžou ukládat do mezipaměti na rok
// (po změně má soubor novou adresu a prohlížeč si ho stáhne znovu).
// Načte se jednou na instanci Workeru — po novém nasazení vzniká instance nová.
let assetsPromise;
function loadAssets(env, origin) {
  const get = (path) => env.ASSETS.fetch(new Request(origin + path)).then((r) => (r.ok ? r.text() : ''));
  const hashOf = async (text) => {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].slice(0, 5).map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  assetsPromise ??= Promise.all([get('/assets/css/fonts.css'), get('/assets/css/style.css'), get('/assets/js/main.js'), get('/assets/js/leseni.js')])
    .then(async ([fonts, style, js, scaffold]) => {
      const css = (fonts + style)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{};])\s*/g, '$1')
        .trim();
      return { css: fonts && style ? css : '', js: js ? await hashOf(js) : '', scaffold: scaffold ? await hashOf(scaffold) : '' };
    })
    .catch(() => {
      assetsPromise = undefined;
      return {};
    });
  return assetsPromise;
}

const redirect = (location) => new Response(null, { status: 301, headers: { Location: location } });

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (STATIC.test(path)) return next();

  // Hlavní adresa webu (SITE_URL ve wrangler.toml): stavbyliterak.cz → www.stavbyliterak.cz.
  // Jinde (*.pages.dev, náhledy) web běží, ale nesmí se indexovat — duplicitní obsah.
  const primary = env.SITE_URL ? new URL(env.SITE_URL) : url;
  if (url.hostname !== primary.hostname && url.hostname === primary.hostname.replace(/^www\./, '')) {
    return redirect(primary.origin + path + url.search);
  }
  const noindex = url.hostname !== primary.hostname;

  try {
    await ensureDb(env);

    if (path.startsWith('/api/')) return await handleApi(request, env, path);
    if (path.startsWith('/img/')) return await serveImage(env, decodeURIComponent(path.slice(5)));
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

    const [site, pages, assets] = await Promise.all([getSite(env), getPages(env), loadAssets(env, url.origin)]);
    // origin = adresa, na které web právě běží — obrázek pro sdílení musí jít stáhnout odsud,
    // dokud hlavní doména ještě neukazuje na Cloudflare (náhled odkazu by byl bez obrázku)
    const ctx = { site, pages, assets, base: primary.origin, origin: url.origin, noindex };

    if (path === '/robots.txt') return respond(renderRobots(ctx), 'text/plain');
    if (path === '/sitemap.xml') return respond(renderSitemap(ctx), 'application/xml', { noindex });
    if (path === '/llms.txt') return respond(renderLlms(ctx), 'text/markdown', { noindex });
    if (path === '/') return respond(renderHome(ctx), 'text/html', { noindex });
    if (path === '/index.html') return redirect('/');

    // /termovize, /termovize/ i /termovize.html → jedna adresa
    const slug = path.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
    const page = pages.find((p) => p.slug === slug);
    if (page) {
      return path === pageUrl(slug) ? respond(renderPage(ctx, page), 'text/html', { noindex }) : redirect(pageUrl(slug) + url.search);
    }

    // staré adresy z předchozího webu
    const norm = (s) => s.replace(/\/+$/, '').toLowerCase();
    const aliased = pages.find((p) => (p.aliases || []).some((a) => norm(a) === norm(path)));
    if (aliased) return redirect(pageUrl(aliased.slug));
    const guessed = guessOldUrl(path, pages);
    if (guessed) return redirect(guessed);

    return respond(renderNotFound(ctx), 'text/html', { status: 404, noindex: true });
  } catch (err) {
    console.error(err);
    if (path.startsWith('/api/')) return json({ error: 'server_error' }, 500);
    return respond('Omlouváme se, web je dočasně nedostupný.', 'text/plain', { status: 500 });
  }
}
