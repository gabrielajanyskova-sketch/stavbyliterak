"""Generuje statické HTML stránky webu Stavby Literák do kořene repozitáře."""
import sys
from pathlib import Path

OUT = Path(sys.argv[1])

PHONE = "+420 000 000 000"      # TODO: doplnit skutečné číslo
PHONE_TEL = "+420000000000"
EMAIL = "stavbyliterak@email.cz"

NAV = [
    ("termovize.html", "Termovize"),
    ("hlinikovy-program.html", "Hliník"),
    ("zemni-prace.html", "Zemní práce"),
    ("stavebni-prace.html", "Stavby a lešení"),
]

SERVICES = [
    "Termovizní měření",
    "Hliníkový program",
    "Zemní práce a trávníky",
    "Stavební práce",
    "Půjčovna lešení",
    "Protipožární systémy",
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
      <a href="index.html#kontakt">Kontakt</a>
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
        <div><dt>Fakturační údaje</dt><dd>Jan Literák · IČO 03171949 · DIČ CZ9011025430</dd></div>
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
    links = "\n".join(f'      <a href="{h}">{l}</a>' for h, l in NAV)
    return f"""</main>
<footer class="site-footer">
  <div class="wrap">
    <a href="index.html"><img src="assets/img/logo.png" alt="Stavby Literák" width="444" height="263"></a>
    <nav aria-label="Patička">
{links}
      <a href="index.html#kontakt">Kontakt</a>
    </nav>
    <span>© Jan Literák · IČO 03171949</span>
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
        <p>Popište, co potřebujete — ozvu se s termínem a cenou.</p>
        <a class="phone" href="tel:{PHONE_TEL}">{PHONE}</a>
        <a class="mail" href="mailto:{EMAIL}">{EMAIL}</a>
        {extra}
        <a class="btn" href="#kontakt">Napsat poptávku</a>
      </div>
    </aside>"""


def page_hero(crumb, title, lead, facts, cls=""):
    rows = "\n".join(f"        <div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in facts)
    scale = '\n      <div class="scale"><span>−5 °C</span><i></i><span>+22 °C</span></div>' if cls == "thermal" else ""
    return f"""<section class="page-hero {cls}">
  <div class="wrap">
    <span class="label crumbs"><a href="index.html">Úvod</a> / {crumb}</span>
    <div class="page-hero-grid">
      <div>
        <h1>{title}</h1>
        <p class="lead">{lead}</p>{scale}
      </div>
      <dl class="facts">
{rows}
      </dl>
    </div>
  </div>
</section>
"""


RIDGE = """<svg class="ridge" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 190 L70 150 L120 168 L190 108 L240 132 L300 62 L318 58 L336 70 L400 120 L450 104 L520 150 L600 128 L600 260 L0 260 Z" fill="#252a30"/>
        <path d="M0 230 L90 196 L160 214 L250 170 L330 196 L420 160 L500 190 L600 172 L600 260 L0 260 Z" fill="#2c323a"/>
        <path d="M0 190 L70 150 L120 168 L190 108 L240 132 L300 62 L318 58 L336 70 L400 120 L450 104 L520 150 L600 128" fill="none" stroke="#f39a1e" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>"""


# ---------------------------------------------------------------- úvod

index = head(
    "Stavby Literák — termovize, hliník, zemní práce | Frýdek-Místek",
    "Termovizní měření, hliníkové ploty a pergoly, zemní práce a zakládání trávníků, stavební práce a půjčovna lešení. Frýdek-Místek a okolí.",
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
      <li><a href="termovize.html"><span class="no">01</span><span class="name">Termovizní měření</span><span class="arrow">→</span><span class="hint">Kudy z domu utíká teplo, kde hrozí vlhkost a plíseň.</span></a></li>
      <li><a href="hlinikovy-program.html"><span class="no">02</span><span class="name">Hliníkový program</span><span class="arrow">→</span><span class="hint">Ploty, brány, zábradlí, pergoly, zimní zahrady a zasklení.</span></a></li>
      <li><a href="zemni-prace.html"><span class="no">03</span><span class="name">Zemní práce a trávníky</span><span class="arrow">→</span><span class="hint">Výkopy, terénní úpravy a strojové založení trávníku.</span></a></li>
      <li><a href="stavebni-prace.html"><span class="no">04</span><span class="name">Stavební práce a lešení</span><span class="arrow">→</span><span class="hint">Menší stavební práce, protipožární systémy, půjčovna lešení.</span></a></li>
    </ul>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head reveal">
      <div><span class="label">Jak pracuji</span><h2>Bez zbytečných řečí</h2></div>
      <p>Jsem menší firma z Frýdku-Místku. Na zakázku se přijedu podívat sám, domluvíme se, co dává smysl, a pak to udělám tak, jak jsme se domluvili.</p>
    </div>
    <div class="principles reveal">
      <div><span class="label">01 — Prohlídka</span><h3>Přijedu se podívat</h3><p>Cenu neodhaduji od stolu. Nejdřív místo vidím, změřím a probereme možnosti.</p></div>
      <div><span class="label">02 — Rada</span><h3>Řeknu, co dává smysl</h3><p>I když to znamená menší zakázku. Nebudu vám prodávat něco, co nepotřebujete.</p></div>
      <div><span class="label">03 — Domluva</span><h3>Domluva platí</h3><p>Termín a cena, na kterých se dohodneme, drží. Když se něco změní, víte to ode mě první.</p></div>
    </div>
  </div>
</section>

<section class="section section-concrete" id="gastro">
  <div class="wrap">
    <div class="section-head reveal">
      <div><span class="label">Na oslavy a svatby</span><h2>Gastropůjčovna</h2></div>
      <div>
        <p>Pořádáte oslavu, svatbu nebo firemní akci? Zapůjčím vybavení, abyste nemuseli nic kupovat.</p>
        <p class="todo" style="margin-top:16px">K doplnění: co přesně půjčujete (stoly, lavice, stany, nádobí…) a zda gastropůjčovna zůstane tady, nebo dostane vlastní web.</p>
      </div>
    </div>
    <a class="btn btn-line reveal" href="index.html?sluzba=Gastropůjčovna#kontakt">Zeptat se na termín</a>
  </div>
</section>
""" + contact() + footer()

# ---------------------------------------------------------------- termovize

termovize = head(
    "Termovizní měření domů a bytů | Stavby Literák, Frýdek-Místek",
    "Termovizní měření rodinných domů, bytů a firem: tepelné ztráty, tepelné mosty, vlhkost, kontrola oken a zateplení. Protokol se snímky a vysvětlením.",
) + header("termovize.html") + page_hero(
    "Termovizní měření",
    "Termovizní měření",
    "Termokamera ukáže to, co okem nevidíte: kudy z domu utíká teplo, kde vzniká tepelný most a kde hrozí vlhkost a plíseň. Dostanete snímky i srozumitelné vysvětlení, co s tím dělat.",
    [
        ("Kdy měřit", "V topné sezóně, ideálně v chladném počasí bez slunce"),
        ("Podmínka", "Venku výrazně chladněji než uvnitř (zhruba o 15 °C a víc)"),
        ("Výstup", "Protokol se snímky, popisem a doporučením"),
        ("Kde", "Frýdek-Místek a okolí"),
    ],
    "thermal",
) + f"""
<section class="section">
  <div class="wrap content-grid">
    <div class="prose">
      <h2>Kdy se měření vyplatí</h2>
      <ol class="uses">
        <li><div><strong>Kupujete dům nebo byt</strong><span>Zjistíte skryté vady dřív, než podepíšete — a máte argument k jednání o ceně.</span></div></li>
        <li><div><strong>Platíte za topení víc, než byste čekali</strong><span>Měření ukáže, kudy teplo odchází: okna, střecha, napojení konstrukcí, věnce.</span></div></li>
        <li><div><strong>Po zateplení nebo výměně oken</strong><span>Kontrola, že je práce udělaná pořádně — dokud ještě běží záruka.</span></div></li>
        <li><div><strong>V rozích se objevuje plíseň</strong><span>Najdeme studená místa, kde kondenzuje vlhkost, a příčinu, ne jen následek.</span></div></li>
        <li><div><strong>Podlahové topení a rozvody</strong><span>Dohledání trasy trubek nebo místa úniku bez bourání.</span></div></li>
        <li><div><strong>Elektrorozvaděče a stroje</strong><span>Přehřáté spoje a součástky se dají odhalit dřív, než začnou dělat problémy.</span></div></li>
      </ol>

      <h2>Jak měření probíhá</h2>
      <ol class="timeline">
        <li><strong>Domluva termínu</strong>Termín volíme podle počasí — potřebujeme chladno a ideálně zataženo. Proto se někdy posouvá o pár dní.</li>
        <li><strong>Příprava domu</strong>Den předem normálně topit, před měřením nevětrat a nechat zavřená okna. Dostanete krátký návod.</li>
        <li><strong>Měření venku i uvnitř</strong>Nafotím dům zvenku a pak jednotlivé místnosti zevnitř. Rovnou vám ukážu, co je na snímcích vidět.</li>
        <li><strong>Protokol</strong>Do několika dnů dostanete protokol: snímky, popis nalezených míst a doporučení, co s nimi.</li>
      </ol>

      <h2>Časté otázky</h2>
      <div class="faq">
        <details><summary>Kolik měření stojí?</summary><p>Záleží na velikosti objektu a rozsahu. Napište, o jaký dům nebo byt jde, a pošlu cenu předem.</p><p class="todo">K doplnění: orientační cena pro byt / rodinný dům.</p></details>
        <details><summary>Dá se měřit i v létě?</summary><p>Obálku domu ne — chybí rozdíl teplot mezi vnitřkem a venkem, takže snímky nic neukážou. Elektrorozvaděče, stroje nebo podlahové topení ale změřit jde kdykoli.</p></details>
        <details><summary>Jak dlouho měření trvá?</summary><p>U běžného rodinného domu jde o jednotky hodin včetně procházení výsledků s vámi.</p></details>
        <details><summary>Je to totéž co energetický průkaz?</summary><p>Ne. Průkaz je výpočet z projektové dokumentace, termovize ukazuje skutečný stav konkrétních míst. Dobře se doplňují.</p></details>
      </div>
    </div>
    {ask("Termovizní měření", '<p style="margin-top:14px">Termíny na topnou sezónu se plní — ozvěte se včas.</p>')}
  </div>
</section>
""" + contact("Termovizní měření") + footer()

# ---------------------------------------------------------------- hliník

hlinik = head(
    "Hliníkové ploty, pergoly a zimní zahrady | Stavby Literák",
    "Hliníkové ploty, brány a branky, zábradlí, pergoly, altány, zastřešení teras, zimní zahrady a zasklení. Zaměření, výroba na míru a montáž.",
) + header("hlinikovy-program.html") + page_hero(
    "Hliníkový program",
    "Hliníkový program",
    "Ploty, brány, zábradlí, pergoly i zimní zahrady z hliníku. Nerezaví, nemusí se natírat a vydrží roky bez údržby.",
    [
        ("Materiál", "Hliníkové profily, povrch v barvách RAL"),
        ("Výroba", "Na míru podle zaměření"),
        ("Postup", "Zaměření → nabídka → výroba → montáž"),
        ("Kde", "Frýdek-Místek a okolí"),
    ],
) + f"""
<section class="section">
  <div class="wrap content-grid">
    <div class="prose">
      <h2>Co dodáváme</h2>
      <div class="products">
        <div><h3>Ploty</h3><p>Lamelové, plaňkové i neprůhledné výplně.</p></div>
        <div><h3>Brány a branky</h3><p>Křídlové i posuvné, případně s pohonem.</p></div>
        <div><h3>Zábradlí</h3><p>Balkony, terasy, schodiště.</p></div>
        <div><h3>Pergoly</h3><p>Pevné i s nastavitelnými lamelami.</p></div>
        <div><h3>Altány</h3><p>Samostatně stojící zastřešení na zahradu.</p></div>
        <div><h3>Zastřešení teras</h3><p>Polykarbonát nebo sklo.</p></div>
        <div><h3>Zimní zahrady</h3><p>Prodloužení obývacího prostoru do zahrady.</p></div>
        <div><h3>Zasklení</h3><p>Terasy, pergoly a balkony.</p></div>
      </div>
      <p class="todo">K ověření: popisky u jednotlivých výrobků — co přesně nabízíte (pohony bran, typy výplní, sklo/polykarbonát).</p>

      <h2>Proč hliník</h2>
      <ul>
        <li><strong>Nerezaví</strong> — ani po letech venku.</li>
        <li><strong>Bez natírání</strong> — povrch je hotový z výroby.</li>
        <li><strong>Lehký a pevný</strong> — nezatěžuje konstrukci, dobře se montuje.</li>
        <li><strong>Barva podle vás</strong> — vzorník RAL, imitace dřeva.</li>
      </ul>

      <h2>Jak to probíhá</h2>
      <ol class="timeline">
        <li><strong>Zaměření</strong>Přijedu, změřím a probereme, co chcete — vzhled, barvu, výplň.</li>
        <li><strong>Nabídka</strong>Dostanete cenu a termín. Bez závazku.</li>
        <li><strong>Výroba</strong>Vše se vyrábí na míru podle zaměření.</li>
        <li><strong>Montáž</strong>Osadím, seřídím a uklidím po sobě.</li>
      </ol>
    </div>
    {ask("Hliníkový program")}
  </div>
</section>
""" + contact("Hliníkový program") + footer()

# ---------------------------------------------------------------- zemní práce

zemni = head(
    "Zemní práce a zakládání trávníků | Stavby Literák, Frýdek-Místek",
    "Výkopy, terénní úpravy, příprava pozemku a strojové založení trávníku zakladačem. Frýdek-Místek a okolí.",
) + header("zemni-prace.html") + page_hero(
    "Zemní práce a trávníky",
    "Zemní práce a trávníky",
    "Od výkopu po hotový trávník. Připravím pozemek, srovnám terén a trávník založím strojově — v jednom kroku a rovnoměrně.",
    [
        ("Rozsah", "Výkopy, terénní úpravy, příprava pozemku"),
        ("Trávník", "Strojové založení zakladačem"),
        ("Kdy", "Trávník ideálně jaro nebo konec léta"),
        ("Kde", "Frýdek-Místek a okolí"),
    ],
) + f"""
<section class="section">
  <div class="wrap content-grid">
    <div class="prose">
      <h2>Zemní práce</h2>
      <ul>
        <li>Výkopy pro základy, přípojky a drenáže</li>
        <li>Terénní úpravy, svahování a srovnání pozemku</li>
        <li>Příprava pozemku pod stavbu, zahradu nebo trávník</li>
        <li>Odvoz a dovoz zeminy</li>
      </ul>
      <p class="todo">K ověření: jakou techniku máte (bagr, nakladač) a zda děláte i odvoz/dovoz materiálu.</p>

      <h2>Založení trávníku</h2>
      <p>Trávník zakládám strojově. Zakladač v jednom průjezdu nakypří a urovná povrch, vyseje osivo a přiválcuje ho. Výsledek je rovnější a hustší než při ručním výsevu a celé je to hotové rychleji.</p>
      <ol class="timeline">
        <li><strong>Příprava plochy</strong>Odstranění zbytků po stavbě, kamenů a plevele, případně doplnění ornice.</li>
        <li><strong>Srovnání terénu</strong>Hrubé vyrovnání a spády, aby na trávníku nestála voda.</li>
        <li><strong>Strojový výsev</strong>Zakladač nakypří, urovná, vyseje a uválí v jednom kroku.</li>
        <li><strong>Péče po výsevu</strong>Dostanete jednoduchý návod na zálivku a první sečení.</li>
      </ol>
    </div>
    {ask("Zemní práce a trávníky")}
  </div>
</section>
""" + contact("Zemní práce a trávníky") + footer()

# ---------------------------------------------------------------- stavební práce + lešení

stavebni = head(
    "Stavební práce, protipožární systémy a půjčovna lešení | Stavby Literák",
    "Menší stavební práce, protipožární systémy a půjčovna lešení ve Frýdku-Místku a okolí.",
) + header("stavebni-prace.html") + page_hero(
    "Stavební práce a lešení",
    "Stavební práce a lešení",
    "Menší stavební práce, protipožární úpravy a půjčovna lešení. Stručně a přehledně — zavolejte a domluvíme se.",
    [
        ("Stavby", "Menší stavební práce a úpravy"),
        ("Požární ochrana", "Protipožární systémy"),
        ("Lešení", "Půjčení i s dopravou a montáží"),
        ("Kde", "Frýdek-Místek a okolí"),
    ],
) + f"""
<section class="section">
  <div class="wrap content-grid">
    <div>
      <table class="ledger">
        <thead><tr><th>Služba</th><th>Co zahrnuje</th><th></th></tr></thead>
        <tbody>
          <tr><td>Stavební práce</td><td>Zednické práce, menší stavby a rekonstrukce, opravy.</td><td><a class="textlink" href="?sluzba=Stavební%20práce#kontakt">Poptat</a></td></tr>
          <tr><td>Protipožární systémy</td><td>Pasivní požární ochrana — protipožární ucpávky prostupů, nátěry a obklady konstrukcí.</td><td><a class="textlink" href="?sluzba=Protipožární%20systémy#kontakt">Poptat</a></td></tr>
          <tr id="leseni"><td>Půjčovna lešení</td><td>Fasádní lešení na krátkodobý i delší pronájem. Na přání doprava, postavení i rozebrání.</td><td><a class="textlink" href="?sluzba=Půjčovna%20lešení#kontakt">Poptat</a></td></tr>
        </tbody>
      </table>
      <p class="todo" style="margin-top:24px">K doplnění: přesný rozsah stavebních a protipožárních prací; u lešení typ, kolik m² máte k dispozici, cena za den/týden a zda je doprava a montáž v ceně.</p>
    </div>
    {ask("Stavební práce a lešení")}
  </div>
</section>
""" + contact("Stavební práce") + footer()

for name, html in {
    "index.html": index,
    "termovize.html": termovize,
    "hlinikovy-program.html": hlinik,
    "zemni-prace.html": zemni,
    "stavebni-prace.html": stavebni,
}.items():
    (OUT / name).write_text(html, encoding="utf-8")
    print("zapsáno", name)
