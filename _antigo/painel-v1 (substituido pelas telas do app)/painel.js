// Painel online do Atalaia Booth: a mesma conta e a mesma nuvem (Supabase) do app.
// Os eventos são os mesmos arquivos que o app sincroniza (eventos/<id>.json): salvar aqui = o equipamento recebe em segundos.
// A chave abaixo é a pública (feita para ficar no navegador); quem protege os dados são as regras do banco.
const URL_ = "https://vcacjcesiyiftoenlcbj.supabase.co";
const KEY = "sb_publishable_tUdrJcNZj0pbbDpQld93Ew_rcETFezK";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const PRODUCT = { totem: "Totem", cabine: "Cabine de Fotos", espelho: "Espelho Mágico", instaprint: "InstaPrint" };
const THEMES = [["visualize", "Padrão"], ["aniversario", "Aniversário"], ["quinze", "15 Anos"], ["casamento", "Casamento"],
  ["confraternizacao", "Confraternização"], ["corporativo", "Corporativo"], ["infantil", "Festa Infantil"]];
const PHRASES = { first: "Prepare-se, é agora!", prepare: "Prepare-se", smile: "Sorria!", next: "Perfeito! Agora vamos para a próxima foto!",
  last: "Última foto, um sorriso bem bonito!", review: "Agora vamos ver como ficou?", thanks: "Muito obrigado por fazer parte dessa festa!", pickup: "Pegue sua foto com o monitor." };

function toast(text, err) {
  const t = $("toast");
  t.textContent = text; t.className = "toast" + (err ? " err" : ""); t.style.display = "block";
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.style.display = "none"), err ? 7000 : 3500);
}

// ---------- login (o mesmo do app) ----------
let session = JSON.parse(localStorage.getItem("atalaia.login") || "null");
const keep = s => { session = s; s ? localStorage.setItem("atalaia.login", JSON.stringify(s)) : localStorage.removeItem("atalaia.login"); };

async function auth(path, body) {
  const r = await fetch(URL_ + "/auth/v1/" + path, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(/Invalid login/.test(j.msg || j.error_description || "") ? "E-mail ou senha errados."
    : /not confirmed/.test(j.msg || "") ? "Confirme o seu e-mail antes de entrar." : (j.msg || j.error_description || "Não consegui entrar."));
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + (j.expires_in - 60) * 1000, uid: j.user.id, email: j.user.email };
}

async function token() {
  if (!session) throw new Error("sair");
  if (Date.now() > session.expires) {
    try { keep(await auth("token?grant_type=refresh_token", { refresh_token: session.refresh })); }
    catch { keep(null); throw new Error("sair"); }
  }
  return session.access;
}

async function api(path, opts = {}) {
  const r = await fetch(URL_ + path, { ...opts, headers: { apikey: KEY, Authorization: "Bearer " + (await token()), ...(opts.headers || {}) } });
  if (r.status === 401) { keep(null); show(); throw new Error("sair"); }
  if (!r.ok) {
    const t = await r.text();
    if (/Duplicate|already exists/.test(t)) return null; // o mesmo conteúdo já está na nuvem
    throw new Error(/row-level security|violates/.test(t) ? "Seu nível de acesso não permite isso." : "A nuvem recusou: " + t.slice(0, 160));
  }
  return r.status === 204 ? null : r.headers.get("content-type")?.includes("json") ? r.json() : r.text();
}

// ---------- empresa e arquivos ----------
let me = null, files = [], events = [], layouts = [], themes = [], view = "open", editing = null;

async function sha256(text) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const blob = hash => api(`/storage/v1/object/authenticated/arquivos/${me.empresa}/${hash}`).then(t => typeof t === "string" ? JSON.parse(t) : t);

async function load() {
  $("loading").hidden = false;
  const m = await api(`/rest/v1/membros?select=empresa_id,nivel,nome,desativado,empresas(nome)&user_id=eq.${session.uid}`);
  if (!m.length || m[0].desativado) {
    keep(null); show();
    msg(m.length ? "O seu acesso foi desativado pelo administrador." : "Sua conta ainda não está numa empresa. Entre primeiro pelo app para criar a empresa ou aceitar o convite.", true);
    return;
  }
  me = { empresa: m[0].empresa_id, nivel: m[0].nivel, nome: m[0].nome, empresaNome: m[0].empresas?.nome ?? "" };
  $("who").textContent = `${me.nome || session.email} · ${me.empresaNome}`;
  $("newEvent").hidden = false;
  files = await api("/rest/v1/arquivos?select=caminho,hash,atualizado_em&excluido=is.false&order=caminho");
  const pick = re => files.filter(f => re.test(f.caminho));
  const [ev, ly, th] = await Promise.all([
    Promise.all(pick(/^eventos\/[^/]+\.json$/).map(f => blob(f.hash).catch(() => null))),
    Promise.all(pick(/^layouts\/[^_/][^/]*\/layout\.json$/).map(f => blob(f.hash).catch(() => null))),
    Promise.all(pick(/^temas\/[^/]+\.json$/).map(f => blob(f.hash).catch(() => null))),
  ]);
  events = ev.filter(Boolean);
  layouts = ly.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  themes = th.filter(Boolean);
  $("loading").hidden = true;
  render();
}

// ---------- lista ----------
const dateBR = d => d.split("-").reverse().join("/");
const monthOf = d => { const t = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t[0].toUpperCase() + t.slice(1); };
const untilOf = d => { const n = Math.round((new Date(d + "T00:00") - new Date(new Date().toDateString())) / 864e5); return n === 0 ? "hoje" : n === 1 ? "amanhã" : n > 1 ? `em ${n} dias` : "já passou"; };

function render() {
  const shown = events.filter(e => !!e.closed === (view === "closed"))
    .sort((a, b) => view === "closed" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  $("evTabs").querySelectorAll("button").forEach(b => {
    const n = events.filter(e => !!e.closed === (b.dataset.v === "closed")).length;
    b.classList.toggle("on", b.dataset.v === view);
    b.textContent = (b.dataset.v === "closed" ? "Histórico" : "Aguardando") + (n ? ` (${n})` : "");
  });
  const box = $("cards");
  box.replaceChildren();
  if (!shown.length) box.innerHTML = `<p class="hint">${view === "closed" ? "Nenhum evento encerrado." : "Nenhum evento ainda. Toque em “Criar evento”."}</p>`;
  let month = "";
  for (const e of shown) {
    if (e.date.slice(0, 7) !== month) { month = e.date.slice(0, 7); box.insertAdjacentHTML("beforeend", `<p class="eyebrow month">${monthOf(e.date)}</p>`); }
    const card = document.createElement("article");
    card.className = "card";
    const when = e.closed ? "" : untilOf(e.date);
    card.innerHTML = `<h3>${esc(e.name)}</h3>
      <p>${dateBR(e.date)}${when ? ` <span class="when${when === "já passou" ? " late" : ""}">${when}</span>` : ""} · ${PRODUCT[e.product] ?? e.product}</p>
      <p class="sub">${esc([e.client, e.place].filter(Boolean).join(" · ")) || "&nbsp;"}</p>
      <p class="sub">${(e.layouts || []).length} layout(s) · ${e.print ? "imprime quando o convidado pede" : "sem impressão"}</p>
      <div class="acts"><button class="btn small" data-a="edit">Editar</button>${me.nivel !== "operador" ? '<button class="btn small" data-a="del">Excluir</button>' : ""}</div>`;
    card.onclick = ev => { if (ev.target.dataset.a !== "del") openForm(e); };
    card.querySelector("[data-a=del]")?.addEventListener("click", ev => { ev.stopPropagation(); remove(e); });
    box.append(card);
  }
}

// ---------- formulário ----------
function openForm(e) {
  editing = e ? structuredClone(e) : {
    id: `e${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}-${(0x1000 + Math.floor(Math.random() * 0xEFFF)).toString(16)}`,
    name: "", date: new Date().toISOString().slice(0, 10), client: "", place: "", product: "totem", layouts: [], defaultLayout: null,
    print: true, copiesPerSession: 1, closed: false, phrase: "Toque na tela e sorria!", phrases: { ...PHRASES }, theme: "visualize",
    activeSeconds: 0, passwordHash: null, hashtag: "", isNew: true,
  };
  const f = editing;
  $("fTitle").textContent = e ? e.name : "Novo evento";
  $("fName").value = f.name; $("fDate").value = f.date; $("fClient").value = f.client; $("fPlace").value = f.place;
  $("fProduct").value = f.product; $("fHashtag").value = f.hashtag ?? ""; $("fPhrase").value = f.phrase ?? "";
  $("fPrint").checked = !!f.print; $("fCopies").value = String(f.copiesPerSession ?? 1);
  $("fPw").value = $("fPwCur").value = "";
  $("fPwHint").textContent = f.passwordHash ? "(em branco = continua a mesma)" : "(obrigatória, pelo menos 4 caracteres)";
  $("fPwCurRow").hidden = !f.passwordHash;
  renderForm();
  $("vEvents").hidden = true; $("vForm").hidden = false; scrollTo(0, 0);
}

function renderForm() {
  const f = editing;
  $("fHashRow").hidden = $("fProduct").value !== "instaprint";
  const th = [...THEMES.map(([k, n]) => [k, n]), ...themes.map(t => ["custom:" + t.id, t.name + " (personalizado)"])];
  $("fThemes").innerHTML = th.map(([k, n]) => `<button class="chip${f.theme === k ? " on" : ""}" data-t="${esc(k)}">${esc(n)}</button>`).join("");
  $("fThemes").querySelectorAll("[data-t]").forEach(b => (b.onclick = () => { f.theme = b.dataset.t; renderForm(); }));
  const known = new Set(layouts.map(l => l.id));
  const chips = layouts.filter(l => l.format !== "polaroid" || $("fProduct").value === "instaprint").map(l => {
    const on = f.layouts.includes(l.id), star = (f.defaultLayout ?? f.layouts[0]) === l.id;
    return `<button class="chip${on ? " on" : ""}" data-l="${esc(l.id)}">${on ? `<span class="star${star ? "" : " off"}" data-star="${esc(l.id)}" title="Layout padrão">★</span>` : ""}
      <span>${esc(l.name)}<small>${{ strip: "Tirinha 5×15", photo: "Foto 10×15", polaroid: "Polaroide" }[l.format] ?? l.format} · ${l.slots?.length ?? 0} foto(s)</small></span></button>`;
  });
  // layout que saiu da biblioteca: aparece para poder tirar
  for (const id of f.layouts.filter(id => !known.has(id)))
    chips.push(`<button class="chip on missing" data-l="${esc(id)}"><span>Layout excluído<small>toque para tirar</small></span></button>`);
  $("fLayouts").innerHTML = chips.join("") || '<p class="hint">Nenhum layout ainda. Crie no app (Configurações → Layouts).</p>';
  $("fLayouts").querySelectorAll("[data-l]").forEach(b => (b.onclick = ev => {
    const id = b.dataset.l;
    if (ev.target.dataset.star) { f.defaultLayout = id; return renderForm(); }
    f.layouts = f.layouts.includes(id) ? f.layouts.filter(x => x !== id) : f.layouts.length >= 8 ? (toast("Até 8 layouts por evento.", true), f.layouts) : [...f.layouts, id];
    if (!f.layouts.includes(f.defaultLayout)) f.defaultLayout = f.layouts[0] ?? null;
    renderForm();
  }));
}

// senha do evento: o mesmo formato do app (PBKDF2-SHA256, 100.000 voltas, sal de 16 bytes) — a tela nunca recebe a senha
const b64 = u => btoa(String.fromCharCode(...u)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, k, 256));
}
async function hashPw(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); return b64(salt) + ":" + b64(await pbkdf2(pw, salt)); }
async function checkPw(pw, stored) { const [s, h] = (stored || "").split(":"); return !!s && b64(await pbkdf2(pw, unb64(s))) === h; }
// mesma regra do app para o nome da pasta do evento (dois eventos não podem cair na mesma pasta)
const safeName = n => (n.replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/\.+$/, "").slice(0, 60).trim()) || "Evento";

async function save() {
  const f = editing;
  Object.assign(f, {
    name: $("fName").value.trim(), date: $("fDate").value, client: $("fClient").value.trim(), place: $("fPlace").value.trim(),
    product: $("fProduct").value, hashtag: $("fHashtag").value.trim().replace(/^#/, "").toLowerCase(), phrase: $("fPhrase").value.trim(),
    print: $("fPrint").checked, copiesPerSession: +$("fCopies").value,
  });
  const fail = m => { toast(m, true); return false; };
  if (!f.name || f.name.length > 60) return fail("Dê um nome ao evento (até 60 letras).");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return fail("Escolha a data do evento.");
  if (f.product === "instaprint" && !/^[\p{L}\p{N}_]{2,100}$/u.test(f.hashtag)) return fail("InstaPrint: escreva a #hashtag do evento (letras, números e _, sem espaço).");
  if (f.layouts.some(id => !layouts.some(l => l.id === id))) return fail("Um layout escolhido foi excluído: toque nele para tirar.");
  if (events.some(o => o.id !== f.id && safeName(o.name).toLowerCase() === safeName(f.name).toLowerCase())) return fail(`Já existe um evento chamado “${f.name}”. Use outro nome.`);
  const pw = $("fPw").value;
  if (!f.passwordHash || pw) {
    if (pw.length < 4) return fail("Crie a senha do evento com pelo menos 4 caracteres.");
    if (f.passwordHash && !(await checkPw($("fPwCur").value, f.passwordHash))) return fail("Senha atual errada. A senha não foi trocada.");
    f.passwordHash = await hashPw(pw);
  }
  f.defaultLayout = f.layouts.includes(f.defaultLayout) ? f.defaultLayout : f.layouts[0] ?? null;
  f.updated = new Date().toISOString();
  const { isNew, ...data } = f;
  $("fSave").disabled = true;
  try {
    await put(`eventos/${f.id}.json`, JSON.stringify(data, null, 2));
    toast(isNew ? `Evento “${f.name}” criado.` : `Evento “${f.name}” salvo.`);
    closeForm();
    await load();
  } catch (err) { if (err.message !== "sair") toast(err.message, true); }
  finally { $("fSave").disabled = false; }
}

/** Grava um arquivo na nuvem como o app grava: o conteúdo no Storage (pelo hash) e a linha na tabela arquivos. */
async function put(path, text) {
  const hash = await sha256(text), body = new TextEncoder().encode(text);
  await api(`/storage/v1/object/arquivos/${me.empresa}/${hash}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body });
  await api("/rest/v1/arquivos?on_conflict=empresa_id,caminho", {
    method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ empresa_id: me.empresa, caminho: path, hash, tamanho: body.length, excluido: false }]),
  });
}

async function remove(e) {
  if (!confirm(`Excluir o evento “${e.name}”?\n\nEle sai de todos os equipamentos (vai para a Lixeira de cada PC). As fotos já tiradas continuam nos PCs.`)) return;
  try {
    await api("/rest/v1/arquivos?on_conflict=empresa_id,caminho", {
      method: "POST", headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ empresa_id: me.empresa, caminho: `eventos/${e.id}.json`, hash: null, tamanho: 0, excluido: true }]),
    });
    toast(`Evento “${e.name}” excluído.`);
    await load();
  } catch (err) { if (err.message !== "sair") toast(err.message, true); }
}

function closeForm() { editing = null; $("vForm").hidden = true; $("vEvents").hidden = false; }

// ---------- telas ----------
const msg = (t, err) => { $("lgMsg").textContent = t ?? ""; $("lgMsg").className = "msg" + (err ? " err" : ""); };
function show() { $("login").hidden = !!session; $("app").hidden = !session; }

$("lgForm").onsubmit = async ev => {
  ev.preventDefault();
  msg("Entrando…");
  try { keep(await auth("token?grant_type=password", { email: $("lgEmail").value.trim(), password: $("lgPass").value })); $("lgPass").value = ""; msg(""); show(); await load(); }
  catch (err) { msg(err.message, true); }
};
$("logout").onclick = () => { keep(null); show(); msg(""); };
$("newEvent").onclick = () => openForm(null);
$("fBack").onclick = closeForm;
$("fSave").onclick = save;
$("fProduct").onchange = renderForm;
$("evTabs").querySelectorAll("button").forEach(b => (b.onclick = () => { view = b.dataset.v; render(); }));
document.querySelectorAll(".bar .tab").forEach(b => (b.onclick = () => {
  document.querySelectorAll(".bar .tab").forEach(x => x.classList.toggle("on", x === b));
  $("vEvents").hidden = b.dataset.view !== "events" || !!editing; $("vForm").hidden = b.dataset.view !== "events" || !editing;
  $("vGallery").hidden = b.dataset.view !== "gallery";
}));
addEventListener("unhandledrejection", e => { if (e.reason?.message !== "sair") toast(e.reason?.message ?? String(e.reason), true); });

show();
if (session) load();
