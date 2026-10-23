// Stavby Literák — mobilní menu, odhalení sekcí, poptávkový formulář
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
      group = [...link.closest(".gallery").querySelectorAll("[data-lightbox]")];
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

  // Odesílá se přes /api/contact; když e-mail na serveru není nastavený nebo selže,
  // otevře se e-mailový klient s vyplněnou zprávou — poptávka se nikdy neztratí.
  const form = document.querySelector("#poptavka");
  if (!form) return;
  const service = new URLSearchParams(location.search).get("sluzba");
  if (service) form.sluzba.value = service;
  const status = form.querySelector("[data-status]");
  const button = form.querySelector("button[type=submit]");

  const mailto = (d) => {
    const body = [
      `Služba: ${d.get("sluzba")}`,
      `Jméno: ${d.get("jmeno")}`,
      `Telefon: ${d.get("telefon")}`,
      `Místo: ${d.get("misto")}`,
      "",
      d.get("zprava"),
    ].join("\n");
    const subject = `Poptávka z webu — ${d.get("sluzba")}`;
    location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    button.disabled = true;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(d)),
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = "Díky, poptávka odešla. Ozvu se co nejdřív.";
    } catch {
      mailto(d);
    } finally {
      button.disabled = false;
    }
  });
})();
