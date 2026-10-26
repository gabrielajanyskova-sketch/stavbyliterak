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

  // Světlý / tmavý režim — výchozí je tmavý, volba z přepínače se pamatuje v prohlížeči
  // (při načtení ho nastavuje už skript v <head>)
  const themeBtn = document.querySelector(".theme-toggle");
  if (themeBtn) {
    const root = document.documentElement;
    const apply = (dark) => {
      if (dark) root.dataset.theme = "dark";
      else delete root.dataset.theme;
      themeBtn.setAttribute("aria-pressed", String(dark));
    };
    apply(root.dataset.theme === "dark");
    themeBtn.addEventListener("click", () => {
      const dark = root.dataset.theme !== "dark";
      apply(dark);
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
    });
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

  // Kalkulačka lešení: plocha = délka stěn × (výška k okapu + 1 m u prací na střeše)
  const scaffold = document.querySelector(".scaffold-calc");
  if (scaffold) {
    const field = (name) => scaffold.querySelector(`[name=${name}]`);
    const num = (name) => Math.max(0, field(name).valueAsNumber || 0);
    const fmt = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
    const values = () => {
      const delka = num("delka");
      const vyska = num("vyska") + (field("strecha").checked ? 1 : 0);
      return { delka, vyska, plocha: Math.ceil(delka * vyska), tydny: Math.max(1, Math.round(num("tydny")) || 1) };
    };
    const update = () => {
      const v = values();
      scaffold.querySelector(".calc-out").innerHTML = `≈ <strong>${fmt(v.plocha)} m²</strong> <span>lešení (${fmt(v.delka)} m délky × ${fmt(v.vyska)} m výšky)</span>`;
    };
    scaffold.addEventListener("input", update);
    scaffold.addEventListener("change", update);
    update();

    scaffold.querySelector("button").addEventListener("click", () => {
      const v = values();
      const text = [
        "Kalkulačka lešení:",
        `- délka stěn: ${fmt(v.delka)} m`,
        `- výška k okapu: ${fmt(num("vyska"))} m${field("strecha").checked ? " (+1 m nad okap kvůli střeše)" : ""}`,
        `- orientační plocha: ${fmt(v.plocha)} m²`,
        `- doba pronájmu: ${v.tydny} ${v.tydny === 1 ? "týden" : v.tydny < 5 ? "týdny" : "týdnů"}`,
        `- dovoz na stavbu: ${field("dovoz").checked ? "ano" : "ne"}`,
      ].join("\n");
      const contact = document.querySelector("#poptavka");
      if (!contact) return;
      const option = [...contact.sluzba.options].find((o) => /lešení/i.test(o.text));
      if (option) contact.sluzba.value = option.value;
      const note = contact.zprava.value.replace(/^Kalkulačka lešení:[\s\S]*?(\n\n|$)/, "").trim();
      contact.zprava.value = note ? `${text}\n\n${note}` : text;
      document.querySelector("#kontakt").scrollIntoView({ behavior: "smooth" });
      contact.jmeno.focus({ preventScroll: true });
    });
  }

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

  // Půjčovna: počty kusů v katalogu → seznam v poptávce, termín víkend / jeden den
  const booking = document.querySelector(".booking-form");
  if (booking) {
    const qty = new Map(); // název → počet
    const list = document.querySelector("[data-list]");
    const empty = document.querySelector("[data-empty]");
    const bar = document.querySelector(".booking-bar");
    const date = booking.datum;
    const until = booking.elements.do;
    const untilBox = booking.querySelector("[data-until]");
    const range = booking.querySelector("[data-range]");
    const button = booking.querySelector("button[type=submit]");
    const DAY = 864e5;
    const fmt = (d) => d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric", year: "numeric" });

    const renderList = () => {
      const rows = [...qty].filter(([, n]) => n > 0);
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
      });
    });

    // lišta „Pokračovat k poptávce“ jen když rezervační box není vidět
    let barOff = false;
    new IntersectionObserver(([e]) => { barOff = e.isIntersecting; renderList(); }).observe(document.querySelector("#rezervace"));

    // víkend = vyzvednutí v pátek, jeden den = pondělí až čtvrtek, více dní = od–do
    const checkDate = () => {
      const typ = booking.typ.value;
      const d = date.value ? new Date(`${date.value}T12:00`) : null;
      const end = until.value ? new Date(`${until.value}T12:00`) : null;
      let msg = "";
      if (!d) msg = "Vyberte datum vyzvednutí.";
      else if (d < new Date(Date.now() - DAY)) msg = "Datum už proběhlo.";
      else if (typ === "vikend" && d.getDay() !== 5) msg = "Víkendový pronájem začíná v pátek. Vyberte prosím pátek.";
      else if (typ === "den" && (d.getDay() < 1 || d.getDay() > 4)) msg = "Jednodenní pronájem je možný od pondělí do čtvrtka.";
      else if (typ === "vice" && !end) msg = "Vyberte datum vrácení.";
      else if (typ === "vice" && end <= d) msg = "Datum vrácení musí být až po dni vyzvednutí.";
      const onUntil = /vrácení/.test(msg);
      date.setCustomValidity(onUntil ? "" : msg);
      until.setCustomValidity(onUntil ? msg : "");
      const days = end && d ? Math.round((end - d) / DAY) : 0;
      range.textContent = msg || {
        vikend: `${fmt(d)} – ${fmt(new Date(d.getTime() + 2 * DAY))}`,
        den: `${fmt(d)}, na 24 hodin`,
        vice: `${fmt(d)} – ${fmt(end)} (${days} ${days === 1 ? "den" : days < 5 ? "dny" : "dní"})`,
      }[typ];
      return { ok: !msg, text: msg ? "" : `${{ vikend: "víkend", den: "jeden den", vice: "více dní" }[typ]} ${range.textContent}` };
    };
    const tomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    date.min = until.min = tomorrow;
    const syncType = () => {
      const vice = booking.typ.value === "vice";
      untilBox.hidden = !vice;
      until.required = vice;
    };
    date.addEventListener("change", () => { if (date.value) until.min = date.value; checkDate(); });
    until.addEventListener("change", checkDate);
    booking.addEventListener("change", (e) => {
      if (e.target.name !== "typ") return;
      syncType();
      if (date.value) checkDate();
    });

    booking.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const status = booking.querySelector("[data-status]");
      const items = [...qty].filter(([, n]) => n > 0);
      const term = checkDate();
      if (!items.length) { status.textContent = "Vyberte prosím u vybavení výše, co si chcete půjčit."; list.scrollIntoView({ block: "center" }); return; }
      if (!term.ok || !booking.reportValidity()) return;
      const d = new FormData(booking);
      const zprava = [
        "Vybavení:",
        ...items.map(([name, n]) => `- ${name}: ${n}×`),
        "",
        `Termín: ${term.text}`,
        `Dovoz a sestavení: ${d.get("dovoz") ? "ano" : "ne"}`,
        d.get("poznamka") ? `\nPoznámka: ${d.get("poznamka")}` : "",
      ].join("\n").trim();
      button.disabled = true;
      const fields = { sluzba: booking.dataset.service, jmeno: d.get("jmeno"), telefon: d.get("telefon"), misto: d.get("misto"), zprava, web: d.get("web") };
      if (await send(fields, booking.dataset.to, status)) {
        booking.reset();
        syncType();
        range.textContent = "";
        qty.clear();
        document.querySelectorAll(".catalog li[data-item]").forEach((li) => {
          li.classList.remove("is-picked");
          li.querySelector(".pick output").textContent = "0";
        });
        renderList();
        status.textContent = "Díky, poptávka odešla. Ozveme se co nejdřív s potvrzením termínu a cenou.";
      }
      button.disabled = false;
    });
    renderList();
  }
})();
