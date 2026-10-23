# Stavby Literák — nový web

Statický web (čisté HTML + CSS, bez frameworku). Stačí nahrát obsah repozitáře na libovolný hosting
nebo zapnout GitHub Pages.

## Struktura

| Soubor | Obsah |
|---|---|
| `index.html` | Úvod — rozcestník služeb, jak pracuji, gastropůjčovna, kontakt |
| `termovize.html` | Termovizní měření (hlavní služba) |
| `zemni-prace.html` | Zemní a výkopové práce + zakladač trávníku (`#zakladac`) |
| `hlinikovy-program.html` | Ploty, brány, zábradlí, pergoly, zimní zahrady… |
| `leseni.html` | Půjčovna lešení |
| `gastropujcovna.html` | Gastropůjčovna — katalog vybavení (odkaz z úvodu a patičky) |
| `stavebni-prace.html` | Protipožární pasivní systémy (`#protipozarni`) + další stavební práce |
| `assets/` | styly, skript, logo (`logo.png` = původní logo s průhledným pozadím) |
| `_build/build.py` | generátor stránek — společná hlavička, patička a kontakt na jednom místě |

Úpravy: změňte `_build/build.py` a spusťte `python3 _build/build.py .` (přepíše HTML v kořeni).

## Design

- Barvy z loga: grafit (pozadí loga), oranžová cihel, světlý „beton“. Ostré hrany, žádné zaoblené karty.
- Písmo: Barlow Condensed (nadpisy, blízké logu), IBM Plex Sans (text), IBM Plex Mono (popisky).
- Úvod není fotogalerie, ale rozcestník — návštěvník hledá konkrétní službu, takže ji najde hned.
- Termovize má vlastní „teplotní“ hlavičku; hřeben v úvodu odkazuje na Beskydy z loga.

## K doplnění

Texty jsou převzaté z původního webu (opravené překlepy, rozčleněné do seznamů a otázek).

- [ ] Termovize — průběh měření a podoba výstupu (na původním webu nebylo, je to návrh)
- [ ] Stavební práce — které z prací (elektro, malby, podlahy, hodinový manžel…) dál nabízet
- [ ] Stránky Certifikáty a Reference z původního webu — zatím nepřevzaté
- [ ] Žluté boxy „K doplnění“ po vyřešení odstranit
- [ ] Formulář zatím otevírá e-mailového klienta; pro odesílání přímo z webu napojit na formulářovou službu hostingu
