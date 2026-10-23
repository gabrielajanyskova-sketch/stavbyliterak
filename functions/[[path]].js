// Cloudflare Pages Function: celý web se skládá z obsahu v D1 (spravuje se v /admin),
// statické soubory (styly, logo, admin) servíruje Pages samo přes next().
import { ensureDb, getSite, getPages } from './_lib/db.js';
import { renderHome, renderPage, renderNotFound, renderSitemap, pageUrl } from './_lib/render.js';
import { handleApi, serveImage, json } from './_lib/api.js';

const STATIC = /^\/(assets\/|admin(\.html)?$|robots\.txt$|favicon)/;

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

function redirect(location) {
  return new Response(null, { status: 301, headers: { Location: location } });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (STATIC.test(path)) return next();

  try {
    await ensureDb(env);

    if (path.startsWith('/api/')) return await handleApi(request, env, path);
    if (path.startsWith('/img/')) return await serveImage(env, decodeURIComponent(path.slice(5)));
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

    const [site, pages] = await Promise.all([getSite(env), getPages(env)]);

    if (path === '/sitemap.xml') {
      return new Response(renderSitemap(pages, url.origin), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    }
    if (path === '/' || path === '/index.html') {
      return path === '/' ? html(renderHome(site, pages, url.origin)) : redirect('/');
    }

    // /termovize, /termovize/ i /termovize.html → jedna adresa
    const slug = path.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
    const page = pages.find((p) => p.slug === slug);
    if (page) {
      return path === pageUrl(slug) ? html(renderPage(site, pages, page, url.origin)) : redirect(pageUrl(slug) + url.search);
    }

    // staré adresy z předchozího webu
    const norm = (s) => s.replace(/\/+$/, '').toLowerCase();
    const aliased = pages.find((p) => (p.aliases || []).some((a) => norm(a) === norm(path)));
    if (aliased) return redirect(pageUrl(aliased.slug));

    return html(renderNotFound(site, pages, url.origin), 404);
  } catch (err) {
    console.error(err);
    if (path.startsWith('/api/')) return json({ error: 'server_error' }, 500);
    return new Response('Omlouváme se, web je dočasně nedostupný.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
