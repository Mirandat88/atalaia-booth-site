// InstaPrint (Etapa 10): Configurações → InstaPrint e o painel do evento InstaPrint (aprovar, ajustar o par, imprimir).
// A busca na Meta, os arquivos e a impressão ficam no app (MainForm.InstaPrint.cs).
(() => {
  // ===================== Configurações → InstaPrint =====================

  const pollLabel = () => ($("igPoll").nextElementSibling.textContent = $("igPoll").value + " s");
  function renderSettings(s) {
    if (document.activeElement !== $("igAppId")) $("igAppId").value = s.appId || "";
    $("igSecret").placeholder = s.hasSecret ? "guardada (cole só para trocar)" : "cole a chave secreta do app";
    $("igToken").placeholder = s.hasToken ? "guardado (cole só para trocar)" : "EAA… (token do Graph API Explorer)";
    $("igPoll").value = s.pollSeconds; pollLabel();
    $("igCarousel").checked = s.includeCarousel;
    const exp = s.tokenExpires ? new Date(s.tokenExpires) : null, days = exp ? Math.floor((exp - Date.now()) / 864e5) : null;
    $("igStatus").innerHTML = [
      s.igUserId ? `<b>Conta:</b> ${s.igUsername ? "@" + s.igUsername : "id " + s.igUserId}` : "<b>Conta:</b> ainda não escolhida",
      !s.hasToken ? "<b>Token:</b> falta" : exp ? `<b>Token:</b> vale até ${exp.toLocaleDateString("pt-BR")}${days < 7 ? ` <em class="warn">(faltam ${Math.max(0, days)} dias — gere um novo)</em>` : ""}` : "<b>Token:</b> guardado",
      `<b>Chave secreta:</b> ${s.hasSecret ? "guardada" : "falta"}`,
    ].map(t => `<p>${t}</p>`).join("");
    $("igStatus").classList.toggle("ok", !!(s.igUserId && s.hasToken));
  }
  const saveSettings = (extra = {}) => send({
    type: "insta.save", appId: $("igAppId").value.trim(), appSecret: $("igSecret").value.trim() || null, token: $("igToken").value.trim() || null,
    pollSeconds: +$("igPoll").value, includeCarousel: $("igCarousel").checked, ...extra,
  });
  $("igSave").onclick = () => { saveSettings(); $("igSecret").value = $("igToken").value = ""; };
  $("igPoll").oninput = pollLabel;
  $("igPoll").onchange = () => saveSettings();
  $("igCarousel").onchange = () => saveSettings();
  $("igImport").onclick = () => {
    if (confirm("Trazer do Visualize Instaprint (app antigo) o app da Meta, a conta e o token?\n\nA chave e o token ficam guardados criptografados neste PC."))
      send({ type: "insta.import" });
  };
  $("igExchange").onclick = () => { send({ type: "insta.exchange", token: $("igToken").value.trim() || null }); $("igToken").value = ""; };
  $("igCheck").onclick = () => send({ type: "insta.check" });
  $("igFind").onclick = () => send({ type: "insta.accounts" });
  $("igAccounts").onchange = () => {
    const o = $("igAccounts").selectedOptions[0];
    if (o?.value) send({ type: "insta.useAccount", id: o.value, username: o.dataset.u });
  };
  $("igTest").onclick = () => send({ type: "insta.test", hashtag: $("igTestTag").value });

  // ===================== painel do evento InstaPrint =====================

  const panel = $("instaPanel");
  let ev = null, state = null, layouts = [], assetsRoot = "", adj = {}, swap = false, drawing = false, again = false;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function open(e) {
    ev = e;
    panel.hidden = false;
    $("home").classList.add("insta");
    $("ipTag").textContent = "#" + (e.hashtag || "");
    send({ type: "layouts.list" });
    send({ type: "insta.state" });
  }
  function close() {
    panel.hidden = true;
    $("home").classList.remove("insta");
    ev = null;
  }

  /** Layout da folha: o polaroide (ou o padrão) do evento. */
  function layoutOf() {
    const ids = ev?.layouts ?? [];
    const list = ids.map(id => layouts.find(l => l.id === id)).filter(Boolean);
    return list.find(l => l.id === ev.defaultLayout && l.format === "polaroid") ?? list.find(l => l.format === "polaroid") ?? list[0] ?? null;
  }
  const need = l => (l.format === "polaroid" ? 2 : Math.max(1, l.slots.length));

  // fila: fotos aprovadas e ainda não impressas, na ordem em que foram aprovadas
  const queue = () => (state?.posts ?? []).flatMap(p => p.photos.filter(f => f.status === "aprovada").map(f => ({ ...f, post: p })))
    .sort((a, b) => new Date(a.approvedAt) - new Date(b.approvedAt));

  function render() {
    if (!state || !ev) return;
    const posts = state.posts ?? [], all = posts.flatMap(p => p.photos);
    $("ipStatus").textContent = `${state.error ? "⚠ " : ""}${state.status || "Buscando…"}${state.last ? ` · última busca ${state.last}` : ""} · a cada ${state.every} s`;
    $("ipStatus").classList.toggle("err", !!state.error);
    $("ipCounts").innerHTML = `<span><b>${posts.length}</b> posts</span><span><b>${all.filter(f => f.status !== "nova" && f.status !== "reprovada").length}</b> aprovadas</span><span><b>${all.filter(f => f.status === "impressa").length}</b> impressas</span>`;

    // chegando: posts com fotos ainda sem decisão
    const fresh = posts.filter(p => p.photos.some(f => f.status === "nova")).reverse();
    $("ipNewCount").textContent = fresh.length;
    $("ipIncoming").replaceChildren(...fresh.map(p => {
      const card = document.createElement("article");
      card.className = "ippost";
      const many = p.photos.length > 1;
      card.innerHTML = `<div class="ipphotos${many ? " many" : ""}">${p.photos.filter(f => f.status === "nova")
        .map(f => `<label><input type="checkbox" value="${f.id}" checked><img src="${f.url}" alt=""></label>`).join("")}</div>
        <div class="ipmeta"><span>${p.time}${many ? ` · carrossel ${p.photos.length} fotos` : ""}</span><p>${esc((p.caption || "").slice(0, 120))}</p></div>
        <div class="row"><button class="f" data-a="ok">Aprovar${many ? " marcadas" : ""}</button><button class="ghost" data-a="no">Reprovar</button></div>`;
      card.querySelector("[data-a=ok]").onclick = () => {
        const ids = [...card.querySelectorAll("input:checked")].map(i => i.value);
        if (!ids.length) return toast("Marque pelo menos uma foto.", true);
        send({ type: "insta.approve", postId: p.id, photos: ids });
      };
      card.querySelector("[data-a=no]").onclick = () => send({ type: "insta.reject", postId: p.id });
      return card;
    }));
    $("ipNoNew").hidden = fresh.length > 0;

    // fila e impressas
    const q = queue();
    $("ipQueue").innerHTML = q.map((f, i) => `<img src="${f.url}" title="${i + 1}ª da fila" alt="">`).join("") || '<p class="hint">Nenhuma foto aprovada esperando.</p>';
    const printed = posts.flatMap(p => p.photos.filter(f => f.status === "impressa")).reverse().slice(0, 12);
    $("ipPrinted").innerHTML = printed.map(f => `<img src="${f.url}" alt="">`).join("") || '<p class="hint">Nada impresso ainda.</p>';
    drawSheet();
  }

  /** Folha montada com as próximas fotos da fila; o operador arrasta e dá zoom em cada uma. */
  async function drawSheet() {
    const l = layoutOf(), q = queue();
    $("ipSheetEmpty").hidden = !!(l && q.length);
    $("ipSheetBox").hidden = !(l && q.length);
    if (!l) { $("ipSheetEmpty").textContent = "Escolha um layout Polaroide para este evento (Eventos → Editar → Layouts)."; return; }
    if (!q.length) { $("ipSheetEmpty").textContent = "Assim que você aprovar fotos, a folha aparece aqui para conferir e imprimir."; return; }
    const n = need(l), picks = q.slice(0, n);
    if (swap && picks.length === 2) picks.reverse();
    $("ipPrint").textContent = picks.length < n ? `Imprimir agora (${picks.length} de ${n} — repete a foto)` : "Imprimir";
    $("ipWaiting").textContent = picks.length < n ? `Esperando mais ${n - picks.length} foto(s) aprovada(s) para completar a folha.` : "";
    $("ipSwap").hidden = picks.length < 2;
    if (drawing) { again = true; return; }
    drawing = true;
    try {
      const f = LayoutRender.FORMATS[l.format], box = $("ipSheetBox").getBoundingClientRect();
      const sheetW = f.w * (l.format === "polaroid" || l.format === "strip" ? 2 : 1);
      const scale = Math.min((box.width || 800) / sheetW, (box.height || 500) / f.h);
      const ph = picks.map(x => ({ url: x.url, ...(adj[x.id] ?? {}) }));
      const fillTo = (arr, k) => Array.from({ length: k }, (_, i) => arr[i] ?? arr[arr.length - 1]); // falta foto: repete a última
      const opts = l.format === "polaroid"
        ? { scale: scale * devicePixelRatio, sheet: true, photos: [fillTo(ph, 2)[0]], photos2: [fillTo(ph, 2)[1]] }
        : { scale: scale * devicePixelRatio, sheet: true, photos: fillTo(ph, Math.max(1, l.slots.length)) };
      const c = await LayoutRender.render(l, assetsRoot + l.id + "/", opts);
      c.style.width = Math.round(c.width / devicePixelRatio) + "px";
      c.id = "ipCanvas";
      $("ipSheetBox").replaceChildren(c);
      hookDrag(c, l, picks, scale);
    } finally {
      drawing = false;
      if (again) { again = false; drawSheet(); }
    }
  }

  /** Arrastar move a foto dentro do quadro; a roda do mouse (ou os botões) dá zoom. */
  function hookDrag(c, l, picks, scale) {
    const f = LayoutRender.FORMATS[l.format];
    const hit = (x, y) => { // qual foto está debaixo do ponteiro
      if (l.format === "polaroid") { const half = x < f.w * scale ? 0 : 1; return { i: half, slot: l.slots[0], ox: half * f.w * scale }; }
      const k = l.slots.findIndex(s => x >= s.x * scale && x <= (s.x + s.w) * scale && y >= s.y * scale && y <= (s.y + s.h) * scale);
      return k < 0 ? null : { i: Math.min(k, picks.length - 1), slot: l.slots[k], ox: 0 };
    };
    let drag = null;
    c.onpointerdown = e => {
      const r = c.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      if (!h || !picks[h.i]) return;
      drag = { id: picks[h.i].id, x: e.clientX, y: e.clientY, w: h.slot.w * scale, hgt: h.slot.h * scale, start: { ...(adj[picks[h.i].id] ?? {}) } };
      c.setPointerCapture(e.pointerId);
    };
    c.onpointermove = e => {
      if (!drag) return;
      adj[drag.id] = { ...drag.start, dx: (drag.start.dx || 0) + (e.clientX - drag.x) / drag.w, dy: (drag.start.dy || 0) + (e.clientY - drag.y) / drag.hgt };
      requestAnimationFrame(drawSheet);
    };
    c.onpointerup = () => (drag = null);
    c.onwheel = e => {
      const r = c.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      if (!h || !picks[h.i]) return;
      e.preventDefault();
      zoomBy(picks[h.i].id, e.deltaY < 0 ? 1.08 : 1 / 1.08);
    };
    $("ipZoom").innerHTML = picks.map((p, i) => `<div><span>${l.format === "polaroid" ? (i ? "Direita" : "Esquerda") : "Foto " + (i + 1)}</span>
      <button data-z="${p.id}" data-k="0.9">−</button><button data-z="${p.id}" data-k="1.1">+</button><button class="ghost" data-r="${p.id}">Centralizar</button></div>`).join("");
    $("ipZoom").querySelectorAll("[data-z]").forEach(b => (b.onclick = () => zoomBy(b.dataset.z, +b.dataset.k)));
    $("ipZoom").querySelectorAll("[data-r]").forEach(b => (b.onclick = () => { delete adj[b.dataset.r]; drawSheet(); }));
  }
  function zoomBy(id, k) {
    const a = adj[id] ?? {};
    adj[id] = { ...a, zoom: Math.min(4, Math.max(1, (a.zoom || 1) * k)) };
    drawSheet();
  }

  $("ipSwap").onclick = () => { swap = !swap; drawSheet(); };
  $("ipFetch").onclick = () => { send({ type: "insta.fetch" }); toast("Buscando a hashtag…"); };
  $("ipGallery").onclick = () => Gallery.open(ev);
  $("ipPrint").onclick = async () => {
    const l = layoutOf(), q = queue();
    if (!l || !q.length) return;
    const n = need(l), picks = q.slice(0, n);
    if (swap && picks.length === 2) picks.reverse();
    const ph = picks.map(x => ({ url: x.url, ...(adj[x.id] ?? {}) }));
    const fillTo = (arr, k) => Array.from({ length: k }, (_, i) => arr[i] ?? arr[arr.length - 1]);
    $("ipPrint").disabled = true;
    try {
      const opts = l.format === "polaroid" ? { scale: 1, sheet: true, photos: [fillTo(ph, 2)[0]], photos2: [fillTo(ph, 2)[1]] }
        : { scale: 1, sheet: true, photos: fillTo(ph, Math.max(1, l.slots.length)) };
      const sheet = await LayoutRender.render(l, assetsRoot + l.id + "/", opts);
      send({ type: "insta.print", photos: picks.map(p => p.id), format: l.format === "polaroid" ? "polaroid" : l.format, png: sheet.toDataURL("image/png"), background: l.background });
      swap = false;
      for (const p of picks) delete adj[p.id];
    } finally {
      setTimeout(() => ($("ipPrint").disabled = false), 1500);
    }
  };

  host?.addEventListener("message", e => {
    const m = e.data;
    switch (m.type) {
      case "instaSettings": renderSettings(m.settings); break;
      case "instaAccounts":
        $("igAccounts").hidden = false;
        $("igAccounts").innerHTML = '<option value="">Escolha a conta…</option>' + m.list.map(a => `<option value="${a.igId}" data-u="${esc(a.igUsername)}">@${esc(a.igUsername)} — ${esc(a.page)}</option>`).join("");
        if (!m.list.length) toast("Nenhuma conta Instagram profissional ligada às suas Páginas do Facebook.", true);
        break;
      case "instaState":
        state = m.active ? m : null;
        if (!m.active && ev) close();
        render();
        break;
      case "instaPrinted": toast(m.pdf ? "PDF salvo: " + m.pdf : "Imprimindo… corte no meio e entregue os polaroides."); break;
      case "layouts": layouts = m.list; assetsRoot = m.assetsRoot; if (ev) drawSheet(); break;
    }
  });
  window.addEventListener("resize", () => ev && drawSheet());
  document.addEventListener("screen", e => { if (e.detail === "insta") send({ type: "insta.get" }); });

  window.InstaPanel = { open, close };
})();
