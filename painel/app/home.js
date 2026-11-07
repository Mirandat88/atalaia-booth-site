// Tela de espera (Etapa 06): abertura com obturador + REC, relógio, menu, tela cheia, fundo animado.
// Sem evento ativo: logo + QR do WhatsApp. Com evento ativo: câmera da logo + frase do evento (tela do convidado).
(() => {
  const home = $("home");
  let fullscreen = false;

  // ===================== abertura: obturador fecha, REC conta, obturador abre =====================

  /**
   * Obturador que fecha e abre a tela inteira. Abertura do app: com REC contando (~2,3 s).
   * Fim da sessão: nas cores do tema, sem REC; onClosed roda com a tela fechada (troca o que aparece ao abrir).
   */
  function screenShutter({ blades, line, withRec = true, hold = 1300, onClosed } = {}) {
    blades ??= THEMES.visualize.blades; // abertura do app: cores da marca
    line ??= THEMES.visualize.vars.accent;
    const c = document.createElement("canvas"), g = c.getContext("2d");
    c.className = "intro";
    document.body.append(c);
    const W = (c.width = innerWidth * devicePixelRatio), H = (c.height = innerHeight * devicePixelRatio);
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2 + 4, px = devicePixelRatio;
    const CLOSE = 520, HOLD = hold, OPEN = 480;
    const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
    const t0 = performance.now();
    let closed = false, finish;
    const done = new Promise(r => (finish = r));

    // íris de 6 lâminas: hexágono aberto no meio; cada lâmina é a borda que sai de um vértice, girando enquanto fecha
    function iris(r, seeThrough) {
      const spin = (1 - r / R) * Math.PI / 3;
      const pts = [...Array(6)].map((_, k) => {
        const a = spin + k * Math.PI / 3 - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      g.clearRect(0, 0, W, H);
      // cada lâmina: raio que sai de um vértice passando pelo anterior + continuação do raio vizinho
      const dir = k => {
        const [x, y] = pts[k], [nx, ny] = pts[(k + 1) % 6], len = Math.hypot(x - nx, y - ny);
        return len > 1 ? [(x - nx) / len, (y - ny) / len] : [Math.cos(k * Math.PI / 3 + spin), Math.sin(k * Math.PI / 3 + spin)];
      };
      const far = (k, from) => [pts[from][0] + dir(k)[0] * R * 2, pts[from][1] + dir(k)[1] * R * 2];
      for (let k = 0; k < 6; k++) {
        const k1 = (k + 1) % 6, [ax, ay] = pts[k1], [bx, by] = far(k, k1), [cx2, cy2] = far(k1, k1);
        const shade = g.createLinearGradient(ax, ay, (bx + cx2) / 2, (by + cy2) / 2);
        shade.addColorStop(0, blades[k % 2]);
        shade.addColorStop(1, "#0b0a09");
        g.fillStyle = shade;
        g.beginPath();
        g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx2, cy2);
        g.closePath();
        g.fill();
      }
      if (!seeThrough && r > 1) { // fechando: dentro da lente é escuro
        g.fillStyle = "#050505";
        g.beginPath();
        pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.fill();
      }
      g.strokeStyle = line;
      g.globalAlpha = .6;
      g.lineWidth = 1.2 * px;
      for (let k = 0; k < 6; k++) {
        const k1 = (k + 1) % 6, [bx, by] = far(k, k1);
        g.beginPath();
        g.moveTo(pts[k1][0], pts[k1][1]);
        g.lineTo(bx, by);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    function rec(ms) {
      const frames = Math.floor(ms / 1000 * 30);
      const tc = `00:00:${String(Math.floor(frames / 30)).padStart(2, "0")}:${String(frames % 30).padStart(2, "0")}`;
      g.font = `500 ${18 * px}px Jost, sans-serif`;
      g.textBaseline = "middle";
      const label = "REC  " + tc, w = g.measureText(label).width + 26 * px;
      if (Math.floor(ms / 400) % 2 === 0) { // ponto vermelho piscando
        g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--rec").trim() || "#BE2D24";
        g.beginPath();
        g.arc(cx - w / 2 + 8 * px, cy, 8 * px, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#F4EFE6";
      g.fillText(label, cx - w / 2 + 26 * px, cy);
    }

    function frame(now) {
      const t = now - t0;
      if (t < CLOSE) iris(R * (1 - ease(t / CLOSE)), false);
      else if (t < CLOSE + HOLD) {
        iris(0, false);
        if (!closed) { closed = true; onClosed?.(); }
        if (withRec) rec(t - CLOSE);
      }
      else if (t < CLOSE + HOLD + OPEN) iris(R * ease((t - CLOSE - HOLD) / OPEN), true);
      else { c.remove(); finish(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return done;
  }
  const intro = () => { $("intro")?.remove(); screenShutter(); };
  /** Fim da sessão: obturador nas cores do tema do evento, que volta para a tela do evento. */
  window.sessionShutter = onClosed => screenShutter({ blades: theme.blades, line: theme.vars.accent, withRec: false, hold: 450, onClosed });

  // ===================== tema: fundo animado, cores, contornos e logo =====================

  const bg = $("homeBg"), bgc = bg.getContext("2d");
  let theme = null, draw = null, last = 0;
  function setTheme(key) {
    const t = THEMES[key] ?? THEMES.visualize;
    if (t === theme) return;
    theme = t;
    home.dataset.theme = key in THEMES ? key : "visualize";
    for (const [k, v] of Object.entries(t.vars)) home.style.setProperty("--h-" + k, v);
    home.style.setProperty("--h-font", t.font);
    t.sansFont ? home.style.setProperty("--sans", t.sansFont) : home.style.removeProperty("--sans"); // tema personalizado: fonte dos textos
    $("homeIcons").innerHTML = t.icons.map((svg, i) => svg.replace("<svg ", `<svg class="hi hi${i + 1}" `)).join("");
    document.querySelector(".home-cam").src = brandImg(t.dark ? "iconDark" : "icon");
    draw = themeParticles(t);
  }
  setTheme("visualize");
  /** A marca mudou (cores, logos): redesenha o tema que está na tela. */
  window.refreshTheme = () => { const k = home.dataset.theme; theme = null; setTheme(k); };
  function bgFrame(now) {
    if (!home.hidden && now - last > 33) { // ~30 quadros por segundo bastam
      const dt = Math.min(.1, (now - last) / 1000);
      last = now;
      draw(bgc, (bg.width = innerWidth), (bg.height = innerHeight), dt, now / 1000);
    }
    requestAnimationFrame(bgFrame);
  }
  requestAnimationFrame(bgFrame);

  // ===================== relógio =====================

  function clock() {
    const now = new Date();
    $("homeClock").textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    // tela do evento: “27/10/2026 · 09:52”; tela de espera: data por extenso
    $("homeDate").dataset.short = now.toLocaleDateString("pt-BR") + " · " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    $("homeDate").textContent = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  }
  clock();
  setInterval(clock, 1000);

  // ===================== abrir / fechar =====================

  /** Tela de espera (guest = false) ou tela do evento ativo (guest = true). */
  window.showHome = (guest = false) => {
    if (!guest) { setTheme("visualize"); InstaPanel.close(); } // a tela de espera é sempre Visualize
    home.classList.toggle("guest", guest);
    home.hidden = false;
  };
  $("homeMenu").onclick = () => { GuestSession.cancel(); Gallery.close(); InstaPanel.close(); home.hidden = true; showTab(tab); };
  $("railHome").onclick = () => showHome();

  // ===================== tela do evento (abre pelo nome do evento em Eventos) =====================

  let guestId = null, guestEv = null, shutterAt = 0;

  // tela de espera com evento ativo: botão para voltar ao evento e, no cantinho, sessões e impressões
  let activeEv = null, counters = null;
  const plural = (n, um, varios) => `${(n ?? 0).toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  function refreshActive() {
    $("homeBackEv").hidden = !activeEv;
    $("homeEvInfo").hidden = !activeEv;
    const count = `${plural(counters?.sessions, "sessão", "sessões")} · ${plural(counters?.copies, "impressão", "impressões")}`;
    if (activeEv) $("homeEvInfo").textContent = `${activeEv.name} · ${count}`;
    $("homeEvCount").textContent = activeEv ? count : ""; // tela do evento: embaixo no meio, sem o nome
  }
  $("homeBackEv").onclick = () => activeEv && showGuest(activeEv);
  function setPhrase(text) {
    const p = $("homePhrase");
    p.replaceChildren(...text.split(/\s+/).filter(Boolean).map((w, i) => {
      const s = document.createElement("span");
      s.textContent = w;
      s.style.setProperty("--i", i);
      return s;
    }));
    p.classList.remove("in");
    void p.offsetWidth; // recomeça a animação de entrada
    p.classList.add("in");
  }
  window.guestEvent = () => guestEv; // evento que está na tela (galeria usa)
  window.showGuest = ev => {
    guestId = ev.id;
    guestEv = ev;
    send({ type: "layouts.list" }); // layouts atualizados para a sessão
    setTheme(ev.theme || "visualize");
    setPhrase(ev.phrase || "");
    $("homeEvName").textContent = ev.name;
    showHome(true);
    if (ev.product === "instaprint") InstaPanel.open(ev); else InstaPanel.close(); // InstaPrint: a tela do evento é o painel de aprovação
    shutterAt = performance.now() + 2500;
  };
  // tocar na tela do evento começa a sessão de fotos (próxima parte da Etapa 06)
  document.querySelector(".home-guest").onclick = () => guestEv && GuestSession.start(guestEv);

  // obturador na lente da câmera da logo: fecha e abre de tempos em tempos
  const LENS = { x: 412.8, y: 260.6, r: 110 }, CYCLE = 10000; // LENS: anel maior da lente (medido na logo)
  function lens(open) { // 1 = aberto, 0 = fechado
    const R = LENS.r, r = R * 1.25 * open, spin = (1 - open) * Math.PI / 3;
    const pts = [...Array(6)].map((_, k) => {
      const a = spin + k * Math.PI / 3 - Math.PI / 2;
      return [LENS.x + r * Math.cos(a), LENS.y + r * Math.sin(a)];
    });
    const dir = k => {
      const [x, y] = pts[k], [nx, ny] = pts[(k + 1) % 6], len = Math.hypot(x - nx, y - ny);
      return len > .01 ? [(x - nx) / len, (y - ny) / len] : [Math.cos(k * Math.PI / 3 + spin), Math.sin(k * Math.PI / 3 + spin)];
    };
    let svg = "";
    for (let k = 0; k < 6 && open < 1; k++) {
      const k1 = (k + 1) % 6, [ax, ay] = pts[k1], [dx, dy] = dir(k), [ex, ey] = dir(k1);
      svg += `<path d="M${ax} ${ay}L${ax + dx * R * 3} ${ay + dy * R * 3}L${ax + ex * R * 3} ${ay + ey * R * 3}Z" fill="${theme.blades[k % 2]}" stroke="${theme.vars.accent}" stroke-opacity=".7" stroke-width="1.5"/>`;
    }
    $("lensBlades").innerHTML = svg;
  }
  function shutter(now) {
    if (!home.hidden && home.classList.contains("guest")) {
      if (now > shutterAt + 2300) shutterAt = now + CYCLE;
      const t = now - shutterAt; // fecha 800 ms, fica fechado 400 ms, abre 1100 ms (devagar)
      const e = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
      lens(t < 0 ? 1 : t < 800 ? 1 - e(t / 800) : t < 1200 ? 0 : e((t - 1200) / 1100));
    }
    requestAnimationFrame(shutter);
  }
  requestAnimationFrame(shutter);
  $("homeFull").onclick = () => send({ type: "fullscreen", on: !fullscreen });
  document.addEventListener("keydown", e => {
    if (e.key === "F11") { e.preventDefault(); send({ type: "fullscreen", on: !fullscreen }); }
    if (e.key === "Escape" && fullscreen) send({ type: "fullscreen", on: false });
  });

  host?.addEventListener("message", e => {
    const m = e.data;
    switch (m.type) {
      case "events":
        activeEv = m.list.find(e => e.id === m.activeId) ?? null;
        refreshActive();
        break;
      case "counters": counters = m.counters; refreshActive(); break;
      case "home":
        $("homeQrPhone").textContent = m.phone;
        $("homeQr").innerHTML = $("homeQrMini").innerHTML = m.qr;
        break;
      case "event": // o evento da tela foi desativado ou encerrado: volta para a tela de espera
        counters = m.active ? m.counters : null;
        $("runGalleryQr").innerHTML = $("runLiveQr").innerHTML = $("homeLiveQr").innerHTML = m.galleryQr ?? "";
        $("runGallery").hidden = $("runLiveQrBox").hidden = $("homeLive").hidden = !m.galleryQr;
        refreshActive();
        if (guestId && !m.active && home.classList.contains("guest")) { GuestSession.cancel(); guestId = null; home.classList.remove("guest"); }
        break;
      case "fullscreen":
        fullscreen = m.on;
        $("homeFull").classList.toggle("on", m.on);
        $("homeFull").title = m.on ? "Sair da tela cheia (Esc)" : "Tela cheia (F11)";
        break;
    }
  });

  intro();
  send({ type: "event.get" }); // contadores do evento ativo para o cantinho da tela de espera
})();
