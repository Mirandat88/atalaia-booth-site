// Configurações → Layouts: biblioteca, criar a partir de modelo, importar do computador e editor.
// O desenho fica em layout-render.js; arquivos, validação e impressão ficam no app (MainForm.Layouts.cs).
(() => {
  const LABEL = { strip: "Tirinha 5×15", landscape: "10×15 deitado", portrait: "10×15 em pé", polaroid: "Polaroide (InstaPrint)" };
  const PALETTE = ["#FFFFFF", "#F4EFE6", "#E6DED0", "#C9A96E", "#7A5C2C", "#6F675C", "#1A1917", "#0E0D0C", "#BE2D24"];
  // [valor, rótulo, largura/altura] — a proporção trava a altura ao mudar a largura
  const RATIOS = [["livre", "Livre", null], ["3:2", "3:2", 3 / 2], ["4:3", "4:3", 4 / 3], ["1:1", "1:1", 1], ["3:4", "3:4", 3 / 4], ["2:3", "2:3", 2 / 3]];
  const WEIGHTS = { serif: [[400, "Regular"], [500, "Médio"], [600, "Forte"]], sans: [[300, "Leve"], [400, "Regular"], [500, "Médio"]] };
  const MAX_PHOTOS = 4, GRID = 6, SAFE = 36; // encaixe de 0,5 mm; margem de segurança de 3 mm
  // com as fotos travadas, estas opções valem para todas as fotos do layout (a posição continua de cada uma)
  const LINKED = ["ratio", "lockRatio", "w", "h", "border", "borderColor", "radius", "filter", "rotation",
    "outline", "outlineGap", "outlineColor", "shadowBlur", "shadowDistance", "shadowOpacity", "shadowColor"];
  const SHADOW = { shadowBlur: 0, shadowDistance: 0, shadowOpacity: 40, shadowColor: "#000000" };
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${d}</svg>`;
  // o editor nunca mostra fotos reais: os quadros aparecem numerados (1, 2, 3…)
  let lib = { list: [], templates: [], assetsRoot: "", templatesRoot: "" }, ed = null;

  const F = l => LayoutRender.FORMATS[l.format];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const assetsOf = l => lib.assetsRoot + l.id + "/";
  const snap = v => Math.round(v / GRID) * GRID;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const plural = (n, word, pl = word + "s") => `${n} ${n === 1 ? word : pl}`;
  const ratioOf = key => RATIOS.find(r => r[0] === key)?.[2] ?? null;
  const on = id => $(id).classList.contains("on");
  const editing = () => ed && !$("editor").hidden && !$("tab-layouts").hidden;

  /** Completa campos que layouts antigos não têm (o app já manda os padrões; isto é só garantia). */
  function normalize(l) {
    l.linkPhotos ??= true;
    Object.assign(l, { frameWidth: 0, frameInset: 36, frameColor: "#C9A96E", frameRadius: 0, ...l });
    l.slots = l.slots.map(s => ({ ratio: "livre", lockRatio: true, z: 0, border: 0, borderColor: "#FFFFFF", radius: 0, rotation: 0, filter: "none", outline: 0, outlineGap: 12, outlineColor: "#C9A96E", ...SHADOW, ...s }));
    l.texts = l.texts.map(t => ({ weight: 0, spacing: 0, upper: false, rotation: 0, z: 0, ...SHADOW, ...t }));
    l.images = l.images.map(i => ({ rotation: 0, opacity: 100, z: 0, ...SHADOW, ...i }));
    l.overlayZ ??= 0;
    l.background2 ??= null;
    l.gradientAngle ??= 180;
    l.frameZ ??= 0;
    return l;
  }

  /** Miniatura do layout dentro de `holder`, no máximo maxW × maxH na tela. Na escolha de layouts, só os números das fotos. */
  async function thumb(layout, assets, holder, maxW, maxH, photos = []) {
    const f = F(layout), view = Math.min(maxW / f.w, maxH / f.h);
    try {
      const c = await LayoutRender.render(normalize(structuredClone(layout)), assets, { scale: view * devicePixelRatio, photos });
      c.style.width = Math.round(f.w * view) + "px";
      holder.replaceChildren(c);
    } catch (err) {
      holder.textContent = err.message;
    }
  }

  // ===================== biblioteca =====================
  // em cima, um de cada modelo pronto (toque = layout novo); embaixo, os layouts já criados num menu, o mais novo primeiro

  let forEvent = null, activeEvent = null; // nome do evento do formulário (Criar layout) / do evento ativo no app
  let picked = null; // layout escolhido no menu

  /** Nome do layout novo: o do evento (com o formato junto, se já houver um igual). Sem evento: o do modelo/arquivo. */
  function newName(format) {
    const base = (forEvent || activeEvent || "").trim();
    if (!base) return null;
    const taken = new Set(lib.list.map(l => l.name));
    let name = base, n = 2;
    if (taken.has(name)) name = `${base} · ${LABEL[format]}`;
    while (taken.has(name)) name = `${base} · ${LABEL[format]} (${n++})`;
    return name.slice(0, 80);
  }

  function renderLibrary() {
    $("layoutFor").hidden = !forEvent;
    $("layoutFor").textContent = forEvent ? `Layout para o evento “${forEvent}”: escolha um modelo ou importe a arte.` : "";
    const models = $("layoutModels");
    models.replaceChildren();
    for (const t of lib.templates) {
      const b = document.createElement("button");
      const holder = document.createElement("div");
      b.append(holder, t.name, Object.assign(document.createElement("small"), { textContent: LABEL[t.format] }));
      b.onclick = () => { send({ type: "layouts.create", template: t.key, name: newName(t.format) }); forEvent = null; };
      models.append(b);
      thumb({ format: t.format, background: t.background, backgroundImage: null, overlayImage: t.overlay, slots: t.slots, texts: t.texts, images: t.images }, lib.templatesRoot, holder, 120, 160);
    }

    const list = [...lib.list].sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    $("noLayouts").hidden = list.length > 0;
    $("layoutUsed").hidden = list.length === 0;
    if (!list.some(l => l.id === picked)) picked = list[0]?.id ?? null;
    $("layoutPick").innerHTML = list.map(l => `<option value="${l.id}">${esc(l.name)} — ${LABEL[l.format]} · ${plural(l.slots.length, "foto")}</option>`).join("");
    $("layoutPick").value = picked ?? "";
    showPicked();
  }

  function showPicked() {
    const l = lib.list.find(x => x.id === picked);
    if (!l) return $("layoutPreview").replaceChildren();
    $("layoutPickInfo").textContent = `${LABEL[l.format]} · ${plural(l.slots.length, "foto")}` + (l.updated ? ` · alterado em ${new Date(l.updated).toLocaleDateString("pt-BR")}` : "");
    thumb(l, assetsOf(l), $("layoutPreview"), 220, 300);
  }

  $("layoutPick").onchange = () => { picked = $("layoutPick").value; showPicked(); };
  const openPicked = () => picked && send({ type: "layouts.open", id: picked });
  $("lpEdit").onclick = $("layoutPreview").onclick = openPicked;
  $("lpDup").onclick = () => picked && send({ type: "layouts.duplicate", id: picked });
  $("lpDel").onclick = () => {
    const l = lib.list.find(x => x.id === picked);
    if (l && confirm(`Excluir “${l.name}”?\n\nEle vai para a Lixeira do Windows (dá para recuperar de lá).`))
      send({ type: "layouts.delete", id: l.id });
  };

  // Eventos → Criar layout: o layout novo nasce com o nome do evento
  document.addEventListener("layoutFor", e => { forEvent = e.detail; if (!ed) renderLibrary(); });

  document.querySelectorAll(".modal [data-close]").forEach(b => (b.onclick = () => (b.closest(".modal").hidden = true)));

  $("btnImportLayout").onclick = () => {
    const box = $("importFormats");
    box.replaceChildren();
    for (const [format, label] of Object.entries(LABEL)) {
      const f = LayoutRender.FORMATS[format], view = 150 / Math.max(f.w, f.h);
      const b = document.createElement("button");
      const shape = document.createElement("div");
      shape.className = "shape";
      shape.style.width = f.w * view + "px";
      shape.style.height = f.h * view + "px";
      b.append(shape, label);
      b.onclick = () => { $("modalImport").hidden = true; send({ type: "layouts.import", format, name: newName(format) }); forEvent = null; };
      box.append(b);
    }
    $("modalImport").hidden = false;
  };

  // ===================== editor =====================

  function openEditor(layout, warning) {
    const l = normalize(structuredClone(layout));
    ed = { layout: l, assets: assetsOf(l), sel: null, dirty: false, token: 0, guides: {}, history: [JSON.stringify(l)], future: [], zoom: 1 };
    $("lib").hidden = true;
    $("editor").hidden = false;
    $("edTitle").textContent = l.name;
    $("edSaved").textContent = "";
    fit();
    select(null);
    if (warning) toast(warning, true);
  }

  function closeEditor() {
    if (ed?.dirty && !confirm("Sair sem salvar as alterações?")) return;
    const closed = { id: ed.layout.id, saved: !!ed.saved };
    ed = null;
    $("editor").hidden = true;
    $("lib").hidden = false;
    send({ type: "layouts.list" });
    document.dispatchEvent(new CustomEvent("layoutClosed", { detail: closed })); // Eventos → Criar layout volta para o evento
  }

  /** Fotos travadas: copia o formato da foto `from` para as outras, mantendo o centro de cada uma. */
  function syncSlots(from) {
    if (!ed.layout.linkPhotos) return;
    for (const s of ed.layout.slots) {
      if (s === from) continue;
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      for (const k of LINKED) s[k] = from[k];
      s.x = Math.round(cx - s.w / 2);
      s.y = Math.round(cy - s.h / 2);
    }
  }

  function changed() {
    if (ed.sel?.kind === "slot") syncSlots(itemOf(ed.sel));
    ed.dirty = true;
    $("edSaved").textContent = "Não salvo";
    $("edTitle").textContent = ed.layout.name;
    draw();
    refreshPropValues();
    refreshTools();
    clearTimeout(ed.commitTimer);
    ed.commitTimer = setTimeout(commit, 350);
  }

  // ---------- desfazer / refazer ----------

  function commit() {
    if (!ed) return;
    const json = JSON.stringify(ed.layout);
    if (json !== ed.history.at(-1)) {
      ed.history.push(json);
      if (ed.history.length > 100) ed.history.shift();
      ed.future = [];
    }
    refreshTools();
  }

  function restore(json) {
    ed.layout = JSON.parse(json);
    ed.dirty = true;
    $("edSaved").textContent = "Não salvo";
    $("edTitle").textContent = ed.layout.name;
    select(null);
    fit();
  }

  function undo() {
    clearTimeout(ed.commitTimer);
    commit();
    if (ed.history.length < 2) return;
    ed.future.push(ed.history.pop());
    restore(ed.history.at(-1));
  }

  function redo() {
    if (!ed.future.length) return;
    const json = ed.future.pop();
    ed.history.push(json);
    restore(json);
  }

  // ---------- desenho e caixas ----------

  function fit() {
    if (!ed) return;
    const st = $("edStage").getBoundingClientRect(), f = F(ed.layout);
    $("edNote").textContent = ed.layout.format === "strip" ? "Tirinha: na impressão a folha 10×15 sai com duas tiras iguais lado a lado (👁 Visualizar mostra a folha)." : "";
    const free = { w: st.width - 60, h: st.height - $("edStage").querySelector(".ed-bar").offsetHeight - $("edNote").offsetHeight - 50 };
    // zoom 1 = a folha inteira cabe na tela; acima disso a área rola (para encaixar detalhes de moldura)
    ed.view = Math.max(0.05, Math.min(free.w / f.w, free.h / f.h)) * ed.zoom;
    $("edZoomFit").textContent = Math.round(ed.zoom * 100) + "%";
    $("edCanvasWrap").style.width = Math.round(f.w * ed.view) + "px";
    $("edCanvasWrap").style.height = Math.round(f.h * ed.view) + "px";
    draw();
    refreshTools();
  }
  addEventListener("resize", fit);

  /** Zoom mantendo no lugar o ponto da folha que está sob o mouse (ou no centro da tela). */
  function setZoom(z, at) {
    if (!ed) return;
    const sc = $("edScroll"), wrap = $("edCanvasWrap"), old = ed.view;
    const px = at ? at.x : sc.clientWidth / 2, py = at ? at.y : sc.clientHeight / 2;
    const lx = (sc.scrollLeft + px - wrap.offsetLeft) / old, ly = (sc.scrollTop + py - wrap.offsetTop) / old;
    ed.zoom = Math.min(8, Math.max(1, z));
    fit();
    sc.scrollLeft = lx * ed.view + wrap.offsetLeft - px;
    sc.scrollTop = ly * ed.view + wrap.offsetTop - py;
  }
  $("edZoomIn").onclick = () => setZoom(ed.zoom * 1.5);
  $("edZoomOut").onclick = () => setZoom(ed.zoom / 1.5);
  $("edZoomFit").onclick = () => setZoom(1);
  $("edScroll").addEventListener("wheel", e => {
    if (!e.ctrlKey) return; // sem Ctrl, a roda rola a folha
    e.preventDefault();
    const r = $("edScroll").getBoundingClientRect();
    setZoom(ed.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });

  // desenha fora da tela e só troca se for o pedido mais recente (arrastar gera muitos pedidos seguidos)
  async function draw() {
    if (!ed) return;
    const token = ++ed.token, f = F(ed.layout);
    boxes();
    try {
      const off = await LayoutRender.render(ed.layout, ed.assets, { scale: ed.view * devicePixelRatio });
      if (!ed || token !== ed.token) return;
      const c = $("edCanvas");
      c.width = off.width;
      c.height = off.height;
      c.style.width = Math.round(f.w * ed.view) + "px";
      c.getContext("2d").drawImage(off, 0, 0);
    } catch (err) {
      toast(err.message, true);
    }
  }

  const listOf = kind => ({ slot: ed.layout.slots, text: ed.layout.texts, image: ed.layout.images })[kind];
  const itemOf = sel => sel && listOf(sel.kind)[sel.i];
  const heightOf = (kind, item) => (kind === "text" ? Math.round(item.size * 1.25) : item.h);

  /** Caixas clicáveis por cima do desenho: selecionar, arrastar e redimensionar. */
  function boxes() {
    const layer = $("edBoxes"), v = ed.view, f = F(ed.layout);
    layer.replaceChildren();
    if (on("edSafe")) {
      const safe = document.createElement("div");
      safe.className = "safe";
      Object.assign(safe.style, { left: SAFE * v + "px", top: SAFE * v + "px", width: (f.w - 2 * SAFE) * v + "px", height: (f.h - 2 * SAFE) * v + "px" });
      layer.append(safe);
    }
    for (const { kind, i } of LayoutRender.stackOf(ed.layout)) {
      if (kind === "overlay" || kind === "frame") continue; // moldura e contorno não são clicáveis
      {
        const item = listOf(kind)[i];
        const b = document.createElement("div");
        b.className = "box" + (ed.sel?.kind === kind && ed.sel.i === i ? " sel" : "");
        Object.assign(b.style, {
          left: item.x * v + "px", top: item.y * v + "px", width: item.w * v + "px", height: heightOf(kind, item) * v + "px",
          transform: item.rotation ? `rotate(${item.rotation}deg)` : "",
        });
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = kind === "slot" ? `FOTO ${i + 1}` : kind === "text" ? "TEXTO" : "IMAGEM";
        const rz = document.createElement("span");
        rz.className = "rz";
        b.append(tag, rz);
        b.onpointerdown = e => drag(e, kind, i, e.target === rz ? "resize" : "move");
        layer.append(b);
      }
    }
    for (const dir of ["v", "h"]) {
      if (!ed.guides[dir]) continue;
      const g = document.createElement("div");
      g.className = "guide " + dir;
      g.style[dir === "v" ? "left" : "top"] = (dir === "v" ? f.w : f.h) / 2 * v + "px";
      layer.append(g);
    }
  }

  function drag(e, kind, i, mode) {
    e.preventDefault();
    e.stopPropagation();
    if (!(ed.sel?.kind === kind && ed.sel.i === i)) select({ kind, i });
    const item = itemOf(ed.sel), f = F(ed.layout);
    const start = { x: e.clientX, y: e.clientY, ix: item.x, iy: item.y, iw: item.w, ih: item.h };
    const aspect = kind === "image" ? item.w / item.h : kind === "slot" && item.lockRatio ? ratioOf(item.ratio) ?? item.w / item.h : null;
    const move = ev => {
      const dx = (ev.clientX - start.x) / ed.view, dy = (ev.clientY - start.y) / ed.view;
      ed.guides = {};
      if (mode === "move") {
        let x = snap(start.ix + dx), y = snap(start.iy + dy);
        const w = item.w, h = heightOf(kind, item);
        // encaixa no centro da folha (linha vermelha)
        if (Math.abs(x + w / 2 - f.w / 2) < 12) { x = Math.round(f.w / 2 - w / 2); ed.guides.v = true; }
        if (Math.abs(y + h / 2 - f.h / 2) < 12) { y = Math.round(f.h / 2 - h / 2); ed.guides.h = true; }
        item.x = x;
        item.y = y;
      } else {
        item.w = Math.min(Math.round(f.w * 1.2), Math.max(30, snap(start.iw + dx)));
        if (aspect) item.h = Math.round(item.w / aspect); // proporção travada (foto com proporção, logo)
        else if (kind === "slot") item.h = Math.max(30, snap(start.ih + dy));
      }
      changed();
    };
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      ed.guides = {};
      boxes();
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  }

  $("edStage").onpointerdown = e => { if (ed && e.target.closest(".ed-canvas") && !e.target.closest(".box")) select(null); };

  function select(sel) {
    ed.sel = sel;
    boxes();
    renderProps();
  }

  /**
   * Faz o quadro caber na área segura da folha mantendo a proporção e o centro
   * (ex.: trocar uma foto deitada por vertical numa tirinha não pode estourar a folha).
   */
  function fitSlot(s) {
    const f = F(ed.layout), r = ratioOf(s.ratio) ?? s.w / s.h;
    const turned = Math.abs(s.rotation) === 90; // girado 90°: largura e altura trocam na folha
    const room = { w: (turned ? f.h : f.w) - 2 * SAFE, h: (turned ? f.w : f.h) - 2 * SAFE };
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    let w = s.w, h = Math.round(w / r);
    if (h > room.h) { h = room.h; w = Math.round(h * r); }
    if (w > room.w) { w = room.w; h = Math.round(w / r); }
    const vis = turned ? { w: h, h: w } : { w, h }; // tamanho que aparece na folha
    const vx = clamp(cx - vis.w / 2, SAFE, f.w - SAFE - vis.w), vy = clamp(cy - vis.h / 2, SAFE, f.h - SAFE - vis.h);
    Object.assign(s, { w, h, x: Math.round(vx + vis.w / 2 - w / 2), y: Math.round(vy + vis.h / 2 - h / 2) });
  }

  // ---------- painel da direita: documento (nada selecionado) ou elemento ----------

  const num = (label, prop, extra = "") => `<div><label>${label}</label><input type="number" data-prop="${prop}" ${extra}></div>`;
  const slider = (label, prop, min, max, unit) =>
    `<label>${label}</label><div class="slider"><input type="range" data-prop="${prop}" min="${min}" max="${max}"><input type="number" data-prop="${prop}" min="${min}" max="${max}" title="${unit}"></div>`;
  /** Seção que abre com um clique; já vem aberta quando a opção está em uso. */
  const section = (title, open, body) => `<details class="sec"${open ? " open" : ""}><summary>${title}</summary>${body}</details>`;
  const shadowSection = item => section("Sombra", item.shadowBlur > 0 || item.shadowDistance > 0,
    `${slider("Intensidade (desfoque, px)", "shadowBlur", 0, 80, "pixels")}${slider("Distância (px)", "shadowDistance", 0, 60, "pixels")}${slider("Opacidade (%)", "shadowOpacity", 0, 100, "%")}
     <label>Cor da sombra</label><div class="swatches" data-colors="shadowColor"></div>`);
  const seg = (prop, options) => `<div class="seg" data-seg="${prop}">${options.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join("")}</div>`;
  const ICON = {
    earlier: '<path d="M15 5l-7 7 7 7"/>',
    later: '<path d="M9 5l7 7-7 7"/>',
    "center-h": '<path d="M12 3v18M2 12h6M16 12h6M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
    "center-v": '<path d="M3 12h18M12 2v6M12 16v6M9 5l3-3 3 3M9 19l3 3 3-3"/>',
    dup: '<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>',
    front: '<rect x="9" y="3" width="12" height="12" fill="currentColor" fill-opacity=".35"/><path d="M15 15v6H3V9h6"/>',
    back: '<rect x="3" y="9" width="12" height="12" fill="currentColor" fill-opacity=".35"/><path d="M9 9V3h12v12h-6"/>',
    remove: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  };
  const ACT_TITLE = {
    earlier: "Antes na sessão (foto tirada antes)", later: "Depois na sessão (foto tirada depois)",
    "center-h": "Centralizar na horizontal", "center-v": "Centralizar na vertical",
    dup: "Duplicar (Ctrl+D)", remove: "Tirar do layout (Delete)",
    front: "Trazer para frente — uma camada (Ctrl+])", back: "Enviar para trás — uma camada (Ctrl+[)",
  };

  /** Ações do elemento numa linha só, com ícones (a dica aparece ao passar o mouse). */
  function actions(sel) {
    const list = sel.kind === "slot" ? ["earlier", "later", "front", "back", "center-h", "center-v", "dup", "remove"] : ["front", "back", "center-h", "center-v", "dup", "remove"];
    const stack = LayoutRender.stackOf(ed.layout), pos = stack.findIndex(e => e.kind === sel.kind && e.i === sel.i);
    const off = a => (a === "earlier" && sel.i === 0) || (a === "later" && sel.i === ed.layout.slots.length - 1) || (a === "dup" && sel.kind === "slot" && ed.layout.slots.length >= MAX_PHOTOS)
      || (a === "front" && pos === stack.length - 1) || (a === "back" && pos === 0);
    const names = stack.map(e => ({ slot: `foto ${e.i + 1}`, overlay: "moldura", image: "imagem", frame: "contorno", text: "texto" })[e.kind]);
    return `<div class="iconrow">${list.map(a => `<button data-act="${a}" title="${ACT_TITLE[a]}" aria-label="${ACT_TITLE[a]}"${a === "remove" ? ' class="danger"' : ""}${off(a) ? " disabled" : ""}>${svg(ICON[a])}</button>`).join("")}</div>
      <p class="layerinfo">Camada ${pos + 1} de ${stack.length}${pos < stack.length - 1 ? ` · por cima: ${names[pos + 1]}` : " · a de cima"}${pos > 0 ? ` · por baixo: ${names[pos - 1]}` : ""}</p>`;
  }

  function renderProps() {
    const p = $("edProps"), sel = ed.sel, item = itemOf(sel);
    if (!item) return renderDocument(p);
    let html;
    if (sel.kind === "slot") {
      html = `<h2>Foto ${sel.i + 1} <span style="color:var(--prata)">· ${sel.i + 1}ª da sessão</span></h2>${actions(sel)}
        <div class="lockrow"><label>Formato do quadro</label>
          <button class="lock${ed.layout.linkPhotos ? " on" : ""}" data-lock title="${ed.layout.linkPhotos ? "Fotos travadas: mudar o formato aqui muda todas. Clique para destravar e ter fotos diferentes." : "Fotos destravadas: cada foto tem o próprio formato. Clique para travar todas no formato desta foto."}">
            ${svg(ed.layout.linkPhotos ? '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/>' : '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 017.5-2"/>')}
            ${ed.layout.linkPhotos ? "Todas iguais" : "Destravadas"}</button></div>
        <div class="ratios">${RATIOS.map(([v, l, k]) => {
          const w = k ? (k >= 1 ? 20 : Math.round(20 * k)) : 20, h = k ? (k >= 1 ? Math.round(20 / k) : 20) : 14;
          return `<button data-ratio="${v}" title="${v === "livre" ? "Livre" : k > 1 ? "Horizontal" : k === 1 ? "Quadrado" : "Vertical"}"><i style="width:${w}px;height:${h}px${v === "livre" ? ";border-style:dashed" : ""}"></i>${l}</button>`;
        }).join("")}</div>
        <div class="grid2">${num("X", "x")}${num("Y", "y")}</div>
        <div class="sizerow">${num("Largura", "w", 'min="30"')}
          <button class="sizelock${item.lockRatio ? " on" : ""}" data-sizelock title="${item.lockRatio ? "Largura e altura travadas: mudam juntas, sem deformar. Clique para soltar." : "Largura e altura soltas: mudam separadas. Clique para travar."}" aria-label="Travar largura e altura">
            ${svg(item.lockRatio ? '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/>' : '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 017.5-2"/>')}</button>
          ${num("Altura", "h", 'min="30"')}</div>
        <label>Efeito da foto</label>${seg("filter", [["none", "Cor"], ["bw", "P&B"], ["sepia", "Sépia"]])}
        ${slider("Cantos arredondados (px)", "radius", 0, 300, "pixels")}
        ${slider("Rotação (°)", "rotation", -180, 180, "graus")}
        ${section("Borda (por dentro da foto)", item.border > 0, `${slider("Espessura (px)", "border", 0, 120, "pixels")}<label>Cor</label><div class="swatches" data-colors="borderColor"></div>`)}
        ${section("Contorno (por fora, para destacar)", item.outline > 0, `${slider("Espessura (px)", "outline", 0, 60, "pixels")}${slider("Espaço até a foto (px)", "outlineGap", 0, 120, "pixels")}<label>Cor</label><div class="swatches" data-colors="outlineColor"></div>`)}
        ${shadowSection(item)}`;
    } else if (sel.kind === "image") {
      html = `<h2>Imagem</h2>${actions(sel)}
        <div class="grid2">${num("X", "x")}${num("Y", "y")}${num("Largura", "w", 'min="30"')}${num("Altura", "h", "disabled")}</div>
        ${slider("Transparência (%)", "opacity", 10, 100, "% visível")}
        ${slider("Rotação (°)", "rotation", -180, 180, "graus")}
        ${shadowSection(item)}`;
    } else {
      html = `<h2>Texto</h2>${actions(sel)}
        <label>Conteúdo</label><input data-prop="text" maxlength="200">
        <div class="chips"><button data-insert="{evento}">+ nome do evento</button><button data-insert="{data}">+ data</button></div>
        <label>Fonte</label>${seg("font", [["serif", "Cormorant"], ["sans", "Jost"]])}
        <label>Peso</label>${seg("weight", [[0, "Padrão"], ...WEIGHTS[item.font]])}
        <div class="grid2">${num("Tamanho (px)", "size", 'min="8" max="400"')}<div><label>&nbsp;</label>
          <div class="pair" style="margin-top:0"><label style="display:flex;gap:6px;align-items:center;margin:8px 0"><input type="checkbox" data-prop="italic" style="width:auto">Itálico</label>
          <label style="display:flex;gap:6px;align-items:center;margin:8px 0"><input type="checkbox" data-prop="upper" style="width:auto">CAIXA ALTA</label></div></div></div>
        ${slider("Espaço entre letras (px)", "spacing", 0, 60, "pixels")}
        <label>Alinhamento</label>${seg("align", [["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]])}
        <label>Cor</label><div class="swatches" data-colors="color"></div>
        <div class="grid2">${num("X", "x")}${num("Y", "y")}${num("Largura da caixa", "w", 'min="30"')}</div>
        ${slider("Rotação (°)", "rotation", -180, 180, "graus")}
        ${shadowSection(item)}`;
    }
    p.innerHTML = html;
    bindProps(p, sel, item);
  }

  /** Nada selecionado: propriedades do documento (nome, formato, fundo, moldura). */
  function renderDocument(p) {
    const l = ed.layout;
    p.innerHTML = `<h2>Documento</h2>
      <label for="edName">Nome</label><input id="edName" maxlength="80">
      <label for="edFormat">Formato da folha</label><select id="edFormat">${Object.entries(LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      <div class="lockrow"><label>Fundo</label>
        <button class="icon" id="bgImage" title="Imagem de fundo (fica atrás das fotos)">${svg('<rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>')}</button></div>
      <div class="seg" id="bgMode"><button data-v="solid">Cor sólida</button><button data-v="gradient">Degradê</button></div>
      <label>${l.background2 ? "Cor 1 (início)" : "Cor"}</label><div class="swatches" id="bgSwatches"></div>
      ${l.background2 ? `<label>Cor 2 (fim)</label><div class="swatches" id="bgSwatches2"></div>
        <label>Direção</label><div class="seg" id="bgAngle">${[[180, "↓"], [90, "→"], [135, "↘"], [45, "↗"], [0, "↑"], [270, "←"]].map(([a, t]) => `<button data-v="${a}" title="${a}°">${t}</button>`).join("")}</div>
        ${slider("Ângulo (°)", "gradientAngle", 0, 359, "graus")}` : ""}
      <p class="hint">O último quadradinho de cada linha abre a paleta completa (qualquer cor).</p>
      ${l.backgroundImage ? `<div class="filechip">Imagem de fundo: ${l.backgroundImage}<button id="bgImageOff">Tirar</button></div>` : ""}
      ${l.overlayImage ? `<div class="filechip">Moldura por cima: ${l.overlayImage}<button id="ovImageOff">Tirar</button></div>` : ""}
      ${section("Contorno da folha", l.frameWidth > 0, `<p class="hint">Linha em volta da folha inteira (na tirinha, de cada tira). 36 px = na margem de segurança.</p>
        ${slider("Espessura (px)", "frameWidth", 0, 60, "pixels")}${slider("Distância da borda do papel (px)", "frameInset", 0, 300, "pixels")}${slider("Cantos (px)", "frameRadius", 0, 300, "pixels")}
        <label>Cor</label><div class="swatches" data-colors="frameColor"></div>`)}
      <p class="none" style="margin-top:16px">${plural(l.slots.length, "foto")} de ${MAX_PHOTOS} · ${plural(l.texts.length, "texto")} · ${plural(l.images.length, "imagem", "imagens")}</p>
      <p class="none" style="margin-top:8px">Clique num elemento do desenho para configurar. Arraste para mover (encaixa no centro); o quadradinho dourado muda o tamanho. Setas movem · Ctrl+Z desfaz · Ctrl+D duplica · Delete tira. 12 px = 1 mm.</p>`;
    $("edName").value = l.name;
    $("edName").oninput = () => { l.name = $("edName").value; changed(); };
    $("edFormat").value = l.format;
    $("edFormat").onchange = () => changeFormat($("edFormat").value);
    colorPicker($("bgSwatches"), () => l.background, c => { l.background = c; changed(); });
    if ($("bgSwatches2")) colorPicker($("bgSwatches2"), () => l.background2, c => { l.background2 = c; changed(); });
    $("bgMode").querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", (b.dataset.v === "gradient") === !!l.background2);
      b.onclick = () => {
        // degradê começa da cor atual para um tom bem mais escuro; sólido guarda só a cor 1
        l.background2 = b.dataset.v === "gradient" ? (l.background2 ?? (l.background.toUpperCase() === "#0E0D0C" ? "#3A342C" : "#0E0D0C")) : null;
        renderProps();
        changed();
      };
    });
    $("bgAngle")?.querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", +b.dataset.v === l.gradientAngle);
      b.onclick = () => { l.gradientAngle = +b.dataset.v; renderProps(); changed(); };
    });
    $("bgImage").onclick = () => send({ type: "layouts.addImage", id: l.id, role: "background" });
    if ($("bgImageOff")) $("bgImageOff").onclick = () => { l.backgroundImage = null; renderProps(); changed(); };
    if ($("ovImageOff")) $("ovImageOff").onclick = () => { l.overlayImage = null; renderProps(); changed(); };
    bindProps(p, { kind: "doc" }, l);
  }

  function bindProps(p, sel, item) {
    p.querySelectorAll("[data-prop]").forEach(inp => {
      const prop = inp.dataset.prop;
      if (inp.type === "checkbox") inp.checked = !!item[prop];
      else inp.value = item[prop];
      inp.oninput = () => {
        if (inp.type === "checkbox") item[prop] = inp.checked;
        else if (prop === "text") item[prop] = inp.value;
        else {
          const v = parseInt(inp.value, 10);
          if (Number.isNaN(v)) return;
          if (prop === "w" && sel.kind === "image") item.h = Math.round(v * item.h / item.w); // logo não deforma
          if (sel.kind === "slot" && item.lockRatio && (prop === "w" || prop === "h")) {
            // travado: largura e altura andam juntas na mesma proporção
            const r = ratioOf(item.ratio) ?? item.w / item.h;
            if (prop === "w") item.h = Math.round(v / r); else item.w = Math.round(v * r);
          }
          item[prop] = v;
          p.querySelectorAll(`[data-prop="${prop}"]`).forEach(o => { if (o !== inp) o.value = v; }); // régua ↔ número
          for (const other of ["w", "h"]) if (other !== prop) p.querySelectorAll(`[data-prop="${other}"]`).forEach(o => (o.value = item[other]));
        }
        changed();
      };
    });
    p.querySelectorAll("[data-insert]").forEach(b => (b.onclick = () => {
      item.text = (item.text + " " + b.dataset.insert).trim();
      p.querySelector("[data-prop=text]").value = item.text;
      changed();
    }));
    p.querySelectorAll("[data-seg]").forEach(segEl => segEl.querySelectorAll("button").forEach(b => {
      const prop = segEl.dataset.seg, value = prop === "weight" ? Number(b.dataset.v) : b.dataset.v;
      b.classList.toggle("on", item[prop] === value);
      b.onclick = () => {
        item[prop] = value;
        if (prop === "font") item.weight = 0; // os pesos mudam de uma fonte para a outra
        renderProps();
        changed();
      };
    }));
    p.querySelectorAll("[data-ratio]").forEach(b => {
      b.classList.toggle("on", item.ratio === b.dataset.ratio);
      b.onclick = () => {
        item.ratio = b.dataset.ratio;
        if (ratioOf(item.ratio)) { item.lockRatio = true; fitSlot(item); } // proporção escolhida = travada; ajusta para caber na folha
        if (ed.layout.linkPhotos) {
          syncSlots(item);
          ed.layout.slots.forEach(s => s !== item && fitSlot(s)); // as outras também não podem sair da folha
        }
        renderProps();
        changed();
      };
    });
    const sizeLock = p.querySelector("[data-sizelock]");
    if (sizeLock) sizeLock.onclick = () => {
      item.lockRatio = !item.lockRatio;
      if (!item.lockRatio) item.ratio = "livre"; // solta: largura e altura livres
      if (ed.layout.linkPhotos) syncSlots(item);
      renderProps();
      changed();
    };
    const lock = p.querySelector("[data-lock]");
    if (lock) lock.onclick = () => {
      ed.layout.linkPhotos = !ed.layout.linkPhotos;
      if (ed.layout.linkPhotos && ed.layout.slots.length > 1) {
        syncSlots(item);
        ed.layout.slots.forEach(s => s !== item && fitSlot(s));
        toast(`Fotos travadas: todas ficaram no formato da foto ${sel.i + 1}.`);
      }
      renderProps();
      changed();
    };
    p.querySelectorAll("[data-colors]").forEach(holder => {
      const prop = holder.dataset.colors;
      colorPicker(holder, () => item[prop], c => { item[prop] = c; changed(); });
    });
    p.querySelectorAll("[data-act]").forEach(b => (b.onclick = () => act(b.dataset.act)));
  }

  /** Atualiza os números do painel durante o arraste, sem reconstruir (não tira o foco de quem está digitando). */
  function refreshPropValues() {
    const item = itemOf(ed.sel);
    if (!item) return;
    $("edProps").querySelectorAll("input[type=number],input[type=range]").forEach(inp => {
      if (document.activeElement !== inp) inp.value = item[inp.dataset.prop];
    });
  }

  function act(what) {
    const sel = ed.sel, list = listOf(sel.kind), i = sel.i, item = list[i], f = F(ed.layout);
    if (what === "remove") {
      list.splice(i, 1);
      select(null);
    } else if (what === "dup") {
      if (sel.kind === "slot" && list.length >= MAX_PHOTOS) return toast(`Máximo de ${MAX_PHOTOS} fotos por layout.`, true);
      list.push({ ...structuredClone(item), x: item.x + 24, y: item.y + 24 });
      select({ kind: sel.kind, i: list.length - 1 });
    } else if (what === "front" || what === "back") {
      moveLayer(sel, what === "front" ? 1 : -1);
      renderProps();
    } else if (what === "center-h") {
      item.x = Math.round((f.w - item.w) / 2);
    } else if (what === "center-v") {
      item.y = Math.round((f.h - heightOf(sel.kind, item)) / 2);
    } else {
      const j = what === "earlier" ? i - 1 : i + 1;
      [list[i], list[j]] = [list[j], list[i]];
      select({ kind: sel.kind, i: j });
    }
    changed();
  }

  /** Troca o elemento de lugar com a camada de cima (+1) ou de baixo (−1) e renumera a pilha toda (z = posição). */
  function moveLayer(sel, dir) {
    const l = ed.layout, stack = LayoutRender.stackOf(l);
    const k = stack.findIndex(e => e.kind === sel.kind && e.i === sel.i), j = k + dir;
    if (k < 0 || j < 0 || j >= stack.length) return;
    [stack[k], stack[j]] = [stack[j], stack[k]];
    stack.forEach((e, z) => {
      if (e.kind === "overlay") l.overlayZ = z;
      else if (e.kind === "frame") l.frameZ = z;
      else listOf(e.kind)[e.i].z = z;
    });
  }

  function colorPicker(holder, get, set) {
    holder.replaceChildren();
    for (const c of PALETTE) {
      const b = document.createElement("button");
      b.style.background = c;
      b.title = c;
      if (get().toUpperCase() === c) b.style.outline = "2px solid var(--champ)";
      b.onclick = () => { set(c); colorPicker(holder, get, set); };
      holder.append(b);
    }
    const custom = document.createElement("input");
    custom.type = "color";
    custom.value = get();
    custom.title = "Outra cor";
    custom.oninput = () => set(custom.value.toUpperCase());
    holder.append(custom);
  }

  function refreshTools() {
    if (!ed) return;
    const n = ed.layout.slots.length;
    $("slotCount").textContent = `${n}/${MAX_PHOTOS}`;
    $("addSlot").disabled = n >= MAX_PHOTOS;
    $("edUndo").disabled = ed.history.length < 2 && !ed.dirty;
    $("edRedo").disabled = !ed.future.length;
  }

  // ---------- organizar, formato ----------

  /** Distribui as fotos em grade dentro da margem, deixando espaço embaixo para nome e logo. */
  function arrange() {
    const l = ed.layout, f = F(l), n = l.slots.length;
    if (!n) return toast("Adicione fotos primeiro.", true);
    const m = l.format === "strip" ? 36 : 48, gap = 24;
    const footer = { strip: 0.25, landscape: 0.1, portrait: 0.16 }[l.format];
    const cols = l.format === "strip" ? 1 : l.format === "landscape" ? (n === 4 ? 2 : n) : n <= 2 ? 1 : 2;
    const rows = Math.ceil(n / cols);
    const area = { w: f.w - 2 * m, h: f.h * (1 - footer) - m };
    const cell = { w: (area.w - gap * (cols - 1)) / cols, h: (area.h - gap * (rows - 1)) / rows };
    l.slots.forEach((s, i) => {
      const r = ratioOf(s.ratio);
      let w = cell.w, h = cell.h;
      if (r) { w = Math.min(cell.w, cell.h * r); h = w / r; }
      const cx = m + (i % cols) * (cell.w + gap) + cell.w / 2, cy = m + Math.floor(i / cols) * (cell.h + gap) + cell.h / 2;
      Object.assign(s, { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h), rotation: 0 });
    });
    changed();
  }

  /** Muda o formato da folha convertendo as posições (tamanhos pela menor escala, para nada deformar). */
  function changeFormat(format) {
    const l = ed.layout, from = F(l), to = LayoutRender.FORMATS[format];
    if (!confirm(`Mudar para ${LABEL[format]}? As posições serão convertidas; confira o resultado (Ctrl+Z desfaz).`)) {
      $("edFormat").value = l.format;
      return;
    }
    const sx = to.w / from.w, sy = to.h / from.h, k = Math.min(sx, sy);
    for (const s of l.slots) Object.assign(s, { x: Math.round(s.x * sx), y: Math.round(s.y * sy), w: Math.round(s.w * k), h: Math.round(s.h * k) });
    for (const i of l.images) Object.assign(i, { x: Math.round(i.x * sx), y: Math.round(i.y * sy), w: Math.round(i.w * k), h: Math.round(i.h * k) });
    for (const t of l.texts) Object.assign(t, { x: Math.round(t.x * sx), y: Math.round(t.y * sy), w: Math.round(t.w * sx), size: Math.max(8, Math.round(t.size * k)) });
    l.format = format;
    select(null);
    fit();
    changed();
  }

  // ---------- visualizar a folha da impressão ----------

  async function preview() {
    const f = F(ed.layout), twice = ed.layout.format === "strip";
    const sheet = { w: f.w * (twice ? 2 : 1), h: f.h };
    $("edPreview").hidden = false;
    $("edPreviewInfo").textContent = twice
      ? "Folha 10×15 como sai da impressora: duas tiras iguais, cortadas no meio."
      : `Folha ${LABEL[ed.layout.format]} como sai da impressora.`;
    const box = $("edPreviewSheet").getBoundingClientRect();
    const view = Math.min((box.width - 48) / sheet.w, (box.height - 48) / sheet.h);
    try {
      const c = await LayoutRender.render(ed.layout, ed.assets, { scale: view * devicePixelRatio, sheet: true });
      c.style.width = Math.round(sheet.w * view) + "px";
      $("edPreviewSheet").replaceChildren(c);
    } catch (err) {
      toast(err.message, true);
    }
  }
  const closePreview = () => ($("edPreview").hidden = true);
  $("edPreviewClose").onclick = closePreview;
  $("edPreview").onclick = e => { if (e.target === $("edPreview") || e.target === $("edPreviewSheet")) closePreview(); };

  // ---------- botões ----------

  $("addSlot").onclick = () => {
    if (ed.layout.slots.length >= MAX_PHOTOS) return;
    const f = F(ed.layout), w = snap(ed.layout.format === "strip" ? 528 : f.w * 0.45), h = Math.round(w / 1.5);
    const model = ed.layout.linkPhotos && ed.layout.slots[0]; // travadas: a nova foto nasce igual às outras
    const fmt = model ? Object.fromEntries(LINKED.map(k => [k, model[k]])) : { w, h, ratio: "3:2", border: 0, borderColor: "#FFFFFF", radius: 0, rotation: 0, filter: "none" };
    ed.layout.slots.push({ ...fmt, x: snap((f.w - fmt.w) / 2), y: snap((f.h - fmt.h) / 2) });
    normalize(ed.layout); // itens novos já com todos os campos (o painel mostra valores, não campos vazios)
    select({ kind: "slot", i: ed.layout.slots.length - 1 });
    changed();
  };

  $("addText").onclick = () => {
    const f = F(ed.layout), size = ed.layout.format === "strip" ? 56 : 72;
    ed.layout.texts.push({ text: "{evento}", x: snap(f.w * 0.06), y: snap(f.h * 0.45), w: snap(f.w * 0.88), size, font: "serif", color: "#0E0D0C", align: "center", italic: true, weight: 0, spacing: 0, upper: false, rotation: 0 });
    normalize(ed.layout);
    select({ kind: "text", i: ed.layout.texts.length - 1 });
    changed();
  };

  $("addImage").onclick = () => send({ type: "layouts.addImage", id: ed.layout.id, role: "image" });
  $("edArrange").onclick = arrange;
  $("edUndo").onclick = undo;
  $("edRedo").onclick = redo;
  $("edSafe").onclick = () => {
    $("edSafe").classList.toggle("on");
    $("edSafe").setAttribute("aria-pressed", on("edSafe"));
    boxes();
  };

  function imageAdded(m) {
    if (!ed) return;
    const f = F(ed.layout);
    if (m.role === "background") ed.layout.backgroundImage = m.file;
    else if (m.frame && confirm(`Esta imagem tem o tamanho da folha e partes transparentes: parece uma moldura.\n\nUsar como moldura por cima das fotos${m.slots.length ? ` e encaixar as fotos nas ${plural(m.slots.length, "janela")}` : ""}?\n(Cancelar = usar como imagem solta)`)) {
      ed.layout.overlayImage = m.file;
      if (m.slots.length) ed.layout.slots = m.slots.map(s => ({ ...s, ratio: "livre" }));
      normalize(ed.layout);
      select(null);
    } else {
      const w = snap(Math.min(f.w, f.h) * 0.4), h = Math.round(w * m.height / m.width);
      ed.layout.images.push({ file: m.file, x: snap((f.w - w) / 2), y: snap(f.h - h - 60), w, h, rotation: 0, opacity: 100 });
      normalize(ed.layout);
      select({ kind: "image", i: ed.layout.images.length - 1 });
    }
    if (!ed.sel) renderProps();
    changed();
  }

  $("edBack").onclick = closeEditor;
  $("edSave").onclick = () => send({ type: "layouts.save", layout: ed.layout });
  $("edView").onclick = preview;
  $("edPrint").onclick = async () => {
    try {
      const sheet = await LayoutRender.render(ed.layout, ed.assets, { scale: 1, sheet: true });
      send({ type: "layouts.print", format: ed.layout.format, png: sheet.toDataURL("image/png"), copies: 1, background: ed.layout.background });
    } catch (err) {
      toast(err.message, true);
    }
  };

  document.addEventListener("keydown", e => {
    if (!editing()) return;
    if (!$("edPreview").hidden) { if (e.key === "Escape") closePreview(); return; }
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    const ctrl = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (ctrl && key === "s") { e.preventDefault(); $("edSave").click(); return; }
    if (ctrl && key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (ctrl && (key === "y" || (key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    const item = itemOf(ed.sel);
    if (!item) return;
    if (ctrl && key === "d") { e.preventDefault(); act("dup"); return; }
    if (ctrl && (e.key === "]" || e.key === "[")) { e.preventDefault(); act(e.key === "]" ? "front" : "back"); return; }
    const step = e.shiftKey ? 12 : 2;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      item.x += moves[e.key][0];
      item.y += moves[e.key][1];
      changed();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      act("remove");
    } else if (e.key === "Escape") {
      select(null);
    }
  });

  // ---------- mensagens do app ----------

  host?.addEventListener("message", e => {
    const m = e.data;
    switch (m.type) {
      case "layouts":
        lib = m;
        if (!ed) renderLibrary();
        break;
      case "events": activeEvent = m.list.find(e => e.id === m.activeId)?.name ?? null; break; // o painel não tem evento ativo
      case "layoutOpen": openEditor(m.layout, m.warning); break;
      case "layoutSaved":
        if (ed && ed.layout.id === m.layout.id) {
          ed.layout.updated = m.layout.updated;
          ed.dirty = false;
          ed.saved = true;
          $("edSaved").textContent = "Salvo";
          refreshTools();
        }
        break;
      case "layoutImage": imageAdded(m); break;
    }
  });

  document.addEventListener("screen", e => {
    if (e.detail !== "layouts") return;
    if (ed) fit(); // a aba estava escondida: recalcula o tamanho do desenho
    else send({ type: "layouts.list" });
  });
  send({ type: "layouts.list" });
})();
