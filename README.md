# Stavby Literák — nový web

Statický web (čisté HTML + CSS, bez frameworku). Stačí nahrát obsah repozitáře na libovolný hosting
nebo zapnout GitHub Pages.

## Struktura

| Soubor | Obsah |
|---|---|
| `index.html` | Úvod — rozcestník služeb, jak pracuji, gastropůjčovna, kontakt |
| `termovize.html` | Termovizní měření (hlavní služba) |
| `hlinikovy-program.html` | Ploty, brány, zábradlí, pergoly, zimní zahrady… |
| `zemni-prace.html` | Zemní práce + strojové zakládání trávníků |
| `stavebni-prace.html` | Stavební práce, protipožární systémy, půjčovna lešení (`#leseni`) |
| `assets/` | styly, skript, logo (`logo.png` = původní logo s průhledným pozadím) |
| `_build/build.py` | generátor stránek — společná hlavička, patička a kontakt na jednom místě |

Úpravy: změňte `_build/build.py` a spusťte `python3 _build/build.py .` (přepíše HTML v kořeni).

## Design

- Barvy z loga: grafit (pozadí loga), oranžová cihel, světlý „beton“. Ostré hrany, žádné zaoblené karty.
- Písmo: Barlow Condensed (nadpisy, blízké logu), IBM Plex Sans (text), IBM Plex Mono (popisky).
- Úvod není fotogalerie, ale rozcestník — návštěvník hledá konkrétní službu, takže ji najde hned.
- Termovize má vlastní „teplotní“ hlavičku; hřeben v úvodu odkazuje na Beskydy z loga.

## K doplnění před spuštěním

- [ ] **Telefon** — všude je zástupné `+420 000 000 000` (proměnné `PHONE` / `PHONE_TEL` v `build.py`)
- [ ] Ověřit e-mail pro poptávky (`stavbyliterak@email.cz`)
- [ ] Žluté boxy „K doplnění“ na stránkách (ceny termovize, rozsah prací, lešení, gastropůjčovna) — po doplnění odstranit
- [ ] Texty jsou návrh — projít s klientem
- [ ] Případně 2–3 fotky k jednotlivým službám (ne galerie)
- [ ] Formulář zatím otevírá e-mailového klienta; pro odesílání přímo z webu napojit na formulářovou službu hostingu
