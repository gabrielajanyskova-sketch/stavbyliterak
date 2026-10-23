// Administrace webu — úpravy obsahu uloženého v D1 přes /api/admin/*.
"use strict";

const TOKEN_KEY = "admin_token";
const BUILTIN_IMAGES = [
  { url: "/assets/img/bagr.webp", name: "Minibagr Kubota (původní fotka)" },
];

const BLOCK_TYPES = {
  heading: { label: "Nadpis" },
  text: { label: "Text (odstavce)" },
  bullets: { label: "Odrážky", fields: [["text", "Text", "area"]], add: "+ odrážka" },
  numbered: { label: "Číslovaný seznam", fields: [["title", "Titulek"], ["text", "Popis", "area"]], add: "+ položka" },
  steps: { label: "Postup (časová osa)", fields: [["title", "Krok"], ["text", "Popis", "area"]], add: "+ krok" },
  grid: { label: "Mřížka položek", fields: [["title", "Název"], ["text", "Popis (nepovinné)"]], add: "+ položka" },
  faq: { label: "Časté otázky", fields: [["title", "Otázka"], ["text", "Odpověď", "area"]], add: "+ otázka" },
  catalog: {
    label: "Katalog (půjčovna)",
    fields: [["title", "Název"], ["text", "Popis", "area"], ["spec", "Parametry (rozměry, objem…)"], ["count", "Počet kusů (např. 2 ks)"]],
    add: "+ položka",
  },
  note: { label: "Zvýrazněná poznámka" },
  image: { label: "Fotka" },
};

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch {}

let content = { site: null, pages: [] };
let current = null; // { kind: 'page'|'home'|'settings'|'images', slug, draft }
let dirty = false;

const $ = (sel) => document.querySelector(sel);

// ---------- pomocníci ----------

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function toast(text, isError = false) {
  const t = h("div", { class: "toast" + (isError ? " err" : ""), role: "status" }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), isError ? 6000 : 2500);
}

function markDirty() {
  dirty = true;
  const msg = $("#save-msg");
  msg.textContent = "Máte neuložené změny.";
  msg.classList.add("dirty");
}

function markClean(text = "Vše uloženo.") {
  dirty = false;
  const msg = $("#save-msg");
  msg.textContent = text;
  msg.classList.remove("dirty");
}

function slugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const ERRORS = {
  wrong_password: "Špatné heslo.",
  not_configured: "Heslo do administrace ještě není nastavené (ADMIN_PASSWORD v Cloudflare).",
  too_many_attempts: "Příliš mnoho pokusů. Zkuste to za 15 minut.",
  invalid_code: "Kód nesouhlasí.",
  code_expired: "Kód vypršel. Přihlaste se znovu.",
  mail_failed: "Nepodařilo se odeslat kód e-mailem.",
  invalid_slug: "Adresa stránky smí obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.",
  slug_exists: "Stránka s touto adresou už existuje.",
  images_not_configured: "Úložiště fotek (KV IMAGES) není v Cloudflare napojené.",
  unsupported_type: "Tento typ souboru nejde nahrát. Použijte JPG, PNG nebo WebP.",
  too_large: "Fotka je příliš velká (max. 10 MB).",
  db_not_configured: "Databáze (D1) není v Cloudflare napojená.",
};

async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch("/api/admin/" + path, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith("login") && !path.startsWith("verify")) {
    setToken(null);
    showLogin();
    throw new Error("Přihlášení vypršelo.");
  }
  if (!res.ok) {
    const err = new Error(ERRORS[data.error] || "Chyba serveru (" + res.status + ").");
    err.code = data.error;
    throw err;
  }
  return data;
}

function setToken(t) {
  token = t;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

// ---------- formulářová pole (zapisují rovnou do objektu) ----------

function text(obj, key, label, { hint, placeholder, type = "text", onChange } = {}) {
  const id = "f" + Math.random().toString(36).slice(2);
  return h("div", { class: "field" },
    h("label", { for: id }, label),
    h("input", {
      id, type, value: obj[key] ?? "", placeholder,
      oninput: (e) => { obj[key] = e.target.value; markDirty(); onChange && onChange(e.target.value); },
    }),
    hint && h("p", { class: "hint" }, hint),
  );
}

function area(obj, key, label, { hint, rows = 4 } = {}) {
  const id = "f" + Math.random().toString(36).slice(2);
  const ta = h("textarea", { id, rows, oninput: (e) => { obj[key] = e.target.value; markDirty(); } });
  ta.value = obj[key] ?? "";
  return h("div", { class: "field" }, h("label", { for: id }, label), ta, hint && h("p", { class: "hint" }, hint));
}

function check(obj, key, label) {
  return h("label", { class: "check" },
    h("input", { type: "checkbox", checked: !!obj[key], onchange: (e) => { obj[key] = e.target.checked; markDirty(); } }),
    label,
  );
}

function select(obj, key, label, options) {
  const id = "f" + Math.random().toString(36).slice(2);
  const sel = h("select", { id, onchange: (e) => { obj[key] = e.target.value; markDirty(); } },
    options.map(([v, l]) => h("option", { value: v, selected: (obj[key] ?? "") === v }, l)));
  return h("div", { class: "field" }, h("label", { for: id }, label), sel);
}

const FORMAT_HINT = "Formátování: **tučně**, odkaz jako [text](https://adresa). Prázdný řádek = nový odstavec.";

function moveIn(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function rowButtons(list, i, rerender, { confirmText } = {}) {
  return h("div", { class: "row-actions" },
    h("button", { class: "icon", type: "button", title: "Posunout nahoru", "aria-label": "Posunout nahoru", onclick: () => { moveIn(list, i, -1); markDirty(); rerender(); } }, "↑"),
    h("button", { class: "icon", type: "button", title: "Posunout dolů", "aria-label": "Posunout dolů", onclick: () => { moveIn(list, i, 1); markDirty(); rerender(); } }, "↓"),
    h("button", {
      class: "icon del", type: "button", title: "Smazat", "aria-label": "Smazat",
      onclick: () => { if (confirmText && !confirm(confirmText)) return; list.splice(i, 1); markDirty(); rerender(); },
    }, "✕"),
  );
}

// Seznam položek se stejnými poli (fakta, položky bloku, zásady na úvodu…)
function itemList(list, fields, addLabel) {
  const wrap = h("div");
  const render = () => {
    wrap.replaceChildren(
      ...list.map((item, i) =>
        h("div", { class: "item" },
          h("div", { class: "fields" },
            fields.map(([key, label, kind]) => (kind === "area" ? area(item, key, label, { rows: 3 }) : text(item, key, label))),
          ),
          rowButtons(list, i, render),
        )),
      h("div", { class: "add-row" },
        h("button", {
          class: "btn btn-line btn-small", type: "button",
          onclick: () => { list.push(Object.fromEntries(fields.map(([k]) => [k, ""]))); markDirty(); render(); },
        }, addLabel)),
    );
  };
  render();
  return wrap;
}

function photoField(obj, key, label) {
  const wrap = h("div", { class: "field" });
  const render = () => {
    wrap.replaceChildren(
      h("span", { class: "lbl" }, label),
      h("div", { class: "photo-pick" },
        obj[key] ? h("img", { src: obj[key], alt: "" }) : h("div", { class: "none" }, "bez fotky"),
        h("div", { class: "row-actions", style: "flex-direction:column;align-items:flex-start;gap:8px" },
          h("button", {
            class: "btn btn-line btn-small", type: "button",
            onclick: () => pickImage((url) => { obj[key] = url; markDirty(); render(); }),
          }, obj[key] ? "Změnit fotku" : "Vybrat fotku"),
          obj[key] && h("button", { class: "btn btn-danger btn-small", type: "button", onclick: () => { obj[key] = ""; markDirty(); render(); } }, "Odebrat"),
        ),
      ),
    );
  };
  render();
  return wrap;
}

// ---------- bloky obsahu stránky ----------

function blockEditor(blocks) {
  const wrap = h("div");
  const render = () => {
    const addSel = h("select", {}, Object.entries(BLOCK_TYPES).map(([k, v]) => h("option", { value: k }, v.label)));
    wrap.replaceChildren(
      ...blocks.map((b, i) => {
        const meta = BLOCK_TYPES[b.type] || { label: b.type };
        let body;
        if (b.type === "heading") {
          body = h("div", { class: "grid2" },
            text(b, "text", "Text nadpisu"),
            h("div", {},
              h("label", { class: "check", style: "margin-top:26px" },
                h("input", { type: "checkbox", checked: b.level === 3, onchange: (e) => { b.level = e.target.checked ? 3 : undefined; markDirty(); } }),
                "Menší nadpis (podnadpis)")),
          );
        } else if (b.type === "text") {
          body = area(b, "text", "Text", { hint: FORMAT_HINT, rows: 6 });
        } else if (b.type === "note") {
          body = h("div", {},
            area(b, "text", "Text poznámky", { hint: FORMAT_HINT, rows: 3 }),
            select(b, "style", "Barva", [["todo", "Žlutá (upozornění)"], ["info", "Šedá (informace)"]]),
          );
        } else if (b.type === "image") {
          body = h("div", {}, photoField(b, "src", "Fotka"), text(b, "caption", "Popisek pod fotkou"));
        } else {
          b.items = b.items || [];
          body = h("div", {},
            ["bullets", "numbered", "steps", "faq", "catalog"].includes(b.type) && h("p", { class: "hint", style: "margin:0 0 8px" }, FORMAT_HINT.split(".")[0] + " (v popisu)."),
            itemList(b.items, meta.fields, meta.add));
        }
        return h("div", { class: "block" },
          h("div", { class: "block-head" }, h("span", { class: "type" }, meta.label), rowButtons(blocks, i, render, { confirmText: "Opravdu smazat celý blok?" })),
          body);
      }),
      h("div", { class: "add-row" },
        h("span", { class: "lbl", style: "margin:0" }, "Přidat blok"),
        addSel,
        h("button", {
          class: "btn btn-small", type: "button",
          onclick: () => {
            const t = addSel.value;
            const b = { type: t };
            if (BLOCK_TYPES[t].fields) b.items = [Object.fromEntries(BLOCK_TYPES[t].fields.map(([k]) => [k, ""]))];
            else if (t === "note") Object.assign(b, { text: "", style: "todo" });
            else if (t === "image") Object.assign(b, { src: "", caption: "" });
            else b.text = "";
            blocks.push(b);
            markDirty();
            render();
            wrap.lastElementChild.previousElementSibling.scrollIntoView({ behavior: "smooth", block: "center" });
          },
        }, "Přidat")),
    );
  };
  render();
  return wrap;
}

// ---------- pohledy ----------

function setActiveNav() {
  document.querySelectorAll(".side button.nav").forEach((b) => {
    const active = current && ((b.dataset.view && b.dataset.view === current.kind) || (b.dataset.slug && current.kind === "page" && b.dataset.slug === current.slug));
    b.classList.toggle("active", !!active);
  });
}

function renderPageList() {
  const ul = $("#page-list");
  ul.replaceChildren(
    ...content.pages.map((p, i) =>
      h("li", {},
        h("button", { class: "nav", "data-slug": p.slug, onclick: () => open("page", p.slug) },
          p.nav_label || p.title, !p.published && h("span", { class: "draft" }, "koncept")),
        h("button", { class: "mini", title: "Posunout nahoru", "aria-label": "Posunout " + p.title + " nahoru", onclick: () => reorder(i, -1) }, "↑"),
        h("button", { class: "mini", title: "Posunout dolů", "aria-label": "Posunout " + p.title + " dolů", onclick: () => reorder(i, 1) }, "↓"),
      )),
  );
  setActiveNav();
}

async function reorder(i, d) {
  moveIn(content.pages, i, d);
  renderPageList();
  try {
    await api("pages-order", { method: "PUT", body: { slugs: content.pages.map((p) => p.slug) } });
    toast("Pořadí uloženo.");
  } catch (e) {
    toast(e.message, true);
  }
}

function confirmLeave() {
  return !dirty || confirm("Máte neuložené změny. Opravdu odejít bez uložení?");
}

function open(kind, slug) {
  if (!confirmLeave()) return;
  const view = $("#view");
  const savebar = $("#savebar");
  if (kind === "page") {
    const page = content.pages.find((p) => p.slug === slug);
    if (!page) return open("home");
    current = { kind, slug, draft: structuredClone(page) };
    current.draft.newSlug = slug;
    view.replaceChildren(pageView(current.draft));
    $("#preview-link").href = "/" + slug;
  } else if (kind === "home") {
    current = { kind, draft: structuredClone(content.site) };
    view.replaceChildren(homeView(current.draft));
    $("#preview-link").href = "/";
  } else if (kind === "settings") {
    current = { kind, draft: structuredClone(content.site) };
    view.replaceChildren(settingsView(current.draft));
    $("#preview-link").href = "/#kontakt";
  } else {
    current = { kind: "images" };
    view.replaceChildren(imagesView());
  }
  savebar.hidden = kind === "images";
  markClean("");
  setActiveNav();
  window.scrollTo(0, 0);
}

function pageView(p) {
  p.facts = p.facts || [];
  p.blocks = p.blocks || [];
  p.aliases = p.aliases || [];
  const aliasHolder = { text: p.aliases.join("\n") };
  const services = (content.site.contact && content.site.contact.services) || [];
  return h("div", {},
    h("h2", {}, p.title || "Stránka"),
    h("div", { class: "panel" },
      h("h3", {}, "Základ"),
      text(p, "title", "Hlavní nadpis stránky"),
      h("div", { class: "grid2" },
        text(p, "newSlug", "Adresa stránky", { hint: "stavbyliterak.cz/… — malá písmena bez diakritiky a pomlčky. Při změně bude stará adresa dál přesměrovávat." }),
        text(p, "crumb", "Text v drobečkové navigaci", { hint: "Úvod / …" }),
      ),
      check(p, "published", "Zveřejněno (jinak je stránka jen rozpracovaný koncept)"),
      check(p, "in_nav", "Zobrazit v horním menu"),
      text(p, "nav_label", "Název v menu a v patičce"),
      check(p, "in_chooser", "Zobrazit v rozcestníku na úvodní stránce"),
      h("div", { class: "grid2" }, text(p, "chooser_title", "Název v rozcestníku"), text(p, "chooser_hint", "Popis v rozcestníku")),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Hlavička stránky"),
      area(p, "lead", "Úvodní text pod nadpisem", { rows: 3, hint: FORMAT_HINT.split(".")[0] + "." }),
      h("span", { class: "lbl" }, "Rychlá fakta (tabulka vpravo / pod textem)"),
      itemList(p.facts, [["label", "Popisek"], ["value", "Hodnota"]], "+ řádek"),
      h("div", { style: "height:14px" }),
      photoField(p, "photo", "Fotka v hlavičce (nepovinné)"),
      text(p, "photo_caption", "Popisek fotky"),
      check({ get t() { return p.theme === "thermal"; }, set t(v) { p.theme = v ? "thermal" : ""; } }, "t", "Tmavá hlavička s teplotní stupnicí (styl termovize)"),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Obsah stránky"),
      h("p", { class: "help" }, "Obsah se skládá z bloků. Pořadí měníte šipkami ↑ ↓, nový blok přidáte dole."),
      blockEditor(p.blocks),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Poptávka"),
      h("div", { class: "grid2" },
        text(p, "ask_title", "Nadpis v boxu Poptávka (vpravo)"),
        select(p, "form_service", "Předvybraná služba ve formuláři", [["", "— žádná —"], ...services.map((s) => [s, s])]),
      ),
      text(p, "ask_note", "Poznámka v boxu (nepovinné)"),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Vyhledávače (SEO)"),
      text(p, "meta_title", "Titulek ve vyhledávání", { hint: "Zobrazí se v Googlu a na záložce prohlížeče. Ideálně do 60 znaků." }),
      area(p, "meta_description", "Popis ve vyhledávání", { rows: 2, hint: "Ideálně 120–160 znaků." }),
      h("div", { class: "field" },
        h("label", { for: "aliases" }, "Staré adresy, které mají přesměrovat sem"),
        (() => {
          const ta = h("textarea", { id: "aliases", rows: 2, oninput: (e) => { aliasHolder.text = e.target.value; p.aliases = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); markDirty(); } });
          ta.value = aliasHolder.text;
          return ta;
        })(),
        h("p", { class: "hint" }, "Jedna na řádek, např. /mereni-tepelnych-uniku/ — aby fungovaly odkazy na původní web."),
      ),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Smazání"),
      h("p", {}, "Smazanou stránku nejde obnovit. Pokud ji chcete jen skrýt, zrušte „Zveřejněno“."),
      h("button", { class: "btn btn-danger", type: "button", onclick: () => removePage(p) }, "Smazat stránku"),
    ),
  );
}

function homeView(s) {
  const hm = (s.home = s.home || {});
  hm.principles = hm.principles || [];
  return h("div", {},
    h("h2", {}, "Úvodní stránka"),
    h("div", { class: "panel" },
      h("h3", {}, "Velký nadpis"),
      h("div", { class: "grid2" }, text(hm, "hero_title", "Nadpis (bílý)"), text(hm, "hero_accent", "Pokračování (oranžové)")),
      text(hm, "hero_meta", "Řádek pod nadpisem"),
      text(hm, "chooser_label", "Nadpis rozcestníku služeb"),
      h("p", { class: "hint" }, "Které služby jsou v rozcestníku a v jakém pořadí, nastavíte u jednotlivých stránek (a šipkami v levém menu)."),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Jak pracuji"),
      h("div", { class: "grid2" }, text(hm, "about_label", "Malý popisek"), text(hm, "about_title", "Nadpis")),
      area(hm, "about_text", "Text", { rows: 3 }),
      h("span", { class: "lbl" }, "Zásady (sloupce)"),
      itemList(hm.principles, [["label", "Popisek (např. 01 — Posouzení)"], ["title", "Nadpis"], ["text", "Text", "area"]], "+ zásada"),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Upoutávka (šedý pruh)"),
      select(hm, "promo_page", "Odkazovaná stránka", [["", "— nezobrazovat —"], ...content.pages.map((p) => [p.slug, p.title])]),
      h("div", { class: "grid2" }, text(hm, "promo_label", "Malý popisek"), text(hm, "promo_title", "Nadpis")),
      area(hm, "promo_text", "Text", { rows: 3 }),
      text(hm, "promo_button", "Text tlačítka"),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Vyhledávače (SEO)"),
      text(hm, "meta_title", "Titulek ve vyhledávání"),
      area(hm, "meta_description", "Popis ve vyhledávání", { rows: 2 }),
    ),
  );
}

function settingsView(s) {
  const c = (s.contact = s.contact || {});
  c.services = c.services || [];
  const servicesHolder = { text: c.services.join("\n") };
  return h("div", {},
    h("h2", {}, "Kontakty a formulář"),
    h("div", { class: "panel" },
      h("h3", {}, "Kontaktní údaje"),
      h("p", { class: "hint", style: "margin:0 0 12px" }, "Zobrazují se v hlavičce, patičce, kontaktu a v boxu Poptávka na všech stránkách."),
      h("div", { class: "grid2" },
        text(s, "phone", "Telefon"),
        text(s, "email", "E-mail", { type: "email" }),
        text(s, "owner", "Jméno / firma"),
        text(s, "ico", "IČ"),
      ),
      text(s, "address", "Adresa"),
      text(s, "name", "Název webu", { hint: "Používá se v titulcích a popiscích obrázků." }),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Kontaktní sekce a formulář"),
      text(c, "title", "Nadpis"),
      text(c, "text", "Text pod nadpisem"),
      h("div", { class: "field" },
        h("label", { for: "services" }, "Možnosti „O co jde“ ve formuláři"),
        (() => {
          const ta = h("textarea", { id: "services", rows: 8, oninput: (e) => { c.services = e.target.value.split("\n").map((x) => x.trim()).filter(Boolean); markDirty(); } });
          ta.value = servicesHolder.text;
          return ta;
        })(),
        h("p", { class: "hint" }, "Jedna možnost na řádek."),
      ),
    ),
  );
}

function imagesView() {
  const wrap = h("div", {}, h("h2", {}, "Fotky"),
    h("p", { class: "help" }, "Nahrané fotky se automaticky zmenší (max. 2000 px) a převedou do formátu WebP, takže se web načítá rychle i s fotkami z mobilu. Fotku pak vyberete u stránky (hlavička nebo blok „Fotka“)."));
  const gallery = h("div", { class: "gallery" });
  const load = async () => {
    gallery.replaceChildren(h("p", {}, "Načítám…"));
    try {
      const { images } = await api("images");
      gallery.replaceChildren(
        ...images.map((img) =>
          h("figure", {},
            h("img", { src: img.url, alt: img.name || "", loading: "lazy" }),
            h("figcaption", {},
              h("span", { title: img.name }, img.name || img.key),
              h("button", {
                class: "icon del", title: "Smazat fotku", "aria-label": "Smazat fotku",
                onclick: async () => {
                  if (!confirm("Smazat fotku? Pokud je použitá na stránce, zmizí i odtamtud.")) return;
                  try { await api("images/" + encodeURIComponent(img.key), { method: "DELETE" }); load(); } catch (e) { toast(e.message, true); }
                },
              }, "✕")))),
      );
      if (!images.length) gallery.replaceChildren(h("p", {}, "Zatím žádné nahrané fotky."));
    } catch (e) {
      gallery.replaceChildren(h("p", { class: "error" }, e.message));
    }
  };
  wrap.append(h("div", { class: "panel" }, uploadControl(() => load()), h("div", { style: "height:16px" }), gallery));
  load();
  return wrap;
}

// ---------- fotky: nahrání a výběr ----------

async function shrink(file) {
  if (file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function uploadControl(onDone) {
  const status = h("span", { class: "hint" });
  const input = h("input", {
    type: "file", accept: "image/*", multiple: true, hidden: true,
    onchange: async () => {
      const files = [...input.files];
      let last = null;
      for (const [i, f] of files.entries()) {
        status.textContent = `Nahrávám ${i + 1} z ${files.length}…`;
        try {
          const blob = await shrink(f);
          const form = new FormData();
          const base = f.name.replace(/\.[^.]+$/, "");
          form.append("file", blob, base + (blob.type === "image/webp" ? ".webp" : ""));
          form.append("name", f.name);
          last = await api("images", { method: "POST", form });
        } catch (e) {
          toast(f.name + ": " + e.message, true);
        }
      }
      status.textContent = "";
      input.value = "";
      onDone(last);
    },
  });
  return h("div", { class: "add-row" },
    h("button", { class: "btn", type: "button", onclick: () => input.click() }, "Nahrát fotky"),
    input, status);
}

function pickImage(onPick) {
  const modal = $("#modal");
  const body = $("#modal-body");
  const gallery = h("div", { class: "gallery" });
  const choose = (url) => { modal.hidden = true; onPick(url); };
  const tile = (url, name) =>
    h("figure", {}, h("button", { class: "pick", type: "button", onclick: () => choose(url) },
      h("img", { src: url, alt: name || "" }), h("figcaption", {}, h("span", {}, name || url))));
  const load = async () => {
    gallery.replaceChildren(h("p", {}, "Načítám…"));
    let images = [];
    try { images = (await api("images")).images; } catch (e) { toast(e.message, true); }
    gallery.replaceChildren(...images.map((i) => tile(i.url, i.name)), ...BUILTIN_IMAGES.map((i) => tile(i.url, i.name)));
  };
  body.replaceChildren(
    uploadControl((last) => (last ? choose(last.url) : load())),
    h("p", { class: "hint" }, "Nahrajte novou fotku, nebo vyberte z již nahraných:"),
    gallery,
  );
  modal.hidden = false;
  load();
}

$("#modal-close").addEventListener("click", () => ($("#modal").hidden = true));
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") e.target.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").hidden = true; });

// ---------- ukládání ----------

async function save() {
  if (!current || current.kind === "images") return;
  const btn = $("#save");
  btn.disabled = true;
  try {
    if (current.kind === "page") {
      const d = current.draft;
      const payload = Object.assign({}, d, { slug: d.newSlug.trim() });
      delete payload.newSlug;
      const res = await api("pages/" + current.slug, { method: "PUT", body: payload });
      await loadContent();
      dirty = false;
      open("page", res.slug);
    } else {
      await api("site", { method: "PUT", body: current.draft });
      await loadContent();
      dirty = false;
    }
    markClean("Uloženo " + new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) + " — změny jsou hned vidět na webu.");
    toast("Uloženo.");
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function removePage(p) {
  if (!confirm(`Opravdu smazat stránku „${p.title}“? Nejde to vrátit.`)) return;
  try {
    await api("pages/" + current.slug, { method: "DELETE" });
    dirty = false;
    await loadContent();
    open("home");
    toast("Stránka smazána.");
  } catch (e) {
    toast(e.message, true);
  }
}

async function newPage() {
  if (!confirmLeave()) return;
  const title = prompt("Název nové stránky (např. Pokládka dlažby):");
  if (!title) return;
  const slug = prompt("Adresa stránky (stavbyliterak.cz/…):", slugify(title));
  if (!slug) return;
  try {
    const res = await api("pages", { method: "POST", body: { title, slug: slugify(slug) } });
    await loadContent();
    dirty = false;
    open("page", res.slug);
    toast("Stránka vytvořena jako koncept — po vyplnění zaškrtněte „Zveřejněno“.");
  } catch (e) {
    toast(e.message, true);
  }
}

$("#save").addEventListener("click", save);
$("#new-page").addEventListener("click", newPage);
document.querySelectorAll(".side button.nav[data-view]").forEach((b) => b.addEventListener("click", () => open(b.dataset.view)));
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
});
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

// ---------- přihlášení a start ----------

async function loadContent() {
  content = await api("content");
  renderPageList();
}

function showLogin() {
  $("#app").hidden = true;
  $("#login-view").hidden = false;
  $("#login-form").hidden = false;
  $("#code-form").hidden = true;
  $("#pw").focus();
}

async function showApp() {
  $("#login-view").hidden = true;
  $("#app").hidden = false;
  await loadContent();
  open("home");
}

let loginId = null;

$("#pw-show").addEventListener("change", (e) => { $("#pw").type = e.target.checked ? "text" : "password"; });

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-error");
  err.hidden = true;
  try {
    const res = await api("login", { method: "POST", body: { password: $("#pw").value } });
    $("#pw").value = "";
    if (res.requiresCode) {
      loginId = res.loginId;
      $("#login-form").hidden = true;
      $("#code-form").hidden = false;
      $("#code").focus();
    } else {
      setToken(res.token);
      showApp();
    }
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  }
});

$("#code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#code-error");
  err.hidden = true;
  try {
    const res = await api("verify-code", { method: "POST", body: { loginId, code: $("#code").value } });
    setToken(res.token);
    $("#code").value = "";
    showApp();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
    if (ex.code === "code_expired") showLogin();
  }
});

$("#logout").addEventListener("click", async () => {
  if (!confirmLeave()) return;
  try { await api("logout", { method: "POST" }); } catch {}
  setToken(null);
  dirty = false;
  showLogin();
});

(async () => {
  if (!token) return showLogin();
  try {
    await showApp();
  } catch {
    showLogin();
  }
})();
