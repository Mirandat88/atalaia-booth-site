// Configurações → Impressão (evento, impressora e a folha como sai da impressora) e Contadores do evento.
// A prévia é a mesma folha que vai para a impressora: a tela desenha o layout e o app gira e corta para o papel do driver.
(() => {
  const LABEL = { strip: "Tirinha 5×15", landscape: "10×15 deitado", portrait: "10×15 em pé", polaroid: "Polaroide (InstaPrint)" };
  const num = v => v.toLocaleString("pt-BR");
  const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  let printers = [], layouts = [], assetsRoot = "", printing = false, shown = null, ev = null;
  let zoom = 1; // 1 = a folha inteira cabe no espaço; continua igual ao trocar papel ou layout

  // ---------- impressora e papel ----------

  function renderPrinters(p) {
    printers = p.list;
    fillSelect($("printer"), printers.map(x => ({ value: x.name, label: x.name })), p.printer ?? printers.find(x => x.isDefault)?.name);
    $("copies").value = p.copies ?? 1;
    savePrintSettings();
  }

  function savePrintSettings() {
    send({ type: "printSettings", printer: $("printer").value || null, copies: +$("copies").value });
    refresh();
  }

  // ---------- prévia ----------

  const current = () => layouts.find(l => l.id === $("prLayout").value);
  // sem fotos reais: os quadros saem numerados (1, 2, 3…)
  const sheetOf = async l => (await LayoutRender.render(l, assetsRoot + l.id + "/", { scale: 1, sheet: true })).toDataURL("image/png");

  function empty(text) {
    $("paper").hidden = $("zoombar").hidden = true;
    $("paperEmpty").hidden = false;
    $("paperEmptyText").textContent = text;
    $("paperInfo").textContent = "";
  }

  // várias mudanças seguidas (lista de layouts + fotos chegando) viram um só desenho
  function refresh() {
    clearTimeout(refresh.timer);
    refresh.timer = setTimeout(async () => {
      if ($("tab-print").hidden) return;
      const l = current();
      $("btnPrintTest").disabled = !l || !$("printer").value || printing;
      $("btnCutTest").disabled = !$("printer").value || printing;
      if (!l) return empty("Crie um layout em Configurações → Layouts para ver como sai na impressora.");
      if (!$("printer").value) return empty("Escolha a impressora ao lado.");
      try {
        shown = l;
        send({ type: "layouts.preview", format: l.format, png: await sheetOf(l), background: l.background });
      } catch (err) {
        empty(err.message);
      }
    }, 60);
  }

  function showPreview(m) {
    $("paperEmpty").hidden = true;
    $("paper").hidden = $("zoombar").hidden = false;
    $("paperImg").src = m.png;
    const strip = shown?.format === "strip";
    const parts = [`Papel <b>${esc(m.paper)}</b> · ${num(m.paperCm[0])} × ${num(m.paperCm[1])} cm`, esc(m.printer)];
    // impressora de foto: o driver imprime um pouco maior (sangria) e a impressora apara; a folha vai no tamanho final
    if (m.driverMm[0] !== m.paperMm[0] || m.driverMm[1] !== m.paperMm[1])
      parts.push(`sai em ${num(m.paperMm[0])} × ${num(m.paperMm[1])} mm (o driver imprime ${num(m.driverMm[0])} × ${num(m.driverMm[1])} mm com a sangria)`);
    if (m.rotated) parts.push("a folha gira para entrar no papel");
    // a folha nunca é cortada: em papel de outra proporção, sobra uma faixa na cor do fundo do layout
    if (m.bandMm >= 1) parts.push(`este papel tem outra proporção: sobra uma faixa de ${num(m.bandMm)} mm de cada lado`);
    if (strip) parts.push("linha vermelha = corte entre as duas tiras");
    $("paperInfo").innerHTML = parts.join(" · ");
    $("paperCut").className = "cut" + (strip ? (m.rotated ? " h" : " v") : "");
    $("paperCut").hidden = !strip;
  }

  /** Tamanho da folha na tela: cabe inteira no espaço × zoom (acima de 1, rola para ver o resto). */
  function layoutPaper() {
    const img = $("paperImg"), box = $("paper");
    if (!img.naturalWidth || box.hidden) return;
    const fit = Math.min((box.clientWidth - 24) / img.naturalWidth, (box.clientHeight - 24) / img.naturalHeight);
    img.style.width = Math.round(img.naturalWidth * fit * zoom) + "px";
    img.style.height = Math.round(img.naturalHeight * fit * zoom) + "px";
    $("zoomTxt").textContent = Math.round(zoom * 100) + "%";
    placeCut();
  }

  function setZoom(z, at) {
    const box = $("paper"), old = zoom;
    zoom = Math.min(6, Math.max(0.5, z));
    // mantém o ponto sob o mouse (ou o centro) no lugar ao aproximar
    const px = at ? at.x : box.clientWidth / 2, py = at ? at.y : box.clientHeight / 2;
    const fx = (box.scrollLeft + px) / box.scrollWidth, fy = (box.scrollTop + py) / box.scrollHeight;
    layoutPaper();
    if (old !== zoom) { box.scrollLeft = fx * box.scrollWidth - px; box.scrollTop = fy * box.scrollHeight - py; }
  }
  $("zoomIn").onclick = () => setZoom(zoom * 1.25);
  $("zoomOut").onclick = () => setZoom(zoom / 1.25);
  $("zoomFit").onclick = () => setZoom(1);
  $("paper").addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = $("paper").getBoundingClientRect();
    setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });

  /** A linha de corte da tirinha fica no meio da folha (o corte do papel é centralizado, então o meio não muda). */
  function placeCut() {
    const img = $("paperImg"), cut = $("paperCut");
    if (cut.hidden) return;
    const v = cut.classList.contains("v");
    Object.assign(cut.style, v
      ? { left: img.offsetLeft + img.offsetWidth / 2 + "px", top: img.offsetTop + "px", height: img.offsetHeight + "px", width: "0" }
      : { left: img.offsetLeft + "px", top: img.offsetTop + img.offsetHeight / 2 + "px", width: img.offsetWidth + "px", height: "0" });
  }
  $("paperImg").onload = layoutPaper;
  window.addEventListener("resize", layoutPaper);

  $("btnPrintTest").onclick = async () => {
    const l = current();
    if (!l || printing) return;
    printing = true;
    $("btnPrintTest").disabled = true;
    try {
      send({ type: "layouts.print", format: l.format, png: await sheetOf(l), copies: +$("copies").value, background: l.background });
    } catch (err) {
      printing = false;
      $("btnPrintTest").disabled = false;
      toast(err.message, true);
    }
  };

  $("btnCutTest").onclick = () => {
    if (printing) return;
    printing = true;
    $("btnCutTest").disabled = $("btnPrintTest").disabled = true;
    send({ type: "layouts.cutTest" });
  };

  // ---------- evento e contadores ----------

  function renderEvent(m) {
    ev = m;
    $("pwCurrent").hidden = !m.hasPassword;
    $("pwSetup").hidden = m.eventPassword; // com evento ativo, vale a senha do evento
    $("pwHint").textContent = m.eventPassword
      ? (m.hasPassword ? "É a senha do evento ativo (criada em Eventos). Para trocar: Eventos → Editar." : "O evento ativo ainda não tem senha. Crie em Eventos → Editar.")
      : m.hasPassword
        ? "Para trocar, digite a senha atual e a nova."
        : "Ainda não há senha. Cadastre uma (mínimo 4 caracteres) para poder zerar os contadores.";
    const PRODUCT = { totem: "Totem", cabine: "Cabine de Fotos", espelho: "Espelho Mágico", instaprint: "InstaPrint" };
    $("evNow").innerHTML = m.active
      ? `<b>${esc(m.name)}</b><span>${m.label.replaceAll(" · ", "/")} · ${PRODUCT[m.product]}${m.client ? " · " + esc(m.client) : ""}</span>`
      : `<b>Nenhum evento ativo</b><span>As fotos e impressões vão para a pasta “Teste”.</span>`;
    LayoutRender.setEvent({ evento: m.name, data: m.label, hashtag: m.hashtag });
    $("ctEvent").textContent = m.name;
    $("ctDate").textContent = `${m.label} · ${m.folder}`;
    renderCounters(m.counters);
    if (m.total) for (const [id, k] of [["totPhotos", "photosTaken"], ["totSessions", "sessions"], ["totCopies", "copies"]]) $(id).textContent = num(m.total[k]);
    refresh();
  }

  function renderCounters(c) {
    $("ctSessions").textContent = num(c.sessions);
    $("ctStarted").textContent = c.started > c.sessions ? `concluídas · ${num(c.started)} iniciadas` : "concluídas";
    $("ctCopies").textContent = num(c.copies);
    $("ctSheets").textContent = `papéis impressos · ${c.sheets === 1 ? "1 envio" : num(c.sheets) + " envios"}`;
    $("ctPhotos").textContent = num(c.photosTaken);
  }

  // ---------- zerar contadores (com senha) ----------

  $("btnCtReset").onclick = () => {
    if (!ev?.hasPassword) { toast(ev?.eventPassword ? "Crie a senha do evento em Eventos → Editar." : "Cadastre a senha abaixo antes de zerar os contadores.", true); return; }
    $("resetWhat").textContent = `Os números do evento “${ev.name}” voltam a 0. As fotos e impressões da pasta não são apagadas.`;
    $("pwReset").value = "";
    $("modalReset").hidden = false;
    $("pwReset").focus();
  };
  const resetGo = () => send({ type: "counters.reset", password: $("pwReset").value });
  $("btnResetGo").onclick = resetGo;
  $("pwReset").onkeydown = e => { if (e.key === "Enter") resetGo(); };

  $("btnPwSave").onclick = () => {
    const next = $("pwNext").value;
    if (next.length < 4) return toast("A senha precisa ter pelo menos 4 caracteres.", true);
    if (next !== $("pwNext2").value) return toast("As duas senhas novas não são iguais.", true);
    send({ type: "counters.password", current: $("pwCurrent").value, next });
  };

  $("printer").onchange = $("copies").onchange = savePrintSettings;
  $("prLayout").onchange = refresh;
  $("btnGoEvents").onclick = () => showTab("events");
  $("btnEvFolder").onclick = $("btnCtFolder").onclick = () => send({ type: "openEventFolder" });

  host?.addEventListener("message", e => {
    const m = e.data;
    switch (m.type) {
      case "printers": renderPrinters(m); break;
      case "printPreview": showPreview(m); break;
      case "event":
        renderEvent(m);
        // senha salva ou contadores zerados: limpa os campos e fecha a janela
        for (const id of ["pwCurrent", "pwNext", "pwNext2", "pwReset"]) $(id).value = "";
        $("modalReset").hidden = true;
        break;
      case "counters":
        renderCounters(m.counters);
        if (!$("tab-counters").hidden) send({ type: "event.get" }); // atualiza o total também
        break;
      case "layouts": {
        const keep = $("prLayout").value;
        layouts = m.list;
        assetsRoot = m.assetsRoot;
        fillSelect($("prLayout"), layouts.map(l => ({ value: l.id, label: `${l.name} — ${LABEL[l.format]}` })));
        if (layouts.some(l => l.id === keep)) $("prLayout").value = keep;
        refresh();
        break;
      }
      case "printing": toast("Enviando para a impressora…"); break;
      case "printed":
        printing = false;
        refresh();
        toast(m.pdf ? "PDF salvo: " + m.pdf : "Enviado para a impressora: " + m.file.split("\\").pop());
        break;
      case "error":
        if (printing) { printing = false; refresh(); }
        break;
    }
  });

  document.addEventListener("screen", e => {
    if (e.detail === "print") send({ type: "layouts.list" });
    if (e.detail === "counters") send({ type: "event.get" });
  });
  send({ type: "event.get" });
})();
