// Administrace webu — úpravy obsahu uloženého v D1 přes /api/admin/*.
"use strict";

const TOKEN_KEY = "admin_token";
// Fotky uložené přímo v repozitáři (public/assets/img/foto, zmenšeniny ve foto/sm).
// Nová fotka přidaná do repozitáře se tu musí doplnit, aby šla vybrat v adminu.
const BUILTIN_IMAGES = [
  // zemní práce
  { url: "/assets/img/foto/minibagr-kubota-kx016.webp", name: "Minibagr Kubota KX016-4" },
  { url: "/assets/img/foto/zemni-podklad-zpevnene-plochy.webp", name: "Štěrkový podklad pro zpevněnou plochu" },
  { url: "/assets/img/foto/zemni-bazen-vykop-obezdivka.webp", name: "Výkop a obezdívka pro bazén" },
  { url: "/assets/img/foto/stavebni-operna-zed-bazen.webp", name: "Opěrná zeď a podklad zpevněné plochy u bazénu" },
  { url: "/assets/img/foto/vykop-zakladova-deska.webp", name: "Výkop pro základy" },
  { url: "/assets/img/foto/terenni-upravy-operna-zed.webp", name: "Terénní úpravy a opěrná zeď" },
  { url: "/assets/img/foto/minibagr-a-traktor-kubota.webp", name: "Minibagr a traktor Kubota" },
  { url: "/assets/img/foto/traktor-kubota-celni-nakladac.webp", name: "Traktor Kubota s čelním nakladačem" },
  { url: "/assets/img/foto/zakladac-travniku.webp", name: "Zakladač trávníku" },
  { url: "/assets/img/foto/zakladac-zpracovani-pudy.webp", name: "Zpracování půdy zakladačem" },
  // termovize a stavební práce
  { url: "/assets/img/foto/termovize-studeny-kout.webp", name: "Termovize — studený kout v místnosti, 12,4 °C" },
  { url: "/assets/img/foto/zamkova-dlazba-garaz.webp", name: "Zámková dlažba v garáži" },
  // hliníkový program
  { url: "/assets/img/foto/zimni-zahrada-rodinny-dum.webp", name: "Zimní zahrada u rodinného domu" },
  { url: "/assets/img/foto/zasklena-terasa-dreveny-dum.webp", name: "Zasklená terasa u dřevěného domu" },
  { url: "/assets/img/foto/zasklena-pergola-dreveny-dum.webp", name: "Zasklená terasa u dřevěného domu — pohled z boku" },
  { url: "/assets/img/foto/zimni-zahrada-interier.webp", name: "Zasklená terasa u dřevěného domu — zevnitř" },
  { url: "/assets/img/foto/zaskleni-pergoly.webp", name: "Zasklení pergoly" },
  { url: "/assets/img/foto/zaskleni-terasy.webp", name: "Zasklení terasy" },
  { url: "/assets/img/foto/hlinikova-pergola.webp", name: "Hliníková pergola" },
  { url: "/assets/img/foto/zimni-zahrada-zahrada.webp", name: "Zimní zahrada na zahradě" },
  { url: "/assets/img/foto/hlinikove-zabradli-dum.webp", name: "Hliníkové zábradlí balkonu" },
  { url: "/assets/img/foto/hlinikove-zabradli-terasa.webp", name: "Hliníkové zábradlí na terase přístavby" },
  { url: "/assets/img/foto/hlinikove-zabradli-balkon.webp", name: "Hliníkové zábradlí na terase přístavby — z druhé strany" },
  // lešení
  { url: "/assets/img/foto/leseni-doprava-dodavkou.webp", name: "Lešení — doprava dodávkou" },
  { url: "/assets/img/foto/leseni-fasada-rodinny-dum.webp", name: "Lešení na fasádě rodinného domu" },
  { url: "/assets/img/foto/leseni-ramove-pozinkovane.webp", name: "Rámové pozinkované lešení" },
  { url: "/assets/img/foto/leseni-ramova-sestava.webp", name: "Rámová sestava lešení (schéma)" },
  { url: "/assets/img/foto/sklopny-privesnik-debon.webp", name: "Sklopný přívěs Debon PW3.6 3500 Electric" },
  { url: "/assets/img/foto/leseni-stit-rodinny-dum.webp", name: "Lešení u štítu rodinného domu" },
  { url: "/assets/img/foto/leseni-rodinny-dum-fasada.webp", name: "Rodinný dům (fasáda)" },
  { url: "/assets/img/foto/stavebni-koupelna-obklady.webp", name: "Koupelna — obklady, sprchový kout a osvětlení" },
  { url: "/assets/img/foto/stavebni-pokladka-dlazby.webp", name: "Pokládka velkoformátové dlažby" },
  { url: "/assets/img/foto/stavebni-obklad-niky-kamna.webp", name: "Obklad niky a dlažba pod krbová kamna" },
  { url: "/assets/img/foto/stavebni-sdk-podhled.webp", name: "Konstrukce sádrokartonového podhledu" },
  // gastropůjčovna
  { url: "/assets/img/foto/gastro-vycep-oslava.webp", name: "Výčep na oslavě" },
  { url: "/assets/img/foto/gastro-vycep-2-kohouty.webp", name: "Výčep na pivo a limo — 2 kohouty" },
  { url: "/assets/img/foto/gastro-termos-elektricky.webp", name: "Elektrický termos s kohoutem" },
  { url: "/assets/img/foto/gastro-varnice-nerez.webp", name: "Nerezová várnice s kohoutem" },
  { url: "/assets/img/foto/gastro-termobox.webp", name: "Termobox" },
  { url: "/assets/img/foto/gastro-kotlik-na-gulas.webp", name: "Kotlík na guláš" },
  { url: "/assets/img/foto/gastro-rozen.webp", name: "Rožeň s elektrickou otočí" },
  { url: "/assets/img/foto/gastro-kotlik-elektricky.webp", name: "Elektrický kotlík na polévku a guláš" },
  { url: "/assets/img/foto/gastro-chafing.webp", name: "Chafing — elektrická ohřevná vana" },
  { url: "/assets/img/foto/gastro-hotdogovac.webp", name: "Hotdogovač se 2 trny" },
  { url: "/assets/img/foto/gastro-stojan-na-prilohy.webp", name: "Stojan na přílohy" },
  { url: "/assets/img/foto/gastro-pivni-set.webp", name: "Pivní set — stůl a 2 lavice" },
  { url: "/assets/img/foto/gastro-reproduktor-jbl.webp", name: "Bluetooth reproduktor JBL — partybox" },
  // certifikáty
  { url: "/assets/img/foto/certifikat-termografie-ctg.webp", name: "Centrum termografie — Termografická diagnostika budov (2026)" },
  { url: "/assets/img/foto/osvedceni-pyroplex.webp", name: "Pyroplex — osvědčení k montáži protipožárních systémů (2024)" },
  { url: "/assets/img/foto/certifikat-nullifire.webp", name: "Nullifire — pasivní protipožární technika, školení (2024)" },
  { url: "/assets/img/foto/certifikat-rigips.webp", name: "Rigips — montáž suché výstavby vč. protipožárních konstrukcí (2022)" },
  { url: "/assets/img/foto/osvedceni-dek-fermacell.webp", name: "Stavebniny DEK — systémy suché výstavby Fermacell (2022)" },
  { url: "/assets/img/foto/osvedceni-weber.webp", name: "Weber — fasády, zateplení ETICS, sanace, obklady a podlahy (2021)" },
  { url: "/assets/img/foto/certifikat-tytan-fgs.webp", name: "Tytan — zateplení fasád FGS (2021)" },
  { url: "/assets/img/foto/certifikat-jub.webp", name: "JUB Academy — techniky DECOR a systém HYDROSOL (2021)" },
  { url: "/assets/img/foto/osvedceni-dek-asfaltove-pasy.webp", name: "Stavebniny DEK — asfaltové pásy (2022)" },
  { url: "/assets/img/foto/poptavej-spolehlivy-dodavatel-2025.webp", name: "Poptávej.cz — Certifikát spolehlivého dodavatele (2025)" },
  { url: "/assets/img/foto/poptavej-spolehlivy-dodavatel-2022.webp", name: "Poptávej.cz — Certifikát spolehlivého dodavatele (2022)" },
  { url: "/assets/img/foto/poptavej-doporuceno-zakazniky.webp", name: "Poptávej.cz — Doporučeno zákazníky" },
  { url: "/assets/img/foto/proverena-spolecnost-2023.webp", name: "Prověřená společnost 2023" },
  { url: "/assets/img/foto/certifikat-autocad.webp", name: "Autodesk — AutoCAD, 2D dokumentace (2010)" },
  { url: "/assets/img/foto/certifikat-vysazeni-stromu.webp", name: "Gala dřevo — certifikát o vysazení stromu (2025)" },
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
    fields: [["title", "Název"], ["text", "Popis", "area"], ["spec", "Parametry (rozměry, objem…)"], ["warn", "Upozornění (na webu zvýrazněné, nepovinné)"], ["count", "Počet kusů (např. 2 ks)"], ["photo", "Fotka (nepovinné)", "photo"],
      ["price_weekend", "Cena za víkend za 1 ks (Kč) — na webu se nezobrazuje"], ["price_day", "Cena za 1 den za 1 ks (Kč) — na webu se nezobrazuje"], ["deposit", "Záloha za 1 ks (Kč) — na webu se nezobrazuje"]],
    add: "+ položka",
  },
  table: { label: "Tabulka (dva sloupce)", fields: [["title", "Položka — bez hodnoty se z řádku stane nadpis skupiny"], ["text", "Hodnota"]], add: "+ řádek" },
  scaffold: { label: "Konfigurátor lešení" },
  note: { label: "Zvýrazněná poznámka" },
  image: { label: "Fotka" },
  gallery: { label: "Galerie (fotky, certifikáty)" },
};

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch {}

let content = { site: null, pages: [] };
let current = null; // { kind: 'page'|'home'|'settings'|'reviews'|'images', slug, draft }
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

const isPdf = (url) => /\.pdf$/i.test(url);
// náhled: zmenšenina (stejná konvence jako na webu), PDF jako dlaždice
const thumbUrl = (url) => url.replace(/^(\/assets\/img\/foto\/|\/img\/)(?!sm\/)/, "$1sm/");
const preview = (url, alt = "") => (isPdf(url) ? h("div", { class: "none" }, "PDF") : h("img", { src: thumbUrl(url), alt, loading: "lazy" }));

const lines = (text) => text.split("\n").map((s) => s.trim()).filter(Boolean);

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
  unsupported_type: "Tento typ souboru nejde nahrát. Použijte JPG, PNG, WebP nebo PDF.",
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
            fields.map(([key, label, kind]) =>
              kind === "area" ? area(item, key, label, { rows: 3 }) : kind === "photo" ? photoField(item, key, label) : text(item, key, label)),
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
        obj[key] ? preview(obj[key]) : h("div", { class: "none" }, "bez fotky"),
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
        } else if (b.type === "gallery") {
          b.items = b.items || [];
          body = galleryEditor(b);
        } else if (b.type === "image") {
          body = h("div", {}, photoField(b, "src", "Fotka"), text(b, "caption", "Popisek pod fotkou"));
        } else if (b.type === "scaffold") {
          body = h("p", { class: "hint", style: "margin:0" }, "Na tomto místě se na webu zobrazí konfigurátor lešení (půdorys, 3D náhled, termín, poptávka). Nemá žádné nastavení.");
        } else if (b.type === "table") {
          b.items = b.items || [];
          body = h("div", {},
            h("div", { class: "grid2" }, text(b, "head1", "Záhlaví 1. sloupce"), text(b, "head2", "Záhlaví 2. sloupce")),
            itemList(b.items, meta.fields, meta.add));
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
            else if (t === "gallery") b.items = [];
            else if (t === "scaffold") {}
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

function galleryEditor(b) {
  const wrap = h("div");
  const render = () => {
    wrap.replaceChildren(
      check({ get v() { return b.fit === "contain"; }, set v(x) { b.fit = x ? "contain" : undefined; } }, "v", "Zobrazit celé, neořezávat (certifikáty, loga, výrobky)"),
      ...b.items.map((item, i) =>
        h("div", { class: "item" },
          h("div", { class: "photo-pick" },
            preview(item.src),
            h("div", { class: "fields", style: "flex:1" }, text(item, "caption", "Popisek")),
          ),
          rowButtons(b.items, i, render),
        )),
      h("div", { class: "add-row" },
        h("button", {
          class: "btn btn-line btn-small", type: "button",
          onclick: () => pickImage((url, name) => { b.items.push({ src: url, caption: name || "" }); markDirty(); render(); }),
        }, "+ fotka nebo PDF")),
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
  } else if (kind === "reviews") {
    current = { kind, draft: structuredClone(content.site) };
    view.replaceChildren(reviewsView(current.draft));
    $("#preview-link").href = "/";
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
      check(p, "nav_extra", "Zobrazit jako zvláštní odkaz vpravo v horní liště (za telefonem, pro vedlejší službu)"),
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
          const ta = h("textarea", { id: "aliases", rows: 2, oninput: (e) => { p.aliases = lines(e.target.value); markDirty(); } });
          ta.value = p.aliases.join("\n");
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
      photoField(hm, "hero_photo", "Fotka na pozadí (nepovinné — ztmaví se, aby byl nadpis čitelný)"),
      text(hm, "hero_photo_alt", "Co je na fotce (pro vyhledávače a nevidomé)"),
      text(hm, "chooser_label", "Nadpis rozcestníku služeb"),
      h("p", { class: "hint" }, "Které služby jsou v rozcestníku a v jakém pořadí, nastavíte u jednotlivých stránek (a šipkami v levém menu)."),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Jak pracuji"),
      h("div", { class: "grid2" }, text(hm, "about_label", "Malý popisek"), text(hm, "about_title", "Nadpis")),
      area(hm, "about_text", "Text", { rows: 3 }),
      h("span", { class: "lbl" }, "Zásady (sloupce)"),
      itemList(hm.principles, [["label", "Popisek (např. 01 — Prohlídka)"], ["title", "Nadpis"], ["text", "Text", "area"]], "+ zásada"),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Upoutávka na další službu (tmavá karta)"),
      select(hm, "promo_page", "Odkazovaná stránka", [["", "— nezobrazovat —"], ...content.pages.map((p) => [p.slug, p.title])]),
      h("div", { class: "grid2" }, text(hm, "promo_label", "Malý popisek"), text(hm, "promo_title", "Nadpis")),
      area(hm, "promo_text", "Text", { rows: 3 }),
      text(hm, "promo_button", "Text tlačítka"),
      photoField(hm, "promo_photo", "Fotka (nepovinné)"),
      text(hm, "promo_photo_alt", "Co je na fotce (pro vyhledávače a nevidomé)"),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Vyhledávače (SEO)"),
      text(hm, "meta_title", "Titulek ve vyhledávání"),
      area(hm, "meta_description", "Popis ve vyhledávání", { rows: 2 }),
    ),
  );
}

function reviewsView(s) {
  const r = (s.reviews = s.reviews || {});
  r.items = r.items || [];
  return h("div", {},
    h("h2", {}, "Recenze"),
    h("p", { class: "help" }, "Sekce se zobrazí na úvodní stránce, jakmile vyplníte hodnocení nebo aspoň jednu recenzi. Recenze zkopírujte z Google (jméno, hvězdičky, text) — vyberte ty nejlepší, ideálně 3 nebo 6."),
    h("div", { class: "panel" },
      h("h3", {}, "Celkové hodnocení na Googlu"),
      h("div", { class: "grid2" },
        text(r, "rating", "Průměr (např. 4,9)"),
        text(r, "count", "Počet recenzí (nepovinné)", { hint: "Počet se na Googlu mění — když ho necháte prázdný, web napíše jen „hodnocení na Googlu“." }),
      ),
      text(r, "title", "Nadpis sekce", { placeholder: "Co o nás říkají zákazníci" }),
      text(r, "google_url", "Odkaz na recenze na Googlu", { hint: "Google Mapy → Stavby Literák → Sdílet → Kopírovat odkaz" }),
      text(r, "write_url", "Odkaz „Napsat recenzi“", { hint: "Firemní profil Google → Požádat o recenze → zkopírovat odkaz (g.page/r/…)" }),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Vybrané recenze"),
      itemList(r.items, [["name", "Jméno"], ["stars", "Hvězdičky (1–5)"], ["date", "Kdy (např. „před 2 měsíci“ nebo „březen 2025“)"], ["text", "Text recenze", "area"]], "+ recenze"),
    ),
  );
}

function settingsView(s) {
  const c = (s.contact = s.contact || {});
  c.services = c.services || [];
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
      text(s, "geo", "Poloha (GPS)", { placeholder: "49.675854, 18.343376", hint: "Pro vyhledávače. Najdete ji v Mapách Google: pravým tlačítkem na značku firmy, první řádek nabídky." }),
      text(s, "name", "Název webu", { hint: "Používá se v titulcích a popiscích obrázků." }),
    ),
    h("div", { class: "panel" },
      h("h3", {}, "Kontaktní sekce a formulář"),
      text(c, "title", "Nadpis"),
      text(c, "text", "Text pod nadpisem"),
      h("div", { class: "field" },
        h("label", { for: "services" }, "Možnosti „O co jde“ ve formuláři"),
        (() => {
          const ta = h("textarea", { id: "services", rows: 8, oninput: (e) => { c.services = lines(e.target.value); markDirty(); } });
          ta.value = c.services.join("\n");
          return ta;
        })(),
        h("p", { class: "hint" }, "Jedna možnost na řádek."),
      ),
    ),
  );
}

function imagesView() {
  const wrap = h("div", {}, h("h2", {}, "Fotky"),
    h("p", { class: "help" }, "Nahrané fotky se automaticky zmenší a převedou do formátu WebP (plná velikost max. 1600 px + náhled), takže se web načítá rychle i s fotkami z mobilu. Nahrát jde i PDF (certifikáty). Fotku pak vyberete u stránky — v hlavičce nebo v bloku „Fotka“ či „Galerie“."));
  const gallery = h("div", { class: "gallery" });
  const load = async () => {
    gallery.replaceChildren(h("p", {}, "Načítám…"));
    try {
      const { images } = await api("images");
      gallery.replaceChildren(
        ...images.map((img) =>
          h("figure", {},
            preview(img.url, img.name || ""),
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

async function shrink(file, max) {
  if (file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function uploadControl(onDone) {
  const status = h("span", { class: "hint" });
  const input = h("input", {
    type: "file", accept: "image/*,application/pdf", multiple: true, hidden: true,
    onchange: async () => {
      const files = [...input.files];
      let last = null;
      for (const [i, f] of files.entries()) {
        status.textContent = `Nahrávám ${i + 1} z ${files.length}…`;
        try {
          const form = new FormData();
          const base = f.name.replace(/\.[^.]+$/, "");
          if (f.type === "application/pdf") {
            form.append("file", f, f.name);
          } else {
            const [full, small] = await Promise.all([shrink(f, 1600), shrink(f, 800)]);
            form.append("file", full, base + ".webp");
            form.append("thumb", small, base + "-sm.webp");
          }
          form.append("name", base);
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
    h("button", { class: "btn", type: "button", onclick: () => input.click() }, "Nahrát fotky / PDF"),
    input, status);
}

function pickImage(onPick) {
  const modal = $("#modal");
  const body = $("#modal-body");
  const gallery = h("div", { class: "gallery" });
  const choose = (url, name) => { modal.hidden = true; onPick(url, name); };
  const tile = (url, name) =>
    h("figure", {}, h("button", { class: "pick", type: "button", onclick: () => choose(url, name) },
      preview(url, name || ""), h("figcaption", {}, h("span", {}, name || url))));
  const load = async () => {
    gallery.replaceChildren(h("p", {}, "Načítám…"));
    let images = [];
    try { images = (await api("images")).images; } catch (e) { toast(e.message, true); }
    gallery.replaceChildren(...images.map((i) => tile(i.url, i.name)), ...BUILTIN_IMAGES.map((i) => tile(i.url, i.name)));
  };
  body.replaceChildren(
    uploadControl((last) => (last ? choose(last.url, last.name) : load())),
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
