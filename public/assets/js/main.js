// Stavby Literák — mobilní menu, odhalení sekcí, galerie, poptávkový formulář
(() => {
  document.documentElement.classList.add("js-ready"); // vypne CSS pojistku odhalení sekcí (style.css)

  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    nav.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
  }

  // Mobilní pruh Zavolat / Poptávka: při posunu dolů se schová (jako lišta Safari), při posunu
  // nahoru se vrátí — v Safari na iOS 26 by jinak pod ním zůstávala mezera
  const callbar = document.querySelector(".callbar");
  if (callbar) {
    let lastY = scrollY;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (Math.abs(y - lastY) < 8) return;
      const away = y > lastY && y > 120;
      callbar.classList.toggle("is-away", away);
      document.documentElement.classList.toggle("callbar-away", away); // lišta gastra sjede níž
      lastY = y;
    }, { passive: true });
  }

  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("in"));
  }

  // Přepočet objemu na hmotnost pod tabulkou, která má hodnoty v kg (např. sypké materiály)
  document.querySelectorAll(".data-table").forEach((table) => {
    const groups = [];
    for (const tr of table.querySelectorAll("tbody tr")) {
      if (tr.classList.contains("group")) { groups.push({ name: tr.textContent.trim(), rows: [] }); continue; }
      const [name, value] = [...tr.cells].map((c) => c.textContent.trim());
      const kg = (value.replace(/\s/g, "").match(/\d+/g) || []).map(Number);
      if (!/kg/i.test(value) || !kg.length) continue;
      if (!groups.length) groups.push({ name: "", rows: [] });
      groups.at(-1).rows.push({ name, kg });
    }
    const all = groups.flatMap((g) => g.rows);
    if (!all.length) return;

    const calc = document.createElement("div");
    calc.className = "calc";
    calc.innerHTML = '<span class="label">Orientační přepočet na hmotnost</span><div class="calc-row"><label>Materiál<select></select></label><label>Objem (m³)<input type="number" min="0" step="0.5" value="1" inputmode="decimal"></label></div><p class="calc-out" aria-live="polite"></p>';
    const select = calc.querySelector("select");
    const volume = calc.querySelector("input");
    const out = calc.querySelector(".calc-out");
    let i = 0;
    for (const g of groups.filter((g) => g.rows.length)) {
      const parent = g.name ? select.appendChild(Object.assign(document.createElement("optgroup"), { label: g.name })) : select;
      for (const r of g.rows) parent.append(new Option(r.name, i++));
    }
    const t = (kg) => (kg / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
    const update = () => {
      const v = Math.max(0, parseFloat(String(volume.value).replace(",", ".")) || 0);
      const kg = all[select.value].kg.map((n) => n * v);
      out.innerHTML = `≈ <strong>${kg.map(t).join("–")} t</strong> <span>(${kg.map((n) => Math.round(n).toLocaleString("cs-CZ")).join("–")} kg)</span>`;
    };
    select.addEventListener("change", update);
    volume.addEventListener("input", update);
    update();
    table.closest(".table-wrap").after(calc);
  });

  // Galerie: zvětšení fotky v <dialog>, šipky přepínají v rámci jedné galerie
  if (document.querySelector("[data-lightbox]") && window.HTMLDialogElement) {
    const dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.innerHTML = '<img alt=""><p></p><button class="lb-prev" type="button" aria-label="Předchozí fotka">‹</button><button class="lb-next" type="button" aria-label="Další fotka">›</button><button class="lb-close" type="button" aria-label="Zavřít">×</button>';
    document.body.append(dlg);
    const img = dlg.querySelector("img");
    const caption = dlg.querySelector("p");
    let group = [];
    let index = 0;
    const show = (i) => {
      index = (i + group.length) % group.length;
      const link = group[index];
      img.src = link.href;
      img.alt = caption.textContent = link.querySelector("img").alt;
    };
    document.addEventListener("click", (e) => {
      const link = e.target.closest("[data-lightbox]");
      if (!link) return;
      e.preventDefault();
      group = [...link.closest(".gallery, .catalog").querySelectorAll("[data-lightbox]")];
      show(group.indexOf(link));
      dlg.showModal();
    });
    dlg.querySelector(".lb-prev").addEventListener("click", () => show(index - 1));
    dlg.querySelector(".lb-next").addEventListener("click", () => show(index + 1));
    dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
    dlg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
  }

  // Poptávky se odesílají přes /api/contact; když e-mail na serveru není nastavený nebo selže,
  // otevře se e-mailový klient s vyplněnou zprávou — poptávka se nikdy neztratí.
  const MAIL_FALLBACK = "Otevřel se vám e-mail s vyplněnou poptávkou, stačí ho odeslat. Nebo rovnou zavolejte.";
  const send = async (fields, to, status) => {
    status.textContent = "Odesílám…";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error(res.status);
      return true;
    } catch {
      const body = [`Služba: ${fields.sluzba}`, `Jméno: ${fields.jmeno}`, `E-mail: ${fields.email}`, `Telefon: ${fields.telefon}`, `Místo: ${fields.misto}`, "", fields.zprava].join("\n");
      location.href = `mailto:${to}?subject=${encodeURIComponent(`Poptávka z webu — ${fields.sluzba}`)}&body=${encodeURIComponent(body)}`;
      status.textContent = MAIL_FALLBACK;
      return false;
    }
  };

  // Po odeslání vyskočí okno s potvrzením (text pod formulářem zůstává pro čtečky a jako záloha).
  const sent = (message) => {
    const dialog = document.createElement("dialog");
    dialog.className = "sent";
    dialog.setAttribute("aria-labelledby", "sent-title");
    dialog.innerHTML = `<span class="sent-icon" aria-hidden="true"></span><h2 id="sent-title">Poptávka odeslána</h2><p></p><button type="button" class="btn">Rozumím</button>`;
    dialog.querySelector("p").textContent = message;
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  };

  window.sendInquiry = send; // používá i konfigurátor lešení (leseni.js)
  window.inquirySent = sent;

  const form = document.querySelector("#poptavka");
  if (form) {
    const service = new URLSearchParams(location.search).get("sluzba");
    if (service) form.sluzba.value = service;
    const button = form.querySelector("button[type=submit]");
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      button.disabled = true;
      const status = form.querySelector("[data-status]");
      if (await send(Object.fromEntries(new FormData(form)), form.dataset.to, status)) {
        form.reset();
        status.textContent = "Díky, poptávka odešla. Ozvu se co nejdřív.";
        sent("Díky, ozvu se vám co nejdřív.");
      }
      button.disabled = false;
    });
  }

  // Půjčovna: počty kusů v katalogu → seznam v poptávce, termín víkend / jeden den / více dní, orientační cena.
  // Více dní: datum vyzvednutí i vrácení, cenu pronájmu stanoví pan Literák individuálně.
  const booking = document.querySelector(".booking-form");
  if (booking) {
    const qty = new Map(); // název → počet
    const list = document.querySelector("[data-list]");
    const empty = document.querySelector("[data-empty]");
    const bar = document.querySelector(".booking-bar");
    const date = booking.datum;
    const range = booking.querySelector("[data-range]");
    const button = booking.querySelector("button[type=submit]");
    const priceBox = booking.querySelector("[data-price]");
    const DAY = 864e5;
    const fmt = (d) => d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });
    const kc = (n) => `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
    const picked = () => [...qty].filter(([, n]) => n > 0);
    let quote = null;
    const typLabel = () => ({ den: "na 1 den", vice: "na více dní" })[booking.typ.value] || "na víkend";
    const multi = () => booking.typ.value === "vice";
    const dateTo = booking.do;
    const multiOnly = booking.querySelector("[data-multi-only]");

    // součty počítá server, ceny jednotlivých položek na stránce nejsou
    let quoteTimer;
    const updateQuote = () => {
      if (!booking.dataset.quote) return;
      clearTimeout(quoteTimer);
      quoteTimer = setTimeout(async () => {
        const rows = picked();
        if (!rows.length) { quote = null; priceBox.hidden = true; return; }
        try {
          const res = await fetch("/api/gastro-quote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: booking.dataset.quote, typ: booking.typ.value, items: Object.fromEntries(rows) }),
          });
          if (!res.ok) throw new Error(res.status);
          quote = await res.json();
        } catch {
          quote = null;
          priceBox.hidden = true;
          return;
        }
        priceBox.querySelector("[data-price-head]").textContent = multi() ? "Cena pronájmu" : "Orientační cena";
        priceBox.querySelector("[data-price-typ]").textContent = typLabel();
        priceBox.querySelector("[data-rent]").textContent = multi() ? "individuálně" : quote.missing.length && !quote.rent ? "doplníme" : kc(quote.rent);
        priceBox.querySelector("[data-deposit]").textContent = kc(quote.deposit);
        const notes = [];
        if (multi()) notes.push("Cenu pronájmu na více dní stanovíme individuálně podle délky pronájmu a pošleme vám ji.");
        else if (quote.missing.length) notes.push(`Cenu za ${quote.missing.join(", ")} doplníme v odpovědi.`);
        if (booking.dovoz.checked) notes.push("Dovoz a sestavení se účtuje zvlášť podle vzdálenosti.");
        notes.push(multi() ? "Záloha je orientační, potvrdíme ji spolu s termínem." : "Cena je orientační, potvrdíme ji spolu s termínem.");
        priceBox.querySelector("[data-price-note]").textContent = notes.join(" ");
        priceBox.hidden = false;
      }, 250);
    };

    // upozornění k vybraným ohřevným a nápojovým zařízením — bez potvrzení nejde poptávku odeslat
    const warnBox = booking.querySelector("[data-warn-box]");
    const warns = new Map([...document.querySelectorAll(".catalog li[data-warn]")].map((li) => [li.dataset.item, li.dataset.warn]));
    const pickedWarns = () => picked().filter(([name]) => warns.has(name));

    const renderList = () => {
      const rows = picked();
      const w = pickedWarns();
      warnBox.querySelector("[data-warn-list]").replaceChildren(...w.map(([name]) => {
        const li = document.createElement("li");
        li.append(Object.assign(document.createElement("strong"), { textContent: `${name}: ` }), warns.get(name));
        return li;
      }));
      warnBox.hidden = !w.length;
      booking.souhlas.required = w.length > 0;
      list.replaceChildren(...rows.map(([name, n]) => Object.assign(document.createElement("li"), { textContent: `${name} — ${n}×` })));
      empty.hidden = rows.length > 0;
      const total = rows.reduce((sum, [, n]) => sum + n, 0);
      bar.querySelector("[data-count]").textContent = total;
      bar.hidden = total === 0 || barOff;
    };

    document.querySelectorAll(".catalog li[data-item]").forEach((li) => {
      const control = li.querySelector(".pick");
      const out = control.querySelector("output");
      const max = Number(control.dataset.max);
      control.addEventListener("click", (e) => {
        const step = Number(e.target.closest("button")?.dataset.step || 0);
        if (!step) return;
        const n = Math.min(max, Math.max(0, (qty.get(li.dataset.item) || 0) + step));
        qty.set(li.dataset.item, n);
        out.textContent = n;
        li.classList.toggle("is-picked", n > 0);
        renderList();
        updateQuote();
      });
    });

    // lišta „Pokračovat k poptávce“ jen když rezervační box není vidět
    let barOff = false;
    new IntersectionObserver(([e]) => { barOff = e.isIntersecting; renderList(); }).observe(document.querySelector("#rezervace"));

    // víkend = vyzvednutí v pátek, jeden den = pondělí až čtvrtek, více dní = od–do podle domluvy
    const checkDate = () => {
      const weekend = booking.typ.value === "vikend";
      const d = date.value ? new Date(`${date.value}T12:00`) : null;
      let msg = "";
      if (!d) msg = "Vyberte datum vyzvednutí.";
      else if (d < new Date(Date.now() - DAY)) msg = "Datum už proběhlo.";
      else if (multi()) {
        const e = dateTo.value ? new Date(`${dateTo.value}T12:00`) : null;
        const days = e ? Math.round((e - d) / DAY) + 1 : 0;
        if (!e) msg = "Vyberte datum vrácení.";
        else if (days < 2) msg = "Datum vrácení musí být až po dni vyzvednutí.";
        date.setCustomValidity("");
        dateTo.setCustomValidity(msg);
        range.textContent = msg || `${fmt(d)} – ${fmt(e)} (${days} ${days < 5 ? "dny" : "dní"})`;
        return { ok: !msg, text: msg ? "" : `více dní ${range.textContent}` };
      }
      else if (weekend && d.getDay() !== 5) msg = "Víkendový pronájem začíná v pátek. Vyberte prosím pátek.";
      else if (!weekend && (d.getDay() < 1 || d.getDay() > 4)) msg = "Jednodenní pronájem je možný od pondělí do čtvrtka.";
      date.setCustomValidity(msg);
      dateTo.setCustomValidity("");
      range.textContent = msg || (weekend ? `${fmt(d)} – ${fmt(new Date(d.getTime() + 2 * DAY))}` : `${fmt(d)}, na 24 hodin`);
      return { ok: !msg, text: msg ? "" : `${weekend ? "víkend" : "jeden den"} ${range.textContent}` };
    };
    date.min = dateTo.min = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    date.addEventListener("change", checkDate);
    dateTo.addEventListener("change", () => { if (date.value) checkDate(); });
    date.addEventListener("change", () => { dateTo.min = date.value || date.min; });
    booking.addEventListener("change", (e) => {
      if (e.target.name === "typ") {
        multiOnly.hidden = !multi();
        dateTo.required = multi();
        if (date.value) checkDate();
      }
      if (e.target.name === "typ" || e.target.name === "dovoz") updateQuote();
    });

    booking.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const status = booking.querySelector("[data-status]");
      const items = picked();
      const term = checkDate();
      if (!items.length) { status.textContent = "Vyberte prosím u vybavení výše, co si chcete půjčit."; list.scrollIntoView({ block: "center" }); return; }
      if (!term.ok || !booking.reportValidity()) return;
      const d = new FormData(booking);
      const price = quote && !priceBox.hidden
        ? [multi() ? "Cena pronájmu: stanoví se individuálně" : `Orientační cena pronájmu: ${priceBox.querySelector("[data-rent]").textContent}`, `Vratná záloha: ${kc(quote.deposit)}`]
        : multi() ? ["Cena pronájmu: stanoví se individuálně"] : [];
      const zprava = [
        "Vybavení:",
        ...items.map(([name, n]) => `- ${name}: ${n}×`),
        "",
        `Termín: ${term.text}`,
        `Dovoz a sestavení: ${d.get("dovoz") ? "ano" : "ne"}`,
        ...price,
        pickedWarns().length ? "Podmínky použití ohřevných a nápojových zařízení: potvrzeno" : "",
        d.get("poznamka") ? `\nPoznámka: ${d.get("poznamka")}` : "",
      ].join("\n").trim();
      button.disabled = true;
      const fields = { sluzba: booking.dataset.service, jmeno: d.get("jmeno"), telefon: d.get("telefon"), email: d.get("email"), misto: d.get("misto"), zprava, web: d.get("web") };
      if (await send(fields, booking.dataset.to, status)) {
        booking.reset();
        multiOnly.hidden = true;
        dateTo.required = false;
        range.textContent = "";
        qty.clear();
        document.querySelectorAll(".catalog li[data-item]").forEach((li) => {
          li.classList.remove("is-picked");
          li.querySelector(".pick output").textContent = "0";
        });
        renderList();
        quote = null;
        priceBox.hidden = true;
        status.textContent = "Díky, poptávka odešla. Ozveme se co nejdřív s potvrzením termínu a cenou.";
        sent("Díky, ozveme se vám co nejdřív s potvrzením termínu a cenou.");
      }
      button.disabled = false;
    });
    renderList();
  }

  // Našeptávač adres (pole s data-suggest, i ta, která vzniknou později — konfigurátor lešení).
  // Návrhy dává /api/adresa (Mapy.com); když nic nevrátí, pole je obyčejný text.
  let suggestId = 0;
  document.addEventListener("focusin", (ev) => {
    const input = ev.target;
    if (!input.matches?.("input[data-suggest]") || input.dataset.suggestReady) return;
    input.dataset.suggestReady = "1";
    const list = document.createElement("ul");
    list.className = "suggest";
    list.id = `suggest-${++suggestId}`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    input.parentElement.classList.add("has-suggest");
    input.after(list);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("aria-expanded", "false");
    input.autocomplete = "off";
    let items = [], active = -1, timer = 0, last = "";
    const render = () => {
      list.innerHTML = "";
      items.forEach((text, i) => {
        const li = document.createElement("li");
        li.id = `${list.id}-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === active));
        li.textContent = text;
        li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(i); });
        list.append(li);
      });
      list.hidden = !items.length;
      list.style.top = `${input.offsetTop + input.offsetHeight}px`; // vždy pod polem, ať adresu nezakryje
      input.setAttribute("aria-expanded", String(!!items.length));
      if (active >= 0) input.setAttribute("aria-activedescendant", `${list.id}-${active}`);
      else input.removeAttribute("aria-activedescendant");
    };
    const close = () => { items = []; active = -1; render(); };
    const pick = (i) => {
      input.value = items[i];
      close();
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { close(); return; }
      timer = setTimeout(async () => {
        if (q === last) return;
        last = q;
        try {
          const res = await fetch(`/api/adresa?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (input.value.trim() !== q || document.activeElement !== input) return;
          items = data.items || [];
          active = -1;
          render();
          // seznam by na mobilu skončil pod klávesnicí → posunout stránku, pole zůstane pod hlavičkou
          const vh = window.visualViewport?.height || innerHeight;
          const over = list.getBoundingClientRect().bottom - vh + 12;
          if (items.length && over > 0) scrollBy({ top: Math.min(over, input.getBoundingClientRect().top - 90) });
        } catch { close(); }
      }, 250);
    });
    input.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        render();
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        pick(active);
      } else if (e.key === "Escape") close();
    });
    input.addEventListener("blur", close);
  });
})();
