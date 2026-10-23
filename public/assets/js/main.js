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
