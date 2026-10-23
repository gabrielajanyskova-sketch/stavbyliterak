// Stavby Literák — drobné chování stránky
document.documentElement.classList.add("js");

// Mobilní menu
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
}

// Odhalení sekcí při posunu
const items = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add("in"));
}

// Poptávkový formulář — odešle se přes /api/contact; když e-mail na serveru
// není nastavený nebo selže, otevře se e-mailový klient s vyplněnou zprávou.
const form = document.querySelector("#poptavka");
if (form) {
  const service = new URLSearchParams(location.search).get("sluzba");
  if (service && form.sluzba) form.sluzba.value = service;
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
      if (status) status.textContent = "Díky, poptávka odešla. Ozvu se co nejdřív.";
    } catch {
      mailto(d);
    } finally {
      button.disabled = false;
    }
  });
}
