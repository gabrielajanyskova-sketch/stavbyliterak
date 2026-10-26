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

  // Světlý / tmavý režim — volba se pamatuje v prohlížeči (nastavuje ji už skript v <head>)
  const themeBtn = document.querySelector(".theme-toggle");
  if (themeBtn) {
    const root = document.documentElement;
    const sync = () => themeBtn.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
    sync();
    themeBtn.addEventListener("click", () => {
      const dark = root.dataset.theme !== "dark";
      if (dark) root.dataset.theme = "dark";
      else delete root.dataset.theme;
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
      sync();
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
  const send = async (fields, to) => {
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
      if (await send(Object.fromEntries(new FormData(form)), form.dataset.to)) {
        form.reset();
        form.querySelector("[data-status]").textContent = "Díky, poptávka odešla. Ozvu se co nejdřív.";
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
      return { ok: !msg, text: msg ? "" : (weekend ? `víkend ${range.textContent}` : `jeden den ${range.textContent}`) };
    };
    date.min = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    date.addEventListener("change", checkDate);
    booking.addEventListener("change", (e) => { if (e.target.name === "typ" && date.value) checkDate(); });

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
      if (await send(fields, booking.dataset.to)) {
        status.textContent = "Díky, poptávka odešla. Ozveme se co nejdřív s potvrzením termínu a cenou.";
      }
      button.disabled = false;
    });
    renderList();
  }
})();
