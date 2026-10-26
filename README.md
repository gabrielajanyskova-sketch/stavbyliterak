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
  assets/css/style.css      styly webu (do stránek se vkládají přímo, bez dalšího požadavku)
  assets/js/main.js         menu, animace, galerie, poptávkový formulář
  assets/js/admin.js        logika administrace
  assets/fonts/             woff2 písma + licence (SIL OFL)
  assets/img/               logo, ikony, obrázek pro sdílení (og.jpg), fotka bagru
  assets/img/foto/          fotky realizací (max. 1400 px) + foto/sm/ zmenšeniny (800 px)
  manifest.webmanifest      ikona webu na ploše telefonu
  _headers                  cache a bezpečnostní hlavičky statických souborů
functions/
  [[path]].js               router: stránky, /api/*, /img/*, robots.txt, sitemap.xml,
                            llms.txt, přesměrování starých adres a domény bez www
  _lib/render.js            HTML šablony, meta tagy, schema.org, česká typografie
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
- Pod každou službou je blok „Další služby“ (interní prolinkování ze stránek
  zaškrtnutých v rozcestníku).
- V hotovém HTML se doplňují nezlomitelné mezery (jednopísmenné předložky, číslo
  a jednotka, telefon), takže nezůstávají na konci řádku.
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

### E-maily přes Resend

Zatím vypnuté — formulář po odeslání otevře návštěvníkovi e-mailový program s vyplněnou
zprávou a do adminu stačí heslo. Zapne se po převodu domény na Cloudflare:

- `RESEND_API_KEY` (secret) — klíč z resend.com, doména `stavbyliterak.cz` ověřená v Resendu
- ve `wrangler.toml` odkomentovat `MAIL_FROM`, `NOTIFY_EMAIL` (kam chodí poptávky)
  a `LOGIN_EMAIL` (kam chodí kódy pro přihlášení do adminu)

S nastaveným Resendem chce přihlášení do adminu navíc jednorázový kód z e-mailu
(samotné uniklé heslo pak nestačí).

## Administrace (`/admin`)

- **Stránky služeb** — nadpis, adresa, zveřejnění, menu, rozcestník na úvodu, hlavička
  (úvodní text, fakta, fotka), obsah po blocích (text, nadpis, odrážky, číslovaný
  seznam, postup, mřížka, časté otázky, katalog, poznámka, fotka), box Poptávka, SEO,
  staré adresy pro přesměrování. Pořadí stránek šipkami v levém menu.
- **Úvodní stránka** — velký nadpis a fotka, „Jak pracuji“, upoutávka na gastropůjčovnu, SEO.
- **Kontakty a formulář** — telefon, e-mail, adresa, IČ, možnosti ve formuláři.
- **Recenze** — hodnocení a vybrané recenze z Googlu, odkazy na profil.
- **Fotky** — nahrání (automaticky se zmenší a převedou na WebP), smazání.

Ochrana přihlášení: po 8 špatných pokusech z jedné IP se přihlašování na 15 minut
zablokuje; přihlášení platí 30 dní. Poptávkový formulář přijme z jedné IP nejvýš
5 zpráv za 10 minut (ochrana proti spamu a vyčerpání Resendu).

Bezpečnostní hlavičky: stránky posílá router s Content-Security-Policy (jen vlastní
skripty + otisk jediného vloženého skriptu `HEAD_SCRIPT` v `render.js`), HSTS
a Permissions-Policy; admin má vlastní CSP v `_headers`.

Žluté poznámky „k doplnění“ (blok Poznámka, styl Úkol) se zobrazují jen na náhledu
(`*.pages.dev`, localhost). Na ostré adrese `SITE_URL` se nevykreslí — nemusí se
před spuštěním mazat ručně. Šedé informační poznámky jsou vidět vždy.

Změny se na webu projeví hned po uložení. Při přejmenování adresy stránky zůstane
stará adresa funkční jako přesměrování.

## Lokální vývoj

```bash
npx wrangler pages dev --binding ADMIN_PASSWORD=heslo
```

Bindingy D1 a KV se načtou z `wrangler.toml` (lokálně jako prázdná databáze, která se
naplní z `seed.json`).

Web pak běží na http://localhost:8788, administrace na http://localhost:8788/admin.

## Výchozí obsah

`functions/_lib/seed.json` se použije jen pro **prázdnou** databázi (první spuštění).
Pozdější změny se dělají v administraci, ne v tomto souboru.

## Co ještě zbývá

- [ ] Termovize — průběh měření a výstup (žlutá poznámka na stránce, čeká na klienta)
- [ ] Stavební práce — které drobné práce dál nabízet (žlutá poznámka na stránce)
- [ ] Fotky z termovize a ze stavebních prací
- [ ] Převod domény od Webnode, Custom domains v Pages, adresa info@stavbyliterak.cz
      (Cloudflare Email Routing), Resend, Google Search Console a Seznam Webmaster

## Fotky

- Nejjednodušší je nahrávat fotky v adminu (**Fotky** nebo přímo v bloku **Galerie**):
  automaticky se zmenší (1600 px + náhled 800 px) a převedou na WebP. Jdou nahrát i PDF
  (certifikáty).
- Fotky přidané přímo do repozitáře patří do `public/assets/img/foto/` (max. 1400 px, WebP)
  a ke každé musí existovat zmenšenina se stejným názvem v `foto/sm/` (800 px) —
  web v galeriích a hlavičkách načítá právě ji. Aby je šlo vybrat v adminu, přidat je
  do `BUILTIN_IMAGES` v `assets/js/admin.js`.

