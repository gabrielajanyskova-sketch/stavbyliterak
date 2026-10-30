# Audit funkčnosti a bezpečnosti — 30. 10. 2026

Rozsah: lokální checkout, serverové Pages Functions, přihlášení a API, vykreslování, hlavičky a klientská logika formulářů. Výchozí commit: `847ccb19251cd823617934edbf58a83a87944b80`. Audit není penetrační test produkce. Texty, obsah databáze a webdesign se nemění. Produkční DNS, nastavení účtů Cloudflare a skutečné odesílání pošty nebyly ověřeny.

## Opravy na této větvi

1. **Střední: obejití limitů souběžnými požadavky.** Čtení počítadla a následný zápis byly oddělené. Paralelní požadavky mohly všechny projít stejným limitem. Nyní jediný podmíněný SQL UPSERT atomicky rezervuje pokus. Platí pro přihlášení, kontaktní formulář i Mapy.com. U e-mailového přihlášení se počítají i požadavky se správným heslem: zabraňuje to neomezenému rozesílání kódů při znalosti hesla. Bez e-mailového druhého kroku úspěšné přihlášení počítadlo resetuje. Žádná migrace databáze.
2. **Střední: opakované použití jednorázového kódu.** Kontrola a smazání byly oddělené; několik současných požadavků mohlo založit více relací. Nově atomická rezervace jednoho z pěti pokusů a podmíněné DELETE RETURNING zaručí jediné spotřebování kódu. Vypršelý nebo vyčerpaný kód se odmítne.
3. **Střední, integrita dat: poškozený JSON při ukládání.** Parser dříve nahrazoval neplatný JSON prázdným objektem, který mohl přepsat nastavení. Nově chybný JSON, null, pole a primitivní hodnoty dostanou 400 před uložením. Null v kontaktním formuláři už nezpůsobí serverovou chybu. Toto není kontrola všech povinných polí jinak platného objektu.
4. **Funkčnost: zastaralá cena půjčovny.** Starší pomalejší odpověď mohla přepsat novější cenu a při čekání se používal starý součet. Verze požadavků nyní ignoruje staré úspěchy i chyby; při změně výběru se starý součet zneplatní. Rozložení, styly a texty zůstávají stejné.

## Další doporučení bez změn v této větvi

- **Priorita 1: limit velikosti požadavků před parsováním.** JSON a multipart se načítají celé do paměti; limit obrázku se kontroluje až po formData(). Zavést čtení s limitem skutečného počtu bajtů (samotný Content-Length nestačí), s odlišným limitem pro obsah, poptávku s nákresem a upload. Otestovat chybové odpovědi i běžné velké galerie. Autentizace uploadu už probíhá před parsováním.
- **Priorita 2: kontrola obsahu nahraných souborů.** API důvěřuje deklarovanému MIME typu. Ověřovat signatury podporovaných obrázků a PDF, u zmenšenin přijímat pouze obrázky. Riziko je omezené přihlášením a hlavičkou nosniff; samotná MIME hodnota ale neprokazuje správný soubor.
- **Priorita 2: ochrana relací.** Admin ukládá bearer token do localStorage a D1 jej ukládá v původní podobě. Zvážit hash tokenu v databázi a přesun relace do Secure/HttpOnly/SameSite cookie s odpovídající CSRF ochranou. Vyžaduje koordinovanou změnu klienta a serveru; neprovádět izolovanou výměnu úložiště.
- **Priorita 2: důsledná validace ukládání a atomické přejmenování.** Platný prázdný objekt zatím může vymazat nastavení; ověřovat požadovanou strukturu. Přejmenování stránky a uložení obsahu jsou dva zápisy; spojit do transakčního D1 batch a ověřit konflikt názvů i zachování aliasů.
- **Priorita 3: sjednotit bezpečnostní hlavičky API, obrázků a chybových odpovědí.** HTML má CSP a ochranu proti vložení; JSON má no-store, ale ne všechny společné hlavičky HTML. Doplňovat podle typu odpovědi a nepřepsat cache obrázků.
- **Provozní kontrola:** ověřit skutečné druhé přihlášení e-mailem, scoped Cloudflare tokeny pro zálohu, obnovitelnost D1 i KV a DMARC reporting. Nastavení DNS neměnit podle samotného screenshotu; nasazení přísnějšího DMARC vyžaduje ověřené odesílatele. Žádná produkční pošta nebyla odeslána.

## Snímky auditu: rychlost a soukromí

Snímky uvádějí mobil 83/100, LCP 2,8 s a CLS 0,24. Neobsahují přesnou testovanou URL ani verzi a nejsou novým měřením této větve. Nelze z nich slíbit zvýšení skóre.

Aktuální kód již používá WebP/AVIF, rozměry obrázků z repozitáře, přednostní načtení hlavní fotky a vlastní písma. Obecná rada „převést obrázky na WebP“ tedy sama neřeší konkrétní příčinu. U fotek nahraných do KV nejsou rozměry evidované. Před případnou opravou CLS doporučuji zaznamenat konkrétní layout-shift zdroje v mobilním prohlížeči na produkční URL, včetně studené cache a pomalého připojení. Prověřit zejména změnu metrik při načtení písem a nahrané obrázky; až pak případně doplnit metadata rozměrů nebo metriky fallback fontu při zachování výsledného vzhledu. V této větvi se CSS ani písma nemění.

Výchozí obsah již má publikovanou stránku `/pravni-informace` s oddílem `#osobni-udaje` a renderer přidává odkaz u formuláře. Kontrola nenalezeného GDPR odkazu na snímku tedy není pro výchozí obsah reprodukována. Produkční D1 může mít jiný obsah než seed; ověřit publikování této stránky v administraci. Právní text nebyl upravován ani právně posuzován.

## Ověření

- `node --experimental-vm-modules scripts/security-test.mjs`: **8/8 testů prošlo**. Skutečný API modul a SQLite: 30 souběžných přihlášení propustí 8 pokusů, obnovení okna, 20 souběžných ověření kódu založí jednu relaci, maximálně 5 pokusů o kód, expirace, odmítnutí poškozeného JSON bez zápisu a null formulář. Klientský test simuluje odpovědi cen v opačném pořadí i starou chybu. Render a datové helpery jsou v těchto úzkých testech nahrazené; nejde o kompletní browser E2E test. Test vyžaduje Node s node:sqlite (ověřeno Node 24.19.0).
- `WRANGLER_SEND_METRICS=false npm run check`: **10 stránek a 209 odkazů/souborů prošlo**, včetně validace HTML, sitemap, robots, llms a security.txt.
- Lokální Wrangler/D1: přihlášení skutečným API, odmítnutí poškozeného PUT s 400 a následné načtení zachovaného obsahu prošlo.
- Produkční LCP/CLS, mobilní browser E2E, Resend, Mapy.com a produkční nastavení nebyly testovány. Bez nasazení a bez změn na main.
