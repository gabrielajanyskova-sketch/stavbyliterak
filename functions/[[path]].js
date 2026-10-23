// Cloudflare Pages Function: stránky se skládají z obsahu v D1 (spravuje se v /admin),
// statické soubory (styly, písma, obrázky, admin) servíruje Pages samo přes next().
import { ensureDb, getSite, getPages } from './_lib/db.js';
import { renderHome, renderPage, renderNotFound, renderSitemap, renderRobots, renderLlms, pageUrl } from './_lib/render.js';
import { handleApi, serveImage, json } from './_lib/api.js';

const STATIC = /^\/(assets\/|admin(\.html)?$|favicon)/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function respond(body, type, { status = 200, noindex = false } = {}) {
  const headers = { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache', ...SECURITY_HEADERS };
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
  [/protipozar|pozarn/, 'stavebni-prace', '#protipozarni'],
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

    const [site, pages] = await Promise.all([getSite(env), getPages(env)]);
    const ctx = { site, pages, base: primary.origin, noindex };

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
