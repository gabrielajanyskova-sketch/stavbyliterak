// Vykreslení stránek webu z obsahu v databázi (server-side, kvůli SEO a rychlosti).
// Všechen text z adminu se escapuje; formátování umí jen **tučně** a [odkaz](url).

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  const u = String(url || '').trim();
  return /^(https?:\/\/|mailto:|tel:|\/|#|\?)/i.test(u) ? u : '#';
}

// Řádkový text: escape + **tučně** + [text](url)
export function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => `<a class="textlink" href="${esc(safeUrl(url.replace(/&amp;/g, '&')))}">${label}</a>`);
}

// Víceodstavcový text: prázdný řádek = nový odstavec, jednoduchý zalomení = <br>
function paragraphs(text, cls = '') {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p${cls ? ` class="${cls}"` : ''}>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n      ');
}

function tel(phone) {
  return String(phone || '').replace(/[^+\d]/g, '');
}

export function pageUrl(slug) {
  return slug ? `/${slug}` : '/';
}

const RIDGE = `<svg class="ridge" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 190 L70 150 L120 168 L190 108 L240 132 L300 62 L318 58 L336 70 L400 120 L450 104 L520 150 L600 128 L600 260 L0 260 Z" fill="#252a30"/>
        <path d="M0 230 L90 196 L160 214 L250 170 L330 196 L420 160 L500 190 L600 172 L600 260 L0 260 Z" fill="#2c323a"/>
        <path d="M0 190 L70 150 L120 168 L190 108 L240 132 L300 62 L318 58 L336 70 L400 120 L450 104 L520 150 L600 128" fill="none" stroke="#f39a1e" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>`;

// ---------- společné části ----------

function head(site, title, description, canonical) {
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="cs_CZ">
<link rel="icon" href="/assets/img/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/style.css">
<script>document.documentElement.classList.add("js")</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    founder: site.owner,
    telephone: site.phone,
    email: site.email,
    address: site.address,
    url: canonical.replace(/^(https?:\/\/[^/]+).*$/, '$1/'),
  }).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#obsah">Přeskočit na obsah</a>
`;
}

function header(site, pages, activeSlug) {
  const links = pages
    .filter((p) => p.in_nav)
    .map((p) => `      <a href="${pageUrl(p.slug)}"${p.slug === activeSlug ? ' aria-current="page"' : ''}>${esc(p.nav_label || p.title)}</a>`)
    .join('\n');
  return `<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${esc(site.name)} — úvod"><img src="/assets/img/logo.png" alt="${esc(site.name)}" width="444" height="263"></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="menu">Menu</button>
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
  const opts = (c.services || [])
    .map((s) => `            <option${s === preselect ? ' selected' : ''}>${esc(s)}</option>`)
    .join('\n');
  return `
<section class="section section-dark" id="kontakt">
  <div class="wrap contact-grid">
    <div class="reveal">
      <span class="label">Kontakt</span>
      <h2>${esc(c.title)}</h2>
      <p style="color:#bfc6cc">${inline(c.text)}</p>
      <dl class="contact-lines">
        <div><dt>Telefon</dt><dd><a class="big" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a></dd></div>
        <div><dt>E-mail</dt><dd><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></dd></div>
        <div><dt>Adresa</dt><dd>${esc(site.address)}</dd></div>
        <div><dt>Fakturační údaje</dt><dd>${esc(site.owner)} · IČ ${esc(site.ico)}</dd></div>
      </dl>
    </div>
    <form class="form reveal" id="poptavka" data-to="${esc(site.email)}">
      <div>
        <label for="sluzba">O co jde</label>
        <select id="sluzba" name="sluzba">
${opts}
        </select>
      </div>
      <div class="row">
        <div><label for="jmeno">Jméno</label><input id="jmeno" name="jmeno" autocomplete="name" required></div>
        <div><label for="telefon">Telefon</label><input id="telefon" name="telefon" type="tel" autocomplete="tel" required></div>
      </div>
      <div><label for="misto">Místo (obec)</label><input id="misto" name="misto"></div>
      <div hidden><label for="web">Nevyplňujte</label><input id="web" name="web" tabindex="-1" autocomplete="off"></div>
      <div><label for="zprava">Co potřebujete</label><textarea id="zprava" name="zprava" placeholder="Stačí pár vět — rozměry, termín, cokoli víte."></textarea></div>
      <div><button class="btn" type="submit">Odeslat poptávku</button></div>
      <p class="note" data-status>Ozvu se vám co nejdřív.</p>
    </form>
  </div>
</section>
`;
}

function footer(site, pages) {
  const links = pages
    .map((p) => `      <a href="${pageUrl(p.slug)}">${esc(p.nav_label || p.title)}</a>`)
    .join('\n');
  return `</main>
<footer class="site-footer">
  <div class="wrap">
    <a href="/"><img src="/assets/img/logo.png" alt="${esc(site.name)}" width="444" height="263"></a>
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

function items(block) {
  return Array.isArray(block.items) ? block.items : [];
}

const BLOCKS = {
  heading(b) {
    const tag = b.level === 3 ? 'h3' : 'h2';
    const style = tag === 'h3' ? ' style="margin-top:1.4em"' : '';
    return `<${tag}${b.anchor ? ` id="${esc(b.anchor)}"` : ''}${style}>${esc(b.text)}</${tag}>`;
  },
  text(b) {
    return paragraphs(b.text);
  },
  note(b) {
    const style = b.style === 'info' ? ' style="background:#eef0f1;border-color:#5b636c;color:#3a4148"' : '';
    return paragraphs(b.text, 'todo').replace(/<p class="todo">/g, `<p class="todo"${style}>`);
  },
  bullets(b) {
    return `<ul>\n${items(b).map((i) => `        <li>${inline(i.text)}</li>`).join('\n')}\n      </ul>`;
  },
  numbered(b) {
    return `<ol class="uses">\n${items(b)
      .map((i) => `        <li><div><strong>${esc(i.title)}</strong><span>${inline(i.text)}</span></div></li>`)
      .join('\n')}\n      </ol>`;
  },
  steps(b) {
    return `<ol class="timeline">\n${items(b)
      .map((i) => `        <li><strong>${esc(i.title)}</strong>${inline(i.text)}</li>`)
      .join('\n')}\n      </ol>`;
  },
  grid(b) {
    return `<div class="products">\n${items(b)
      .map((i) => `        <div><h3>${esc(i.title)}</h3>${i.text ? `<p>${inline(i.text)}</p>` : ''}</div>`)
      .join('\n')}\n      </div>`;
  },
  faq(b) {
    return `<div class="faq">\n${items(b)
      .map((i) => `        <details><summary>${esc(i.title)}</summary>${paragraphs(i.text)}</details>`)
      .join('\n')}\n      </div>`;
  },
  catalog(b) {
    return `<ul class="catalog">\n${items(b)
      .map(
        (i) => `        <li>
          <h3>${esc(i.title)}</h3>
          <div><p>${inline(i.text)}</p>${i.spec ? `<p class="spec">${esc(i.spec)}</p>` : ''}</div>
          ${i.count ? `<span class="count">${esc(i.count)}</span>` : '<span></span>'}
        </li>`
      )
      .join('\n')}\n      </ul>`;
  },
  image(b) {
    if (!b.src) return '';
    return `<figure class="content-photo"><img src="${esc(safeUrl(b.src))}" alt="${esc(b.caption || '')}" loading="lazy">${
      b.caption ? `<figcaption class="label">${esc(b.caption)}</figcaption>` : ''
    }</figure>`;
  },
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

function renderBlocks(blocks) {
  return (blocks || [])
    .map((b) => (BLOCKS[b.type] ? '      ' + BLOCKS[b.type](b) : ''))
    .filter((s) => s.trim())
    .join('\n\n');
}

function pageHero(p) {
  const facts = (p.facts || []).filter((f) => f.label || f.value);
  const factsHtml = facts.length
    ? `      <dl class="facts">
${facts.map((f) => `        <div><dt>${esc(f.label)}</dt><dd>${inline(f.value)}</dd></div>`).join('\n')}
      </dl>`
    : '';
  const scale = p.theme === 'thermal' ? '\n      <div class="scale"><span>−5 °C</span><i></i><span>+22 °C</span></div>' : '';
  let leftExtra = '';
  let right = factsHtml;
  if (p.photo) {
    leftExtra = factsHtml ? '\n' + factsHtml : '';
    right = `      <figure class="hero-photo"><img src="${esc(safeUrl(p.photo))}" alt="${esc(p.photo_caption || p.title)}">${
      p.photo_caption ? `<figcaption class="label">${esc(p.photo_caption)}</figcaption>` : ''
    }</figure>`;
  }
  return `<section class="page-hero ${p.theme === 'thermal' ? 'thermal' : ''}">
  <div class="wrap">
    <span class="label crumbs"><a href="/">Úvod</a> / ${esc(p.crumb || p.title)}</span>
    <div class="page-hero-grid">
      <div>
        <h1>${esc(p.title)}</h1>
        <p class="lead">${inline(p.lead)}</p>${scale}${leftExtra}
      </div>
${right}
    </div>
  </div>
</section>
`;
}

function ask(site, p) {
  return `<aside>
      <div class="ask">
        <span class="label" style="color:#9aa3ab">Poptávka</span>
        <h3>${esc(p.ask_title || p.title)}</h3>
        <p>Popište, co potřebujete — ozvu se a domluvíme se.</p>
        <a class="phone" href="tel:${esc(tel(site.phone))}">${esc(site.phone)}</a>
        <a class="mail" href="mailto:${esc(site.email)}">${esc(site.email)}</a>
        ${p.ask_note ? `<p style="margin-top:14px">${inline(p.ask_note)}</p>` : ''}
        <a class="btn" href="#kontakt">Napsat poptávku</a>
      </div>
    </aside>`;
}

// ---------- stránky ----------

export function renderPage(site, pages, p, origin) {
  return (
    head(site, p.meta_title || `${p.title} | ${site.name}`, p.meta_description || p.lead, origin + pageUrl(p.slug)) +
    header(site, pages, p.slug) +
    pageHero(p) +
    `
<section class="section">
  <div class="wrap content-grid">
    <div class="prose">
${renderBlocks(p.blocks)}
    </div>
    ${ask(site, p)}
  </div>
</section>
` +
    contact(site, p.form_service) +
    footer(site, pages)
  );
}

export function renderHome(site, pages, origin) {
  const h = site.home || {};
  const chooser = pages
    .filter((p) => p.in_chooser)
    .map(
      (p, i) =>
        `      <li><a href="${pageUrl(p.slug)}"><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="name">${esc(
          p.chooser_title || p.title
        )}</span><span class="arrow">→</span><span class="hint">${esc(p.chooser_hint)}</span></a></li>`
    )
    .join('\n');
  const principles = (h.principles || [])
    .map((x) => `      <div><span class="label">${esc(x.label)}</span><h3>${esc(x.title)}</h3><p>${inline(x.text)}</p></div>`)
    .join('\n');
  const promo = pages.find((p) => p.slug === h.promo_page);
  const promoHtml = promo
    ? `
<section class="section section-concrete" id="${esc(promo.slug)}">
  <div class="wrap">
    <div class="section-head reveal">
      <div><span class="label">${esc(h.promo_label)}</span><h2>${esc(h.promo_title)}</h2></div>
      <div>
        ${paragraphs(h.promo_text)}
      </div>
    </div>
    <a class="btn btn-line reveal" href="${pageUrl(promo.slug)}">${esc(h.promo_button || 'Více')}</a>
  </div>
</section>
`
    : '';

  return (
    head(site, h.meta_title || site.name, h.meta_description || '', origin + '/') +
    header(site, pages, '') +
    `
<section class="hero">
  <div class="hero-panel">
    <h1>${esc(h.hero_title)} <span>${esc(h.hero_accent)}</span></h1>
    <p class="hero-meta">${esc(String(h.hero_meta || '').toUpperCase())}</p>
    ${RIDGE}
  </div>
  <div class="hero-index">
    <span class="label">${esc(h.chooser_label)}</span>
    <ul class="chooser">
${chooser}
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <div><span class="label">${esc(h.about_label)}</span><h2>${esc(h.about_title)}</h2></div>
      ${paragraphs(h.about_text)}
    </div>
    <div class="principles reveal">
${principles}
    </div>
  </div>
</section>
${promoHtml}` +
    contact(site, '') +
    footer(site, pages)
  );
}

export function renderNotFound(site, pages, origin) {
  return (
    head(site, `Stránka nenalezena | ${site.name}`, '', origin + '/') +
    header(site, pages, '') +
    `
<section class="page-hero">
  <div class="wrap">
    <span class="label crumbs"><a href="/">Úvod</a> / 404</span>
    <h1>Tahle stránka tu není</h1>
    <p class="lead">Možná se přesunula při předělávání webu. Zkuste <a class="textlink" href="/">úvodní stránku</a>, nebo rovnou zavolejte.</p>
  </div>
</section>
` +
    contact(site, '') +
    footer(site, pages)
  );
}

export function renderSitemap(pages, origin) {
  const urls = ['/', ...pages.map((p) => pageUrl(p.slug))];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(origin + u)}</loc></url>`).join('\n')}
</urlset>
`;
}
