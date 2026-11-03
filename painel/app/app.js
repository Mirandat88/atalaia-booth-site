// Configurações → Câmera (Etapa 03). Conversa com o app (C#) por mensagens: send({type,...}) e on(message).
const $ = id => document.getElementById(id);
const host = window.chrome?.webview;
const send = msg => host?.postMessage(msg);
// erros da tela vão para o registro do app (o mesmo arquivo que olhamos quando algo falha)
window.onerror = (message, src, line, col) => send({ type: "jsError", message: `${message} (${src?.split("/").pop()}:${line}:${col})` });
let state = {}, busy = false, focusing = false;

function toast(text, isError) {
  const t = $("toast");
  t.textContent = text;
  t.className = "toast" + (isError ? " err" : "");
  t.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.style.display = "none"), isError ? 7000 : 3500);
}

/** Pede a senha do evento numa janela própria (por cima de tudo). Resolve com a senha ou null (cancelou). */
function askPassword(what, title, text) {
  $("pwAskWhat").textContent = what;
  $("pwAskTitle").textContent = title;
  $("pwAskText").textContent = text || "";
  $("pwAsk").value = "";
  $("modalPw").hidden = false;
  setTimeout(() => $("pwAsk").focus(), 50);
  return new Promise(resolve => {
    const done = v => { $("modalPw").hidden = true; $("pwAskYes").onclick = $("pwAskNo").onclick = $("pwAsk").onkeydown = null; resolve(v); };
    $("pwAskYes").onclick = e => { e.stopPropagation(); done($("pwAsk").value); };
    $("pwAskNo").onclick = e => { e.stopPropagation(); done(null); };
    $("pwAsk").onkeydown = e => { if (e.key === "Enter") done($("pwAsk").value); if (e.key === "Escape") done(null); };
  });
}
$("modalPw").onclick = e => e.stopPropagation();

function fillSelect(sel, options, value) {
  sel.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
  if (value != null) sel.value = value;
}

function renderState(s) {
  state = s;
  $("camDot").classList.toggle("on", s.connected);
  $("camName").textContent = s.connected ? s.model : "Desconectada";
  $("btnConnect").textContent = s.connected ? "Desconectar" : "Conectar";
  $("btnLive").disabled = !s.connected;
  $("btnLive").textContent = s.liveView ? "Pausar ao vivo" : "Ver ao vivo";
  $("warnM").style.display = s.connected && !s.manual ? "block" : "none";
  $("empty").hidden = s.connected && s.liveView;
  $("live").hidden = !(s.connected && s.liveView);
  $("rec").style.display = s.connected && s.liveView ? "flex" : "none";
  $("hung").style.display = s.hung ? "flex" : "none";
  const canFocus = s.connected && s.liveView && !s.lensMF;
  $("btnAF").disabled = !canFocus || focusing;
  document.querySelectorAll(".focus button").forEach(b => (b.disabled = !canFocus));
  $("btnZoom").disabled = !(s.connected && s.liveView);
  $("btnZoom").classList.toggle("on", s.zoomed);
  $("warnMF").style.display = s.connected && s.lensMF ? "block" : "none";
  $("auto").checked = s.autoExposure;
  $("auto").disabled = !s.connected || !s.manual;
  for (const key of ["iso", "av", "tv", "wb"]) {
    const sel = $(key), e = s.exposure?.[key];
    // no automático o app escolhe ISO, abertura e velocidade, e a câmera acerta a cor (balanço de branco automático)
    sel.disabled = !e || !s.manual || s.autoExposure;
    if (e) fillSelect(sel, e.options.map(o => ({ value: o.code, label: o.label })), e.value);
    else sel.innerHTML = "";
  }
  fillSelect($("profile"), s.profiles.map(p => ({ value: p, label: p })), s.lastProfile);
  $("btnApply").disabled = !s.connected || !s.profiles.length;
  $("btnSave").disabled = !s.connected;
  $("btnShoot").disabled = !s.connected || busy;
  if (s.countdown != null && document.activeElement !== $("countdown")) { $("countdown").value = s.countdown; showCountdown(); }
}

const showCountdown = () => ($("countdownTxt").textContent = +$("countdown").value ? $("countdown").value + " s" : "sem contagem");

// Nitidez relativa: 100% = o melhor ponto visto há pouco (o número absoluto muda com a cena).
// O recorde zera no foco automático e na lupa, e se apaga devagar (~metade a cada 10 s) quando alguém entra ou sai da cena.
let bestSharp = 0;
function showSharpness(v) {
  bestSharp = Math.max(bestSharp * 0.977, v);
  const pct = bestSharp ? Math.round(v / bestSharp * 100) : 0;
  $("sharpBar").style.width = pct + "%";
  $("sharpBar").classList.toggle("best", pct >= 95);
  $("sharpTxt").textContent = pct >= 95 ? "no ponto" : pct + "%";
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function shoot() {
  if (busy || !state.connected) return;
  busy = true;
  $("btnShoot").disabled = true;
  const seconds = +$("countdown").value;
  if (seconds > 0) {
    const c = $("count");
    c.style.display = "flex";
    for (let n = seconds; n > 0; n--) { c.textContent = n; await wait(1000); }
    c.style.display = "none";
  }
  send({ type: "capture" });
}

function captured(m) {
  const f = $("flash");
  f.style.transition = "none"; f.style.opacity = 1;
  requestAnimationFrame(() => { f.style.transition = "opacity .5s"; f.style.opacity = 0; });
  const img = document.createElement("img");
  img.src = m.url;
  $("thumbs").prepend(img);
  while ($("thumbs").children.length > 6) $("thumbs").lastChild.remove();
  busy = false;
  $("btnShoot").disabled = !state.connected;
}

host?.addEventListener("message", e => {
  const m = e.data;
  switch (m.type) {
    case "state": renderState(m); break;
    case "frame":
      $("live").src = "data:image/jpeg;base64," + m.data;
      if (m.sharpness != null) showSharpness(m.sharpness);
      break;
    case "captured": captured(m); break;
    case "camera": toast(m.message, true); send({ type: "ready" }); break;
    case "notice": toast(m.message, true); break;
    case "info": toast(m.message); send({ type: "ready" }); break;
    case "focused": focusing = false; $("btnAF").textContent = "Focar"; renderState(state); break;
    case "hung": $("hung").style.display = "flex"; break;
    case "error":
      busy = false;
      if (focusing) { focusing = false; $("btnAF").textContent = "Focar"; renderState(state); }
      $("btnShoot").disabled = !state.connected;
      toast(m.message, true);
      break;
  }
});

$("btnConnect").onclick = () => send({ type: state.connected ? "disconnect" : "connect" });
$("btnLive").onclick = () => send({ type: "liveview", on: !state.liveView });
for (const key of ["iso", "av", "tv", "wb"]) $(key).onchange = e => send({ type: "set", key, value: +e.target.value });
$("auto").onchange = e => send({ type: "autoExposure", on: e.target.checked });
$("btnAF").onclick = () => {
  focusing = true;
  bestSharp = 0;
  $("btnAF").disabled = true;
  $("btnAF").textContent = "…";
  send({ type: "autofocus" });
};
document.querySelectorAll(".focus button[data-step]").forEach(b => (b.onclick = () => send({ type: "focus", step: +b.dataset.step })));
$("btnZoom").onclick = () => { bestSharp = 0; send({ type: "zoom", on: !state.zoomed }); };
$("btnRestart").onclick = () => send({ type: "restart" });
$("btnApply").onclick = () => send({ type: "applyProfile", name: $("profile").value });
$("btnSave").onclick = () => {
  const name = $("profileName").value.trim();
  if (!name) return toast("Dê um nome ao perfil (ex.: Salão escuro).", true);
  send({ type: "saveProfile", name });
  $("profileName").value = "";
  toast(`Perfil “${name}” salvo.`);
};
$("btnShoot").onclick = shoot;
$("countdown").oninput = showCountdown;
$("countdown").onchange = () => send({ type: "countdown", seconds: +$("countdown").value });
$("btnFolder").onclick = () => send({ type: "openFolder" });
document.addEventListener("keydown", e => {
  if (tab === "camera" && e.code === "Space" && e.target.tagName !== "INPUT") { e.preventDefault(); shoot(); }
});

// ---------- menu lateral: Eventos · Configurações → Câmera / Impressão / Layouts / Contadores ----------
let tab = "events";
function showTab(name) {
  tab = name;
  document.querySelectorAll(".rail [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  for (const t of document.querySelectorAll(".tab[id^='tab-']")) t.hidden = t.id !== "tab-" + name; // o painel acrescenta as dele
  document.dispatchEvent(new CustomEvent("screen", { detail: name }));
}
document.querySelectorAll(".rail [data-tab]").forEach(b => (b.onclick = () => showTab(b.dataset.tab)));
// Câmera, Impressão, Layouts e Contadores só aparecem depois de clicar na engrenagem
const cfgMenu = open => { $("cfgMenu").hidden = !open; $("btnCfg").setAttribute("aria-expanded", open); $("btnCfg").classList.toggle("open", open); };
$("btnCfg").onclick = () => cfgMenu($("cfgMenu").hidden);
document.addEventListener("screen", e => cfgMenu(e.detail !== "events"));
document.addEventListener("DOMContentLoaded", () => showTab("events")); // depois de events.js, que ouve "screen"

send({ type: "ready" });
