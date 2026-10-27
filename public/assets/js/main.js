// Stavby Literák — mobilní menu, odhalení sekcí, galerie, poptávkový formulář
(() => {
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
    calc.innerHTML = '<span class="label">Přepočet na hmotnost</span><div class="calc-row"><label>Materiál<select></select></label><label>Objem (m³)<input type="number" min="0" step="0.5" value="1" inputmode="decimal"></label></div><p class="calc-out" aria-live="polite"></p>';
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
      const body = [`Služba: ${fields.sluzba}`, `Jméno: ${fields.jmeno}`, `Telefon: ${fields.telefon}`, `Místo: ${fields.misto}`, "", fields.zprava].join("\n");
      location.href = `mailto:${to}?subject=${encodeURIComponent(`Poptávka z webu — ${fields.sluzba}`)}&body=${encodeURIComponent(body)}`;
      status.textContent = MAIL_FALLBACK;
      return false;
    }
  };

  window.sendInquiry = send; // používá i konfigurátor lešení (leseni.js)

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
      }
      button.disabled = false;
    });
  }

  // Půjčovna: počty kusů v katalogu → seznam v poptávce, termín víkend / jeden den, orientační cena.
  // Více dní se domlouvá individuálně — odkaz vyplní hlavní kontaktní formulář.
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
        priceBox.querySelector("[data-rent]").textContent = quote.missing.length && !quote.rent ? "doplníme" : kc(quote.rent);
        priceBox.querySelector("[data-deposit]").textContent = kc(quote.deposit);
        const notes = [];
        if (quote.missing.length) notes.push(`Cenu za ${quote.missing.join(", ")} doplníme v odpovědi.`);
        if (booking.dovoz.checked) notes.push("Dovoz a sestavení se účtuje zvlášť podle vzdálenosti.");
        notes.push("Cena je orientační, potvrdíme ji spolu s termínem.");
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

    // Více dní → hlavní kontaktní formulář s vybraným vybavením
    booking.querySelector("[data-multi]").addEventListener("click", () => {
      const contact = document.querySelector("#poptavka");
      if (!contact) return;
      const option = [...contact.sluzba.options].find((o) => /gastro/i.test(o.text));
      if (option) contact.sluzba.value = option.value;
      const rows = picked();
      contact.zprava.value = [
        "Chci si půjčit vybavení na více dní, od … do … .",
        ...(rows.length ? ["", "Vybavení:", ...rows.map(([name, n]) => `- ${name}: ${n}×`)] : []),
      ].join("\n");
      setTimeout(() => contact.jmeno.focus({ preventScroll: true }), 400);
    });

    // víkend = vyzvednutí v pátek, jeden den = pondělí až čtvrtek
    const checkDate = () => {
      const weekend = booking.typ.value === "vikend";
      const d = date.value ? new Date(`${date.value}T12:00`) : null;
      let msg = "";
      if (!d) msg = "Vyberte datum vyzvednutí.";
      else if (d < new Date(Date.now() - DAY)) msg = "Datum už proběhlo.";
      else if (weekend && d.getDay() !== 5) msg = "Víkendový pronájem začíná v pátek. Vyberte prosím pátek.";
      else if (!weekend && (d.getDay() < 1 || d.getDay() > 4)) msg = "Jednodenní pronájem je možný od pondělí do čtvrtka.";
      date.setCustomValidity(msg);
      range.textContent = msg || (weekend ? `${fmt(d)} – ${fmt(new Date(d.getTime() + 2 * DAY))}` : `${fmt(d)}, na 24 hodin`);
      return { ok: !msg, text: msg ? "" : `${weekend ? "víkend" : "jeden den"} ${range.textContent}` };
    };
    date.min = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    date.addEventListener("change", checkDate);
    booking.addEventListener("change", (e) => {
      if (e.target.name === "typ" && date.value) checkDate();
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
        ? [`Orientační cena pronájmu: ${priceBox.querySelector("[data-rent]").textContent}`, `Vratná záloha: ${kc(quote.deposit)}`]
        : [];
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
      const fields = { sluzba: booking.dataset.service, jmeno: d.get("jmeno"), telefon: d.get("telefon"), misto: d.get("misto"), zprava, web: d.get("web") };
      if (await send(fields, booking.dataset.to, status)) {
        booking.reset();
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
      }
      button.disabled = false;
    });
    renderList();
  }
})();
