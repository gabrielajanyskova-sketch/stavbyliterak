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
  assets/css/fonts.css      písma hostovaná u nás (bez Google Fonts)
  assets/css/style.css      styly webu
  assets/js/main.js         menu, animace, poptávkový formulář
  assets/js/admin.js        logika administrace
  assets/fonts/             woff2 písma + licence (SIL OFL)
  assets/img/               logo, favicon, obrázek pro sdílení (og.jpg), fotka bagru
  assets/img/foto/          fotky realizací (max. 1400 px) + foto/sm/ zmenšeniny (800 px)
  _headers                  cache a bezpečnostní hlavičky statických souborů
functions/
  [[path]].js               router: stránky, /api/*, /img/*, robots.txt, sitemap.xml,
                            llms.txt, přesměrování starých adres a domény bez www
  _lib/render.js            HTML šablony, meta tagy, schema.org
  _lib/db.js                práce s D1, automatické vytvoření tabulek
  _lib/api.js               API administrace a formuláře, přihlášení, fotky
  _lib/seed.json            výchozí obsah — nahraje se do prázdné databáze
wrangler.toml               napojení D1/KV, SITE_URL
```

## SEO, schema.org a AI vyhledávače

- Hlavní adresa je `SITE_URL` ve `wrangler.toml` (`https://www.stavbyliterak.cz`):
  z ní se skládá canonical, sitemap, Open Graph a schema.org. Na jiných adresách
  (`*.pages.dev`) web běží s `noindex`, `stavbyliterak.cz` bez www se přesměruje.
- Každá stránka má title, description, canonical, Open Graph (obrázek = fotka stránky,
  jinak `og.jpg`) a JSON-LD graf: `HomeAndConstructionBusiness` (NAP, IČO, oblast),
  `WebSite`, `WebPage`, `Service`, `BreadcrumbList`, `FAQPage` z bloků „Časté otázky“
  a `OfferCatalog` z bloků „Katalog“.
- `/sitemap.xml` a `/robots.txt` se generují z obsahu, `/llms.txt` je stručný
  přehled firmy, služeb a odpovědí pro AI vyhledávače (ChatGPT, Perplexity, Gemini…).
- Po spuštění domény: přidat web do Google Search Console a Bing Webmaster Tools,
  odeslat sitemapu a založit/aktualizovat Firemní profil Google se stejným názvem,
  adresou a telefonem jako na webu.

## Nasazení na Cloudflare

- Pages projekt `stavbyliterak` je napojený na tento repozitář, nasazuje se
  automaticky při každém pushi do `main` (výstupní složka `public`, bez build příkazu).
- D1 databáze `stavbyliterak` a KV `stavbyliterak-images` jsou napojené přes
  `wrangler.toml` — bindingy se v dashboardu neklikají. Tabulky se vytvoří a naplní
  výchozím obsahem samy při první návštěvě webu.
- Heslo do adminu je Secret `ADMIN_PASSWORD` v dashboardu
  (Pages → stavbyliterak → Settings → Variables and Secrets) — do repozitáře nepatří.
- Doména: Custom domains → `stavbyliterak.cz` a `www.stavbyliterak.cz`
  (DNS domény musí být na Cloudflare — přesun z Webnode).

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

## Fotky

- Nejjednodušší je nahrávat fotky v adminu (**Fotky** nebo přímo v bloku **Galerie**):
  automaticky se zmenší (1600 px + náhled 800 px) a převedou na WebP. Jdou nahrát i PDF
  (certifikáty).
- Fotky přidané přímo do repozitáře patří do `public/assets/img/foto/` (max. 1400 px, WebP)
  a ke každé musí existovat zmenšenina se stejným názvem v `foto/sm/` (800 px) —
  web v galeriích a hlavičkách načítá právě ji. Aby je šlo vybrat v adminu, přidat je
  do `BUILTIN_IMAGES` v `assets/js/admin.js`.

