// Sessão de fotos do convidado (Etapa 06): toca na tela do evento → (escolhe o layout) → frases, contagem e foto,
// uma por janela do layout, podendo refazer cada foto → “como ficou” → Imprimir ou Concluir → agradecimento → logo.
// Frases: evento (Frases da sessão). Tempos: Configurações → Sessão. Cores e fontes: tema do evento.
(() => {
  const run = $("guestRun");
  let layouts = [], assetsRoot = "", live = false, showLive = false, waiting = null, token = 0; // showLive: câmera na tela só durante as fotos

  // ---------- peças ----------

  let tuned = null; // tempo médio ligado: frases e “ver a foto” calculados para o nº de fotos do layout
  const T = () => ({ countdown: 3, phrase: 2.5, review: 4, final: 30, thanks: 8, ...state.session, ...tuned }); // segundos
  const pause = ms => new Promise(r => setTimeout(r, ms));
  class Cancelled extends Error {}
  const alive = t => { if (t !== token) throw new Cancelled(); }; // sessão encerrada no meio: para tudo

  function show(part) {
    run.dataset.part = part;
    for (const el of run.querySelectorAll("[data-part]")) el.hidden = el.dataset.part !== part;
  }

  /** Pergunta “refazer?” aberta: a sessão para aqui até o convidado decidir. */
  async function holdForRedo(t) {
    while (redoAsk) await redoAsk.done;
    alive(t);
  }

  /** Uma frase grande no meio da tela (vazia = pula). */
  async function say(t, text, seconds = T().phrase) {
    await holdForRedo(t);
    if (!text) return;
    show("say");
    const p = $("runSay");
    p.textContent = text;
    p.classList.remove("in"); void p.offsetWidth; p.classList.add("in");
    await pause(seconds * 1000); alive(t);
  }

  async function countdown(t, smile) {
    const n = T().countdown;
    await holdForRedo(t);
    show("count");
    for (let k = n; k > 0; k--) {
      if (redoAsk) { await holdForRedo(t); show("count"); k = n + 1; continue; } // tocou na miniatura: a contagem recomeça depois
      const c = $("runCount");
      c.textContent = k;
      c.classList.remove("tick"); void c.offsetWidth; c.classList.add("tick");
      await pause(1000); alive(t);
    }
    show("say");
    $("runSay").textContent = smile || "";
    $("runSay").classList.remove("in"); void $("runSay").offsetWidth; $("runSay").classList.add("in");
  }

  /** Dispara a câmera e espera a foto (url). Os testes trocam GuestSession.capture por uma foto falsa. */
  function capture() {
    return new Promise((resolve, reject) => {
      waiting = { resolve, reject };
      send({ type: "capture" }); // sem foco no disparo: o foco foi feito na montagem (aba Câmera)
    });
  }

  function flash() {
    const f = $("runFlash");
    f.style.transition = "none"; f.style.opacity = 1;
    requestAnimationFrame(() => { f.style.transition = "opacity .7s"; f.style.opacity = 0; });
  }

  // ----- miniatura do layout no canto: as fotos aceitas vão entrando nas janelas -----
  const mini = { layout: null, assets: "", photos: [], s: 1 };
  async function drawMini() {
    const f = LayoutRender.FORMATS[mini.layout.format];
    // cabe na lateral da moldura (deitada: coluna à direita; em pé: faixa embaixo), ao lado do QR das fotos ao vivo
    const side = run.querySelector(".run-side"), box = side.getBoundingClientRect();
    const qr = $("runLiveQrBox").hidden ? { width: 0, height: 0 } : $("runLiveQrBox").getBoundingClientRect();
    const row = getComputedStyle(side).flexDirection === "row";
    const w = row ? box.width - qr.width - 60 : box.width * .8, h = row ? box.height * .92 : box.height - qr.height - 50;
    mini.s = Math.max(.05, Math.min(h / f.h, w / f.w));
    const c = await LayoutRender.render(mini.layout, mini.assets, { scale: mini.s * devicePixelRatio, photos: mini.photos });
    c.style.width = Math.round(f.w * mini.s) + "px";
    $("runMini").querySelector("canvas")?.remove();
    $("runMini").prepend(c);
  }
  /** Onde fica a janela i da miniatura na tela. */
  function slotRect(i) {
    const c = $("runMini").querySelector("canvas").getBoundingClientRect(), sl = mini.layout.slots[i];
    return { x: c.left + sl.x * mini.s, y: c.top + sl.y * mini.s, w: sl.w * mini.s, h: sl.h * mini.s };
  }
  function markSlot(i) { // contorno piscando na janela da próxima foto
    const now = $("runMiniNow");
    if (i == null || !mini.layout.slots[i]) { now.hidden = true; return; }
    const sl = mini.layout.slots[i], s = mini.s;
    Object.assign(now.style, { left: sl.x * s + "px", top: sl.y * s + "px", width: sl.w * s + "px", height: sl.h * s + "px" });
    now.hidden = false;
  }

  /** A foto entra girando e “bate” na tela, fica o tempo de rever e voa para a janela dela na miniatura. */
  async function review(t, url, i, n) {
    const secs = Math.max(T().review, .8), box = $("runShotBox"), img = $("runShot");
    show("review");
    $("runReview").classList.remove("flying");
    box.style.transition = "none"; box.style.transform = ""; box.style.opacity = "";
    img.src = url;
    await img.decode().catch(() => {});
    $("runShotNo").textContent = `Foto ${i + 1} de ${n}`;
    for (const [el, cls] of [[box, "slam"], [run, "shake"]]) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
    const bar = $("runReviewBar");
    bar.style.transition = "none"; bar.style.width = "100%";
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${secs}s linear`; bar.style.width = "0%"; }));
    await pause(secs * 1000); alive(t);
    $("runReview").classList.add("flying");
    box.classList.remove("slam");
    // voa e encaixa na janela da miniatura
    const r = box.getBoundingClientRect(), to = slotRect(i);
    const k = Math.max(to.w / r.width, to.h / r.height);
    box.style.transition = "transform .95s cubic-bezier(.55,0,.2,1), opacity .25s .8s";
    box.style.transform = `translate(${to.x + to.w / 2 - (r.left + r.width / 2)}px, ${to.y + to.h / 2 - (r.top + r.height / 2)}px) scale(${k}) rotate(0deg)`;
    box.style.opacity = "0";
    await pause(950); alive(t);
    mini.photos[i] = url;
    await drawMini(); alive(t);
  }

  // ----- refazer: tocar numa foto da miniatura abre a opção -----
  let redoQueue = [], redoAsk = null; // redoAsk: a pergunta aberta (resolve quando fecha)
  $("runMini").onclick = e => {
    e.stopPropagation();
    if (!run.dataset.on || !mini.layout) return;
    const c = $("runMini").querySelector("canvas").getBoundingClientRect();
    const x = (e.clientX - c.left) / mini.s, y = (e.clientY - c.top) / mini.s;
    const i = mini.layout.slots.findIndex(sl => x >= sl.x && x <= sl.x + sl.w && y >= sl.y && y <= sl.y + sl.h);
    if (i < 0 || !mini.photos[i] || redoQueue.includes(i)) return;
    askRedo(i);
  };
  function askRedo(i) {
    redoAsk?.close(false);
    $("runRedoImg").src = mini.photos[i];
    $("runRedoNo").textContent = `Foto ${i + 1}`;
    // ao lado da miniatura (tela deitada) ou acima dela (tela em pé, miniatura na faixa de baixo)
    const r = $("runMini").getBoundingClientRect(), below = getComputedStyle(run.querySelector(".run-side")).flexDirection === "row";
    Object.assign($("runRedo").style, below
      ? { right: "", bottom: "", left: "50%", top: "45%", translate: "-50% -50%" }
      : { left: "", bottom: "", top: "50%", translate: "0 -50%", right: innerWidth - r.left + 24 + "px" });
    $("runRedo").hidden = false;
    let timer;
    const done = new Promise(resolve => {
      const close = yes => { clearTimeout(timer); $("runRedo").hidden = true; redoAsk = null; if (yes) redoQueue.push(i); resolve(); };
      redoAsk = { close, done: null };
      timer = setTimeout(() => close(false), 8000); // sem resposta: mantém a foto
      $("runRedoYes").onclick = e => { e.stopPropagation(); close(true); };
      $("runRedoKeep").onclick = e => { e.stopPropagation(); close(false); };
    });
    redoAsk.done = done;
  }
  /** Entre uma foto e outra (e no fim): espera a pergunta aberta e refaz as fotos pedidas. true = refez alguma. */
  async function redoPending(t, n, ph, shoot) {
    for (let did = false; ; did = true) {
      await holdForRedo(t);
      if (!redoQueue.length) return did;
      const i = redoQueue.shift();
      send({ type: "session.retake" });
      dots(n, i); markSlot(i);
      await say(t, ph.prepare);
      await shoot(i);
    }
  }

  function chooseLayout(t, list) {
    show("choose");
    const box = $("runLayouts");
    box.replaceChildren();
    return new Promise(resolve => {
      for (const l of list) {
        const b = document.createElement("button");
        b.className = "runpick";
        b.innerHTML = `<div class="th"></div><b>${l.name}</b><span>${l.slots.length} foto${l.slots.length > 1 ? "s" : ""}</span>`;
        b.onclick = e => { e.stopPropagation(); resolve(l); };
        box.append(b);
        const f = LayoutRender.FORMATS[l.format], s = Math.min(260 / f.w, 300 / f.h);
        LayoutRender.render(l, assetsRoot + l.id + "/", { scale: s * devicePixelRatio })
          .then(c => { c.style.width = Math.round(f.w * s) + "px"; b.querySelector(".th").append(c); })
          .catch(() => {});
      }
    }).then(l => { alive(t); return l; });
  }

  /**
   * Tela “como ficou”: as fotos aparecem de novo, uma sobre a outra, e voam para as janelas do layout montado.
   * Depois Imprimir (se o evento imprime) ou Concluir; sem toque, conclui sozinho. true = imprimir.
   */
  async function result(t, canvas, canPrint, layout, photos, vs) {
    show("result");
    const part = $("runResultPart");
    part.classList.add("building"); // botões só depois da montagem
    $("runResult").replaceChildren(canvas);
    canvas.style.transition = "none"; canvas.style.opacity = "0";
    $("runPrint").hidden = !canPrint;
    $("runCopies").hidden = !canPrint;
    pickCopies(copies);
    const pile = $("runPile");
    pile.replaceChildren();
    const pics = [];
    for (const [i, url] of photos.entries()) { // uma a uma, batendo na tela
      const im = new Image();
      im.src = url;
      await im.decode().catch(() => {});
      im.className = "pile-ph";
      im.style.setProperty("--r", (i % 2 ? 1 : -1) * (3 + Math.random() * 5) + "deg");
      pile.append(im);
      pics.push(im);
      run.classList.remove("shake"); void run.offsetWidth; run.classList.add("shake");
      await pause(3500); alive(t); // cada foto fica 3,5 s antes da próxima
    }
    await pause(500); alive(t);
    // monta: cada foto voa para a janela dela no layout
    const c = canvas.getBoundingClientRect();
    pics.forEach((im, i) => {
      const sl = layout.slots[i], r = im.getBoundingClientRect();
      const to = { x: c.left + sl.x * vs, y: c.top + sl.y * vs, w: sl.w * vs, h: sl.h * vs };
      const k = Math.max(to.w / r.width, to.h / r.height);
      im.style.animation = "none";
      im.style.transition = `transform .85s cubic-bezier(.55,0,.2,1) ${i * .14}s, opacity .3s ${.75 + i * .14}s`;
      im.style.transform = `translate(${to.x + to.w / 2 - (r.left + r.width / 2)}px, ${to.y + to.h / 2 - (r.top + r.height / 2)}px) scale(${k}) rotate(0deg)`;
      im.style.opacity = "0";
    });
    canvas.style.transition = `opacity .45s ${.6 + pics.length * .14}s`;
    canvas.style.opacity = "1";
    await pause(1100 + pics.length * 140); alive(t);
    pile.replaceChildren();
    part.classList.remove("building");
    const secs = T().final, bar = $("runFinalBar");
    bar.style.transition = "none"; bar.style.width = "100%";
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${secs}s linear`; bar.style.width = "0%"; }));
    return new Promise(resolve => {
      const done = p => { clearTimeout(timer); $("runPrint").onclick = $("runDone").onclick = null; resolve(p); };
      const timer = setTimeout(() => done(false), secs * 1000);
      $("runPrint").onclick = e => { e.stopPropagation(); done(true); };
      $("runDone").onclick = e => { e.stopPropagation(); done(false); };
    }).then(p => { alive(t); return p; });
  }

  // ----- cópias (1 a 3), no canto de cima da tela “como ficou”; começa nas cópias do evento -----
  let copies = 1;
  function pickCopies(k) {
    copies = Math.min(3, Math.max(1, k));
    $("runCopiesN").textContent = copies;
    $("runCopiesL").textContent = copies > 1 ? "cópias" : "cópia";
    const [less, more] = $("runCopies").querySelectorAll("button");
    less.disabled = copies === 1; more.disabled = copies === 3;
  }
  $("runCopies").onclick = e => { e.stopPropagation(); const b = e.target.closest("button"); if (b) pickCopies(copies + +b.dataset.d); };

  // ----- moldura: nome do evento, data e hora em cima -----
  const clock = () => { $("runWhen").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
  setInterval(() => { if (run.dataset.on) clock(); }, 10000);

  function dots(n, i) {
    $("runDots").innerHTML = [...Array(n)].map((_, k) => `<i class="${k < i ? "ok" : k === i ? "now" : ""}"></i>`).join("");
  }

  // ---------- a sessão ----------

  async function start(ev) {
    if (run.dataset.on) return;
    const t = ++token;
    const ids = ev.layouts?.length ? ev.layouts : [];
    const list = ids.map(id => layouts.find(l => l.id === id)).filter(Boolean);
    if (!list.length) { toast("Este evento ainda não tem layout. Escolha um em Eventos → Editar.", true); return; }
    if (!state.connected && GuestSession.capture === capture) { toast("Câmera desconectada. Chame o monitor do evento.", true); return; }

    run.dataset.on = "1";
    run.hidden = false;
    $("runLogo").src = brandImg(THEMES[ev.theme]?.dark ? "logoDark" : "logo");
    $("runEvName").textContent = ev.name;
    $("runEvDate").textContent = ev.date ? ev.date.split("-").reverse().join("/") : "";
    clock();
    copies = Math.min(3, Math.max(1, ev.copiesPerSession ?? 1));
    const ph = ev.phrases ?? {};
    try {
      // vários layouts: o convidado escolhe (o padrão aparece primeiro)
      const sorted = [...list].sort((a, b) => (b.id === ev.defaultLayout) - (a.id === ev.defaultLayout));
      const layout = sorted.length > 1 ? await chooseLayout(t, sorted) : sorted[0];
      send({ type: "session.start", layout: layout.id });
      if (state.connected && !state.liveView) { live = true; send({ type: "liveview", on: true }); }

      const n = layout.slots.length, photos = [];
      tuned = null;
      if (T().target) { const f = fitSessionTimes(T(), n); tuned = { phrase: f.phrase, review: f.review }; }
      redoQueue = [];
      Object.assign(mini, { layout, assets: assetsRoot + layout.id + "/", photos: Array(n).fill(null) });
      $("runSay").textContent = ""; show("say"); // a moldura já na tela: a miniatura mede a lateral
      await drawMini(); alive(t);
      showLive = true;
      const shoot = async i => {
        await countdown(t, ph.smile);
        const url = await GuestSession.capture(); alive(t);
        flash();
        photos[i] = url;
        await review(t, url, i, n);
      };
      for (let i = 0; i < n; i++) {
        dots(n, i);
        markSlot(i);
        if (i === 0) await say(t, ph.first);
        else { await say(t, n > 1 && i === n - 1 ? ph.last : ph.next); await say(t, ph.prepare); }
        // pediu para refazer durante as frases: refaz já, antes da próxima
        if (await redoPending(t, n, ph, shoot)) { dots(n, i); markSlot(i); await say(t, ph.prepare); }
        await shoot(i);
        await redoPending(t, n, ph, shoot); // fotos que o convidado pediu para refazer (tocando na miniatura)
      }
      // última chance de refazer (inclusive a última foto): com a câmera ainda ligada, a frase “como ficou” espera
      for (;;) {
        dots(n, n);
        markSlot(null);
        if (ph.review) await say(t, ph.review);
        else { await holdForRedo(t); await pause(1500); alive(t); }
        if (!await redoPending(t, n, ph, shoot)) break;
      }
      if (live) { live = false; send({ type: "liveview", on: false }); }
      showLive = false;
      $("runLive").removeAttribute("src");

      // monta a folha com as fotos de verdade (tirinha sai duas vezes, para o corte)
      const assets = assetsRoot + layout.id + "/";
      const sheet = await LayoutRender.render(layout, assets, { scale: 1, photos, sheet: true }); alive(t);
      const f = LayoutRender.FORMATS[layout.format];
      const vs = Math.min(innerWidth * .42 / f.w, innerHeight * .66 / f.h); // px da tela por unidade do layout
      const view = await LayoutRender.render(layout, assets, { scale: vs * devicePixelRatio, photos });
      view.style.width = f.w * vs + "px"; view.style.height = f.h * vs + "px";
      const print = await result(t, view, ev.print, layout, photos, vs);
      send({ type: "session.finish", format: layout.format, png: sheet.toDataURL("image/png"), background: layout.background, print, copies });

      // agradecimento → logo com o Instagram
      const thanks = T().thanks;
      show("thanks");
      $("runThanks").textContent = ph.thanks || "";
      $("runPickup").textContent = print ? ph.pickup || "" : "";
      for (const el of [$("runThanks"), $("runPickup")]) { el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); }
      await pause(thanks * ($("runGallery").hidden ? 600 : 1500)); alive(t); // com o QR da galeria, tempo de apontar o celular
      show("logo");
      await pause(thanks * 400); alive(t);
      // obturador nas cores do tema: fecha sobre a logo e abre já na tela do evento
      await sessionShutter(() => { if (t === token) end(); });
    } catch (err) {
      if (!(err instanceof Cancelled)) { toast(err.message || "A foto não saiu. Tente de novo.", true); send({ type: "session.cancel" }); }
    } finally {
      if (t === token) end();
    }
  }

  function end() {
    if (live) { live = false; send({ type: "liveview", on: false }); }
    waiting = null;
    showLive = false;
    redoAsk?.close(false);
    redoQueue = [];
    $("runPile").replaceChildren();
    delete run.dataset.on;
    run.hidden = true;
    $("runLive").removeAttribute("src");
  }

  /** Encerrar no meio (botão discreto ✕ ou o operador abrindo o menu). */
  function cancel() {
    if (!run.dataset.on) return;
    token++;
    waiting?.reject(new Cancelled());
    send({ type: "session.cancel" });
    end();
  }

  $("runCancel").onclick = e => { e.stopPropagation(); cancel(); };
  run.onclick = e => e.stopPropagation(); // toque durante a sessão não começa outra

  host?.addEventListener("message", e => {
    const m = e.data;
    switch (m.type) {
      case "frame": if (showLive) $("runLive").src = "data:image/jpeg;base64," + m.data; break;
      case "captured": if (waiting) { waiting.resolve(m.url); waiting = null; } break;
      case "error": if (waiting) { waiting.reject(new Error("A foto não saiu: " + m.message)); waiting = null; } break;
      case "sessionSaved": if (m.printed) toast(m.pdf ? "PDF salvo: " + m.pdf : "Imprimindo…"); break;
      case "layouts": layouts = m.list; assetsRoot = m.assetsRoot; break;
    }
  });

  window.GuestSession = { start, cancel, capture };
})();
