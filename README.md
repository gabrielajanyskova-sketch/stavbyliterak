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
  assets/js/leseni.js       konfigurátor lešení (půdorys, 3D náhled, termín) — jen na stránce s blokem „Konfigurátor lešení“
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

### Našeptávač adres (Mapy.com)

Pole „Místo“ ve formulářích a „Adresa stavby“ v konfigurátoru lešení našeptávají adresy
přes `/api/adresa` → Mapy.com REST API (`/v1/suggest`, jen Česko). Klíč je Secret
`MAPY_API_KEY` v Pages (účet na developer.mapy.com, bezplatný tarif stačí). Bez klíče
pole fungují jako obyčejný text.

Kontrola: `https://<web>/api/health` vrátí `{"ok":true,"db":true,"images":true,...}`.

### E-maily přes Resend

Zapnuté. Účet Resend je pana Literáka, doména `stavbyliterak.cz` je v něm ověřená (region EU).

- `RESEND_API_KEY` (secret v Pages) — klíč s oprávněním Sending access
- ve `wrangler.toml`: `MAIL_FROM` (web@stavbyliterak.cz), `NOTIFY_EMAIL` (info@stavbyliterak.cz,
  kam chodí poptávky) a `LOGIN_EMAIL` (kam chodí kódy pro přihlášení do adminu)
- DNS pro Resend: TXT `resend._domainkey`, CNAME `send` a `rsend`, TXT `_dmarc`,
  TXT `resend-domain-verification` na hlavní doméně. Pošta na info@ jde přes Seznam
  Email Profi (2× MX). Při převodu domény se všechny tyto záznamy musí přenést.
- Poptávka chodí jako přehledný HTML e-mail (zákazník, tlačítko Zavolat, rozpis). Z konfigurátoru lešení
  přijde navíc nákres (půdorys + 3D náhled) jako vložený obrázek. Když zákazník vyplní e-mail,
  poptávka má reply-to na něj.

Bez klíče (nebo při chybě) formulář otevře návštěvníkovi e-mailový program s vyplněnou zprávou.

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
- **Ceny gastropůjčovny** — u každé položky katalogu cena za víkend, za 1 den a záloha (za 1 ks).
  Na webu se nevypisují; zákazník po výběru vybavení a termínu uvidí jen orientační součet
  pronájmu a vratné zálohy (počítá server, `/api/gastro-quote`, počet kusů nejvýš podle „K zapůjčení“).
  Dokud není vyplněná žádná cena, box s cenou se neukazuje. U volby „Více dní“ zákazník zadá datum
  vyzvednutí i vrácení, cena pronájmu je „individuálně“ a ukáže se jen záloha.

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
  web v galeriích a hlavičkách načítá právě ji. Vedle ní patří i AVIF verze se stejným názvem
  (`foto/sm/název.avif`, kvalita ~50) — je zhruba o třetinu menší a prohlížeče ji berou přednostně. Aby je šlo vybrat v adminu, přidat je
  do `BUILTIN_IMAGES` v `assets/js/admin.js`.

