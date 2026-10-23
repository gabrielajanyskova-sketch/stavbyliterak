"""Generuje statické HTML stránky webu Stavby Literák.

Použití:  python3 _build/build.py .
Texty vycházejí z původního webu stavbyliterak.cz (opraveny překlepy, rozčleněno).
"""
import sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")

PHONE = "+420 723 009 858"
PHONE_TEL = "+420723009858"
EMAIL = "stavbyliterak@email.cz"

NAV = [
    ("termovize.html", "Termovize"),
    ("zemni-prace.html", "Zemní práce"),
    ("hlinikovy-program.html", "Hliník"),
    ("leseni.html", "Lešení"),
    ("stavebni-prace.html", "Stavební práce"),
]

SERVICES = [
    "Termovizní měření",
    "Zemní práce",
    "Zakladač trávníku",
    "Hliníkový program",
    "Půjčovna lešení",
    "Protipožární systémy",
    "Stavební práce",
    "Gastropůjčovna",
    "Něco jiného",
]


def head(title, desc):
    return f"""<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="assets/img/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
<a class="skip" href="#obsah">Přeskočit na obsah</a>
"""


def header(active):
    links = "\n".join(
        f'      <a href="{href}"{" aria-current=\"page\"" if href == active else ""}>{label}</a>'
        for href, label in NAV
    )
    return f"""<header class="site-header">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="Stavby Literák — úvod"><img src="assets/img/logo.png" alt="Stavby Literák" width="444" height="263"></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="menu">Menu</button>
    <nav class="nav" id="menu" aria-label="Hlavní menu">
{links}
      <a href="#kontakt">Kontakt</a>
      <a class="nav-call" href="tel:{PHONE_TEL}">{PHONE}</a>
    </nav>
  </div>
</header>
<main id="obsah">
"""


def contact(preselect=""):
    opts = "\n".join(
        f'            <option{" selected" if s == preselect else ""}>{s}</option>' for s in SERVICES
    )
    return f"""
<section class="section section-dark" id="kontakt">
  <div class="wrap contact-grid">
    <div class="reveal">
      <span class="label">Kontakt</span>
      <h2>Zavolejte, nebo napište</h2>
      <p style="color:#bfc6cc">Nejrychlejší je telefon. Když to nezvednu, ozvu se zpátky.</p>
      <dl class="contact-lines">
        <div><dt>Telefon</dt><dd><a class="big" href="tel:{PHONE_TEL}">{PHONE}</a></dd></div>
        <div><dt>E-mail</dt><dd><a href="mailto:{EMAIL}">{EMAIL}</a></dd></div>
        <div><dt>Adresa</dt><dd>Malé náměstí 98, 738 01 Frýdek-Místek</dd></div>
        <div><dt>Fakturační údaje</dt><dd>Jan Literák · IČ 03171949</dd></div>
      </dl>
    </div>
    <form class="form reveal" id="poptavka" data-to="{EMAIL}">
      <div>
        <label for="sluzba">O co jde</label>
        <select id="sluzba" name="sluzba">
{opts}
        </select>
      </div>
      <div class="row">
        <div><label for="jmeno">Jméno</label><input id="jmeno" name="jmeno" autocomplete="name" required></div>
        <div><label for="telefon">Telefon</label><input id="telefon" name="telefon" type="tel" autocomplete="tel" required></div>
      </div>
      <div><label for="misto">Místo (obec)</label><input id="misto" name="misto"></div>
      <div><label for="zprava">Co potřebujete</label><textarea id="zprava" name="zprava" placeholder="Stačí pár vět — rozměry, termín, cokoli víte."></textarea></div>
      <div><button class="btn" type="submit">Odeslat poptávku</button></div>
      <p class="note">Formulář otevře váš e-mail s předvyplněnou zprávou.</p>
    </form>
  </div>
</section>
"""


def footer():
    links = "\n".join(f'      <a href="{h}">{l}</a>' for h, l in NAV + [("gastropujcovna.html", "Gastropůjčovna")])
    return f"""</main>
<footer class="site-footer">
  <div class="wrap">
    <a href="index.html"><img src="assets/img/logo.png" alt="Stavby Literák" width="444" height="263"></a>
    <nav aria-label="Patička">
{links}
      <a href="#kontakt">Kontakt</a>
    </nav>
    <span>© Jan Literák · <a href="tel:{PHONE_TEL}">{PHONE}</a></span>
  </div>
</footer>
<script src="assets/js/main.js" defer></script>
</body>
</html>
"""


def ask(service, extra=""):
    return f"""<aside>
      <div class="ask">
        <span class="label" style="color:#9aa3ab">Poptávka</span>
        <h3>{service}</h3>
        <p>Popište, co potřebujete — ozvu se a domluvíme se.</p>
        <a class="phone" href="tel:{PHONE_TEL}">{PHONE}</a>
        <a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>
        {extra}
        <a class="btn" href="#kontakt">Napsat poptávku</a>
      </div>
    </aside>"""


def page_hero(crumb, title, lead, facts, cls="", photo=None):
    """photo = (cesta, popisek); použije se jen pokud soubor existuje."""
    rows = "\n".join(f"        <div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in facts)
    scale = '\n      <div class="scale"><span>−5 °C</span><i></i><span>+22 °C</span></div>' if cls == "thermal" else ""
    facts_html = f"""      <dl class="facts">
{rows}
      </dl>"""
    if photo and (OUT / photo[0]).exists():
        left_extra = "\n" + facts_html
        right = f"""      <figure class="hero-photo"><img src="{photo[0]}" alt="{photo[1]}"><figcaption class="label">{photo[1]}</figcaption></figure>"""
    else:
        left_extra, right = "", facts_html
    return f"""<section class="page-hero {cls}">
  <div class="wrap">
    <span class="label crumbs"><a href="index.html">Úvod</a> / {crumb}</span>
    <div class="page-hero-grid">
      <div>
        <h1>{title}</h1>
        <p class="lead">{lead}</p>{scale}{left_extra}
      </div>
{right}
    </div>
  </div>
</section>
"""


def uses(items):
    """Číslovaný seznam: (titulek, popis)."""
    li = "\n".join(f"        <li><div><strong>{t}</strong><span>{d}</span></div></li>" for t, d in items)
    return f'<ol class="uses">\n{li}\n      </ol>'


def faq(items):
    det = "\n".join(f"        <details><summary>{q}</summary><p>{a}</p></details>" for q, a in items)
    return f'<div class="faq">\n{det}\n      </div>'


def products(items):
    cells = "\n".join(
        f"        <div><h3>{t}</h3>{f'<p>{d}</p>' if d else ''}</div>" for t, d in items
    )
    return f'<div class="products">\n{cells}\n      </div>'


def service_page(fname, title, desc, hero, body, aside, preselect):
    return (
        head(title, desc)
        + header(fname)
        + hero
        + f"""
<section class="section">
  <div class="wrap content-grid">
    <div class="prose">
{body}
    </div>
    {aside}
  </div>
</section>
"""
        + contact(preselect)
        + footer()
    )


RIDGE = """<svg class="ridge" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 190 L70 150 L120 168 L190 108 L240 132 L300 62 L318 58 L336 70 L400 120 L450 104 L520 150 L600 128 L600 260 L0 260 Z" fill="#252a30"/>
        <path d="M0 230 L90 196 L160 214 L250 170 L330 196 L420 160 L500 190 L600 172 L600 260 L0 260 Z" fill="#2c323a"/>
        <path d="M0 190 L70 150 L120 168 L190 108 L240 132 L300 62 L318 58 L336 70 L400 120 L450 104 L520 150 L600 128" fill="none" stroke="#f39a1e" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>"""


pages = {}

# ================================================================ úvod

pages["index.html"] = head(
    "Stavby Literák — termovize, zemní práce, hliník, lešení | Frýdek-Místek",
    "Termovizní měření, zemní a výkopové práce, zakladač trávníku, hliníkové ploty a pergoly, půjčovna lešení a protipožární systémy. Jan Literák, Frýdek-Místek.",
) + header("index.html") + f"""
<section class="hero">
  <div class="hero-panel">
    <h1>Poctivá práce <span>pod Beskydami</span></h1>
    <p class="hero-meta">JAN LITERÁK · FRÝDEK-MÍSTEK A OKOLÍ</p>
    {RIDGE}
  </div>
  <div class="hero-index">
    <span class="label">Co potřebujete vyřešit?</span>
    <ul class="chooser">
      <li><a href="termovize.html"><span class="no">01</span><span class="name">Termovizní měření</span><span class="arrow">→</span><span class="hint">Tepelné úniky, tepelné mosty, plísně, kontrola provedených prací.</span></a></li>
      <li><a href="zemni-prace.html"><span class="no">02</span><span class="name">Zemní práce a zakladač</span><span class="arrow">→</span><span class="hint">Výkopy, zásypy a hutnění, terénní úpravy, zpracování půdy po stavbě.</span></a></li>
      <li><a href="hlinikovy-program.html"><span class="no">03</span><span class="name">Hliníkový program</span><span class="arrow">→</span><span class="hint">Ploty, brány, zábradlí, pergoly, zastřešení, zimní zahrady.</span></a></li>
      <li><a href="leseni.html"><span class="no">04</span><span class="name">Půjčovna lešení</span><span class="arrow">→</span><span class="hint">Rámové pozinkované lešení pro rodinné domy, i s dopravou.</span></a></li>
      <li><a href="stavebni-prace.html"><span class="no">05</span><span class="name">Stavební práce</span><span class="arrow">→</span><span class="hint">Protipožární systémy, zednické práce, sádrokartony a další.</span></a></li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <div><span class="label">Jak pracuji</span><h2>Řešení podle místa, ne podle ceníku</h2></div>
      <p>Ne každý dům, pozemek nebo prostup umožňuje použít stejné řešení. Proto se nejdřív řeší konkrétní místo a způsob využití — a teprve potom provedení a cena.</p>
    </div>
    <div class="principles reveal">
      <div><span class="label">01 — Posouzení</span><h3>Posoudím na místě</h3><p>Rozhodují výškové poměry, přístup, napojení na dům a spousta dalších věcí. Ty se dají zjistit jen na místě.</p></div>
      <div><span class="label">02 — Realizace</span><h3>Navrhnu i provedu</h3><p>Na základě měření nebo prohlídky navrhnu vhodné řešení a ve většině případů ho i zrealizuji, případně doporučím prověřené partnery.</p></div>
      <div><span class="label">03 — Cena</span><h3>Platíte skutečnou práci</h3><p>Strojní práce účtuji podle skutečně odpracovaného času. Žádné příplatky „co kdyby“.</p></div>
    </div>
  </div>
</section>

<section class="section section-concrete" id="gastro">
  <div class="wrap">
    <div class="section-head reveal">
      <div><span class="label">Oslavy, svatby, párty</span><h2>Gastropůjčovna</h2></div>
      <div>
        <p>Chystáte oslavu narozenin, svatbu, posezení s přáteli nebo párty? Půjčím pivní sety, výčep, kotlík na guláš, rožeň, ohřevné vany, reproduktor a další vybavení.</p>
      </div>
    </div>
    <a class="btn btn-line reveal" href="gastropujcovna.html">Co se dá půjčit</a>
  </div>
</section>
""" + contact() + footer()

# ================================================================ termovize

pages["termovize.html"] = service_page(
    "termovize.html",
    "Termovizní měření a detekce tepelných úniků | Stavby Literák, Frýdek-Místek",
    "Termovizní měření domů, bytů a firem: tepelné úniky, tepelné mosty, plísně, kontrola provedených prací, elektrorozvaděče a podlahové topení. Frýdek-Místek a okolí.",
    page_hero(
        "Termovizní měření",
        "Termovizní měření",
        "Investice do termovizního měření se obvykle rychle vrátí díky úsporám za vytápění a včasnému řešení stavebních či technických problémů.",
        [
            ("Technika", "Kvalitní značková německá termokamera"),
            ("Kdy měřit", "V topné sezóně, ideálně v chladném počasí"),
            ("Pro koho", "Rodinné domy, byty, SVJ, novostavby, firmy"),
            ("Navíc", "Návrh řešení a jeho realizace"),
        ],
        "thermal",
    ),
    """      <h2>Proč hledat tepelné úniky</h2>
      <p>Hledání tepelných úniků je v dnešní době rostoucích cen obzvlášť důležité pro <strong>snížení nákladů na vytápění</strong>, <strong>zvýšení komfortu bydlení</strong> (rovnoměrná teplota, žádný průvan) a <strong>ochranu zdraví</strong> (prevence vzniku plísní). Odhalením a odstraněním úniků tepla také zvýšíte energetickou účinnost a hodnotu nemovitosti.</p>
      <p>Termokamera se hodí také pro SVJ nebo majitele novostaveb jako kontrola správného provedení prací — a může sloužit jako podklad pro reklamaci u dodavatele.</p>
      """ + uses([
        ("Úspora peněz", "Tepelné ztráty vedou ke zbytečně vysokým účtům za vytápění. Zjištěním a odstraněním úniků můžete snížit náklady až o desítky procent."),
        ("Vyšší komfort", "Úniky tepla způsobují chladná místa a průvan. Jejich odstranění zajistí rovnoměrnou teplotu v celém domě a příjemnější klima."),
        ("Prevence plísní", "Tepelné mosty způsobují kondenzaci vlhkosti na povrchu stěn, což podporuje růst zdraví škodlivých plísní."),
        ("Vyšší hodnota nemovitosti", "Energeticky efektivní budovy jsou na trhu nemovitostí žádanější a cennější."),
        ("Přesná diagnostika", "Termokamera přesně najde slabá místa — špatně zateplené fasády, netěsnící okna, tepelné mosty v rozích a napojeních konstrukcí. Proto je vhodná i pro kontrolu provedených prací a reklamace."),
        ("Kontrola i mimo stavbu", "Termokamera odhalí i problém v elektrickém rozvaděči, v podlahovém topení a mnoho dalšího."),
    ]) + """

      <h2>Od měření k řešení</h2>
      <p>Na základě provedeného měření vám umím navrhnout vhodná řešení a ve většině případů potřebná opatření také zrealizovat, nebo doporučit prověřené partnery, se kterými dlouhodobě spolupracuji. Samozřejmostí jsou potřebná školení. Používám pouze kvalitní značkovou německou techniku — to je základ pro správnou diagnostiku.</p>

      <h2>Jak měření probíhá</h2>
      <ol class="timeline">
        <li><strong>Domluva termínu</strong>Termín volíme podle počasí — pro měření obálky domu je potřeba chladno, aby byl dostatečný rozdíl teplot uvnitř a venku.</li>
        <li><strong>Příprava domu</strong>Den předem normálně topit, před měřením nevětrat a nechat zavřená okna.</li>
        <li><strong>Měření venku i uvnitř</strong>Dům se nasnímá zvenku i zevnitř. Co je na snímcích vidět, vám rovnou ukážu.</li>
        <li><strong>Výsledek a návrh řešení</strong>Dostanete výsledky měření a doporučení, co s nalezenými místy dělat.</li>
      </ol>
      <p class="todo">K ověření: průběh měření a podoba výstupu (protokol?) — tato část na původním webu nebyla, je to návrh.</p>
""",
    ask("Termovizní měření"),
    "Termovizní měření",
)

# ================================================================ zemní práce + zakladač

pages["zemni-prace.html"] = service_page(
    "zemni-prace.html",
    "Zemní a výkopové práce, zakladač trávníku | Stavby Literák, Frýdek-Místek",
    "Výkopy pro základy, sítě, jímky, bazény a drenáže, zásypy a hutnění, terénní úpravy, odvoz zeminy a zpracování půdy zakladačem trávníku. Frýdek-Místek a okolí.",
    page_hero(
        "Zemní práce a zakladač trávníku",
        "Zemní a výkopové práce",
        "Rozhodující není jen odtěžit zeminu, ale dodržet projektované hloubky, spády a tvar výkopu, připravit podloží a správně provést zásypy.",
        [
            ("Lžíce", "20, 40 a 60 cm, hydraulická svahovka 120 cm"),
            ("Hutnění", "Bomag, Weber MT — desky i pěchy do úzkých prostor"),
            ("Nakladač", "Traktor Kubota s čelním nakladačem"),
            ("Cena", "Hodinová sazba za skutečně odpracovaný čas"),
        ],
        photo=("assets/img/bagr.webp", "Vlastní minibagr Kubota KX016-4"),
    ),
    """      <p>Správně provedené zemní práce jsou předpokladem pro založení stavby, uložení inženýrských sítí, zpevněné plochy i konečné úpravy zahrady. Před zahájením si domluvíme způsob provedení, vaše požadavky, reálné možnosti na místě a další náležitosti — včetně využití výkopku na pozemku nebo rozsahu odvozu. Promyšlená organizace omezuje zbytečné přesuny materiálu a může výrazně ušetřit výsledné náklady.</p>

      <h2>S čím vám mohu pomoci</h2>
      """ + uses([
        ("Výkopy pro základy, opěrné zdi a oplocení", "Hloubení základových pasů, patek a stavebních jam."),
        ("Výkopy pro inženýrské sítě", "Rýhy pro vodovod, kanalizaci, kabelové trasy a další rozvody."),
        ("Nádrže, jímky a domovní ČOV", "Jámy s prostorem pro osazení zařízení, podklad a připojení potrubí."),
        ("Bazény a zahradní jezírka", "Výkop podle půdorysu, hloubky a konstrukce, včetně prostoru pro podkladní vrstvy a rozvody."),
        ("Skrývka ornice a odtěžení zeminy", "Ornici lze převézt po pozemku a později využít při dokončovacích úpravách."),
        ("Příjezdové cesty, stání, chodníky a terasy", "Výkop na požadovanou úroveň a podle domluvy i dodání, rozprostření a zhutnění podkladu."),
        ("Terénní úpravy a svahování", "Srovnání nerovností a modelace pozemku s ohledem na okolní stavby a odvod srážkové vody."),
        ("Drenáže a odvodnění", "Drážky pro drenážní potrubí se správnými výškami. Drenáž není univerzální řešení vlhkosti — umím navrhnout i zrealizovat komplexní řešení."),
        ("Odkopání obvodového zdiva a základů", "Zpřístupnění spodní stavby pro hydroizolaci, zateplení nebo sanaci."),
        ("Zásypy a hutnění", "Ukládání materiálu po vrstvách s postupným hutněním profesionální technikou."),
        ("Rozprostření zeminy a ornice", "Doplnění prohlubní a příprava ploch pro zahradní úpravy, na které může navázat zakladač."),
    ]) + """

      <h2>Odvoz zeminy a dodávky materiálu</h2>
      <p>K zemním pracím zajistím také nakládku a odvoz přebytečné zeminy, dodávky kameniva, písku či zeminy a související bourací práce v předem domluveném rozsahu.</p>

      <h2>Co ovlivňuje cenu</h2>
      <p><strong>Půdní podmínky.</strong> Kamenitost a skryté „poklady“ jako beton, železo nebo suť. Těžká jílovitá půda s kamením je časově mnohem náročnější než pěkná ornice.</p>
      <p><strong>Výkopy účtuji vždy v hodinové sazbě.</strong> Nikdo dopředu neví, jaká zemina skutečně je a co se v ní skrývá — realita je v 99 % jiná než předpoklad. Účtování podle skutečně odpracovaného času je nejtransparentnější: co se udělá, to se účtuje.</p>
      <p class="todo" style="background:#eef0f1;border-color:#5b636c;color:#3a4148"><strong>Aktuálně:</strong> Kvůli kolísání cen pohonných hmot zde nemohu uvést platnou hodinovou sazbu. Sazba strojních prací se počítá podle aktuálních cen PHM. Děkuji za pochopení.</p>

      <h2 id="zakladac">Zakladač trávníku — úprava pozemku a zpracování půdy</h2>
      <p>Zakladač trávníku neslouží jen k přípravě plochy pro nový trávník. Využívá se hlavně pro mechanické zpracování a finální úpravu půdy — po stavbě, rekonstrukci, výkopech nebo pojezdu techniky. Půdu rozruší a rozmělní, nakypří zpracovávanou vrstvu, zapracuje drobnější kameny pod povrch a zároveň upraví povrch pozemku.</p>
      <p>Po stavbě bývá pozemek rozježděný a zhutněný bagry a nákladními auty, s kolejemi, nerovnostmi, kameny a hrudkami. Po srovnání může vypadat připravený, ale samotné rozhrnutí zeminy ještě neznamená, že je půda vhodná pro další využití.</p>
      """ + products([
        ("Po stavbě domu", "Konečná úprava pozemku."),
        ("Po rekonstrukci", "Úprava zahrady."),
        ("Po výkopech", "Plochy po zemních pracích a pojezdu techniky."),
        ("Staré zahrady", "Dlouhodobě neudržované plochy, obnova trávníku."),
        ("Před výsadbou", "Příprava půdy."),
        ("Nový trávník", "Příprava pozemku pro založení."),
    ]) + """
      <p>Výhodou strojního zpracování je rychlost a rovnoměrnost na větších plochách, kde by ruční příprava byla časově i fyzicky náročná.</p>

      <h2>Časté otázky</h2>
      """ + faq([
        ("Děláte i malé zakázky a práce na hůře přístupných místech?", "Ano. Techniku volím podle rozsahu práce a přístupu, umím zajistit i stroj, který přímo nevlastním. Předem je potřeba posoudit šířku a výšku průjezdu, sklon a únosnost příjezdu a prostor pro práci a ukládání zeminy. Klidně přijedu s bagrem nebo traktorem i na půl hodiny — pak ale účtuji fixní taxu místo hodinové sazby, aby se vůbec pokryly náklady."),
        ("Neprodraží se hodinová sazba oproti pevné ceně?", "Nemusíte mít obavy, spíš naopak. U strojních výkopů je hodinová sazba férovější — úkolová cena bývá nadhodnocená pro případ „co kdyby“. V hodinové sazbě platíte skutečně odpracovaný čas, ne předpoklady."),
        ("Co je potřeba připravit před příjezdem techniky?", "Určit rozsah a umístění výkopů, zajistit přístup a prostor pro zeminu. Před zahájením musí být ověřeny a vytyčeny podzemní sítě a připravené případné projekty a povolení — to je povinnost zákazníka."),
        ("Zůstanou po technice stopy?", "I ten nejšetrnější pojezd na podkladu stopy zanechá. Techniku volím podle potřeby a snažím se, ale anglický trávník po práci zaručit nemohu — fyzikální zákony ohnout neumím."),
    ]) + "\n",
    ask("Zemní práce", '<p style="margin-top:14px">Strojní práce účtuji podle skutečně odpracovaného času.</p>'),
    "Zemní práce",
)

# ================================================================ hliník

pages["hlinikovy-program.html"] = service_page(
    "hlinikovy-program.html",
    "Hliníkové ploty, brány, pergoly a zimní zahrady | Stavby Literák",
    "Hliníkové ploty a brány, zábradlí, pergoly a altány, zastřešení teras, zimní zahrady a zasklení. Od zaměření po montáž. Frýdek-Místek a okolí.",
    page_hero(
        "Hliníkový program",
        "Hliníkový program",
        "Oplocení, zastřešení i další konstrukce kolem domu z hliníku. Dlouhá životnost, minimální údržba — od návrhu a zaměření po dodávku a montáž.",
        [
            ("Rozsah", "Zaměření, výroba, dodávka a montáž"),
            ("Údržba", "Bez natírání, stálobarevné, jen čištění"),
            ("Vhodné pro", "Novostavby i rekonstrukce starších domů"),
            ("Atypy", "Podle možností systému a profilů"),
        ],
    ),
    """      <p>Hliníkový program využijete při stavbě, rekonstrukci i úpravě okolí domu. Může jít o jednoduchý plot a branku, ale také o kompletní řešení zahrady s navazujícím zábradlím, pergolou, zastřešením nebo zaskleným prostorem.</p>

      <h2>Co zajišťuji</h2>
      """ + products([
        ("Ploty a oplocení", ""),
        ("Branky a vjezdové brány", ""),
        ("Zábradlí", ""),
        ("Pergoly a altány", ""),
        ("Zastřešení teras", "a dalších venkovních prostor"),
        ("Zimní zahrady", ""),
        ("Zasklení", "pergol, altánů, teras a dalších konstrukcí"),
        ("Individuální konstrukce", "podle konkrétního prostoru"),
    ]) + """

      <h2>Proč hliník</h2>
      <p>Hliník je lehký a pevný. Hodí se všude, kde chcete konstrukci, která dlouhodobě odolá venkovnímu prostředí a nebude vyžadovat náročnou pravidelnou údržbu. Má lehký a čistý vzhled, který sedne k moderní novostavbě i ke staršímu domu.</p>

      <h2>Plot nemusí být jen plot</h2>
      <p>Při úpravě okolí domu dává smysl řešit jednotlivé prvky společně. Oplocení může navazovat na branku a bránu, na terase pokračovat zábradlím a pergolou a stejný vzhled lze použít i u zastřešení. Nemusíte pak jednotlivé části řešit odděleně a hledat, jak je sladit.</p>

      <h2>Pergoly, altány a zastřešení</h2>
      <p>Zastřešený prostor pro posezení a běžné využití terasy — jednoduché zastřešení, pergola nebo samostatně stojící altán. Podle systému lze doplnit zasklení pro ochranu před větrem a počasím. Vždy je potřeba zohlednit rozměry, umístění, kotvení a návaznost na stávající stavbu, proto se konstrukce řeší přímo podle místa.</p>

      <h2>Zasklení a zimní zahrady</h2>
      <p>Zasklením můžete venkovní prostor využívat i tehdy, když samotná terasa nebo pergola už před počasím nechrání. Zasklít lze pergolu, altán, terasu, balkon nebo lodžii, u větších konstrukcí může vzniknout samostatná zimní zahrada. Možnosti se liší podle systému, rozměrů a způsobu otevírání.</p>

      <h2>Řešení podle vašeho domu</h2>
      <p>Ne každý pozemek umožňuje stejné řešení — rozhodují výškové poměry, podezdívka, napojení na dům, přístup a další faktory. Nejdřív proto řešíme konkrétní prostor a způsob využití, pak provedení, zaměření, výrobu a montáž. Cílem není univerzální konstrukce, ale řešení, které dává smysl právě u vašeho domu.</p>

      <h2>Časté otázky</h2>
      """ + faq([
        ("Je hliníkový plot bezúdržbový?", "Zcela bezúdržbový není žádný venkovní prvek. Hliník ale nevyžaduje pravidelné natírání jako dřevo, není nasákavý a je stálobarevný. Údržba spočívá hlavně v čištění."),
        ("Lze udělat plot, bránu a branku ve stejném provedení?", "Ano, sladění prvků je jednou z výhod hliníkového programu. Stejný vzhled lze použít i u zábradlí a dalších konstrukcí."),
        ("Je možné zasklít pergolu nebo altán?", "Ano, pokud to konkrétní konstrukční systém umožňuje. Zasklení chrání před větrem a deštěm a prodlouží dobu, kdy prostor využijete."),
        ("Je hliník vhodný i pro starší dům?", "Ano. Hliníkové prvky mohou být součástí rekonstrukce nebo postupné úpravy okolí staršího domu."),
        ("Kolik stojí plot, pergola nebo zastřešení?", "Záleží na rozměrech, provedení, výplni, povrchové úpravě, kotvení a rozsahu montáže. Bez znalosti konkrétního řešení nejde určit jednu cenu."),
        ("Zajišťujete kompletní realizaci?", "Ano — zaměření, výrobu konstrukce i montáž."),
        ("Lze řešit i atypické provedení?", "Ano, pokud to umožňuje zvolený systém profilů a technické řešení. Nejdřív je potřeba posoudit konkrétní prostor."),
    ]) + "\n",
    ask("Hliníkový program"),
    "Hliníkový program",
)

# ================================================================ lešení

pages["leseni.html"] = service_page(
    "leseni.html",
    "Půjčovna lešení Frýdek-Místek — rámové lešení i s dopravou | Stavby Literák",
    "Pronájem pozinkovaného rámového lešení s českým certifikátem pro rodinné domy a menší stavby. Doprava na stavbu, stavební stojky. Frýdek-Místek a okolí.",
    page_hero(
        "Půjčovna lešení",
        "Půjčovna lešení",
        "Rámové lešení s českým certifikátem na opravu fasády, zateplení, střechu nebo jinou práci kolem domu. Pro rodinné domy a menší stavby.",
        [
            ("Typ", "Rámové lešení, český certifikát"),
            ("Provedení", "Pozinkované rámy i podlážky"),
            ("Doprava", "Na stavbu podle domluvy"),
            ("Navíc", "Stavební stojky"),
        ],
    ),
    """      <p>Rámové lešení je praktické všude, kde potřebujete bezpečný a stabilní pracovní prostor ve výšce a nechcete kvůli jedné stavbě kupovat vlastní. Hodí se na opravy a zateplení fasád, práce u střech, omítání, nátěry, klempířské práce a další práce kolem domu.</p>

      <h2>Co nabízím</h2>
      """ + products([
        ("Rámové konstrukce", "pozinkované"),
        ("Podlážky", "pozinkované"),
        ("Prvky pro sestavení", "vše potřebné ke konkrétní sestavě"),
        ("Stavební stojky", "podle konkrétní stavby"),
        ("Doprava", "až na stavbu"),
        ("Řešení na míru", "podle rozměrů a tvaru objektu"),
    ]) + """

      <h2>Proč si lešení půjčit</h2>
      <p>U jednorázové opravy nedává smysl kupovat vlastní lešení. Pronájmem ho máte jen na dobu, kdy ho opravdu potřebujete, a neřešíte skladování. Po sestavení vytvoří souvislou pracovní plochu podél fasády — pohodlnější a bezpečnější než žebříky nebo improvizace.</p>

      <h2>Doprava až na stavbu</h2>
      <p>Pokud nemáte jak lešení převézt, dopravu zajistím. Při domluvě je potřeba zohlednit přístup ke stavbě, místo pro složení dílů a možnosti manipulace na pozemku. Ne každá stavba má ideální podmínky — rozhoduje terén, výškové rozdíly, balkony, přístřešky a další překážky, proto je dobré situaci probrat předem.</p>

      <h2>Co uvést v poptávce</h2>
      """ + uses([
        ("Přibližné rozměry domu", "Délky stran, případně u které části domu lešení potřebujete."),
        ("Počet podlaží", "Výška objektu a tvar střechy."),
        ("Dobu pronájmu", "Od kdy a na jak dlouho."),
        ("Účel", "Fasáda, zateplení, střecha, nátěry…"),
    ]) + """

      <h2>Bezpečnost především</h2>
      <p>Lešení musí být sestaveno a používáno v souladu s jeho určením. Kontroluje se kompletnost konstrukce, podlážky, zábradlí, kotvení a další prvky — i průběžně během používání. Lešení proto není vhodné svévolně upravovat nebo z něj odebírat díly. Pokud se změní způsob používání nebo je potřeba lešení přestavět, je nutné to řešit odpovídajícím způsobem.</p>

      <h2>Časté otázky</h2>
      """ + faq([
        ("Na jaké stavby je rámové lešení vhodné?", "Hlavně na rodinné domy, rekonstrukce a menší stavby — opravy a zateplení fasády, omítání, nátěry, práce u střech a další činnosti kolem objektu."),
        ("Musím si lešení přijet vyzvednout?", "Nemusíte. Dopravu na stavbu lze podle domluvy zajistit."),
        ("Je možné zapůjčit i stavební stojky?", "Ano, podle konkrétního řešení."),
        ("Na jak dlouho si mohu lešení půjčit?", "Podle zakázky a dohody — od krátkodobého zapůjčení na konkrétní práci až po pronájem na celou dobu rekonstrukce."),
        ("Kolik lešení potřebuji na rodinný dům?", "Záleží na rozměrech, výšce, tvaru domu a rozsahu prací. Stačí poslat přibližné rozměry a popsat, co budete na lešení dělat."),
        ("Co když potřebuji lešení jen na část domu?", "I to je možné. Rozsah lešení se přizpůsobí tomu, kde a jaké práce budete provádět."),
        ("Jak zjistím cenu pronájmu?", "Cena závisí na množství lešení, délce pronájmu, dopravě a konkrétním řešení. Pošlete základní informace o stavbě a termín a domluvíme konkrétní nabídku."),
    ]) + "\n",
    ask("Půjčovna lešení"),
    "Půjčovna lešení",
)

# ================================================================ stavební práce + protipožární

pages["stavebni-prace.html"] = service_page(
    "stavebni-prace.html",
    "Stavební práce a protipožární pasivní systémy | Stavby Literák",
    "Protipožární utěsnění prostupů a spár systémy Pyroplex a Nullifire. Zednické práce, sádrokartony, elektro, instalatérské práce, malby, podlahy. Frýdek-Místek.",
    page_hero(
        "Stavební práce",
        "Stavební práce",
        "Protipožární pasivní systémy a menší stavební práce v domluveném rozsahu.",
        [
            ("Požární ochrana", "Utěsnění prostupů a spár"),
            ("Systémy", "Pyroplex, Nullifire"),
            ("Stavební práce", "Zednické práce, sádrokartony a další"),
            ("Kde", "Frýdek-Místek a okolí"),
        ],
    ),
    """      <h2 id="protipozarni">Protipožární pasivní systémy</h2>
      <p>Pasivní požární ochrana je součástí stavby. V případě požáru má omezit jeho šíření a zachovat požadované vlastnosti požárně dělicích konstrukcí. Zajišťuji protipožární utěsnění prostupů, spár a dalších konstrukčních detailů systémy značek <strong>Pyroplex</strong> a <strong>Nullifire</strong>.</p>
      <p>Při stavbě i rekonstrukci vzniká řada míst, kudy procházejí kabely, potrubí, vzduchotechnika a další rozvody. Tyto prostupy narušují požárně dělicí konstrukci a musí být odpovídajícím způsobem zabezpečeny — stejně jako spáry, dilatační a konstrukční napojení.</p>
      """ + uses([
        ("Prostupy kabelů a kabelových tras", "Utěsnění v požárně dělicích stěnách a stropech."),
        ("Prostupy potrubí", "Včetně manžet a pásek pro hořlavé potrubí."),
        ("Spáry a otvory", "Lineární, dilatační a konstrukční spáry."),
        ("Konstrukční detaily", "Protipožární ochrana vybraných detailů, nátěry ocelových konstrukcí."),
        ("Dodatečné prostupy", "Při rekonstrukcích a nových instalacích, kdy se na utěsnění často zapomíná."),
    ]) + """
      <p><strong>Každý prostup má své řešení.</strong> Rozhoduje, čím je prostup veden, jeho rozměr, zda jde o kabely nebo potrubí, materiál konstrukce, zda jde o stěnu nebo strop a požadovaná požární odolnost. Nestačí použít „protipožární materiál“ — musí to být odpovídající systém ve správné skladbě, aplikovaný podle technických podmínek výrobce.</p>

      <h3 style="margin-top:1.4em">Časté otázky</h3>
      """ + faq([
        ("Proč je potřeba utěsňovat prostupy kabelů a potrubí?", "Prostup v požárně dělicí stěně nebo stropu narušuje její požární odolnost. Protipožární systém má v tom místě obnovit požadované vlastnosti konstrukce."),
        ("Lze jeden protipožární tmel použít na všechny prostupy?", "Ne. Řešení závisí na typu konstrukce, rozměru prostupu, druhu instalace a konkrétním systému. Výrobci pro jednotlivé aplikace uvádějí konkrétní skladby a podmínky použití."),
        ("Řešíte prostupy i při rekonstrukcích?", "Ano — u novostaveb i při rekonstrukcích a dodatečných instalacích."),
        ("Umíte vyřešit i prostup, který už je hotový?", "Ano, pokud ho lze odpovídajícím způsobem zabezpečit. Nejdřív je potřeba posoudit jeho provedení, rozměry, typ instalace a konstrukci."),
        ("Jak zjistím, jaké řešení potřebuji?", "Nejdůležitější je znát konstrukci a samotný prostup. Pokud si nejste jistí, místo posoudím a určím vhodný způsob řešení."),
    ]) + """

      <h2>Další stavební práce</h2>
      <p>Menší stavební práce v domluveném rozsahu — zavolejte a probereme, co potřebujete.</p>
      """ + products([
        ("Zednické práce", ""),
        ("Sádrokartony", ""),
        ("Elektro", ""),
        ("Instalatérské práce", ""),
        ("Malby", ""),
        ("Podlahy", ""),
        ("Hodinový manžel", ""),
    ]) + """
      <p class="todo">K rozhodnutí: kterou z těchto prací chcete na webu dál nabízet — podle toho seznam zkrátíme.</p>
""",
    ask("Stavební práce"),
    "Protipožární systémy",
)

# ================================================================ gastropůjčovna


def catalog(items):
    """Katalog půjčovny: (název, popis, parametry, počet kusů)."""
    rows = []
    for name, desc, spec, count in items:
        spec_html = f'<p class="spec">{spec}</p>' if spec else ""
        rows.append(
            f"""        <li>
          <h3>{name}</h3>
          <div><p>{desc}</p>{spec_html}</div>
          <span class="count">{count}</span>
        </li>"""
        )
    return '<ul class="catalog">\n' + "\n".join(rows) + "\n      </ul>"


pages["gastropujcovna.html"] = service_page(
    "gastropujcovna.html",
    "Gastropůjčovna — oslavy, svatby, párty | Stavby Literák, Frýdek-Místek",
    "Půjčovna vybavení na oslavy, svatby a párty: pivní sety, výčep na 2 sudy, kotlík na guláš, rožeň, ohřevné vany, várnice, hotdogovač, reproduktor JBL. Frýdek-Místek.",
    page_hero(
        "Gastropůjčovna",
        "Gastropůjčovna",
        "Chystáte oslavu narozenin, svatbu, posezení s přáteli nebo párty? Půjčím vybavení, které celou akci zpříjemní a posune na vyšší úroveň.",
        [
            ("Pronájem", "Minimálně na 1 den"),
            ("Cena", "Individuálně podle délky pronájmu"),
            ("Doprava", "Podle domluvy i se sestavením a zprovozněním"),
            ("Dostupnost", "Ověřte telefonicky nebo e-mailem"),
        ],
    ),
    """      <h2>Pití</h2>
      """ + catalog([
        ("Výčep na pivo a limo — 2 kohouty", "Na jedné pípě pivo, na druhé nealko pro děti. Výčepní zařízení s vlastním vzduchovým kompresorem, nebo lze připojit na CO<sub>2</sub>.", "Narážecí hlavy na Radegast nebo Kofolu (bajonet / žehlička)", "1 ks"),
        ("Elektrický termos s kohoutem", "Horký čaj, káva nebo svařák stále po ruce. Pro studené pití stačí nezapínat ohřev.", "Objem 20 l · pouze pro nápoje, ne na omáčky, polévky ani guláš", "1 ks"),
        ("Nerezová várnice s kohoutem", "Připravený nápoj stačí nalít do várnice a máte vystaráno.", "Pouze pro nápoje, ne na omáčky, polévky ani guláš", "1 ks"),
        ("Termobox", "Polystyrenový termobox pro převoz a uchování potravin a nápojů.", "", "2 ks"),
    ]) + """

      <h2>Vaření a ohřev</h2>
      """ + catalog([
        ("Kotlík na guláš", "Lehký přenosný set nerezového kotlíku s poklicí a ocelového topeniště. Ideální na svařák, pravý kotlíkový guláš nebo vaječinu. Stačí pár drobných polínek a zavaříte celý objem — nízká spotřeba paliva.", "Objem cca 27 l", "1 ks"),
        ("Rožeň s elektrickou otočí", "Celonerezový rožeň na dřevěné uhlí nebo brikety na drůbež, špízy, zeleninu i menší kýtu. Zadní topeniště s popelníkem, nastavitelná vzdálenost od topeniště, motorek 230 V. Vejdou se 2–4 kuřata — ideálně kolem 1,2 kg, větší se dělají zbytečně dlouho.", "Do 7 kg · rozměry 100 × 119 × 67 cm", "1 ks"),
        ("Elektrický kotlík na polévku a guláš", "Nerezový varný kotlík pro udržování a výdej teplých polévek, omáček a guláše. Ohřev ve vodní lázni, takže se nic nepřipeče.", "Objem 10 l", "2 ks"),
        ("Chafing — elektrická ohřevná vana", "Neodhadli jste množství masa na grilu? V ohřevné vaně udržíte jídlo teplé a čerstvé, jak dlouho potřebujete. Ohřev ve vodní lázni, nic se nepřipeče.", "Objem 8,5 l · včetně GN 1/1 a víka", "2 ks"),
        ("Hotdogovač se 2 trny", "Napařovací skleněný válec s děleným nerezovým košem pro 2 druhy párků a dva trny na nahřívání rohlíků. Rychlá svačina pro dospělé i děti.", "", "1 ks"),
        ("Stojan na přílohy", "Nerezový set 4 gastronádob na přílohy, omáčky a dochucovadla.", "4 × 0,9 l · 47 × 19 × 15 cm", "2 ks"),
    ]) + """

      <h2>Sezení a hudba</h2>
      """ + catalog([
        ("Pivní set — stůl a 2 lavice", "Co by byla oslava, kdybyste měli sedět na mokré zemi? Čundr je romantika, ale není pro každého.", "Stůl 200 × 50 × 77 cm, nosnost 150 kg · lavice 200 × 25 × 46 cm, nosnost 250 kg", "5 sad"),
        ("Bluetooth reproduktor JBL — partybox", "Posezení bez hudby není ono. Zvládne akci pro zhruba 50 lidí, karaoke není problém — k dispozici jsou i 2 bezdrátové mikrofony JBL.", "400 W RMS · baterie až 15 hodin, nebo ze sítě", "1 ks"),
    ]) + """

      <h2>Ceny a podmínky pronájmu</h2>
      <ul>
        <li>Ceny jsou individuální podle délky pronájmu a dalších okolností.</li>
        <li>Podle potřeby zajistím dopravu, sestavení a zprovoznění.</li>
        <li>Minimální doba pronájmu je 1 den.</li>
        <li>Nájemce používá veškeré vybavení na vlastní odpovědnost.</li>
      </ul>
""",
    ask("Gastropůjčovna", '<p style="margin-top:14px">Napište termín akce a co byste chtěli půjčit — ověřím dostupnost a pošlu cenu.</p>'),
    "Gastropůjčovna",
)

for name, html in pages.items():
    (OUT / name).write_text(html, encoding="utf-8")
    print("zapsáno", name)
