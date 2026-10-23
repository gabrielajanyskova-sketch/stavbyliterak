// Vykreslení stránek z obsahu v databázi (na serveru — kvůli SEO a rychlosti).
// Text z adminu se vždy escapuje; formátování umí jen **tučně** a [odkaz](url).

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function safeUrl(url) {
  const u = String(url || '').trim();
  return /^(https?:\/\/|mailto:|tel:|\/|#|\?)/i.test(u) ? u : '#';
}

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a class="textlink" href="${esc(safeUrl(url.replace(/&amp;/g, '&')))}">${label}</a>`);
}

// Prostý text bez formátování — pro meta popisky, schema.org a llms.txt
function plain(text) {
  return String(text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Prázdný řádek = nový odstavec, jednoduché zalomení = <br>
function paragraphs(text, cls = '') {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p${cls ? ` class="${cls}"` : ''}>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

const tel = (phone) => String(phone || '').replace(/[^+\d]/g, '');
const abs = (base, url) => (/^https?:\/\//.test(url) ? url : base + url);
export const pageUrl = (slug) => (slug ? `/${slug}` : '/');

const OG_IMAGE = '/assets/img/og.jpg';

const RIDGE = `<svg class="ridge" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
<path d="M0 190 70 150 120 168 190 108 240 132 300 62 318 58 336 70 400 120 450 104 520 150 600 128V260H0Z" fill="#252a30"/>
<path d="M0 230 90 196 160 214 250 170 330 196 420 160 500 190 600 172V260H0Z" fill="#2c323a"/>
<path d="M0 190 70 150 120 168 190 108 240 132 300 62 318 58 336 70 400 120 450 104 520 150 600 128" fill="none" stroke="#f39a1e" stroke-width="2" vector-effect="non-scaling-stroke"/>
</svg>`;

// ---------- schema.org ----------

function postalAddress(address) {
  const m = String(address || '').match(/^(.*?),\s*(\d{3}\s?\d{2})\s+(.+)$/);
  return m
    ? { '@type': 'PostalAddress', streetAddress: m[1], postalCode: m[2], addressLocality: m[3], addressCountry: 'CZ' }
    : { '@type': 'PostalAddress', streetAddress: address, addressCountry: 'CZ' };
}

function businessNode(ctx) {
  const { site, pages, base } = ctx;
  const m = String(site.address || '').match(/\d{3}\s?\d{2}\s+(.+)$/);
  return {
    '@type': 'HomeAndConstructionBusiness',
    '@id': `${base}/#firma`,
    name: site.name,
    url: `${base}/`,
    logo: `${base}/assets/img/logo.webp`,
    image: `${base}${OG_IMAGE}`,
    telephone: site.phone,
    email: site.email,
    address: postalAddress(site.address),
    founder: { '@type': 'Person', name: site.owner },
    identifier: { '@type': 'PropertyValue', propertyID: 'IČO', value: site.ico },
    areaServed: m ? { '@type': 'City', name: m[1] } : undefined,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Služby',
      itemListElement: pages.map((p) => ({ '@type': 'Offer', itemOffered: { '@id': `${base}${pageUrl(p.slug)}#sluzba` } })),
    },
  };
}

function websiteNode(ctx) {
  return { '@type': 'WebSite', '@id': `${ctx.base}/#web`, url: `${ctx.base}/`, name: ctx.site.name, inLanguage: 'cs', publisher: { '@id': `${ctx.base}/#firma` } };
}

function pageSchema(ctx, p) {
  const { base } = ctx;
  const url = base + pageUrl(p.slug);
  const blocks = p.blocks || [];
  const faq = blocks.filter((b) => b.type === 'faq').flatMap((b) => b.items || []);
  const catalog = blocks.filter((b) => b.type === 'catalog').flatMap((b) => b.items || []);
  const service = {
    '@type': 'Service',
    '@id': `${url}#sluzba`,
    name: p.title,
    serviceType: p.title,
    description: plain(p.meta_description || p.lead),
    url,
    provider: { '@id': `${base}/#firma` },
    areaServed: businessNode(ctx).areaServed,
  };
  if (p.photo) service.image = abs(base, p.photo);
  if (catalog.length) {
    service.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: p.title,
      itemListElement: catalog.map((i) => ({ '@type': 'Offer', name: i.title, description: plain([i.text, i.spec].filter(Boolean).join(' · ')) })),
    };
  }
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${url}#stranka`,
      url,
      name: p.meta_title || p.title,
      description: plain(p.meta_description || p.lead),
      inLanguage: 'cs',
      isPartOf: { '@id': `${base}/#web` },
      about: { '@id': `${url}#sluzba` },
      breadcrumb: { '@id': `${url}#drobecky` },
      dateModified: p.updated_at || undefined,
    },
    service,
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#drobecky`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Úvod', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name: p.crumb || p.title, item: url },
      ],
    },
    businessNode(ctx),
    websiteNode(ctx),
  ];
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#otazky`,
      isPartOf: { '@id': `${url}#stranka` },
      mainEntity: faq.map((q) => ({ '@type': 'Question', name: plain(q.title), acceptedAnswer: { '@type': 'Answer', text: plain(q.text) } })),
    });
  }
  return graph;
}

function jsonLd(graph) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// ---------- společné části ----------

function head(ctx, { title, description, path, image, schema, preload = '' }) {
  const url = ctx.base + path;
  const img = abs(ctx.base, image || OG_IMAGE);
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${ctx.noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="cs_CZ">
<meta property="og:site_name" content="${esc(ctx.site.name)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1d2126">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="preload" href="/assets/fonts/barlow-condensed-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/ibm-plex-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/assets/css/style.css">
<script>document.documentElement.classList.add("js")</script>
<script type="application/ld+json">${jsonLd(schema)}</script>
</head>
<body>
<a class="skip" href="#obsah">Přeskočit na obsah</a>
`;
}

const LOGO = (name) => `<img src="/assets/img/logo.webp" alt="${esc(name)}" width="288" height="171">`;

function header(ctx, activeSlug) {
  const { site, pages } = ctx;
  const links = pages
    .filter((p) => p.in_nav)
    .map((p) => `<a href="${pageUrl(p.slug)}"${p.slug === activeSlug ? ' aria-current="page"' : ''}>${esc(p.nav_label || p.title)}</a>`)
    .join('\n');
  return `<header class="site-header">
<div class="wrap">
<a class="brand" href="/" aria-label="${esc(site.name)} — úvod">${LOGO(site.name)}</a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
<nav class="nav" id="menu" aria-label="Hlavní menu">
${links}
<a href="#kontakt">Kontakt</a>
<a class="nav-call" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a>
</nav>
</div>
</header>
<main id="obsah">
`;
}

function contact(site, preselect) {
  const c = site.contact || {};
  const opts = (c.services || []).map((s) => `<option${s === preselect ? ' selected' : ''}>${esc(s)}</option>`).join('');
  return `
<section class="section section-dark" id="kontakt">
<div class="wrap contact-grid">
<div class="reveal">
<span class="label">Kontakt</span>
<h2>${esc(c.title)}</h2>
<p class="contact-intro">${inline(c.text)}</p>
<dl class="contact-lines">
<div><dt>Telefon</dt><dd><a class="big" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a></dd></div>
<div><dt>E-mail</dt><dd><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></dd></div>
<div><dt>Adresa</dt><dd>${esc(site.address)}</dd></div>
<div><dt>Fakturační údaje</dt><dd>${esc(site.owner)} · IČ ${esc(site.ico)}</dd></div>
</dl>
</div>
<form class="form reveal" id="poptavka" data-to="${esc(site.email)}">
<div><label for="sluzba">O co jde</label><select id="sluzba" name="sluzba">${opts}</select></div>
<div class="row">
<div><label for="jmeno">Jméno</label><input id="jmeno" name="jmeno" autocomplete="name" required></div>
<div><label for="telefon">Telefon</label><input id="telefon" name="telefon" type="tel" autocomplete="tel" required></div>
</div>
<div><label for="misto">Místo (obec)</label><input id="misto" name="misto" autocomplete="address-level2"></div>
<div hidden><label for="web">Nevyplňujte</label><input id="web" name="web" tabindex="-1" autocomplete="off"></div>
<div><label for="zprava">Co potřebujete</label><textarea id="zprava" name="zprava" placeholder="Stačí pár vět — rozměry, termín, cokoli víte."></textarea></div>
<div><button class="btn" type="submit">Odeslat poptávku</button></div>
<p class="note" data-status role="status">Ozvu se vám co nejdřív.</p>
</form>
</div>
</section>
`;
}

function footer(ctx) {
  const { site, pages } = ctx;
  const links = pages.map((p) => `<a href="${pageUrl(p.slug)}">${esc(p.nav_label || p.title)}</a>`).join('\n');
  return `</main>
<footer class="site-footer">
<div class="wrap">
<a href="/" aria-label="${esc(site.name)} — úvod">${LOGO(site.name)}</a>
<nav aria-label="Patička">
${links}
<a href="#kontakt">Kontakt</a>
</nav>
<span>© ${esc(site.owner)} · <a href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a></span>
</div>
</footer>
<script src="/assets/js/main.js" defer></script>
</body>
</html>
`;
}

// ---------- bloky obsahu ----------

const items = (b) => (Array.isArray(b.items) ? b.items : []);
const list = (tag, cls, rows) => `<${tag} class="${cls}">\n${rows.join('\n')}\n</${tag}>`;

const BLOCKS = {
  heading: (b) => {
    const tag = b.level === 3 ? 'h3' : 'h2';
    return `<${tag}${b.anchor ? ` id="${esc(b.anchor)}"` : ''}>${esc(b.text)}</${tag}>`;
  },
  text: (b) => paragraphs(b.text),
  note: (b) => paragraphs(b.text, b.style === 'info' ? 'todo is-info' : 'todo'),
  bullets: (b) => `<ul>\n${items(b).map((i) => `<li>${inline(i.text)}</li>`).join('\n')}\n</ul>`,
  numbered: (b) => list('ol', 'uses', items(b).map((i) => `<li><div><strong>${esc(i.title)}</strong><span>${inline(i.text)}</span></div></li>`)),
  steps: (b) => list('ol', 'timeline', items(b).map((i) => `<li><strong>${esc(i.title)}</strong>${inline(i.text)}</li>`)),
  grid: (b) => list('div', 'products', items(b).map((i) => `<div><h3>${esc(i.title)}</h3>${i.text ? `<p>${inline(i.text)}</p>` : ''}</div>`)),
  faq: (b) => list('div', 'faq', items(b).map((i) => `<details><summary>${esc(i.title)}</summary>${paragraphs(i.text)}</details>`)),
  catalog: (b) =>
    list('ul', 'catalog', items(b).map((i) =>
      `<li><h3>${esc(i.title)}</h3><div><p>${inline(i.text)}</p>${i.spec ? `<p class="spec">${esc(i.spec)}</p>` : ''}</div>${
        i.count ? `<span class="count">${esc(i.count)}</span>` : ''}</li>`)),
  image: (b) =>
    b.src
      ? `<figure class="content-photo"><img src="${esc(safeUrl(b.src))}" alt="${esc(b.caption)}" loading="lazy" decoding="async">${
          b.caption ? `<figcaption class="label">${esc(b.caption)}</figcaption>` : ''}</figure>`
      : '',
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

const renderBlocks = (blocks) => (blocks || []).map((b) => (BLOCKS[b.type] ? BLOCKS[b.type](b) : '')).filter(Boolean).join('\n');

function pageHero(p) {
  const facts = (p.facts || []).filter((f) => f.label || f.value);
  const factsHtml = facts.length
    ? `<dl class="facts">\n${facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${inline(f.value)}</dd></div>`).join('\n')}\n</dl>`
    : '';
  const thermal = p.theme === 'thermal';
  const photo = p.photo
    ? `<figure class="hero-photo"><img src="${esc(safeUrl(p.photo))}" alt="${esc(p.photo_caption || p.title)}" fetchpriority="high">${
        p.photo_caption ? `<figcaption class="label">${esc(p.photo_caption)}</figcaption>` : ''}</figure>`
    : '';
  return `<section class="page-hero${thermal ? ' thermal' : ''}">
<div class="wrap">
<nav class="label crumbs" aria-label="Drobečková navigace"><a href="/">Úvod</a> / <span aria-current="page">${esc(p.crumb || p.title)}</span></nav>
<div class="page-hero-grid">
<div>
<h1>${esc(p.title)}</h1>
<p class="lead">${inline(p.lead)}</p>${thermal ? '\n<div class="scale" aria-hidden="true"><span>−5 °C</span><i></i><span>+22 °C</span></div>' : ''}
${photo ? factsHtml : ''}
</div>
${photo || factsHtml}
</div>
</div>
</section>
`;
}

function ask(site, p) {
  return `<aside class="ask" aria-label="Poptávka">
<span class="label">Poptávka</span>
<h2>${esc(p.ask_title || p.title)}</h2>
<p>Popište, co potřebujete — ozvu se a domluvíme se.</p>
<a class="phone" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a>
<a class="mail" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
${p.ask_note ? `<p class="ask-note">${inline(p.ask_note)}</p>` : ''}
<a class="btn" href="#kontakt">Napsat poptávku</a>
</aside>`;
}

// ---------- stránky ----------

export function renderPage(ctx, p) {
  const path = pageUrl(p.slug);
  return (
    head(ctx, {
      title: p.meta_title || `${p.title} | ${ctx.site.name}`,
      description: plain(p.meta_description || p.lead),
      path,
      image: p.photo,
      schema: pageSchema(ctx, p),
      preload: p.photo ? `<link rel="preload" href="${esc(safeUrl(p.photo))}" as="image" fetchpriority="high">\n` : '',
    }) +
    header(ctx, p.slug) +
    pageHero(p) +
    `<section class="section">
<div class="wrap content-grid">
<div class="prose">
${renderBlocks(p.blocks)}
</div>
${ask(ctx.site, p)}
</div>
</section>
` +
    contact(ctx.site, p.form_service) +
    footer(ctx)
  );
}

export function renderHome(ctx) {
  const { site, pages, base } = ctx;
  const h = site.home || {};
  const chooser = pages
    .filter((p) => p.in_chooser)
    .map((p, i) =>
      `<li><a href="${pageUrl(p.slug)}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="name">${esc(p.chooser_title || p.title)}</span><span class="arrow" aria-hidden="true">→</span><span class="hint">${esc(p.chooser_hint)}</span></a></li>`)
    .join('\n');
  const principles = (h.principles || []).map((x) => `<div><span class="label">${esc(x.label)}</span><h3>${esc(x.title)}</h3><p>${inline(x.text)}</p></div>`).join('\n');
  const promo = pages.find((p) => p.slug === h.promo_page);
  const description = plain(h.meta_description);
  const schema = [
    { '@type': 'WebPage', '@id': `${base}/#stranka`, url: `${base}/`, name: h.meta_title || site.name, description, inLanguage: 'cs', isPartOf: { '@id': `${base}/#web` }, about: { '@id': `${base}/#firma` } },
    businessNode(ctx),
    websiteNode(ctx),
  ];

  return (
    head(ctx, { title: h.meta_title || site.name, description, path: '/', schema }) +
    header(ctx, '') +
    `<section class="hero">
<div class="hero-panel">
<h1>${esc(h.hero_title)} <span>${esc(h.hero_accent)}</span></h1>
<p class="hero-meta">${esc(h.hero_meta)}</p>
${RIDGE}
</div>
<nav class="hero-index" aria-labelledby="rozcestnik">
<h2 class="label" id="rozcestnik">${esc(h.chooser_label)}</h2>
<ul class="chooser">
${chooser}
</ul>
</nav>
</section>
<section class="section">
<div class="wrap">
<div class="section-head reveal">
<div><span class="label">${esc(h.about_label)}</span><h2>${esc(h.about_title)}</h2></div>
<div>${paragraphs(h.about_text)}</div>
</div>
<div class="principles reveal">
${principles}
</div>
</div>
</section>
${promo ? `<section class="section section-concrete">
<div class="wrap">
<div class="section-head reveal">
<div><span class="label">${esc(h.promo_label)}</span><h2>${esc(h.promo_title)}</h2></div>
<div>${paragraphs(h.promo_text)}</div>
</div>
<a class="btn btn-line reveal" href="${pageUrl(promo.slug)}">${esc(h.promo_button || 'Více')}</a>
</div>
</section>` : ''}` +
    contact(site, '') +
    footer(ctx)
  );
}

export function renderNotFound(ctx) {
  return (
    head({ ...ctx, noindex: true }, { title: `Stránka nenalezena | ${ctx.site.name}`, description: '', path: '/', schema: [websiteNode(ctx)] }) +
    header(ctx, '') +
    `<section class="page-hero">
<div class="wrap">
<h1>Tahle stránka tu není</h1>
<p class="lead">Možná se přesunula při předělávání webu. Zkuste <a class="textlink" href="/">úvodní stránku</a>, nebo rovnou zavolejte.</p>
</div>
</section>
` +
    contact(ctx.site, '') +
    footer(ctx)
  );
}

// ---------- soubory pro vyhledávače a AI ----------

export function renderSitemap(ctx) {
  const rows = [{ loc: '/', mod: null }, ...ctx.pages.map((p) => ({ loc: pageUrl(p.slug), mod: p.updated_at }))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map((r) => `<url><loc>${esc(ctx.base + r.loc)}</loc>${r.mod ? `<lastmod>${esc(r.mod.slice(0, 10))}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

export function renderRobots(ctx) {
  if (ctx.noindex) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${ctx.base}/sitemap.xml\n`;
}

// llms.txt — stručný strojově čitelný přehled pro AI vyhledávače (GEO/AEO)
export function renderLlms(ctx) {
  const { site, pages, base } = ctx;
  const h = site.home || {};
  const out = [`# ${site.name}`, '', `> ${plain(h.meta_description)}`, ''];
  out.push(
    `- Provozovatel: ${site.owner}, IČ ${site.ico}`,
    `- Adresa: ${site.address}`,
    `- Telefon: ${site.phone}`,
    `- E-mail: ${site.email}`,
    '',
    '## Služby',
    '',
  );
  for (const p of pages) {
    out.push(`### [${p.title}](${base}${pageUrl(p.slug)})`, '', plain(p.lead), '');
    for (const f of p.facts || []) out.push(`- ${plain(f.label)}: ${plain(f.value)}`);
    const faq = (p.blocks || []).filter((b) => b.type === 'faq').flatMap((b) => b.items || []);
    if (faq.length) {
      out.push('', 'Časté otázky:', '');
      for (const q of faq) out.push(`- **${plain(q.title)}** ${plain(q.text)}`);
    }
    out.push('');
  }
  return out.join('\n');
}
