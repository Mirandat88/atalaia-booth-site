// Menu Eventos (Etapa 05): lista de eventos, formulário e evento ativo. Arquivos e validação ficam no app (MainForm.Events.cs).
(() => {
  const PRODUCT = { totem: "Totem", cabine: "Cabine de Fotos", espelho: "Espelho Mágico", instaprint: "InstaPrint" };
  const FORMAT = { strip: "Tirinha 5×15", landscape: "10×15 deitado", portrait: "10×15 em pé", polaroid: "Polaroide" };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const dateBR = d => d.split("-").reverse().join("/");
  // “novembro de 2026” para separar os eventos por mês
  const monthOf = d => { const t = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t[0].toUpperCase() + t.slice(1); };
  // quanto falta (só nos eventos aguardando): hoje, amanhã, em 5 dias, já passou
  const untilOf = d => {
    const days = Math.round((new Date(d + "T00:00") - new Date(new Date().toDateString())) / 864e5);
    return days === 0 ? "hoje" : days === 1 ? "amanhã" : days > 1 ? `em ${days} dias` : "já passou";
  };
  // ícones dos botões do cartão (o nome aparece ao parar o mouse em cima)
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${d}</svg>`;
  const ICON = {
    activate: svg('<path d="M12 3v8"/><path d="M6.6 6.6a8 8 0 1010.8 0"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
    close: svg('<path d="M5 21V3"/><path d="M5 4h13v9H5"/><path d="M5 4h4.3v3H5zM13.7 4H18v3h-4.3zM9.3 7h4.4v3H9.3zM5 10h4.3v3H5zM13.7 10H18v3h-4.3z" fill="currentColor" stroke="none"/>'),
    reopen: svg('<path d="M4 12a8 8 0 108-8H7"/><path d="M10 1L7 4l3 3"/>'),
    dup: svg('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>'),
    del: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    summary: svg('<path d="M5 20V10M10 20V4M15 20v-7M20 20V8M3 20h18"/>'),
    counters: svg('<path d="M5 20V10M10 20V4M15 20v-7M20 20V8M3 20h18"/>'),
  };
  const TIP = { activate: "Ativar", edit: "Editar", close: "Encerrar", summary: "Resumo do evento", counters: "Contadores do evento", reopen: "Reabrir", dup: "Duplicar", del: "Excluir" };
  const act = (a, cls = "", tip = TIP[a]) => `<button class="icon ${cls}" data-a="${a}" title="${tip}" aria-label="${tip}">${ICON[a]}</button>`;
  let events = [], activeId = null, layouts = [], assetsRoot = "", form = null; // form = { ev, saved: JSON da última versão salva }
  let view = "open"; // aba da lista: Criados (open) ou Histórico (closed = encerrados)
  let defaultPhrases = null;
  // frases da sessão, na ordem em que aparecem
  const PHRASES = [
    ["first", "Antes da 1ª foto"], ["prepare", "Antes das outras fotos"], ["smile", "Na hora da foto (depois do 1)"],
    ["next", "Entre as fotos"], ["last", "Antes da última foto"], ["review", "Depois da última foto"],
    ["thanks", "Agradecimento"], ["pickup", "Onde pegar a foto"],
  ];

  // ===================== lista =====================

  function renderList() {
    const box = $("eventCards");
    box.replaceChildren();
    // aguardando: o próximo primeiro; histórico: o mais recente primeiro
    const shown = events.filter(ev => ev.closed === (view === "closed"))
      .sort((a, b) => view === "closed" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
    $("evTabs").querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", b.dataset.v === view);
      const n = events.filter(ev => ev.closed === (b.dataset.v === "closed")).length;
      b.textContent = (b.dataset.v === "closed" ? "Histórico" : "Aguardando") + (n ? ` (${n})` : "");
    });
    $("noEvents").hidden = shown.length > 0;
    $("noEvents").textContent = view === "closed"
      ? "Nenhum evento encerrado. Use “Encerrar” no cartão quando o evento acabar."
      : window.PANEL ? "Nenhum evento ainda. Toque em “Criar evento”."
      : "Nenhum evento ainda. Toque em “Criar evento”. Enquanto não houver evento ativo, as fotos vão para a pasta “Teste”.";
    let month = "";
    for (const ev of shown) {
      if (ev.date.slice(0, 7) !== month) {
        month = ev.date.slice(0, 7);
        box.append(Object.assign(document.createElement("h2"), { className: "evmonth", textContent: monthOf(ev.date) }));
      }
      const on = ev.id === activeId;
      const layout = layouts.find(l => l.id === (ev.defaultLayout ?? ev.layouts[0]));
      const card = document.createElement("article");
      card.className = "evcard" + (on ? " active" : "");
      card.innerHTML = `
        <div class="evcard-main">
          <div class="evcard-text">
            ${on ? '<span class="badge">Ativo</span>' : ""}
            <h3 class="evname" title="Abrir a tela do evento">${esc(ev.name)}</h3>
            <p>${dateBR(ev.date)}${ev.closed ? "" : ` <span class="evwhen${untilOf(ev.date) === "já passou" ? " late" : ""}">${untilOf(ev.date)}</span>`} · ${PRODUCT[ev.product]}</p>
            <p class="hint">${esc([ev.client, ev.place].filter(Boolean).join(" · ")) || "&nbsp;"}</p>
            <p class="hint">${ev.layouts.length ? `${ev.layouts.length} layout${ev.layouts.length > 1 ? "s" : ""}` : "Sem layout ainda"} · ${ev.print ? "imprime quando o convidado pede" : "sem impressão"}</p>
            ${ev.galleryUrl ? `<p class="hint"><a class="evgallery" href="${esc(ev.galleryUrl)}" target="_blank" rel="noopener">Galeria online ↗</a></p>` : ""}
          </div>
          ${layout ? `<div class="evcard-layout" title="${esc(layout.name)}"></div>` : ""}
        </div>
        <div class="acts">
          ${ev.closed ? act("reopen", "f") + act("summary")
            : (window.PANEL ? "" : act("activate", on ? "power on" : "power off", on ? "Ativo — clique para desativar" : "Desativado — clique para ativar")) // ativar é só no equipamento
              + act("edit") + act("counters") + act("close")}
          ${act("dup")}${act("del")}
        </div>`;
      if (layout) {
        thumb(layout, card.querySelector(".evcard-layout"), 76);
        card.querySelector(".evcard-layout").onclick = e => { e.stopPropagation(); viewLayout(layout); };
      }
      card.title = on ? "Toque para abrir a tela do evento" : "";
      card.onclick = e => {
        if (e.target.closest("button")) return; // os botões do cartão fazem a ação deles
        if (window.PANEL && !ev.closed) return send({ type: "events.open", id: ev.id }); // no painel, abre o formulário
        on ? showGuest(ev)
          : toast(ev.closed ? "Evento encerrado: reabra no Histórico (com a senha) e ative para abrir a tela dele." : "Ative o evento (botão vermelho) para abrir a tela dele.", true);
      };
      card.querySelector("[data-a=counters]")?.addEventListener("click", () => send({ type: "events.summary", id: ev.id }));
      card.querySelector("[data-a=edit]")?.addEventListener("click", () => send({ type: "events.open", id: ev.id }));
      // no app, o link abre no navegador do Windows (no painel online é um link comum)
      card.querySelector(".evgallery")?.addEventListener("click", e => { if (!window.PANEL) { e.preventDefault(); send({ type: "openGallery", url: ev.galleryUrl }); } });
      card.querySelector("[data-a=summary]")?.addEventListener("click", () => send({ type: "events.summary", id: ev.id }));
      card.querySelector("[data-a=reopen]")?.addEventListener("click", async () => {
        const pw = await askPassword("Reabrir evento", ev.name, "Digite a senha do evento para reabrir.");
        if (pw != null) send({ type: "events.reopen", id: ev.id, password: pw });
      });
      card.querySelector("[data-a=close]")?.addEventListener("click", () => {
        if (!confirm(`Encerrar o evento “${ev.name}”?\n\nEle vai para o Histórico${on ? " e deixa de ser o ativo" : ""}. Para reabrir depois, só com a senha do evento.`)) return;
        if (!confirm(`Confirme de novo: encerrar “${ev.name}” agora?\n\nO resumo (fotos, sessões, impressões, tempo e link) abre na tela e no e-mail.`)) return;
        send({ type: "events.close", id: ev.id });
      });
      card.querySelector("[data-a=dup]").onclick = () => send({ type: "events.duplicate", id: ev.id });
      card.querySelector("[data-a=del]").onclick = () => {
        if (confirm(`Excluir o evento “${ev.name}”?\n\nO cadastro vai para a Lixeira do Windows. A pasta de fotos e impressões do evento NÃO é apagada.`))
          send({ type: "events.delete", id: ev.id });
      };
      card.querySelector("[data-a=activate]")?.addEventListener("click", () => send({ type: "events.activate", id: on ? null : ev.id })); // verde = ativo; clicar desativa
      box.append(card);
    }
  }

  // ===================== formulário =====================

  const dirty = () => form && JSON.stringify(form.ev) !== form.saved;

  function openForm(ev, isNew) {
    form = { ev: structuredClone(ev), saved: isNew ? "" : JSON.stringify(ev), isNew };
    $("evList").hidden = true;
    $("evForm").hidden = false;
    renderForm();
  }

  function closeForm() {
    if (dirty() && !confirm("Sair sem salvar as mudanças do evento?")) return;
    form = null;
    $("evForm").hidden = true;
    $("evList").hidden = false;
    send({ type: "events.list" });
  }

  function renderForm() {
    const ev = form.ev;
    $("evTitle").textContent = ev.name || "Novo evento";
    $("efName").value = ev.name;
    $("efDate").value = ev.date;
    $("efClient").value = ev.client;
    $("efPlace").value = ev.place;
    $("efPhrase").value = ev.phrase ?? "";
    $("efPw").value = $("efPw2").value = $("efPwCur").value = "";
    const hasPw = !!ev.passwordHash;
    $("efPwLabel").textContent = hasPw ? "Trocar a senha do evento (deixe em branco para manter)" : "Senha do evento (obrigatória)";
    $("efPw").placeholder = hasPw ? "Nova senha" : "Senha (mín. 4)";
    $("efPwCur").hidden = !hasPw; // trocar a senha pede a atual
    segment("efProduct", ev.product, v => (ev.product = v));
    $("efHashRow").hidden = ev.product !== "instaprint";
    $("efHashtag").value = ev.hashtag ?? "";
    toggle("efPrint", ev.print, v => { ev.print = v; renderForm(); });
    $("efPrintRows").hidden = !ev.print;
    segment("efCopies", String(ev.copiesPerSession), v => (ev.copiesPerSession = +v));
    renderPhrases();
    renderThemes();
    renderLayoutPicker();
  }

  const field = (id, prop) => ($(id).oninput = () => { form.ev[prop] = $(id).value; if (prop === "name") $("evTitle").textContent = $(id).value || "Novo evento"; });
  field("efName", "name");
  field("efDate", "date");
  field("efClient", "client");
  field("efPlace", "place");
  field("efPhrase", "phrase");
  field("efHashtag", "hashtag");

  function segment(id, value, set) {
    $(id).querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", b.dataset.v === value);
      b.onclick = () => { set(b.dataset.v); renderForm(); };
    });
  }
  function toggle(id, value, set) {
    $(id).checked = value;
    $(id).onchange = () => set($(id).checked);
  }

  function renderPhrases() {
    const ph = form.ev.phrases ??= structuredClone(defaultPhrases);
    const box = $("efPhrases");
    if (!box.children.length) {
      for (const [key, label] of PHRASES) {
        const row = document.createElement("label");
        row.innerHTML = `<span>${label}</span><input maxlength="80" data-k="${key}">`;
        row.querySelector("input").oninput = e => (form.ev.phrases[key] = e.target.value);
        box.append(row);
      }
    }
    box.querySelectorAll("input").forEach(i => (i.value = ph[i.dataset.k] ?? ""));
  }

  // tema personalizado criado, mudado ou excluído: monta a escolha de novo
  // (o tema criado pelo “+ Tema personalizado” do formulário já fica escolhido no evento)
  let newThemeFromForm = false;
  document.addEventListener("themeschanged", e => {
    $("efThemes").replaceChildren();
    if (form && newThemeFromForm && e.detail?.savedId) { form.ev.theme = e.detail.savedId; newThemeFromForm = false; }
    if (form) renderThemes();
  });

  function renderThemes() {
    const box = $("efThemes");
    if (!box.children.length)
      for (const key of Object.keys(THEMES)) {
        const card = themeCard(key);
        card.onclick = () => { form.ev.theme = key; renderThemes(); };
        box.append(card);
      }
    if (!box.querySelector(".tnew")) {
      const add = document.createElement("button");
      add.className = "tcard tnew";
      add.type = "button";
      add.innerHTML = "<span>+</span><b>Tema personalizado</b><small>cores, fontes e fundo do seu jeito</small>";
      add.onclick = () => { newThemeFromForm = true; newCustomTheme(); };
      box.append(add);
    }
    box.querySelectorAll(".tcard").forEach(c => c.classList.toggle("on", c.dataset.theme === (form.ev.theme || "visualize")));
  }

  $("efPhrasesReset").onclick = () => { form.ev.phrases = structuredClone(defaultPhrases); renderPhrases(); };

  /** Cartões dos layouts do evento (★ padrão, Tirar) + lista dos que já existem + Criar layout. Miniaturas só com os números das fotos. */
  function renderLayoutPicker() {
    const box = $("efLayouts"), ev = form.ev;
    box.replaceChildren();
    $("efMissing").hidden = ev.layouts.every(id => layouts.some(l => l.id === id));
    // layout excluído da biblioteca: aparece para poder tirar (senão o aviso fica preso e o evento não salva)
    for (const id of ev.layouts.filter(id => !layouts.some(l => l.id === id))) {
      const card = document.createElement("div");
      card.className = "lpick on missing";
      card.innerHTML = `<div class="lthumb">?</div><b>Layout excluído</b><span>não está mais na biblioteca</span>
        <div class="row"><button class="star ghost" data-a="out">Tirar</button></div>`;
      card.querySelector("[data-a=out]").onclick = () => {
        ev.layouts = ev.layouts.filter(x => x !== id);
        if (!ev.layouts.includes(ev.defaultLayout)) ev.defaultLayout = ev.layouts[0] ?? null;
        renderForm();
      };
      box.append(card);
    }
    for (const l of ev.layouts.map(id => layouts.find(l => l.id === id)).filter(Boolean)) {
      const isDefault = (ev.defaultLayout ?? ev.layouts[0]) === l.id;
      const card = document.createElement("div");
      card.className = "lpick on";
      card.innerHTML = `<div class="lthumb"></div><b>${esc(l.name)}</b><span>${FORMAT[l.format]} · ${l.slots.length} foto${l.slots.length > 1 ? "s" : ""}</span>
        <div class="row"><button class="star${isDefault ? " on" : ""}" title="${isDefault ? "Layout padrão do evento" : "Usar como padrão"}">${isDefault ? "★ Padrão" : "☆ Padrão"}</button>
        <button class="star ghost" data-a="out">Tirar</button></div>`;
      card.querySelector(".star").onclick = () => { ev.defaultLayout = l.id; renderForm(); };
      card.querySelector("[data-a=out]").onclick = () => {
        ev.layouts = ev.layouts.filter(id => id !== l.id);
        if (!ev.layouts.includes(ev.defaultLayout)) ev.defaultLayout = ev.layouts[0] ?? null;
        renderForm();
      };
      box.append(card);
      thumb(l, card.querySelector(".lthumb"));
      card.querySelector(".lthumb").onclick = () => viewLayout(l);
    }
    // polaroide é só do InstaPrint
    const free = layouts.filter(l => !ev.layouts.includes(l.id) && (l.format !== "polaroid" || ev.product === "instaprint"));
    $("efAddLayout").innerHTML = `<option value="">${free.length ? "Escolher layout já existente…" : layouts.length ? "Todos os layouts já estão no evento" : "Nenhum layout criado ainda"}</option>`
      + free.map(l => `<option value="${l.id}">${esc(l.name)} — ${FORMAT[l.format]} · ${l.slots.length} foto${l.slots.length > 1 ? "s" : ""}</option>`).join("");
    $("efAddLayout").disabled = !free.length;
    $("efLayoutsHint").textContent = ev.layouts.length > 1
      ? `${ev.layouts.length} layouts: o convidado escolhe na tela; o padrão (★) aparece primeiro.`
      : ev.layouts.length ? "1 layout: sai sempre este." : "Nenhum layout escolhido (dá para salvar e escolher depois).";
  }

  // ---------- layout em tela cheia: o layout, ou a folha 10×15 como vai para a impressora ----------
  let viewing = null, printMode = false;
  async function viewLayout(l, print = false) {
    viewing = l; printMode = print;
    $("lvName").textContent = l.name;
    $("lvLayout").classList.toggle("on", !print);
    $("lvPrint").classList.toggle("on", print);
    $("layoutView").hidden = false;
    const f = LayoutRender.FORMATS[l.format];
    const twice = print && (l.format === "strip" || l.format === "polaroid"); // a folha leva duas, lado a lado
    const w = twice ? f.w * 2 : f.w, h = f.h;
    const stage = $("lvStage"), view = Math.min((stage.clientWidth - 24) / w, (stage.clientHeight - 24) / h);
    $("lvHint").textContent = !print ? `${FORMAT[l.format]} · fotos numeradas na ordem em que são tiradas.`
      : twice ? "Folha 10×15 no tamanho exato em que sai: as duas tiras lado a lado; a impressora corta na linha vermelha."
      : "Folha 10×15 no tamanho exato em que sai (papel, corte e orientação vêm das Preferências de impressão do Windows).";
    try {
      const c = await LayoutRender.render(l, assetsRoot + l.id + "/", { scale: view * devicePixelRatio, sheet: print });
      if (viewing !== l || printMode !== print) return; // trocou de modo enquanto desenhava
      c.style.width = Math.round(w * view) + "px";
      const sheet = document.createElement("div");
      sheet.className = "lview-sheet";
      sheet.append(c);
      if (twice) sheet.append(Object.assign(document.createElement("i"), { className: "lview-cut" }));
      stage.replaceChildren(sheet);
    } catch (err) {
      stage.textContent = err.message;
    }
  }
  const closeView = () => { $("layoutView").hidden = true; $("lvStage").replaceChildren(); viewing = null; };
  $("lvClose").onclick = closeView;
  $("layoutView").onclick = e => { if (e.target === $("layoutView") || e.target === $("lvStage")) closeView(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && viewing) closeView(); });
  $("lvLayout").onclick = () => viewing && viewLayout(viewing, false);
  $("lvPrint").onclick = () => viewing && viewLayout(viewing, true);

  async function thumb(l, holder, size = 150) {
    const f = LayoutRender.FORMATS[l.format], view = Math.min(size / f.w, size / f.h);
    try {
      const c = await LayoutRender.render(l, assetsRoot + l.id + "/", { scale: view * devicePixelRatio });
      c.style.width = Math.round(f.w * view) + "px";
      holder.replaceChildren(c);
    } catch (err) {
      holder.textContent = err.message;
    }
  }

  $("efAddLayout").onchange = () => {
    const id = $("efAddLayout").value;
    if (!id) return;
    form.ev.layouts = [...form.ev.layouts, id];
    form.ev.defaultLayout ??= id;
    renderForm();
  };
  // Criar layout: vai para o editor; ao sair dele, volta para este evento com o layout novo já escolhido (se foi salvo)
  let creating = false;
  $("efNewLayout").onclick = () => {
    creating = true;
    document.dispatchEvent(new CustomEvent("layoutFor", { detail: $("efName").value.trim() || null }));
    showTab("layouts");
  };
  document.addEventListener("layoutClosed", e => {
    if (!creating || !form) return;
    creating = false;
    if (e.detail.saved && !form.ev.layouts.includes(e.detail.id)) {
      form.ev.layouts = [...form.ev.layouts, e.detail.id];
      form.ev.defaultLayout ??= e.detail.id;
    }
    showTab("events");
  });

  const save = () => {
    const pw = $("efPw").value;
    if (pw || !form.ev.passwordHash) {
      if (pw.length < 4) return toast("Crie a senha do evento com pelo menos 4 caracteres.", true);
      if (pw !== $("efPw2").value) return toast("As duas senhas não são iguais.", true);
      if (form.ev.passwordHash && !$("efPwCur").value) return toast("Para trocar a senha, digite a senha atual.", true);
    }
    send({ type: "events.save", event: form.ev, password: pw || null, currentPassword: pw ? $("efPwCur").value : null });
  };
  $("btnNewEvent").onclick = () => { view = "open"; send({ type: "events.new" }); };
  $("evTabs").querySelectorAll("button").forEach(b => (b.onclick = () => { view = b.dataset.v; renderList(); }));
  $("efBack").onclick = closeForm;
  $("efSave").onclick = save;

  host?.addEventListener("message", e => {
    const m = e.data;
    switch (m.type) {
      case "events":
        events = m.list;
        activeId = m.activeId;
        defaultPhrases = m.defaultPhrases;
        renderList();
        break;
      case "eventSummary": {
        const s = m.summary, n = v => (v ?? 0).toLocaleString("pt-BR");
        $("sumName").textContent = s.name;
        $("modalSummary").querySelector(".eyebrow").textContent = events.find(x => x.id === m.id)?.closed ? "Resumo do evento" : "Contadores do evento";
        $("sumDate").textContent = s.date;
        $("sumPhotos").textContent = n(s.photos);
        $("sumSessions").textContent = n(s.sessions);
        $("sumPrints").textContent = n(s.prints);
        $("sumTime").textContent = s.time;
        $("sumMail").onclick = () => send({ type: "events.mail", id: m.id });
        $("sumFolder").onclick = () => send({ type: "events.folder", id: m.id });
        $("modalSummary").hidden = false;
        break;
      }
      case "eventOpen": openForm(m.event, !events.some(x => x.id === m.event.id)); break;
      case "eventSaved":
        if (!form || form.ev.id !== m.event.id) break;
        toast(m.active ? `Evento “${m.event.name}” salvo e ativo.` : `Evento “${m.event.name}” salvo.`);
        form = null; // volta para a lista sem perguntar
        $("evForm").hidden = true;
        $("evList").hidden = false;
        break;
      case "layouts":
        layouts = m.list;
        assetsRoot = m.assetsRoot;
        if (form) renderLayoutPicker();
        renderList(); // miniaturas dos cartões
        break;
      case "layoutSaved": // layout criado por “Criar layout” aparece na lista mesmo antes de voltar
        if (creating) send({ type: "layouts.list" });
        break;
    }
  });

  document.addEventListener("screen", e => {
    if (e.detail !== "events") return;
    send({ type: "layouts.list" });
    send({ type: "events.list" });
  });
  send({ type: "events.list" });
})();
