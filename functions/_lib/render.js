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

// Česká typografie v hotovém HTML (jen v textu, ne ve značkách a skriptech):
// jednopísmenné předložky a spojky nezůstanou na konci řádku, číslo se nerozdělí
// od jednotky ani telefonní číslo na dva řádky — nezlomitelná mezera.
export function czTypo(html) {
  return html
    .split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/)
    .map((part, i) => (i % 2 ? part : part
      .replace(/(?<=^|[\s(„])([kvszouai]) +/gi, '$1\u00a0')
      .replace(/(\d) (?=\d{3}\b|(?:%|Kč|m²|m³|m|km|ks|t|°C)(?!\p{L}))/gu, '$1\u00a0')))
    .join('');
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

// Zmenšenina fotky (max. 800 px) — u fotek z repozitáře v /assets/img/foto/sm/,
// u nahraných z adminu pod /img/sm/. Plná velikost jen ve zvětšení galerie.
function thumb(src) {
  const u = safeUrl(src);
  const m = u.match(/^(\/assets\/img\/foto\/|\/img\/)(?!sm\/)(.+)$/);
  return m && !isPdf(u) ? `${m[1]}sm/${m[2]}` : u;
}
const isPdf = (src) => /\.pdf$/i.test(src);

// Ceny půjčovny (víkend, jeden den, záloha) se zadávají v adminu u položek katalogu.
// Na stránce se nikdy nevypisují — celkovou cenu spočítá server (/api/gastro-quote).
export const catalogItems = (p) => (p.blocks || []).filter((b) => b.type === 'catalog').flatMap((b) => b.items || []);
export function money(v) {
  const n = parseFloat(String(v ?? '').replace(/[\s\u00a0]|kč|,-/gi, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const hasPrices = (p) => catalogItems(p).some((i) => money(i.price_weekend) !== null || money(i.price_day) !== null);

// Služba = stránka, ze které jde poptávka (má předvybranou službu ve formuláři);
// ostatní stránky (např. Certifikáty) jsou jen informační.
const isService = (p) => !!p.form_service;
const LEGAL_SLUG = 'pravni-informace';

const tel = (phone) => String(phone || '').replace(/[^+\d]/g, '');
const abs = (base, url) => (/^https?:\/\//.test(url) ? url : base + url);
export const pageUrl = (slug) => (slug ? `/${slug}` : '/');

const OG_IMAGE = '/assets/img/og.jpg';

// Jediný vložený skript (třída „js“ ještě před vykreslením — kvůli animacím a prvkům jen pro JS).
// Router z něj počítá otisk pro Content-Security-Policy — při změně se hlavička upraví sama.
export const HEAD_SCRIPT = 'document.documentElement.classList.add("js")';

// Beskydy z Frýdku-Místku (pohled na jih), stylizované podle polohy vrcholů:
// vzadu Travný a Lysá hora s vysílačem, vpředu bližší hřbet Ondřejníku se Skalkou.
// SVG drží poměr stran (výška podle šířky), takže se hory nezploští ani neořežou.
const RIDGE_BACK =
  'M0 172C36 164 70 140 94 112C102 102 108 96 113 96C119 96 124 104 132 114C150 134 170 142 190 138C214 133 238 100 262 74C274 61 286 54 300 52C314 54 326 61 338 72C362 94 392 112 430 118C470 124 520 126 800 140';
const RIDGE_FRONT =
  'M250 260C340 248 410 190 448 140C468 112 486 90 508 78C522 71 536 70 552 72C574 75 594 70 616 62C630 57 642 56 656 60C690 70 722 104 756 128C774 140 788 146 800 148';
const RIDGE = `<svg class="ridge" viewBox="0 -32 800 292" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
<path d="${RIDGE_BACK}V260H0Z" fill="#2b3138"/>
<path class="ridge-line" d="${RIDGE_BACK}" fill="none" stroke="#f39a1e" stroke-width="1.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
<g class="tower" transform="translate(300 54) scale(.7) translate(-112 -78)">
<path d="M110 1 110.6 28 111.5 36 112.6 42 115 47.5 117 53H103L105 47.5 107.4 42 108.5 36 109.4 28Z" fill="#f39a1e"/>
<path d="M93 66h3.4v13H93zM99.5 66h3.4v13h-3.4zM121.5 66h3.4v13h-3.4zM128 66h3.4v13H128z" fill="#f39a1e"/>
<path d="M82 61 108 51 146 55 113 68Z" fill="#2b3138" stroke="#f39a1e" stroke-width=".9" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
<path d="M82 61 113 68 146 55" fill="none" stroke="#f39a1e" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
<circle class="tower-light" cx="110" cy="1.5" r="2.2" fill="#ff4a2b"/>
</g>
<path d="${RIDGE_FRONT}V260H250Z" fill="#22262c"/>
<clipPath id="ridge-sky"><rect x="458" width="342" height="260"/></clipPath>
<path d="${RIDGE_FRONT}" clip-path="url(#ridge-sky)" fill="none" stroke="#f39a1e" stroke-opacity="0.55" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
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
    areaServed: m ? [{ '@type': 'City', name: m[1] }, { '@type': 'AdministrativeArea', name: `okres ${m[1]}` }] : undefined,
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`,
    sameAs: site.reviews?.google_url ? [site.reviews.google_url] : undefined,
    knowsAbout: pages.filter(isService).map((p) => p.title),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Služby',
      itemListElement: pages.filter(isService).map((p) => ({ '@type': 'Offer', itemOffered: { '@id': `${base}${pageUrl(p.slug)}#sluzba` } })),
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
  const photos = [p.photo, ...blocks.filter((b) => b.type === 'gallery' || b.type === 'image').flatMap((b) => (b.items || [b]).map((i) => i.src))]
    .filter((src) => src && !isPdf(src));
  if (photos.length) service.image = [...new Set(photos)].slice(0, 10).map((src) => abs(base, src));
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
      about: isService(p) ? { '@id': `${url}#sluzba` } : { '@id': `${base}/#firma` },
      breadcrumb: { '@id': `${url}#drobecky` },
      dateModified: p.updated_at || undefined,
    },
    ...(isService(p) ? [service] : []),
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

function head(ctx, { title, description, path, image, schema, preload = '', canonical = true }) {
  const url = ctx.base + path;
  // WebP neumí spolehlivě všechny sítě (LinkedIn, starší Messenger) → pak společný og.jpg
  if (image && !/\.(jpe?g|png)$/i.test(image)) image = '';
  const img = abs(ctx.noindex && ctx.origin ? ctx.origin : ctx.base, image || OG_IMAGE);
  return `<!doctype html>
<html lang="cs" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${ctx.noindex ? 'noindex' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
${canonical ? `<link rel="canonical" href="${esc(url)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:locale" content="cs_CZ">
<meta property="og:site_name" content="${esc(ctx.site.name)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(img)}">
${image ? '' : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1d2126">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/favicon.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/barlow-condensed-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/ibm-plex-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${preload}${ctx.assets?.css ? `<style>${ctx.assets.css}</style>` : '<link rel="stylesheet" href="/assets/css/fonts.css">\n<link rel="stylesheet" href="/assets/css/style.css">'}
<script>${HEAD_SCRIPT}</script>
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
  // vedlejší služba (gastropůjčovna) — vpravo za telefonem, vizuálně oddělená od stavebních služeb
  const extra = pages
    .filter((p) => p.nav_extra)
    .map((p) => `<a class="nav-extra" href="${pageUrl(p.slug)}"${p.slug === activeSlug ? ' aria-current="page"' : ''}>${esc(p.nav_label || p.title)}</a>`)
    .join('\n');
  return `<header class="site-header">
<div class="wrap">
<a class="brand" href="/" aria-label="${esc(site.name)} — úvod">${LOGO(site.name)}</a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
<nav class="nav" id="menu" aria-label="Hlavní menu">
${links}
<a href="#kontakt">Kontakt</a>
<a class="nav-call" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a>
${extra}
</nav>
</div>
</header>
<main id="obsah">
`;
}

function contact(ctx, preselect) {
  const { site } = ctx;
  const c = site.contact || {};
  const legal = ctx.pages.find((p) => p.slug === LEGAL_SLUG);
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
<div><dt>Adresa</dt><dd><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(site.address)}" target="_blank" rel="noopener">${esc(site.address)}</a></dd></div>
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
<div><label for="zprava">Popište mi, čeho se váš dotaz týká</label><textarea id="zprava" name="zprava" placeholder="Stačí pár vět: rozměry, termín, cokoli víte."></textarea></div>
<div><button class="btn" type="submit">Odeslat poptávku</button></div>
<p class="note" data-status role="status">Poskytnuté údaje budou použity <strong>POUZE</strong> k vyřízení poptávky.${
      legal ? ` <a href="${pageUrl(LEGAL_SLUG)}#osobni-udaje">Ochrana osobních údajů</a>` : ''}</p>
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
<div class="site-footer-bottom">
<span>© ${new Date().getFullYear()} ${esc(site.owner)} · <a href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a></span>
<span class="site-footer-credit">Web: <a href="https://janyskovadigital.cz" target="_blank" rel="noopener">janyskovadigital.cz</a></span>
</div>
</div>
</footer>
<nav class="callbar" aria-label="Rychlý kontakt">
<a href="tel:${esc(tel(site.phone))}">Zavolat</a>
<a href="#kontakt">Poptávka</a>
</nav>
<script src="/assets/js/main.js${ctx.assets?.js ? `?v=${ctx.assets.js}` : ''}" defer></script>
${ctx.scaffold ? '<script src="/assets/js/leseni.js" defer></script>\n' : ''}
</body>
</html>
`;
}

// ---------- bloky obsahu ----------

const items = (b) => (Array.isArray(b.items) ? b.items : []);
const list = (tag, cls, rows) => `<${tag} class="${cls}">\n${rows.join('\n')}\n</${tag}>`;

// Výběr počtu kusů do poptávky (ovládá main.js; bez JavaScriptu je skrytý)
const pick = (i) => {
  const max = Math.max(1, parseInt((String(i.count).match(/\d+/) || ['1'])[0], 10));
  return `<div class="pick" data-max="${max}"><button type="button" data-step="-1" aria-label="Ubrat: ${esc(i.title)}">−</button><output aria-label="Počet: ${esc(i.title)}">0</output><button type="button" data-step="1" aria-label="Přidat: ${esc(i.title)}">+</button></div>`;
};

const BLOCKS = {
  heading: (b) => {
    const tag = b.level === 3 ? 'h3' : 'h2';
    return `<${tag}${b.anchor ? ` id="${esc(b.anchor)}"` : ''}>${esc(b.text)}</${tag}>`;
  },
  text: (b) => paragraphs(b.text),
  // poznámka „k doplnění“ je vidět jen na náhledu; na ostré adrese se nevykreslí
  note: (b, ctx) => (b.style === 'info' ? paragraphs(b.text, 'todo is-info') : ctx.noindex ? paragraphs(b.text, 'todo') : ''),
  bullets: (b) => `<ul>\n${items(b).map((i) => `<li>${inline(i.text)}</li>`).join('\n')}\n</ul>`,
  numbered: (b) => list('ol', 'uses', items(b).map((i) => `<li><div><strong>${esc(i.title)}</strong><span>${inline(i.text)}</span></div></li>`)),
  steps: (b) => list('ol', 'timeline', items(b).map((i) => `<li><strong>${esc(i.title)}</strong>${inline(i.text)}</li>`)),
  grid: (b) => list('div', 'products', items(b).map((i) => `<div><h3>${esc(i.title)}</h3>${i.text ? `<p>${inline(i.text)}</p>` : ''}</div>`)),
  faq: (b) => list('div', 'faq', items(b).map((i) => `<details><summary>${esc(i.title)}</summary>${paragraphs(i.text)}</details>`)),
  catalog: (b) =>
    list('ul', 'catalog', items(b).map((i) =>
      `<li data-item="${esc(i.title)}"${i.warn ? ` data-warn="${esc(plain(i.warn))}"` : ''}>${i.photo
        ? `<a class="catalog-photo" href="${esc(safeUrl(i.photo))}" data-lightbox><img src="${esc(thumb(i.photo))}" alt="${esc(i.title)}" loading="lazy" decoding="async"></a>`
        : '<span class="catalog-photo" aria-hidden="true"></span>'}<h3>${esc(i.title)}</h3><div><p>${inline(i.text)}</p>${i.spec ? `<p class="spec">${esc(i.spec)}</p>` : ''}${i.warn ? `<p class="warn">${inline(i.warn)}</p>` : ''}</div><div class="catalog-side">${
        i.count ? `<span class="count">K zapůjčení: ${esc(i.count)}</span>` : ''}${pick(i)}</div></li>`)),
  // řádek bez hodnoty = nadpis skupiny
  table: (b) => {
    const head = b.head1 || b.head2 ? `<thead><tr><th scope="col">${esc(b.head1)}</th><th scope="col">${esc(b.head2)}</th></tr></thead>\n` : '';
    const rows = items(b).filter((i) => i.title || i.text).map((i) => (i.text
      ? `<tr><td>${inline(i.title)}</td><td>${inline(i.text)}</td></tr>`
      : `<tr class="group"><th colspan="2" scope="colgroup">${esc(i.title)}</th></tr>`));
    return `<div class="table-wrap"><table class="data-table">\n${head}<tbody>\n${rows.join('\n')}\n</tbody></table></div>`;
  },
  // konfigurátor lešení (půdorys, 3D náhled, termín, poptávka) — sestaví ho /assets/js/leseni.js
  scaffold: (b, ctx) => `<div class="calc sc" id="konfigurator" data-scaffold data-to="${esc(ctx.site.email)}"></div>`,
  gallery: (b) =>
    list(`div`, `gallery${b.fit === 'contain' ? ' is-contain' : ''}`, items(b).filter((i) => i.src).map((i) =>
      isPdf(i.src)
        ? `<a class="gallery-item is-doc" href="${esc(safeUrl(i.src))}" target="_blank" rel="noopener"><span class="doc" aria-hidden="true">PDF</span><span class="caption">${esc(i.caption || 'Dokument')}</span></a>`
        : `<a class="gallery-item" href="${esc(safeUrl(i.src))}" data-lightbox><img src="${esc(thumb(i.src))}" alt="${esc(i.caption)}" loading="lazy" decoding="async">${
            i.caption ? `<span class="caption">${esc(i.caption)}</span>` : ''}</a>`)),
  image: (b) =>
    b.src
      ? `<figure class="content-photo"><img src="${esc(thumb(b.src))}" alt="${esc(b.caption)}" loading="lazy" decoding="async">${
          b.caption ? `<figcaption class="label">${esc(b.caption)}</figcaption>` : ''}</figure>`
      : '',
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

const renderBlocks = (blocks, ctx) => (blocks || []).map((b) => (BLOCKS[b.type] ? BLOCKS[b.type](b, ctx) : '')).filter(Boolean).join('\n');

function pageHero(p) {
  const facts = (p.facts || []).filter((f) => f.label || f.value);
  const factsHtml = facts.length
    ? `<dl class="facts">\n${facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${inline(f.value)}</dd></div>`).join('\n')}\n</dl>`
    : '';
  const thermal = p.theme === 'thermal';
  const photo = p.photo
    ? `<figure class="hero-photo"><img src="${esc(thumb(p.photo))}" alt="${esc(p.photo_caption || p.title)}" fetchpriority="high">${
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
<p>Dejte mi vědět, co pro vás mohu udělat.</p>
<a class="phone" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a>
<a class="mail" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
${p.ask_note ? `<p class="ask-note">${inline(p.ask_note)}</p>` : ''}
<a class="btn" href="#kontakt">Napsat poptávku</a>
</aside>`;
}

// ---------- recenze (ručně vybrané z Google) ----------

function stars(n) {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return `<span class="stars" aria-label="${v} z 5 hvězdiček">${'★'.repeat(v)}<span aria-hidden="true">${'★'.repeat(5 - v)}</span></span>`;
}

function reviewsSection(r) {
  const list = (r && r.items || []).filter((i) => i.text);
  if (!r || (!list.length && !r.rating)) return '';
  const summary = r.rating
    ? `<p class="reviews-score"><strong>${esc(String(r.rating).replace('.', ','))}</strong> ${stars(r.rating)}<span>${r.count ? `${esc(r.count)} recenzí na Googlu` : 'hodnocení na Googlu'}</span></p>`
    : '';
  const links = [
    r.google_url && `<a class="btn btn-line" href="${esc(safeUrl(r.google_url))}" target="_blank" rel="noopener">Všechny recenze na Googlu</a>`,
    r.write_url && `<a class="btn" href="${esc(safeUrl(r.write_url))}" target="_blank" rel="noopener">Napsat recenzi</a>`,
  ].filter(Boolean).join('\n');
  return `<section class="section section-concrete reviews">
<div class="wrap">
<div class="reviews-head reveal">
<span class="label">Hodnocení zákazníků</span><h2>${esc(r.title || 'Co o nás říkají zákazníci')}</h2>
${summary}
</div>
${list.length ? `<ul class="review-list reveal">
${list.map((i) => `<li><blockquote><p>${esc(i.text)}</p></blockquote><p class="review-meta">${stars(i.stars || 5)} <strong>${esc(i.name)}</strong>${i.date ? ` · ${esc(i.date)}` : ''}</p></li>`).join('\n')}
</ul>` : ''}
${links ? `<div class="reviews-links reveal">${links}</div>` : ''}
</div>
</section>`;
}

// ---------- úvod: ukázky zakázek a certifikace ----------

// První fotka z galerie každé služby (bez certifikátů a log) — mění se samy podle obsahu v adminu
function showcase(pages) {
  const tiles = pages
    .filter((p) => p.in_chooser)
    .map((p) => {
      const g = (p.blocks || []).find((b) => b.type === 'gallery' && b.fit !== 'contain' && (b.items || []).some((i) => i.src && !isPdf(i.src)));
      const src = g ? g.items.find((i) => i.src && !isPdf(i.src)).src : p.photo;
      return src ? { p, src } : null;
    })
    .filter(Boolean)
    .slice(0, 4);
  if (tiles.length < 2) return '';
  return `<section class="section showcase">
<div class="wrap">
<div class="section-head is-stacked reveal"><span class="label">Z našich zakázek</span><h2>Práce, za kterou si stojíme</h2></div>
<div class="showcase-grid reveal">
${tiles.map(({ p, src }) => `<a class="showcase-item" href="${pageUrl(p.slug)}"><img src="${esc(thumb(src))}" alt="${esc(p.chooser_title || p.title)}" loading="lazy" decoding="async"><span>${esc(p.chooser_title || p.title)} <i aria-hidden="true">→</i></span></a>`).join('\n')}
</div>
</div>
</section>`;
}

// Řádek s názvy certifikací (z popisků na stránce Certifikáty, část před „—“)
function trustStrip(pages) {
  const cert = pages.find((p) => p.slug === 'certifikaty');
  if (!cert) return '';
  const names = [...new Set((cert.blocks || [])
    .filter((b) => b.type === 'gallery')
    .flatMap((b) => b.items || [])
    .map((i) => String(i.caption || '').split(' — ')[0].trim())
    .filter((n) => n && !/^(Poptávej|Prověřená|Gala|Autodesk)/.test(n)))].slice(0, 7);
  if (!names.length) return '';
  return `<a class="trust reveal" href="${pageUrl(cert.slug)}"><span class="label">Školení a certifikace</span><span class="trust-names">${names.map(esc).join(' <i aria-hidden="true">·</i> ')}</span><span class="trust-more">Zobrazit certifikáty →</span></a>`;
}

// ---------- stránky ----------

// Pod obsahem služby rozcestník na ostatní služby — návštěvník nemusí zpět do menu
// a vyhledávače vidí, jak spolu stránky souvisejí.
function related(pages, current) {
  const others = pages.filter((p) => p.in_chooser && p.slug !== current.slug);
  if (!isService(current) || !others.length) return '';
  return `<section class="related" aria-labelledby="dalsi-sluzby">
<div class="wrap">
<h2 class="label" id="dalsi-sluzby">Další služby</h2>
<ul class="related-list">
${others.map((p) => `<li><a href="${pageUrl(p.slug)}"><span class="name">${esc(p.chooser_title || p.title)} <i aria-hidden="true">→</i></span><span class="hint">${esc(p.chooser_hint)}</span></a></li>`).join('\n')}
</ul>
</div>
</section>
`;
}

// Poptávka půjčovny: vybrané vybavení z katalogu, termín (víkend / jeden den) a kontakt.
// Zobrazí se jen na stránce s katalogem; odesílá main.js stejně jako hlavní formulář.
function booking(site, p) {
  if (!catalogItems(p).length) return '';
  return `<section class="booking" id="rezervace" aria-labelledby="rezervace-title">
<span class="label">Poptávka vybavení</span>
<h2 id="rezervace-title">Vyberte termín a odešlete poptávku</h2>
<ul class="booking-list" data-list></ul>
<p class="booking-empty" data-empty>Zatím nic vybraného. U vybavení výše přidejte počet kusů tlačítkem <b>+</b>.</p>
<form class="form booking-form" data-to="${esc(site.email)}" data-service="${esc(p.form_service || p.title)}"${hasPrices(p) ? ` data-quote="${esc(p.slug)}"` : ''} novalidate>
<fieldset class="seg">
<legend>Na jak dlouho</legend>
<label><input type="radio" name="typ" value="vikend" checked><span><strong>Víkend</strong>pátek–neděle</span></label>
<label><input type="radio" name="typ" value="den"><span><strong>Jeden den</strong>pondělí–čtvrtek, 24 hodin</span></label>
<a class="seg-link" href="#kontakt" data-multi><span><strong>Více dní</strong>domluvíme se individuálně →</span></a>
</fieldset>
<div><label for="b-datum">Datum vyzvednutí</label><input id="b-datum" name="datum" type="date" required><p class="hint" data-range></p></div>
<label class="check"><input type="checkbox" name="dovoz"> Chci dovoz, sestavení a zprovoznění</label>
<div class="booking-price" data-price hidden>
<dl><div><dt>Cena pronájmu</dt><dd data-rent></dd></div><div><dt>Vratná záloha</dt><dd data-deposit></dd></div></dl>
<p class="hint" data-price-note></p>
</div>
<div class="row">
<div><label for="b-jmeno">Jméno</label><input id="b-jmeno" name="jmeno" autocomplete="name" required></div>
<div><label for="b-telefon">Telefon</label><input id="b-telefon" name="telefon" type="tel" autocomplete="tel" required></div>
</div>
<div><label for="b-misto">Místo akce (obec)</label><input id="b-misto" name="misto" autocomplete="address-level2"></div>
<div><label for="b-pozn">Poznámka</label><textarea id="b-pozn" name="poznamka" placeholder="Např. počet hostů nebo čas vyzvednutí."></textarea></div>
<div class="booking-warn" data-warn-box hidden>
<span class="label">Upozornění k vybranému vybavení</span>
<ul data-warn-list></ul>
<p>Při porušení můžeme požadovat náhradu vzniklé škody a nákladů na vyčištění nebo uvedení zařízení do původního stavu.</p>
<label class="check"><input type="checkbox" name="souhlas"> Beru na vědomí podmínky použití</label>
</div>
<div hidden><label for="b-web">Nevyplňujte</label><input id="b-web" name="web" tabindex="-1" autocomplete="off"></div>
<div><button class="btn" type="submit">Odeslat poptávku</button></div>
<p class="note" data-status role="status">Jde o nezávaznou poptávku. Dostupnost a cenu vám potvrdíme telefonicky nebo e-mailem.</p>
</form>
</section>
<a class="booking-bar" href="#rezervace" hidden>Vybráno <strong data-count>0</strong> ks · Pokračovat k poptávce ↓</a>`;
}

export function renderPage(ctx, p) {
  const path = pageUrl(p.slug);
  return (
    head(ctx, {
      title: p.meta_title || `${p.title} | ${ctx.site.name}`,
      description: plain(p.meta_description || p.lead),
      path,
      image: p.photo,
      schema: pageSchema(ctx, p),
      preload: p.photo ? `<link rel="preload" href="${esc(thumb(p.photo))}" as="image" fetchpriority="high">\n` : '',
    }) +
    header(ctx, p.slug) +
    pageHero(p) +
    `<section class="section">
<div class="wrap content-grid">
<div class="prose">
${renderBlocks(p.blocks, ctx)}
${booking(ctx.site, p)}
</div>
${ask(ctx.site, p)}
</div>
</section>
` +
    related(ctx.pages, p) +
    contact(ctx, p.form_service) +
    footer({ ...ctx, scaffold: (p.blocks || []).some((b) => b.type === 'scaffold') })
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
    head(ctx, {
      title: h.meta_title || site.name,
      description,
      path: '/',
      schema,
      preload: h.hero_photo ? `<link rel="preload" href="${esc(thumb(h.hero_photo))}" as="image" fetchpriority="high">\n` : '',
    }) +
    header(ctx, '') +
    `<section class="hero">
<div class="hero-panel">
${h.hero_photo ? `<img class="hero-bg" src="${esc(thumb(h.hero_photo))}" alt="${esc(h.hero_photo_alt)}" fetchpriority="high">\n` : ''}<h1>${esc(h.hero_title)} <span>${esc(h.hero_accent)}</span></h1>
<p class="hero-meta">${String(h.hero_meta || '').split(' · ').map(esc).join(' <i aria-hidden="true">·</i> ')}</p>
${RIDGE}
</div>
<nav class="hero-index" aria-labelledby="rozcestnik">
<h2 class="label" id="rozcestnik">${esc(h.chooser_label)}</h2>
<ul class="chooser">
${chooser}
</ul>
</nav>
</section>
${showcase(pages)}
<section class="section">
<div class="wrap">
<div class="section-head is-stacked reveal">
<span class="label">${esc(h.about_label)}</span><h2>${esc(h.about_title)}</h2>
${paragraphs(h.about_text)}
</div>
<div class="principles reveal">
${principles}
</div>
${trustStrip(pages)}
</div>
</section>
${reviewsSection(site.reviews)}
${promo ? `<section class="section promo">
<div class="wrap">
<div class="promo-card reveal${h.promo_photo ? ' has-photo' : ''}">
<div class="promo-text">
<span class="label">${esc(h.promo_label)}</span>
<h2>${esc(h.promo_title)}</h2>
${paragraphs(h.promo_text)}
<a class="btn" href="${pageUrl(promo.slug)}">${esc(h.promo_button || 'Více')}</a>
</div>
${h.promo_photo ? `<img src="${esc(thumb(h.promo_photo))}" alt="${esc(h.promo_photo_alt || h.promo_title)}" loading="lazy" decoding="async">` : ''}
</div>
</div>
</section>` : ''}` +
    contact(ctx, '') +
    footer(ctx)
  );
}

export function renderNotFound(ctx) {
  return (
    head({ ...ctx, noindex: true }, { title: `Stránka nenalezena | ${ctx.site.name}`, description: '', path: '/', schema: [websiteNode(ctx)], canonical: false }) +
    header(ctx, '') +
    `<section class="page-hero">
<div class="wrap">
<h1>Tahle stránka tu není</h1>
<p class="lead">Možná se přesunula při předělávání webu. Zkuste <a class="textlink" href="/">úvodní stránku</a>, nebo rovnou zavolejte.</p>
</div>
</section>
` +
    contact(ctx, '') +
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
