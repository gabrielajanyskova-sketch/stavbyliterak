# Cloudflare Turnstile

Implementace je připravená na větvi feat/turnstile. Bez obou skutečných klíčů není produkční ochrana aktivovaná. Žádné nasazení ani změna Cloudflare nastavení v rámci této přípravy neproběhly.

## Zapnutí

1. Cloudflare → Turnstile → Add widget, režim Managed. Povolit hostname `www.stavbyliterak.cz` a `stavbyliterak.cz`. Případné Pages preview adresy povolit zvlášť, mají-li odesílat skutečné poptávky.
2. Cloudflare Pages → stavbyliterak → Settings → Variables and Secrets, prostředí Production:
   - `TURNSTILE_SITE_KEY`: veřejný Site key, běžná proměnná.
   - `TURNSTILE_SECRET_KEY`: Secret key, uložit jako secret. Nikdy do repozitáře ani chatu.
3. Nastavit oba klíče současně a nasadit kód této větve. Pouhé uložení proměnných bez nového deploymentu nemusí aktualizovat běžící Functions. Náhledy mají oddělené proměnné.
4. Ověřit v prohlížeči běžný formulář, půjčovnu a konfigurátor lešení. Při odesílání proběhne ověření; výzva se může vyřešit automaticky. Potvrdit skutečné doručení testovací poptávky na firemní e-mail. Požadavek bez tokenu musí s aktivními klíči vrátit 403 bez odeslání e-mailu.

Oba klíče nenastavené: zůstává dosavadní provoz s honeypotem a limitem IP, což umožňuje připravit kód před aktivací. Jen jeden klíč: odesílání na serveru se odmítá. Při zapnuté ochraně klient nejdřív získá nový token pro každou poptávku a server jej ověří přímo u Cloudflare, včetně action `contact` a hostname. Ověření na serveru má timeout 10 sekund. Neplatný token ani chyba ověřovací služby nesmí způsobit odeslání e-mailu. Selhání ověření v klientovi nebo odpověď 403 nespustí mailto fallback.

Skript a iframe z challenges.cloudflare.com jsou povolené v CSP. Hlavní texty, CSS a vzhled se nemění; widget a stav ověření se zobrazí jen během odesílání. Nativní POST bez JavaScriptu nelze s aktivním Turnstile ověřit a server jej odmítne. Skutečné klíče se zatím v tomto prostředí nenacházejí; end-to-end kontrola s Cloudflare a reálné doručení zůstávají před aktivací k ověření.

Testy: `node --experimental-vm-modules scripts/security-test.mjs`, `node --experimental-vm-modules scripts/legal-test.mjs`, `npm run check`. Testy Turnstile používají simulovanou odpověď ověřovací služby a klientský widget; neposílají skutečné e-maily.
