// Configurações → Sessão (Etapa 06): tempos da sessão de fotos e galeria de temas.
// A contagem (#countdown) continua com app.js, que já a envia e usa na foto de teste da Câmera.
/**
 * Tempos para uma sessão de n fotos chegar perto do tempo médio (target). Só frases e “ver a foto” mudam, na mesma
 * proporção; contagem, foto, voo, pilha final (3,5 s por foto) e agradecimento ficam. total = duração estimada.
 */
function fitSessionTimes(t, n) {
  const fixed = n * (t.countdown + 2.5) + n * 3.5 + 2 + t.thanks; // contagem + disparo/voo, pilha, montagem, agradecimento
  const phrases = 2 * n; // 1ª foto: 1 frase; as outras: 2; mais “vamos ver como ficou”
  let phrase = t.phrase, review = t.review;
  if (t.target) {
    const k = Math.max(0, (t.target - fixed) / (phrases * 2.5 + n * 4)); // proporção dos padrões 2,5 s e 4 s
    phrase = Math.min(6, Math.max(1, 2.5 * k));
    review = Math.min(15, Math.max(1, 4 * k));
  }
  return { phrase, review, total: fixed + phrases * phrase + n * Math.max(review, .8) };
}

(() => {
  const TIMES = [
    ["stPhrase", "phrase", v => v.toLocaleString("pt-BR") + " s"],
    ["stReview", "review", v => (v ? v + " s" : "não mostra")],
    ["stFinal", "final", v => v + " s"],
    ["stThanks", "thanks", v => v + " s"],
    ["stTarget", "target", v => (v ? v + " s" : "desligado")],
  ];
  const s1 = v => (Math.round(v * 10) / 10).toLocaleString("pt-BR");

  /** Mostra quanto dura uma sessão de 3 fotos e, com tempo médio ligado, os tempos que o app vai usar. */
  function estimate() {
    const t = { countdown: +$("countdown").value, ...Object.fromEntries(TIMES.map(([i, k]) => [k, +$(i).value])) };
    const f = fitSessionTimes(t, 3);
    $("stEstimate").textContent = t.target
      ? `Com 3 fotos: cada frase ${s1(f.phrase)} s e cada foto na tela ${s1(f.review)} s → sessão de ≈ ${Math.round(f.total)} s (a contagem não muda). Com 4 fotos, o app recalcula para o mesmo tempo.`
      : `Com os tempos acima, uma sessão de 3 fotos dura ≈ ${Math.round(f.total)} s (sem contar a espera na tela “como ficou”).`;
    $("stPhrase").disabled = $("stReview").disabled = !!t.target; // ajustados pelo tempo médio
  }
  const label = (id, fmt) => ($(id).nextElementSibling.textContent = fmt(+$(id).value));
  for (const [id, , fmt] of TIMES) {
    $(id).oninput = () => { label(id, fmt); estimate(); };
    $(id).onchange = () => send({ type: "sessionTimes", ...Object.fromEntries(TIMES.map(([i, k]) => [k, +$(i).value])) });
  }

  host?.addEventListener("message", e => {
    if (e.data.type !== "state" || !e.data.session) return;
    for (const [id, key, fmt] of TIMES)
      if (document.activeElement !== $(id)) { $(id).value = e.data.session[key] ?? 0; label(id, fmt); }
    estimate();
  });
  $("countdown").addEventListener("input", estimate);

  // ===================== temas: os 7 fixos + os personalizados =====================

  // valores de partida de cada tema fixo, para “Personalizar a partir deste”
  const PRESETS = {
    visualize: { bgStyle: "radial", bg1: "#141210", bg2: "#070706", text: "#F4EFE6", accent: "#C9A96E", titleFont: "Cormorant Garamond", italic: true, bold: false, fx: "bokeh", fxColor: "#C9A96E", glow: false, icons: ["camera", "strip", "arch", "photo"] },
    aniversario: { bgStyle: "radial", bg1: "#2C1650", bg2: "#120A24", text: "#FFF6EC", accent: "#FFCF5A", titleFont: "Jost", italic: false, bold: true, fx: "confetti", fxColor: "#FF5D8F", glow: true, icons: ["balloon", "gift", "cake", "hat"] },
    quinze: { bgStyle: "radial", bg1: "#3F1430", bg2: "#16060F", text: "#FFF0F5", accent: "#E8B4A0", titleFont: "Cormorant Garamond", italic: true, bold: true, fx: "sparkle", fxColor: "#FFB6CE", glow: true, icons: ["crown", "butterfly", "star"] },
    casamento: { bgStyle: "radial", bg1: "#FBF7F0", bg2: "#ECE2D2", text: "#3A332B", accent: "#A9844F", titleFont: "Cormorant Garamond", italic: true, bold: false, fx: "petal", fxColor: "#F0C8CD", glow: true, icons: ["rings", "heart", "leaf"] },
    confraternizacao: { bgStyle: "radial", bg1: "#123228", bg2: "#06120E", text: "#FDF6E3", accent: "#E8B04A", titleFont: "Cormorant Garamond", italic: true, bold: true, fx: "lights", fxColor: "#FFD678", glow: false, icons: ["glasses", "star", "ornament", "gift"] },
    corporativo: { bgStyle: "linear", bg1: "#0F1D30", bg2: "#08111C", text: "#EEF3F8", accent: "#4FB3D9", titleFont: "Jost", italic: false, bold: false, fx: "network", fxColor: "#4FB3D9", glow: false, icons: ["hexagon", "chart", "photo"] },
    infantil: { bgStyle: "linear", bg1: "#BFE6FF", bg2: "#FFF1C2", text: "#25306B", accent: "#FF6B6B", titleFont: "Jost", italic: false, bold: true, fx: "balloon", fxColor: "#4DABF7", glow: false, icons: ["cloud", "star", "rainbow"] },
  };
  const BUILTIN = Object.keys(PRESETS);
  let customs = [];

  host?.addEventListener("message", e => {
    if (e.data.type !== "themes") return;
    for (const k of Object.keys(THEMES)) if (THEMES[k].custom) delete THEMES[k];
    customs = e.data.list;
    for (const c of customs) THEMES[ThemeKey(c.id)] = customTheme(c);
    renderGallery();
    document.dispatchEvent(new CustomEvent("themeschanged", { detail: { savedId: e.data.savedId && ThemeKey(e.data.savedId) } }));
    if (e.data.savedId) { closeEditor(); toast("Tema salvo."); }
  });
  function ThemeKey(id) { return "custom:" + id; }

  // galeria: tocar no tema mostra em tela cheia; os personalizados têm Editar, os fixos têm Personalizar
  function renderGallery() {
    const gallery = $("themeGallery");
    gallery.replaceChildren();
    for (const key of Object.keys(THEMES)) {
      const card = themeCard(key), custom = THEMES[key].custom;
      card.insertAdjacentHTML("beforeend", `<div class="tacts"><button class="see" data-a="see">Ver</button><button class="see" data-a="edit">${custom ? "Editar" : "Personalizar"}</button></div>`);
      card.onclick = e => {
        const a = e.target.closest("[data-a]")?.dataset.a;
        if (a === "edit") return custom ? openEditor(customs.find(c => ThemeKey(c.id) === key)) : openEditor({ ...PRESETS[key], name: THEMES[key].name + " (meu)" });
        showGuest({ id: null, name: "Exemplo · " + THEMES[key].name, phrase: "Toque na tela e sorria!", theme: key });
      };
      gallery.append(card);
    }
    const add = document.createElement("button");
    add.className = "tcard tnew";
    add.innerHTML = "<span>+</span><b>Tema personalizado</b><small>cores, fontes, fundo animado e desenhos</small>";
    add.onclick = () => openEditor({ ...PRESETS.visualize, name: "" });
    gallery.append(add);
  }
  renderGallery();

  // ===================== editor do tema personalizado =====================

  const FONTS = ["Cormorant Garamond", "Jost", "Georgia", "Palatino Linotype", "Times New Roman", "Cambria", "Constantia",
    "Segoe UI", "Segoe Script", "Lucida Handwriting", "Arial", "Verdana", "Trebuchet MS", "Calibri", "Candara", "Corbel", "Century Gothic"];
  for (const id of ["teTitleFont", "teTextFont"]) $(id).innerHTML = FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join("");
  $("teBase").innerHTML = BUILTIN.map(k => `<option value="${k}">${THEMES[k].name}</option>`).join("");
  $("teFx").innerHTML = Object.entries(FX_KINDS).map(([k, [label]]) => `<button data-v="${k}">${label}</button>`).join("");
  $("teIcons").innerHTML = Object.entries(ICON_NAMES).map(([k, label]) => `<button data-v="${k}" title="${label}">${THEME_ICONS[k]}<span>${label}</span></button>`).join("");

  let edit = null, raf = 0;
  const seg = (id, v) => $(id).querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === String(v)));

  function openEditor(t) {
    edit = { id: "", bgStyle: "radial", amount: 2, logo: "auto", textFont: "Jost", icons: [], ...structuredClone(t) };
    $("teDelete").hidden = !edit.id;
    fill();
    $("modalTheme").hidden = false;
    cancelAnimationFrame(raf);
    let last = performance.now(), draw = null, key = "";
    const loop = now => { // prévia animada enquanto o editor está aberto
      if ($("modalTheme").hidden) return;
      const json = JSON.stringify(edit);
      if (json !== key) { key = json; draw = themeParticles(customTheme(edit)); }
      const c = $("teCanvas"), r = c.getBoundingClientRect();
      draw(c.getContext("2d"), (c.width = r.width), (c.height = r.height), Math.min(.1, (now - last) / 1000), now / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  // o formulário do evento também cria tema personalizado
  window.newCustomTheme = () => openEditor({ ...PRESETS.visualize, name: "" });
  function closeEditor() { $("modalTheme").hidden = true; cancelAnimationFrame(raf); edit = null; }

  function fill() {
    $("teName").value = edit.name || "";
    for (const [id, k] of [["teBg1", "bg1"], ["teBg2", "bg2"], ["teText", "text"], ["teAccent", "accent"], ["teFxColor", "fxColor"]]) $(id).value = edit[k];
    $("teTitleFont").value = edit.titleFont; $("teTextFont").value = edit.textFont;
    $("teItalic").checked = !!edit.italic; $("teBold").checked = !!edit.bold; $("teGlow").checked = !!edit.glow;
    seg("teBgStyle", edit.bgStyle); seg("teAmount", edit.amount); seg("teLogo", edit.logo); seg("teFx", edit.fx);
    $("teBg2Row").hidden = edit.bgStyle === "solid";
    $("teIcons").querySelectorAll("button").forEach(b => b.classList.toggle("on", edit.icons.includes(b.dataset.v)));
    preview();
  }

  function preview() {
    const t = customTheme(edit);
    $("teScreen").style.background = t.vars.bg;
    $("tePhrase").style.font = t.font.replace(/ [.\d]+em /, " 30px ");
    $("tePhrase").style.color = t.vars.text;
    $("teSmall").style.fontFamily = t.sansFont;
    $("teSmall").style.color = t.vars.accent;
    $("teCam").src = brandImg(t.dark ? "iconDark" : "icon");
    $("teIconsBg").innerHTML = t.icons.join("");
    $("teIconsBg").style.stroke = t.vars.line;
  }

  // cada mudança no formulário já aparece na prévia
  const bind = (id, k, read = el => el.value) => ($(id).oninput = $(id).onchange = () => { edit[k] = read($(id)); fill(); });
  bind("teName", "name"); bind("teBg1", "bg1"); bind("teBg2", "bg2"); bind("teText", "text"); bind("teAccent", "accent"); bind("teFxColor", "fxColor");
  bind("teTitleFont", "titleFont"); bind("teTextFont", "textFont");
  bind("teItalic", "italic", el => el.checked); bind("teBold", "bold", el => el.checked); bind("teGlow", "glow", el => el.checked);
  for (const [id, k, num] of [["teBgStyle", "bgStyle"], ["teAmount", "amount", true], ["teLogo", "logo"], ["teFx", "fx"]])
    $(id).querySelectorAll("button").forEach(b => (b.onclick = () => { edit[k] = num ? +b.dataset.v : b.dataset.v; fill(); }));
  $("teIcons").querySelectorAll("button").forEach(b => (b.onclick = () => {
    const k = b.dataset.v;
    if (edit.icons.includes(k)) edit.icons = edit.icons.filter(x => x !== k);
    else if (edit.icons.length < 4) edit.icons = [...edit.icons, k];
    else return toast("Até 4 desenhos por tema.", true);
    fill();
  }));
  $("teBase").onchange = () => { edit = { ...edit, ...structuredClone(PRESETS[$("teBase").value]) }; fill(); };
  $("teSave").onclick = () => {
    if (!edit.name?.trim()) return toast("Dê um nome ao tema.", true);
    send({ type: "themes.save", theme: edit });
  };
  $("teCancel").onclick = closeEditor;
  $("teDelete").onclick = () => {
    if (confirm(`Excluir o tema “${edit.name}”?\n\nOs eventos que usam este tema voltam a mostrar o tema ${THEMES.visualize.name}. O arquivo do tema fica guardado na pasta temas\\excluídos.`)) {
      send({ type: "themes.delete", id: edit.id });
      closeEditor();
    }
  };
  $("teFull").onclick = () => {
    const key = "custom:__previa";
    THEMES[key] = customTheme({ ...edit, id: "__previa" });
    showGuest({ id: null, name: "Prévia · " + (edit.name || "Tema personalizado"), phrase: "Toque na tela e sorria!", theme: key });
    toast("Prévia do tema. Volte pelo botão de menu.");
  };
  $("modalTheme").onclick = e => { if (e.target === $("modalTheme")) closeEditor(); };
})();
