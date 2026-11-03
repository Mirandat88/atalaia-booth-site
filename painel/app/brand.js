// Marca (Configurações → Marca): aplica em todo o app o nome, contatos, logos, cores e fontes da empresa,
// e cuida da tela onde isso é configurado. O app (Brand.cs) guarda e valida; aqui só mostra e envia.
const BRAND_DEFAULT = {
  name: "Visualize Locações e Eventos", short: "Visualize", phone: "(47) 99761-3155", instagram: "@visualize360.rec",
  accent: "#C9A96E", background: "#0E0D0C", text: "#F4EFE6", rec: "#BE2D24", titleFont: "Cormorant Garamond", textFont: "Jost",
};
const BRAND_IMG = { logo: "img/logo-horizontal.svg", logoDark: "img/logo-horizontal-escura.svg", icon: "img/logo-camera.svg", iconDark: "img/logo-camera-escura.svg" };
let brand = { ...BRAND_DEFAULT }, brandRoot = "";

/** Endereço de um logo da marca (o enviado, ou o desenho padrão da Visualize). Versão escura sem arquivo usa a normal. */
function brandImg(slot) {
  const file = brand[slot] || (slot.endsWith("Dark") ? brand[slot.replace("Dark", "")] : null);
  return file ? brandRoot + encodeURIComponent(file) : BRAND_IMG[slot];
}

(() => {
  const VIS = structuredClone({ vars: THEMES.visualize.vars, fx: THEMES.visualize.fx, blades: THEMES.visualize.blades, dark: THEMES.visualize.dark, name: THEMES.visualize.name });
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join(""); // a → b
  const rgb = h => hex(h).join(",");
  const light = h => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55; };
  const FONTS = ["Cormorant Garamond", "Jost", "Georgia", "Palatino Linotype", "Times New Roman", "Cambria", "Constantia",
    "Segoe UI", "Arial", "Verdana", "Trebuchet MS", "Calibri", "Candara", "Corbel", "Century Gothic"];

  function apply() {
    const root = document.documentElement.style, b = brand;
    const custom = b.accent !== BRAND_DEFAULT.accent || b.background !== BRAND_DEFAULT.background || b.text !== BRAND_DEFAULT.text || b.rec !== BRAND_DEFAULT.rec;
    // cores do app: as 4 da marca e os tons do meio calculados entre fundo e texto
    const vars = custom ? {
      "--noir": b.background, "--marfim": b.text, "--champ": b.accent, "--rec": b.rec,
      "--grafite": mix(b.background, b.text, .07), "--fumaca": mix(b.background, b.text, .16),
      "--prata": mix(b.background, b.text, .6), "--pedra": mix(b.background, b.text, .42), "--linho": mix(b.background, b.text, .88),
    } : {};
    for (const k of ["--noir", "--marfim", "--champ", "--rec", "--grafite", "--fumaca", "--prata", "--pedra", "--linho"])
      vars[k] ? root.setProperty(k, vars[k]) : root.removeProperty(k);

    // fontes: arquivo enviado > fonte escolhida > padrão
    let css = "";
    const family = (file, name, alias, fallback) => {
      if (file) { css += `@font-face{font-family:"${alias}";src:url("${brandRoot + encodeURIComponent(file)}");font-display:block}`; return `"${alias}",${fallback}`; }
      return `"${name}",${fallback}`;
    };
    root.setProperty("--serif", family(b.titleFontFile, b.titleFont, "MarcaTitulo", "Georgia,serif"));
    root.setProperty("--sans", family(b.textFontFile, b.textFont, "MarcaTexto", "\"Segoe UI\",sans-serif"));
    ($("brandFonts") ?? document.head.appendChild(Object.assign(document.createElement("style"), { id: "brandFonts" }))).textContent = css;

    // tema padrão (o da tela de espera) com as cores da marca
    const t = THEMES.visualize;
    Object.assign(t, structuredClone(VIS));
    t.name = b.short;
    if (custom) {
      t.vars = {
        bg: `radial-gradient(ellipse at 50% 45%,${mix(b.background, b.text, .05)} 0%,${mix(b.background, "#000000", .45)} 70%)`,
        text: b.text, accent: b.accent, line: `rgba(${rgb(b.text)},.07)`, btn: `rgba(${rgb(b.background)},.55)`,
      };
      t.blades = [mix(b.background, b.text, .1), mix(b.background, b.text, .16)];
      t.fx = [{ kind: "bokeh", n: 26, colors: [rgb(b.text), rgb(b.text), rgb(b.accent)] }];
      t.dark = light(b.background); // fundo claro: logos escuros
    }

    // textos e logos espalhados pelo app
    for (const el of document.querySelectorAll("[data-brand]")) el.textContent = b[el.dataset.brand] || "";
    for (const img of document.querySelectorAll("img[data-logo]")) img.src = brandImg(img.dataset.logo);
    document.querySelector(".home-logo").src = brandImg(t.dark ? "logoDark" : "logo"); // tela de espera: fundo claro usa o logo escuro
    $("home").classList.toggle("custom-icon", !!b.icon); // símbolo próprio: sem o obturador desenhado na lente da Visualize
    $("railMarkImg").hidden = !b.icon;
    $("railMarkImg").src = b.icon ? brandImg("icon") : "";
    $("railMarkSvg").style.display = b.icon ? "none" : "";
    window.refreshTheme?.();
    fillForm();
  }

  // ===================== tela Configurações → Marca =====================

  const F = {
    name: "brName", short: "brShort", phone: "brPhone", instagram: "brInsta", site: "brSite", qrLink: "brQrLink",
    accent: "brAccent", background: "brBg", text: "brText", rec: "brRec", titleFont: "brTitleFont", textFont: "brTextFont",
  };
  for (const id of ["brTitleFont", "brTextFont"]) $(id).innerHTML = FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join("");
  let qrMode = "whats";

  function fillForm() {
    for (const [k, id] of Object.entries(F)) if (document.activeElement !== $(id)) $(id).value = brand[k] ?? "";
    for (const id of ["brTitleFont", "brTextFont"]) if (![...$(id).options].some(o => o.value === $(id).value)) $(id).value = FONTS[0];
    qrMode = brand.qrLink ? "link" : "whats";
    $("brQrMode").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === qrMode));
    $("brQrLinkRow").hidden = qrMode !== "link";
    for (const [slot, label] of [["titleFontFile", "brTitleFile"], ["textFontFile", "brTextFile"]]) {
      $(label).hidden = !brand[slot];
      $(label).querySelector("span").textContent = brand[slot] ? `Usando a fonte enviada (${brand[slot]})` : "";
    }
    for (const card of document.querySelectorAll(".brlogo")) {
      const slot = card.dataset.slot;
      card.querySelector("img").src = brandImg(slot);
      card.querySelector("small").textContent = brand[slot] ? brand[slot] : (slot.endsWith("Dark") && brand[slot.replace("Dark", "")] ? "usa a versão normal" : "padrão Visualize");
      card.querySelector("[data-a=clear]").hidden = !brand[slot];
    }
  }

  function save() {
    const out = { ...brand };
    for (const [k, id] of Object.entries(F)) out[k] = $(id).value;
    if (qrMode === "whats") out.qrLink = "";
    send({ type: "brand.save", brand: out });
  }
  for (const id of Object.values(F)) $(id).onchange = save;
  $("brQrMode").querySelectorAll("button").forEach(b => (b.onclick = () => {
    qrMode = b.dataset.v;
    $("brQrMode").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    $("brQrLinkRow").hidden = qrMode !== "link";
    if (qrMode === "whats") save(); else $("brQrLink").focus();
  }));
  document.querySelectorAll("[data-pick]").forEach(b => (b.onclick = () => send({ type: "brand.pick", slot: b.dataset.pick })));
  document.querySelectorAll("[data-unpick]").forEach(b => (b.onclick = () => send({ type: "brand.clear", slot: b.dataset.unpick })));
  for (const card of document.querySelectorAll(".brlogo")) {
    card.querySelector("[data-a=pick]").onclick = () => send({ type: "brand.pick", slot: card.dataset.slot });
    card.querySelector("[data-a=clear]").onclick = () => send({ type: "brand.clear", slot: card.dataset.slot });
  }
  $("brReset").onclick = () => {
    if (confirm("Voltar toda a marca para a Visualize (nome, contatos, cores, fontes e logos)?\n\nOs arquivos enviados continuam guardados na pasta da marca."))
      send({ type: "brand.reset" });
  };
  $("brPreview").onclick = () => showHome();

  host?.addEventListener("message", e => {
    if (e.data.type !== "brand") return;
    brand = { ...BRAND_DEFAULT, ...e.data.brand };
    brandRoot = e.data.root;
    apply();
  });
  document.addEventListener("screen", e => { if (e.detail === "brand") send({ type: "brand.get" }); });
})();
