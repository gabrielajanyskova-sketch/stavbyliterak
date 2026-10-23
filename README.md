# Stavby Literák — web s redakčním systémem

Web běží celý na **Cloudflare Pages**: statické soubory (styly, logo, administrace)
z `public/` a stránky se skládají z obsahu v databázi **D1** přes Pages Functions
(`functions/`). Fotky nahrané v administraci se ukládají do **Workers KV**.
Nasazuje se samo při každém pushi — nic se nevkládá ručně do dashboardu.

Veškerý obsah (texty, služby, menu, rozcestník na úvodu, fakta, fotky, časté otázky,
katalog gastropůjčovny, kontakty, SEO) se upravuje v **`/admin`**.

## Struktura

```
public/                     statické soubory (výstupní složka Pages)
  admin.html                administrace
  assets/css/style.css      styly webu
  assets/js/main.js         menu, animace, poptávkový formulář
  assets/js/admin.js        logika administrace
  assets/img/               logo, favicon, výchozí fotka bagru
  robots.txt, _headers
functions/
  [[path]].js               router: stránky, /api/*, /img/*, sitemap.xml, přesměrování
  _lib/render.js            HTML šablony stránek (design)
  _lib/db.js                práce s D1, automatické vytvoření tabulek
  _lib/api.js               API administrace a formuláře, přihlášení, fotky
  _lib/seed.json            výchozí obsah — nahraje se do prázdné databáze
```

## Nasazení na Cloudflare (jednou)

1. **D1 databáze:** Workers & Pages → D1 → Create → název `stavbyliterak`.
   Tabulky se vytvoří a naplní výchozím obsahem samy při první návštěvě webu.
2. **KV pro fotky:** Workers & Pages → KV → Create namespace → `stavbyliterak-images`.
3. **Pages projekt:** Workers & Pages → Create → Pages → Connect to Git → tento repozitář.
   - Production branch: `main`
   - Build command: *(prázdné)*
   - Build output directory: `public`
4. V projektu **Settings → Bindings**:
   - D1 database → název proměnné `DB` → databáze `stavbyliterak`
   - KV namespace → název proměnné `IMAGES` → `stavbyliterak-images`
5. **Settings → Variables and Secrets** (typ *Secret*):
   - `ADMIN_PASSWORD` — heslo do administrace (dlouhé, ne „Bublina90“)
6. **Doména:** Custom domains → `stavbyliterak.cz` a `www.stavbyliterak.cz`
   (doména musí mít DNS na Cloudflare — přesun z Webnode).
7. Po změně bindingů/proměnných je potřeba nové nasazení (Deployments → Retry deployment).

Kontrola: `https://<web>/api/health` vrátí `{"ok":true,"db":true,"images":true,...}`.

### Volitelně: e-maily přes Resend (doporučeno)

Když nastavíte tyto proměnné, poptávkový formulář posílá e-maily přímo a přihlášení
do adminu chce navíc jednorázový kód z e-mailu (samotné uniklé heslo pak nestačí):

- `RESEND_API_KEY` (secret) — klíč z resend.com, doména `stavbyliterak.cz` ověřená v Resend
- `MAIL_FROM` (text) — např. `Web Stavby Literák <web@stavbyliterak.cz>`
- `NOTIFY_EMAIL` (text) — kam chodí poptávky a přihlašovací kódy, např. `stavbyliterak@email.cz`

Bez nich formulář otevře návštěvníkovi e-mailový program s vyplněnou zprávou a do adminu
stačí heslo.

## Administrace (`/admin`)

- **Stránky služeb** — nadpis, adresa, zveřejnění, menu, rozcestník na úvodu, hlavička
  (úvodní text, fakta, fotka), obsah po blocích (text, nadpis, odrážky, číslovaný
  seznam, postup, mřížka, časté otázky, katalog, poznámka, fotka), box Poptávka, SEO,
  staré adresy pro přesměrování. Pořadí stránek šipkami v levém menu.
- **Úvodní stránka** — velký nadpis, „Jak pracuji“, upoutávka na gastropůjčovnu, SEO.
- **Kontakty a formulář** — telefon, e-mail, adresa, IČ, možnosti ve formuláři.
- **Fotky** — nahrání (automaticky se zmenší a převedou na WebP), smazání.

Ochrana přihlášení: po 8 špatných pokusech z jedné IP se přihlašování na 15 minut
zablokuje; přihlášení platí 30 dní.

Změny se na webu projeví hned po uložení. Při přejmenování adresy stránky zůstane
stará adresa funkční jako přesměrování.

## Lokální vývoj

```bash
npx wrangler pages dev public --d1 DB --kv IMAGES --binding ADMIN_PASSWORD=heslo
```

Web pak běží na http://localhost:8788, administrace na http://localhost:8788/admin.

## Výchozí obsah

`functions/_lib/seed.json` se použije jen pro **prázdnou** databázi (první spuštění).
Pozdější změny se dělají v administraci, ne v tomto souboru.

## Co ještě zbývá

- [ ] Termovize — průběh měření a výstup (na původním webu nebylo, je to návrh; žlutá poznámka na stránce)
- [ ] Stavební práce — které drobné práce dál nabízet (žlutá poznámka na stránce)
- [ ] Stránky Certifikáty a Reference z původního webu — lze přidat v adminu jako nové stránky
- [ ] Další vlastní fotky ke službám
