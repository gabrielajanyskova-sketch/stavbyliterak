# Audit funkčnosti a bezpečnosti — 30. 10. 2026

Rozsah: lokální checkout, serverové Pages Functions, přihlášení a API, vykreslování, hlavičky a klientská logika formulářů. Výchozí commit: `847ccb19251cd823617934edbf58a83a87944b80`. Audit není penetrační test produkce. Texty, obsah databáze a webdesign se nemění. Produkční DNS, nastavení účtů Cloudflare a skutečné odesílání pošty nebyly ověřeny.

## Opravy na této větvi

1. **Střední: obejití limitů souběžnými požadavky.** Čtení počítadla a následný zápis byly oddělené. Paralelní požadavky mohly všechny projít stejným limitem. Nyní jediný podmíněný SQL UPSERT atomicky rezervuje pokus. Platí pro přihlášení, kontaktní formulář i Mapy.com. U e-mailového přihlášení se počítají i požadavky se správným heslem: zabraňuje to neomezenému rozesílání kódů při znalosti hesla. Bez e-mailového druhého kroku úspěšné přihlášení počítadlo resetuje. Žádná migrace databáze.
2. **Střední: opakované použití jednorázového kódu.** Kontrola a smazání byly oddělené; několik současných požadavků mohlo založit více relací. Nově atomická rezervace jednoho z pěti pokusů a podmíněné DELETE RETURNING zaručí jediné spotřebování kódu. Vypršelý nebo vyčerpaný kód se odmítne.
3. **Střední, integrita dat: poškozený JSON při ukládání.** Parser dříve nahrazoval neplatný JSON prázdným objektem, který mohl přepsat nastavení. Nově chybný JSON, null, pole a primitivní hodnoty dostanou 400 před uložením. Null v kontaktním formuláři už nezpůsobí serverovou chybu. Toto není kontrola všech povinných polí jinak platného objektu.
4. **Funkčnost: zastaralá cena půjčovny.** Starší pomalejší odpověď mohla přepsat novější cenu a při čekání se používal starý součet. Verze požadavků nyní ignoruje staré úspěchy i chyby; při změně výběru se starý součet zneplatní. Rozložení, styly a texty zůstávají stejné.

## Navazující opravy na stejné větvi

- **Limity před parsováním:** čtení skutečných bajtů ze streamu; Content-Length není jediným zdrojem kontroly. Limity jsou 64 KiB pro malé požadavky, 2 MiB pro obsah a kontaktní formulář s nákresem a 21 MiB pro multipart se dvěma soubory do 10 MiB. Upload se autentizuje před čtením těla. Překročení vrací 413, poškozený multipart 400.
- **Nahrávání:** kontrola signatur JPEG, PNG, WebP, GIF, AVIF a PDF. Zmenšenina musí být obrázek; velikost i signatura obou souborů se ověří před zápisem do KV. Jde o kontrolu formátu, nikoli plný mediální dekodér nebo antivir.
- **Relace:** token se neposílá v JSON ani neukládá do localStorage; server jej předá přes HttpOnly, SameSite=Strict cookie. Na HTTPS je cookie Secure s prefixem __Host-. Pro lokální HTTP vývoj je samostatná cookie. D1 uchovává SHA-256 otisk náhodného tokenu. Změnové admin požadavky vyžadují Origin shodný s adresou požadavku, včetně přihlášení a odhlášení. Staré bearer relace nejsou přijímány; po nasazení je potřeba znovu se přihlásit. Není nutná změna schématu D1. Staré řádky relací dožijí do pravidelného úklidu, nejsou ale použitelné starým tokenem.
- **Ukládání:** validace povinných polí a struktury nastavení, bloků a pořadí stránek. Prázdný objekt nastavení se odmítá. Přejmenování a uložení obsahu stránky proběhne jedním SQL UPDATE; konflikt adresy zachová původní řádek a vrací 409.
- **Hlavičky:** společné ochranné hlavičky jsou v jednom modulu a používají je HTML, JSON API, odpovědi formuláře a KV soubory. Souborům z KV se přidává omezující CSP, cache obrázků se zachovává. Statické soubory si ponechávají public/_headers.
- **Odhlášení:** při neúspěšné serverové revokaci se klient netváří jako úspěšně odhlášený.

### Zbývající provozní ověření

Ověřit skutečné druhé přihlášení e-mailem, scoped Cloudflare tokeny pro zálohu, obnovitelnost D1 i KV a DMARC reporting. Nastavení DNS neměnit podle samotného screenshotu; nasazení přísnějšího DMARC vyžaduje ověřené odesílatele. Žádná produkční pošta nebyla odeslána. Tyto úkony vyžadují produkční přístupy a nejsou součástí lokálních změn kódu.

## Snímky auditu: rychlost a soukromí

Snímky uvádějí mobil 83/100, LCP 2,8 s a CLS 0,24. Neobsahují přesnou testovanou URL ani verzi a nejsou novým měřením této větve. Nelze z nich slíbit zvýšení skóre.

Aktuální kód již používá WebP/AVIF, rozměry obrázků z repozitáře, přednostní načtení hlavní fotky a vlastní písma. Obecná rada „převést obrázky na WebP“ tedy sama neřeší konkrétní příčinu. U fotek nahraných do KV nejsou rozměry evidované. Před případnou opravou CLS doporučuji zaznamenat konkrétní layout-shift zdroje v mobilním prohlížeči na produkční URL, včetně studené cache a pomalého připojení. Prověřit zejména změnu metrik při načtení písem a nahrané obrázky; až pak případně doplnit metadata rozměrů nebo metriky fallback fontu při zachování výsledného vzhledu. V této větvi se CSS ani písma nemění.

Výchozí obsah již má publikovanou stránku `/pravni-informace` s oddílem `#osobni-udaje` a renderer přidává odkaz u formuláře. Kontrola nenalezeného GDPR odkazu na snímku tedy není pro výchozí obsah reprodukována. Produkční D1 může mít jiný obsah než seed; ověřit publikování této stránky v administraci. Právní text nebyl upravován ani právně posuzován.

## Ověření finálního stavu

- `node --experimental-vm-modules scripts/security-test.mjs`: **17/17 testů prošlo**. Souběžné limity a OTP, expirace, neplatný JSON bez zápisu, null formulář, pořadí odpovědí ceny, cookie a hash relace, revokace, CSRF Origin, stream bez Content-Length, signatury a upload bez dílčího zápisu, atomický konflikt přejmenování, odmítnutí starého bearer tokenu, nadlimitní data a poškozený multipart. Používá se skutečný API modul a SQLite; render a část datových helperů jsou v úzkých testech nahrazené. Test vyžaduje Node s node:sqlite (ověřeno Node 24.19.0 a Node 22).
- Bezpečnostní testy jsou také součástí `.github/workflows/kontrola.yml` pod Node 22.
- `WRANGLER_SEND_METRICS=false npm run check`: **10 stránek a 209 odkazů/souborů prošlo**, včetně validace HTML, sitemap, robots, llms a security.txt. Není build krok.
- `node scripts/admin-browser-test.mjs` se spuštěným `npm run dev`: skutečný Chromium a lokální Wrangler/D1/KV. Prošlo přihlášení z formuláře, HttpOnly cookie nedostupná JavaScriptu, nepřítomnost tokenu v localStorage, obnova stránky se zachovanou relací, uložení skutečného site obsahu, vytvoření/přejmenování/smazání testovací stránky se zachovaným aliasem, upload/načtení/smazání skutečného WebP a odhlášení s následnou 401. Bez JavaScriptových výjimek. Test vyžaduje systémový Chromium, port 9223 a lokální server na 8788; pro testovací data používat lokální vývojové prostředí.
- Produkční LCP/CLS, Resend, Mapy.com a produkční nastavení nebyly testovány. Texty ani CSS nebyly upraveny. Bez nasazení a bez změn na main.

## Oprava dostupnosti právních informací ve starší D1

Inicializace nyní pomocí INSERT OR IGNORE doplní chybějící stránku `pravni-informace` i tehdy, když tabulka site už obsahuje produkční data. Používá stávající právní text ze seed.json; jiné stránky, kontakty ani existující upravenou právní stránku nepřepisuje. Pokud je právní stránka rozpracovaná jako koncept, veřejně zůstane dostupný výchozí právní text; koncept se nevystaví. Odkazy u formuláře a v patičce tak nezmizí. Nastavení Published u této vyhrazené stránky ovládá publikování vlastní verze, nikoli odstranění výchozích právních informací.

`node --experimental-vm-modules scripts/legal-test.mjs`: 3/3 regresní testy ověřují starší naplněnou databázi, zachování upraveného obsahu, funkční odkazy i kotvu a neveřejnost konceptu. Celkem s bezpečnostní sadou 20/20 testů; úplná kontrola webu nadále 10 stránek a 209 odkazů/souborů. Produkční URL je ze současného běžícího prostředí síťově blokovaná, takže skutečný stav ostrého nasazení není potvrzený.

DMARC se kódem nemění. Pro jeho ověření a úpravu chybí Cloudflare DNS přístup; v návrhu prostředí je připraven požadavek na CLOUDFLARE_DNS_API_TOKEN (proměnná CLOUDFLARE_API_TOKEN, cíl api.cloudflare.com) a přístup k veřejné doméně. Token má být omezený na zónu stavbyliterak.cz, DNS Read/Edit a Zone Read. Hodnotu doplnit bezpečně v nastavení prostředí, nikoli do chatu. Přísnější politiku nastavit až po ověření platných odesílatelů a jejich DMARC alignmentu. Uložení návrhu samo neupravilo běžící síť ani produkční DNS.
