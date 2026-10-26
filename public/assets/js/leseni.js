// Konfigurátor lešení: půdorys domu do mřížky → stěny a jejich délky → 3D náhled,
// služba, termín a kontakt. Výsledek odejde jako poptávka (přes window.sendInquiry z main.js).
// Ceny zatím nepočítá — souhrn ukazuje plochu a rozpis, nabídku pošle pan Literák.
(() => {
  const root = document.querySelector("[data-scaffold]");
  if (!root) return;

  const N = 8; // mřížka N × N políček
  const CELL_M = 2.5; // výchozí délka jednoho políčka v metrech
  const FLOOR_M = 3; // výška jednoho podlaží k okapu
  const DAY = 864e5;
  const ROOFS = { sedlova: "Sedlová", valbova: "Valbová", plocha: "Plochá / pultová" };
  const SERVICES = {
    pronajem: ["Jen pronájem", "lešení si postavíte sami"],
    montaz: ["S montáží", "postavíme, rozebíráte vy"],
    komplet: ["Montáž i demontáž", "postavíme i rozebereme"],
  };

  const state = {
    step: 1,
    cells: new Set(["2,2", "3,2", "4,2", "5,2", "2,3", "3,3", "4,3", "5,3", "2,4", "3,4", "4,4", "5,4"]),
    lengths: {}, // délky stěn podle klíče segmentu (pamatují se při úpravě půdorysu)
    off: new Set(), // stěny bez lešení
    floors: 2,
    height: 6,
    roof: "sedlova",
    overRoof: true,
    service: "pronajem",
    transport: "dovoz",
    props: 0, // stavební stojky (0 = nechce)
  };

  // ---------- geometrie půdorysu ----------

  const has = (x, y) => state.cells.has(`${x},${y}`);

  // Obrys po směru hodinových ručiček (y dolů): vrací seznam stěn {x1,y1,x2,y2,cells}
  // nebo chybu, když tvar není jeden souvislý kus bez děr.
  function outline() {
    if (!state.cells.size) return { error: "Vyklikejte půdorys domu." };
    const edges = new Map();
    const add = (a, b) => {
      const k = a.join(",");
      if (edges.has(k)) edges.set(k, null); // dvě hrany z jednoho bodu = dotyk rohem
      else edges.set(k, b);
    };
    for (const c of state.cells) {
      const [x, y] = c.split(",").map(Number);
      if (!has(x, y - 1)) add([x, y], [x + 1, y]);
      if (!has(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
      if (!has(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
      if (!has(x - 1, y)) add([x, y + 1], [x, y]);
    }
    if ([...edges.values()].includes(null)) return { error: "Políčka se nesmí dotýkat jen rohem." };
    const start = edges.keys().next().value;
    const pts = [];
    let k = start;
    do {
      pts.push(k.split(",").map(Number));
      const next = edges.get(k);
      edges.delete(k);
      k = next.join(",");
    } while (k !== start && edges.has(k));
    if (k !== start || edges.size) return { error: "Půdorys musí být jeden souvislý tvar bez dvorků uvnitř." };

    // sloučení rovných úseků do stěn, začátek v rohu
    const turn = (i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0;
    };
    const corners = pts.map((_, i) => i).filter(turn);
    // začít v levém horním rohu, ať se písmena stěn při malé změně nepřeházejí
    corners.sort((a, b) => pts[a][1] - pts[b][1] || pts[a][0] - pts[b][0]);
    const first = corners[0];
    const ordered = pts.map((_, i) => (first + i) % pts.length).filter(turn);
    const walls = ordered.map((i, n) => {
      const a = pts[i], b = pts[ordered[(n + 1) % ordered.length]];
      return { x1: a[0], y1: a[1], x2: b[0], y2: b[1], cells: Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]) };
    });
    return { walls };
  }

  const wallKey = (w) => `${w.x1},${w.y1},${w.x2},${w.y2}`;
  const letter = (i) => String.fromCharCode(65 + i);
  const wallLength = (w) => state.lengths[wallKey(w)] ?? w.cells * CELL_M;

  function totals(walls) {
    const on = walls.filter((w) => !state.off.has(wallKey(w)));
    const length = on.reduce((s, w) => s + wallLength(w), 0);
    const height = state.height + (state.overRoof ? 1 : 0);
    return { length, height, area: Math.ceil(length * height), walls: on.length, all: walls.length };
  }

  // ---------- 3D náhled (izometrie, kreslí se odzadu dopředu) ----------

  const ISO = { c: Math.cos(Math.PI / 6), s: Math.sin(Math.PI / 6) };
  const pr = (x, y, z) => [(x - y) * ISO.c, (x + y) * ISO.s - z];
  const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map((p) => pr(...p).map((v) => v.toFixed(2)).join(",")).join(" ")}"/>`;
  const line = (a, b, cls) => {
    const [x1, y1] = pr(...a), [x2, y2] = pr(...b);
    return `<line class="${cls}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  };

  function rectOf() {
    const xs = [], ys = [];
    for (const c of state.cells) { const [x, y] = c.split(",").map(Number); xs.push(x); ys.push(y); }
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 };
  }

  // roh na začátku stěny i míří ven z domu (u obrysu po směru hodinových ručiček)
  const convexAt = (walls, i) => {
    const p = walls[(i - 1 + walls.length) % walls.length], w = walls[i];
    return (p.x2 - p.x1) * (w.y2 - w.y1) - (p.y2 - p.y1) * (w.x2 - w.x1) > 0;
  };

  // Rámové lešení podél stěny: dvě řady sloupků (u zdi a venku), podlážky po 2 m, zábradlí,
  // diagonály. Na vnějších rozích se prodlouží, aby na sebe lešení sousedních stěn navazovalo.
  const LIFT = 2 / CELL_M; // výška patra lešení (2 m)
  const IN = 0.1, OUT = 0.4; // odstup vnitřní a vnější řady od zdi (≈ 0,25 m a 1 m)
  function scaffoldFrame(walls, i, eave, top, back) {
    const w = walls[i];
    const dx = Math.sign(w.x2 - w.x1), dy = Math.sign(w.y2 - w.y1);
    const nx = dy, ny = -dx; // ven od domu
    const e1 = convexAt(walls, i) ? OUT : -OUT;
    const e2 = convexAt(walls, (i + 1) % walls.length) ? OUT : -OUT;
    const L = w.cells + e1 + e2;
    const at = (t, off, z) => [w.x1 - dx * e1 + dx * t + nx * off, w.y1 - dy * e1 + dy * t + ny * off, z];
    const bays = Math.max(1, Math.round(L / 1.1));
    const ts = Array.from({ length: bays + 1 }, (_, j) => (L * j) / bays);
    // podlážky podle okapu: nejvyšší 1 m pod okapem, další po 2 m dolů. Práce u střechy
    // jen prodlouží sloupky o 1 m nad okap a nahoře přidá zábradlí — další patro to není.
    const RAIL = 1 / CELL_M;
    const standTop = top;
    const decks = [];
    for (let z = eave - RAIL; z >= 1.2 / CELL_M - 0.01; z -= LIFT) decks.unshift(z);
    if (!decks.length) decks.push(Math.max(0.4, eave - RAIL));

    const side = (off) => [
      ...ts.map((t) => line(at(t, off, 0), at(t, off, standTop), "sc-std")),
      ...decks.map((z) => line(at(0, off, z), at(L, off, z), "sc-ledger")),
    ];
    const planks = decks.map((z) => poly([at(0, IN, z), at(L, IN, z), at(L, OUT, z), at(0, OUT, z)], "sc-plank"));
    const transoms = decks.flatMap((z) => ts.map((t) => line(at(t, IN, z), at(t, OUT, z), "sc-ledger")));
    const railAt = (z) => line(at(0, OUT, z), at(L, OUT, z), "sc-rail");
    const rails = decks.flatMap((z) => [railAt(z + RAIL / 2), railAt(z + RAIL)]);
    if (standTop > decks[decks.length - 1] + RAIL + 0.01) rails.push(railAt(standTop - RAIL / 2), railAt(standTop));
    const braces = [];
    for (let j = 0; j < bays; j += 2) {
      let z0 = 0;
      for (const [k, z] of decks.entries()) {
        const up = k % 2 === 0;
        braces.push(line(at(ts[j], OUT, up ? z0 : z), at(ts[j + 1], OUT, up ? z : z0), "sc-brace"));
        z0 = z;
      }
    }
    const parts = back
      ? [...side(OUT), ...braces, ...rails, ...planks, ...transoms, ...side(IN)]
      : [...side(IN), ...planks, ...transoms, ...side(OUT), ...braces, ...rails];
    return parts.join("");
  }

  // Výška střechy nad okapem v bodě půdorysu: sklon × vzdálenost k nejbližší okapové hraně.
  // U rohů dovnitř domu se měří „čtvercově“ k rohu — vznikne rovné úžlabí jako u skutečné střechy.
  // Sedlová: koncové stěny křídel (oba rohy ven a křídlo za nimi je aspoň tak hluboké, jak je stěna
  // dlouhá) jsou štíty, ne okapy.
  const SLOPE = 0.7; // sklon střechy ≈ 35°
  function roofHeight(walls) {
    if (state.roof === "plocha") return () => 0;
    const n = walls.length;
    const len = (w) => w.cells;
    const convex = (i) => convexAt(walls, i);
    let gable = walls.map(() => false);
    if (state.roof === "sedlova") {
      // hloubka domu za stěnou: od prostředku stěny dovnitř, dokud jsou políčka vyplněná
      const depth = (w) => {
        const dx = Math.sign(w.x2 - w.x1), dy = Math.sign(w.y2 - w.y1);
        const k = Math.floor(w.cells / 2) + 0.5;
        let x = w.x1 + dx * k - dy * 0.5, y = w.y1 + dy * k + dx * 0.5, d = 0;
        while (has(Math.floor(x), Math.floor(y))) { d++; x -= dy; y += dx; }
        return d;
      };
      gable = walls.map((w, i) => convex(i) && convex((i + 1) % n) && len(w) <= depth(w));
      // čtverec a podobně: dva sousední štíty nejdou — štíty nechá jen na svislých stěnách
      gable = gable.map((g, i) => g && !(walls[i].y1 === walls[i].y2 && (gable[(i - 1 + n) % n] || gable[(i + 1) % n])));
    }
    const eaves = walls.filter((_, i) => !gable[i]);
    return (px, py) => {
      let d = Infinity;
      for (const e of eaves) {
        let v;
        if (e.y1 === e.y2) {
          const lo = Math.min(e.x1, e.x2), hi = Math.max(e.x1, e.x2);
          v = px >= lo && px <= hi ? Math.abs(py - e.y1) : Math.max(Math.min(Math.abs(px - lo), Math.abs(px - hi)), Math.abs(py - e.y1));
        } else {
          const lo = Math.min(e.y1, e.y2), hi = Math.max(e.y1, e.y2);
          v = py >= lo && py <= hi ? Math.abs(px - e.x1) : Math.max(Math.min(Math.abs(py - lo), Math.abs(py - hi)), Math.abs(px - e.x1));
        }
        if (v < d) d = v;
      }
      return d === Infinity ? 0 : d * SLOPE;
    };
  }

  function render3d(walls) {
    const svg = root.querySelector(".sc-3d");
    if (!walls) { svg.innerHTML = ""; return; }
    const H = Math.max(0.6, state.height / CELL_M);
    const top = H + (state.overRoof ? 1 / CELL_M : 0);
    const facing = (w) => (w.y2 - w.y1) + (w.x1 - w.x2) > 0; // vnější normála míří k divákovi
    const depth = (w) => (w.x1 + w.x2 + w.y1 + w.y2) / 2;
    const withScaffold = walls.filter((w) => !state.off.has(wallKey(w)));
    const out = [];

    // zem kolem domu (náhled se přiblíží na dům, ať je vidět detail)
    const g = rectOf();
    const gx0 = g.x0 - 1.5, gy0 = g.y0 - 1.5, gx1 = g.x1 + 1.5, gy1 = g.y1 + 1.5;
    out.push(poly([[gx0, gy0, 0], [gx1, gy0, 0], [gx1, gy1, 0], [gx0, gy1, 0]], "sc-ground"));
    for (let i = Math.ceil(gx0); i <= gx1; i++) out.push(line([i, gy0, 0], [i, gy1, 0], "sc-gridline"));
    for (let i = Math.ceil(gy0); i <= gy1; i++) out.push(line([gx0, i, 0], [gx1, i, 0], "sc-gridline"));
    // lešení za domem
    const frame = (w, back) => scaffoldFrame(walls, walls.indexOf(w), H, top, back);
    for (const w of withScaffold.filter((w) => !facing(w)).sort((a, b) => depth(a) - depth(b))) out.push(frame(w, true));
    // stěny čelem k divákovi, odzadu; horní hrana sleduje střechu (štíty u sedlové)
    const roofH = roofHeight(walls);
    for (const w of walls.filter(facing).sort((a, b) => depth(a) - depth(b))) {
      const shade = w.y1 === w.y2 ? "sc-wall-a" : "sc-wall-b";
      const top = [];
      for (let i = 0; i <= w.cells * 4; i++) {
        const t = i / (w.cells * 4), x = w.x1 + (w.x2 - w.x1) * t, y = w.y1 + (w.y2 - w.y1) * t;
        top.push([x, y, H + roofH(x, y)]);
      }
      out.push(poly([[w.x1, w.y1, 0], [w.x2, w.y2, 0], ...top.reverse()], shade));
    }
    // střecha: výšková plocha nad půdorysem, kreslená po trojúhelnících odzadu dopředu
    if (state.roof === "plocha") {
      out.push(poly(walls.map((w) => [w.x1, w.y1, H]), "sc-flat"));
    } else {
      const tris = [];
      const S = 0.5;
      for (const c of state.cells) {
        const [cx, cy] = c.split(",").map(Number);
        for (let x = cx; x < cx + 1; x += S) {
          for (let y = cy; y < cy + 1; y += S) {
            const p = (px, py) => [px, py, H + roofH(px, py)];
            const m = p(x + S / 2, y + S / 2);
            const q = [p(x, y), p(x + S, y), p(x + S, y + S), p(x, y + S)];
            for (let i = 0; i < 4; i++) tris.push([q[i], q[(i + 1) % 4], m]);
          }
        }
      }
      // světlo zleva: každý směr svahu má jiný odstín, takže jsou vidět hřebeny i úžlabí
      const L = [-0.6, 0.35, 0.72];
      const shade = (t) => {
        const u = t[1].map((v, i) => v - t[0][i]), v = t[2].map((v, i) => v - t[0][i]);
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        if (n[2] < 0) n = n.map((c) => -c);
        const k = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (Math.hypot(...n) || 1);
        return `hsl(12 52% ${Math.round(22 + k * 26)}%)`;
      };
      tris.sort((a, b) => (a[0][0] + a[0][1] + a[1][0] + a[1][1] + a[2][0] + a[2][1]) - (b[0][0] + b[0][1] + b[1][0] + b[1][1] + b[2][0] + b[2][1]));
      for (const t of tris) {
        const f = shade(t);
        out.push(`<polygon fill="${f}" stroke="${f}" stroke-width="0.012" points="${t.map((p) => pr(...p).map((v) => v.toFixed(3)).join(",")).join(" ")}"/>`);
      }
    }
    // lešení před domem
    for (const w of withScaffold.filter(facing).sort((a, b) => depth(a) - depth(b))) out.push(frame(w, false));
    svg.innerHTML = out.join("");
    const box = svg.getBBox();
    // poměr 4 : 3 jako rámeček, obsah na střed
    let w = box.width + 0.6, h = box.height + 0.6;
    if (w / h > 4 / 3) h = (w * 3) / 4; else w = (h * 4) / 3;
    svg.setAttribute("viewBox", `${box.x + box.width / 2 - w / 2} ${box.y + box.height / 2 - h / 2} ${w} ${h}`);
  }

  // ---------- rozhraní ----------

  const fmt = (n) => n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
  const seg = (name, options, value) =>
    `<div class="seg sc-seg" role="radiogroup">${Object.entries(options).map(([v, [title, hint]]) =>
      `<label><input type="radio" name="${name}" value="${v}"${v === value ? " checked" : ""}><span><strong>${title}</strong>${hint || ""}</span></label>`).join("")}</div>`;

  root.innerHTML = `
<ol class="sc-steps">
<li><button type="button" data-go="1">Dům</button></li>
<li><button type="button" data-go="2">Služba</button></li>
<li><button type="button" data-go="3">Termín</button></li>
<li><button type="button" data-go="4">Odeslat</button></li>
</ol>
<div class="sc-body">
<div class="sc-panel" data-panel="1">
<h3>Tvar domu</h3>
<div class="sc-house">
<div>
<p class="sc-help">Klikáním do mřížky vyznačte půdorys domu. Jedno políčko je asi ${fmt(CELL_M)} m, přesné délky stěn doplníte pod mřížkou.</p>
<div class="sc-grid" role="group" aria-label="Půdorys domu, ${N} × ${N} políček"></div>
<p class="sc-error" role="alert"></p>
</div>
<figure class="sc-view"><svg class="sc-3d" role="img" aria-label="Náhled domu s lešením"></svg><figcaption>Náhled je orientační.</figcaption></figure>
</div>
<div class="sc-fields">
<label>Počet podlaží<select name="floors">${[1, 2, 3, 4].map((n) => `<option value="${n}"${n === state.floors ? " selected" : ""}>${n === 1 ? "přízemí" : `${n} podlaží`}</option>`).join("")}</select></label>
<label>Výška k okapu (m)<input name="height" type="number" min="1" max="30" step="0.5" value="${state.height}" inputmode="decimal"></label>
<label>Střecha<select name="roof">${Object.entries(ROOFS).map(([v, t]) => `<option value="${v}"${v === state.roof ? " selected" : ""}>${t}</option>`).join("")}</select></label>
</div>
<label class="calc-check"><input type="checkbox" name="overRoof" checked> Budu pracovat i u střechy (lešení o 1 m nad okap)</label>
<h3>Stěny a jejich délky</h3>
<p class="sc-help">Odškrtněte stěny, kde lešení nepotřebujete.</p>
<ul class="sc-walls"></ul>
</div>
<div class="sc-panel" data-panel="2" hidden>
<h3>Montáž</h3>
${seg("service", SERVICES, state.service)}
<h3>Doprava</h3>
${seg("transport", { dovoz: ["Dovoz na stavbu", "přivezeme a po pronájmu odvezeme"], sam: ["Odvezu si sám", "vyzvednutí ve Frýdku-Místku"] }, state.transport)}
<label class="sc-wide">Místo stavby (obec)<input name="misto" autocomplete="address-level2"></label>
<h3>Stavební stojky</h3>
<label class="calc-check"><input type="checkbox" name="propsOn"> Potřebuji i stavební stojky</label>
<label class="sc-wide sc-props" hidden>Počet stojek (ks)<input name="props" type="number" min="1" step="1" value="10" inputmode="numeric"></label>
<label class="sc-wide">K čemu lešení potřebujete<select name="ucel"><option>Omítky a nátěry fasády</option><option>Střecha a klempířské práce</option><option>Okna a parapety</option><option>Jiné práce</option></select></label>
</div>
<div class="sc-panel" data-panel="3" hidden>
<h3>Termín pronájmu</h3>
<div class="sc-fields is-2">
<label>Od<input name="od" type="date"></label>
<label>Do<input name="do" type="date"></label>
</div>
<p class="sc-help" data-term>Termín potvrdíme podle dostupnosti lešení.</p>
</div>
<div class="sc-panel" data-panel="4" hidden>
<h3>Kam vám pošleme nabídku</h3>
<div class="sc-fields is-2">
<label>Jméno<input name="jmeno" autocomplete="name"></label>
<label>Telefon<input name="telefon" type="tel" autocomplete="tel"></label>
</div>
<label class="sc-wide">E-mail (nepovinné)<input name="email" type="email" autocomplete="email"></label>
<label class="sc-wide">Poznámka<textarea name="poznamka" rows="3" placeholder="Např. přístup ke stavbě, terén, balkony…"></textarea></label>
<div hidden><label>Nevyplňujte<input name="web" tabindex="-1" autocomplete="off"></label></div>
</div>
<aside class="sc-summary" aria-live="polite"></aside>
</div>
<div class="sc-nav">
<button type="button" class="btn btn-line" data-prev>Zpět</button>
<button type="button" class="btn" data-next>Pokračovat</button>
</div>
<p class="sc-status" role="status"></p>`;

  const $ = (sel) => root.querySelector(sel);
  const field = (name) => root.querySelector(`[name=${name}]`);
  const grid = $(".sc-grid");
  let current = outline();

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.cell = `${x},${y}`;
      b.setAttribute("aria-label", `Políčko ${x + 1}, ${y + 1}`);
      grid.append(b);
    }
  }
  const labels = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  labels.setAttribute("viewBox", `0 0 ${N} ${N}`);
  labels.setAttribute("aria-hidden", "true");
  labels.classList.add("sc-outline");
  grid.append(labels);

  function drawGrid() {
    grid.querySelectorAll("[data-cell]").forEach((b) => {
      const on = state.cells.has(b.dataset.cell);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    labels.innerHTML = (current.walls || []).map((w, i) => {
      const off = state.off.has(wallKey(w));
      const [nx, ny] = [w.y2 - w.y1, w.x1 - w.x2].map((v) => Math.sign(v) * 0.32);
      const mx = (w.x1 + w.x2) / 2 + nx, my = (w.y1 + w.y2) / 2 + ny;
      return `<line class="${off ? "is-off" : ""}" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}"/><text x="${mx}" y="${my}">${letter(i)}</text>`;
    }).join("");
  }

  function drawWalls() {
    const list = $(".sc-walls");
    if (!current.walls) { list.innerHTML = ""; return; }
    list.innerHTML = current.walls.map((w, i) => {
      const k = wallKey(w);
      return `<li><label class="calc-check"><input type="checkbox" data-wall="${k}"${state.off.has(k) ? "" : " checked"}> Stěna ${letter(i)}</label><label class="sc-len"><input type="number" min="0.5" step="0.1" inputmode="decimal" data-len="${k}" value="${+wallLength(w).toFixed(2)}" aria-label="Délka stěny ${letter(i)} v metrech"><span>m</span></label></li>`;
    }).join("");
  }

  function term() {
    const od = field("od").value, doo = field("do").value;
    if (!od || !doo) return null;
    const a = new Date(`${od}T12:00`), b = new Date(`${doo}T12:00`);
    if (b < a) return { error: "Konec pronájmu musí být po začátku." };
    const days = Math.round((b - a) / DAY) + 1;
    const f = (d) => d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
    return { days, text: `${f(a)} – ${f(b)} (${days} ${days === 1 ? "den" : days < 5 ? "dny" : "dní"})` };
  }

  function summary() {
    const t = current.walls ? totals(current.walls) : null;
    const tm = term();
    const rows = [
      ["Plocha lešení", t ? `≈ ${fmt(t.area)} m²` : "—"],
      ["Délka lešení", t ? `${fmt(t.length)} m (${t.walls} z ${t.all} stěn)` : "—"],
      ["Výška lešení", t ? `${fmt(t.height)} m` : "—"],
      ["Střecha", ROOFS[state.roof]],
      ["Montáž", SERVICES[state.service][0]],
      ["Doprava", state.transport === "dovoz" ? "dovoz na stavbu" : "vlastní odvoz"],
      ...(state.props ? [["Stavební stojky", `${state.props} ks`]] : []),
      ["Termín", tm && !tm.error ? tm.text : "—"],
    ];
    $(".sc-summary").innerHTML = `<span class="label">Souhrn poptávky</span><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl><p class="sc-price">Cenu spočítáme a pošleme vám nabídku.</p>`;
    return { t, tm };
  }

  function update() {
    current = outline();
    $(".sc-error").textContent = current.error || "";
    drawGrid();
    drawWalls();
    render3d(current.walls);
    summary();
  }

  function refresh() {
    drawGrid();
    render3d(current.walls);
    summary();
  }

  // ---------- události ----------

  // tažení prstem/myší přes víc políček najednou
  let paint = null;
  grid.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-cell]");
    if (!b) return;
    e.preventDefault();
    paint = !state.cells.has(b.dataset.cell);
    grid.setPointerCapture(e.pointerId);
    toggle(b.dataset.cell);
  });
  grid.addEventListener("pointermove", (e) => {
    if (paint === null) return;
    const b = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell]");
    if (b && state.cells.has(b.dataset.cell) !== paint) toggle(b.dataset.cell);
  });
  const stop = () => { paint = null; };
  grid.addEventListener("pointerup", stop);
  grid.addEventListener("pointercancel", stop);
  // klávesnice (Enter / mezerník)
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cell]");
    if (b && e.detail === 0) toggle(b.dataset.cell);
  });
  function toggle(cell) {
    if (state.cells.has(cell)) state.cells.delete(cell);
    else state.cells.add(cell);
    update();
  }

  root.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.len) {
      const v = parseFloat(String(el.value).replace(",", "."));
      if (v > 0) state.lengths[el.dataset.len] = v;
      refresh();
    } else if (el.name === "height") {
      state.height = Math.max(1, parseFloat(String(el.value).replace(",", ".")) || 1);
      refresh();
    } else if (el.name === "props") {
      if (field("propsOn").checked) state.props = Math.max(1, Math.round(el.valueAsNumber) || 1);
      summary();
    } else if (el.name === "od" || el.name === "do") {
      const tm = term();
      root.querySelector("[data-term]").textContent = tm?.error || "Termín potvrdíme podle dostupnosti lešení.";
      summary();
    }
  });
  root.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.wall) {
      if (el.checked) state.off.delete(el.dataset.wall);
      else state.off.add(el.dataset.wall);
      refresh();
    } else if (el.name === "floors") {
      state.floors = +el.value;
      state.height = state.floors * FLOOR_M;
      field("height").value = state.height;
      refresh();
    } else if (el.name === "roof") { state.roof = el.value; refresh(); }
    else if (el.name === "overRoof") { state.overRoof = el.checked; refresh(); }
    else if (el.name === "service") { state.service = el.value; summary(); }
    else if (el.name === "transport") { state.transport = el.value; summary(); }
    else if (el.name === "propsOn") {
      $(".sc-props").hidden = !el.checked;
      state.props = el.checked ? Math.max(1, Math.round(field("props").valueAsNumber) || 1) : 0;
      summary();
    }
  });

  const tomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10);
  field("od").min = field("do").min = tomorrow;
  field("od").addEventListener("change", () => { field("do").min = field("od").value || tomorrow; });

  // ---------- kroky ----------

  const status = $(".sc-status");
  function check(step) {
    if (step === 1 && current.error) return current.error;
    if (step === 1 && !totals(current.walls).walls) return "Zaškrtněte aspoň jednu stěnu s lešením.";
    if (step === 3) {
      const tm = term();
      if (!tm) return "Vyberte prosím začátek a konec pronájmu.";
      if (tm.error) return tm.error;
    }
    if (step === 4 && (!field("jmeno").value.trim() || !field("telefon").value.trim())) return "Vyplňte prosím jméno a telefon.";
    return "";
  }
  function go(step) {
    for (let s = 1; s < step; s++) {
      const err = check(s);
      if (err) { show(s); status.textContent = err; return; }
    }
    show(step);
  }
  function show(step) {
    state.step = step;
    status.textContent = "";
    root.querySelectorAll("[data-panel]").forEach((p) => { p.hidden = +p.dataset.panel !== step; });
    root.querySelectorAll("[data-go]").forEach((b) => {
      const n = +b.dataset.go;
      b.classList.toggle("is-done", n < step);
      if (n === step) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    $("[data-prev]").hidden = step === 1;
    $("[data-next]").textContent = step === 4 ? "Odeslat poptávku" : "Pokračovat";
  }
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(+b.dataset.go)));
  $("[data-prev]").addEventListener("click", () => show(state.step - 1));
  $("[data-next]").addEventListener("click", async () => {
    const err = check(state.step);
    if (err) { status.textContent = err; return; }
    if (state.step < 4) {
      show(state.step + 1);
      root.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const { t, tm } = summary();
    const lines = [
      "Konfigurátor lešení:",
      `- plocha lešení: ≈ ${fmt(t.area)} m² (délka ${fmt(t.length)} m × výška ${fmt(t.height)} m)`,
      `- stěny: ${current.walls.map((w, i) => `${letter(i)} ${fmt(wallLength(w))} m${state.off.has(wallKey(w)) ? " (bez lešení)" : ""}`).join(", ")}`,
      `- dům: ${state.floors === 1 ? "přízemní" : `${state.floors} podlaží`}, výška k okapu ${fmt(state.height)} m, střecha ${ROOFS[state.roof].toLowerCase()}${state.overRoof ? ", práce i u střechy" : ""}`,
      `- montáž: ${SERVICES[state.service][0].toLowerCase()}`,
      `- doprava: ${state.transport === "dovoz" ? "dovoz na stavbu" : "odvezu si sám"}`,
      state.props ? `- stavební stojky: ${state.props} ks` : "",
      `- účel: ${field("ucel").value}`,
      `- termín: ${tm.text}`,
      field("email").value.trim() ? `- e-mail: ${field("email").value.trim()}` : "",
      field("poznamka").value.trim() ? `\nPoznámka: ${field("poznamka").value.trim()}` : "",
    ].filter(Boolean).join("\n");
    const button = $("[data-next]");
    button.disabled = true;
    const ok = await window.sendInquiry(
      { sluzba: "Půjčovna lešení", jmeno: field("jmeno").value.trim(), telefon: field("telefon").value.trim(), misto: field("misto").value.trim(), zprava: lines, web: field("web").value },
      root.dataset.to,
      status,
    );
    button.disabled = false;
    if (ok) status.textContent = "Díky, poptávka odešla. Ozveme se s nabídkou co nejdřív.";
  });

  update();
  show(1);
})();
