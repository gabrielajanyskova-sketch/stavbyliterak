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

// Poptávkový formulář — zatím bez serveru, otevře e-mail s vyplněným textem
const form = document.querySelector("#poptavka");
if (form) {
  const service = new URLSearchParams(location.search).get("sluzba");
  if (service && form.sluzba) form.sluzba.value = service;

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
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
  });
}
