// Painel online do Atalaia Booth: as MESMAS telas do app (copiadas de Software\Booth\src\Visualize.Booth\ui por
// montar-painel.mjs), com esta ponte no lugar do programa do equipamento. Onde o app fala com o C#
// (chrome.webview.postMessage), aqui as mensagens são respondidas no navegador, gravando na mesma nuvem que o app
// sincroniza (Supabase: tabela arquivos + Storage). Regras iguais às do app (EventStore, LayoutStore, ThemeStore, Brand).
// A chave é a pública; quem protege os dados são as regras do banco (Software\Booth\nuvem\atalaia.sql).
window.PANEL = true;
document.body.classList.add("panel", "web");
(() => {
  const SUPA = "https://vcacjcesiyiftoenlcbj.supabase.co";
  const KEY = "sb_publishable_tUdrJcNZj0pbbDpQld93Ew_rcETFezK";
  const ASSETS = "arquivos/"; // o service worker (sw.js) entrega arquivos/<caminho na nuvem>
  const listeners = [];
  const out = data => listeners.forEach(f => f({ data }));
  const fail = text => { throw new Error(text); };

  // responde só depois de todas as telas carregarem (no app a resposta do C# sempre chega depois; aqui seria cedo demais)
  const loaded = new Promise(ok => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", ok) : ok());
  (window.chrome ??= {}).webview = {
    postMessage: m => loaded.then(() => handle(m)).catch(err => { if (err.message !== "sair") out({ type: "error", message: err.message }); }),
    addEventListener: (t, f) => { if (t === "message") listeners.push(f); },
    removeEventListener: (t, f) => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); },
  };

  // ---------- login (o mesmo do app) ----------
  let session = JSON.parse(localStorage.getItem("atalaia.login") || "null");
  const keep = s => { session = s; s ? localStorage.setItem("atalaia.login", JSON.stringify(s)) : localStorage.removeItem("atalaia.login"); toWorker(); };
  const asSession = j => ({ access: j.access_token, refresh: j.refresh_token, expires: Date.now() + ((j.expires_in || 3600) - 60) * 1000, uid: j.user?.id, email: j.user?.email });

  function translate(msg) {
    return /Invalid login/.test(msg) ? "E-mail ou senha errados."
      : /not confirmed/.test(msg) ? "Confirme o seu e-mail antes de entrar (veja a caixa de entrada e o spam)."
      : /already registered/.test(msg) ? "Já existe uma conta com este e-mail. Use “Entrar” ou “Esqueci a senha”."
      : /Password should be/.test(msg) ? "A senha precisa ter pelo menos 6 caracteres."
      : /rate limit/i.test(msg) ? "Muitos e-mails enviados agora. Espere alguns minutos e tente de novo."
      : /row-level security|violates|permission denied/.test(msg) ? "Seu nível de acesso não permite isso."
      : msg;
  }

  async function auth(path, body, bearer) {
    const r = await fetch(SUPA + "/auth/v1/" + path, {
      method: bearer && !body ? "GET" : body?.password && bearer ? "PUT" : "POST",
      headers: { apikey: KEY, "Content-Type": "application/json", ...(bearer ? { Authorization: "Bearer " + bearer } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) fail(translate(j.msg || j.error_description || j.message || "A nuvem recusou o pedido."));
    return j;
  }

  async function token() {
    if (!session) fail("sair");
    if (Date.now() > session.expires) {
      try { keep(asSession(await auth("token?grant_type=refresh_token", { refresh_token: session.refresh }))); }
      catch { keep(null); sendAccount(); fail("sair"); }
    }
    return session.access;
  }

  async function api(path, opts = {}) {
    const r = await fetch(SUPA + path, { ...opts, headers: { apikey: KEY, Authorization: "Bearer " + (await token()), ...(opts.headers || {}) } });
    if (r.status === 401) { keep(null); sendAccount(); fail("sair"); }
    if (!r.ok) {
      const t = await r.text();
      if (/Duplicate|already exists/.test(t)) return null; // o mesmo conteúdo já está na nuvem
      fail(translate(t.length < 300 ? t : t.slice(0, 300)));
    }
    if (r.status === 204) return null;
    return r.headers.get("content-type")?.includes("json") ? r.json() : r.arrayBuffer();
  }
  const rest = (path, method = "GET", body) => api("/rest/v1/" + path, body === undefined ? { method } :
    { method, headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });

  // ---------- a empresa e os arquivos dela ----------
  let me = null; // { empresa, nivel, nome, empresaNome }
  let files = new Map(); // caminho → { hash, size }
  let disabled = false, lastSync = null, error = null, recovering = false;
  const cache = new Map(); // hash → bytes
  const enc = new TextEncoder(), dec = new TextDecoder();

  async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join(""); }

  async function loadIndex() {
    const all = [];
    for (let off = 0; ; off += 1000) {
      const page = await rest(`arquivos?select=caminho,hash,tamanho&excluido=is.false&order=caminho&limit=1000&offset=${off}`);
      all.push(...page);
      if (page.length < 1000) break;
    }
    files = new Map(all.map(f => [f.caminho, { hash: f.hash, size: f.tamanho }]));
    lastSync = new Date();
    toWorker();
  }

  async function bytes(path) {
    const f = files.get(path) ?? fail(`Arquivo não encontrado na nuvem: ${path}`);
    if (!cache.has(f.hash)) cache.set(f.hash, new Uint8Array(await api(`/storage/v1/object/authenticated/arquivos/${me.empresa}/${f.hash}`)));
    return cache.get(f.hash);
  }
  const json = async path => JSON.parse(dec.decode(await bytes(path)));
  const exists = path => files.has(path);
  const under = prefix => [...files.keys()].filter(p => p.startsWith(prefix));

  /** Grava como o app grava: o conteúdo no Storage (pelo hash) e a linha na tabela arquivos. */
  async function put(path, data) {
    const b = typeof data === "string" ? enc.encode(data) : data;
    const hash = await sha256(b);
    await api(`/storage/v1/object/arquivos/${me.empresa}/${hash}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: b });
    await rest("arquivos?on_conflict=empresa_id,caminho", "POST", [{ empresa_id: me.empresa, caminho: path, hash, tamanho: b.length, excluido: false }]);
    cache.set(hash, b);
    files.set(path, { hash, size: b.length });
    toWorker();
  }
  const putJson = (path, obj) => put(path, JSON.stringify(obj, null, 2));
  /** Some de todos os PCs (lá vai para a Lixeira). */
  async function del(paths) {
    if (!paths.length) return;
    await rest("arquivos?on_conflict=empresa_id,caminho", "POST", paths.map(p => ({ empresa_id: me.empresa, caminho: p, hash: null, tamanho: 0, excluido: true })));
    paths.forEach(p => files.delete(p));
    toWorker();
  }
  /** Muda arquivos de lugar sem baixar nem subir de novo: a mesma linha com outro caminho (e a antiga excluída). */
  async function move(pairs) {
    if (!pairs.length) return;
    await rest("arquivos?on_conflict=empresa_id,caminho", "POST",
      pairs.map(([from, to]) => ({ empresa_id: me.empresa, caminho: to, hash: files.get(from).hash, tamanho: files.get(from).size, excluido: false })));
    for (const [from, to] of pairs) files.set(to, files.get(from));
    await del(pairs.map(([from]) => from));
  }

  // o service worker entrega as imagens e fontes da nuvem para as telas (com o login)
  function toWorker() {
    const w = navigator.serviceWorker?.controller;
    if (w) w.postMessage({ token: session?.access ?? null, empresa: me?.empresa ?? null, supa: SUPA, key: KEY, map: Object.fromEntries([...files].map(([p, f]) => [p, f.hash])) });
  }

  // ---------- conta (Configurações → Conta e a tela de entrada) ----------
  function sendAccount() {
    out({
      type: "account", logged: !!session, ready: !!session && !!me && !disabled && !recovering,
      needsCompany: !!session && !me && !disabled && !recovering, disabled,
      email: session?.email ?? "", name: me?.nome ?? "", company: me?.empresaNome ?? "", level: me?.nivel ?? "",
      lastSync: lastSync?.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ""), error,
    });
  }

  async function join() {
    let rows = await rest(`membros?select=empresa_id,nivel,nome,desativado,empresas(nome)&user_id=eq.${session.uid}`);
    if (!rows.length && await api("/rest/v1/rpc/aceitar_convite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome_pessoa: session.email.split("@")[0] }) }))
      rows = await rest(`membros?select=empresa_id,nivel,nome,desativado,empresas(nome)&user_id=eq.${session.uid}`);
    me = rows.length && !rows[0].desativado ? { empresa: rows[0].empresa_id, nivel: rows[0].nivel, nome: rows[0].nome, empresaNome: rows[0].empresas?.nome ?? "" } : null;
    disabled = rows.length > 0 && rows[0].desativado;
    if (me) await loadIndex();
    sendAccount();
    if (me) sendAll();
  }

  async function rpc(fn, args) { return api("/rest/v1/rpc/" + fn, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) }); }

  // ---------- regras iguais às do app ----------
  const COLOR = /^#[0-9a-fA-F]{6}$/, FONT = /^[\p{L}\p{N} \-]{1,60}$/u, ID = /^[a-z0-9-]{1,64}$/;
  const check = (ok, text) => { if (!ok) fail(text); };
  const pad = n => String(n).padStart(2, "0");
  const stamp = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const newId = p => `${p}${stamp()}-${(0x1000 + Math.floor(Math.random() * 0xEFFF)).toString(16)}`;
  const now = () => new Date().toISOString();
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const pickFile = accept => new Promise(ok => {
    const i = Object.assign(document.createElement("input"), { type: "file", accept });
    i.onchange = () => ok(i.files[0]);
    i.click();
  });
  const extOf = name => (name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();

  // senha do evento: PBKDF2-SHA256, 100.000 voltas, sal de 16 bytes ("sal:hash" em base64), igual ao app
  const b64 = u => btoa(String.fromCharCode(...u)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function pbkdf2(pw, salt) {
    const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, k, 256));
  }
  async function hashPw(pw) { check(pw.length >= 4, "A senha precisa ter pelo menos 4 caracteres."); const s = crypto.getRandomValues(new Uint8Array(16)); return b64(s) + ":" + b64(await pbkdf2(pw, s)); }
  async function checkPw(ev, pw, whatFailed) {
    check(ev.passwordHash, "Este evento ainda não tem senha. Crie uma em Eventos → Editar.");
    const [s, h] = ev.passwordHash.split(":");
    check(b64(await pbkdf2(pw ?? "", unb64(s))) === h, `Senha errada. ${whatFailed}`);
  }

  // ---------- eventos ----------
  const PHRASE = "Toque na tela e sorria!";
  const PHRASES = { first: "Prepare-se, é agora!", prepare: "Prepare-se", smile: "Sorria!", next: "Perfeito! Agora vamos para a próxima foto!",
    last: "Última foto, um sorriso bem bonito!", review: "Agora vamos ver como ficou?", thanks: "Muito obrigado por fazer parte dessa festa!", pickup: "Pegue sua foto com o monitor." };
  const PRODUCTS = ["totem", "cabine", "espelho", "instaprint"], THEMES = ["visualize", "aniversario", "quinze", "casamento", "confraternizacao", "corporativo", "infantil"];
  const evPath = id => (ID.test(id) || fail("Identificador de evento inválido.")) && `eventos/${id}.json`;
  async function events() { return (await Promise.all(under("eventos/").filter(p => /^eventos\/[^/]+\.json$/.test(p)).map(p => json(p).catch(() => null)))).filter(Boolean); }
  const masked = e => ({ ...e, passwordHash: e.passwordHash ? "definida" : null });
  async function sendEvents() {
    const list = (await events()).sort((a, b) => b.date.localeCompare(a.date) || String(b.updated).localeCompare(String(a.updated)));
    out({ type: "events", list: list.map(masked), activeId: null, defaultPhrases: PHRASES });
  }
  const safeName = n => (n.replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().replace(/\.+$/, "").slice(0, 60).trim()) || "Evento";
  const themeOk = async t => THEMES.includes(t) || (t?.startsWith("custom:") && exists(`temas/${t.slice(7)}.json`));
  const libLayout = id => `layouts/${id}/layout.json`;

  async function validateEvent(e) {
    check(e.name.length > 0 && e.name.length <= 60, "Dê um nome ao evento (até 60 letras).");
    check(/^\d{4}-\d{2}-\d{2}$/.test(e.date), "Data do evento inválida.");
    check(e.client.length <= 80 && e.place.length <= 80, "Cliente e local: até 80 letras.");
    check(e.phrase.length <= 80, "Frase da tela: até 80 letras.");
    check(Object.values(e.phrases ?? {}).every(p => p.length <= 80), "Frases da sessão: até 80 letras cada.");
    check(PRODUCTS.includes(e.product), "Escolha o produto: Totem, Cabine de Fotos, Espelho Mágico ou InstaPrint.");
    check(e.product !== "instaprint" || /^[\p{L}\p{N}_]{2,100}$/u.test(e.hashtag), "InstaPrint: escreva a #hashtag do evento (letras, números e _, sem espaço).");
    check(await themeOk(e.theme), "Escolha um tema para o evento (o tema personalizado escolhido não existe mais).");
    check(e.copiesPerSession >= 1 && e.copiesPerSession <= 3, "Cópias a cada impressão: de 1 a 3.");
    check(e.layouts.length <= 8 && new Set(e.layouts).size === e.layouts.length, "Escolha até 8 layouts diferentes.");
    for (const id of e.layouts) {
      check(ID.test(id) && exists(libLayout(id)), "Um dos layouts escolhidos não existe mais.");
      check(e.product === "instaprint" || (await json(libLayout(id))).format !== "polaroid", "O layout Polaroide é só para eventos InstaPrint.");
    }
    check(e.defaultLayout == null || e.layouts.includes(e.defaultLayout), "O layout padrão precisa estar entre os escolhidos.");
    const folder = safeName(e.name).toLowerCase();
    check(!(await events()).some(o => o.id !== e.id && safeName(o.name).toLowerCase() === folder), `Já existe um evento chamado “${e.name}”. Use outro nome (cada evento tem a sua pasta).`);
  }

  async function saveEvent(e) {
    const t = s => (s ?? "").trim();
    const clean = { ...e, name: t(e.name), client: t(e.client), place: t(e.place), phrase: t(e.phrase), layouts: e.layouts ?? [],
      hashtag: t(e.hashtag).replace(/^#+/, "").toLowerCase(),
      phrases: Object.fromEntries(Object.entries({ ...PHRASES, ...(e.phrases ?? {}) }).map(([k, v]) => [k, t(v)])) };
    clean.defaultLayout = clean.layouts.length ? clean.defaultLayout ?? clean.layouts[0] : null;
    await validateEvent(clean);
    const disk = exists(evPath(clean.id)) ? await json(evPath(clean.id)) : null;
    const saved = { ...clean, updated: now(), activeSeconds: disk?.activeSeconds ?? 0, passwordHash: clean.passwordHash ?? disk?.passwordHash ?? null,
      galleryFolderId: disk?.galleryFolderId ?? null, galleryUrl: disk?.galleryUrl ?? null }; // a galeria é o equipamento que cria
    await putJson(evPath(saved.id), saved);
    return saved;
  }

  async function saveFromForm(m) {
    const before = exists(evPath(m.event.id)) ? await json(evPath(m.event.id)) : null;
    if (m.password && before?.passwordHash) await checkPw(before, m.currentPassword, "A senha não foi trocada.");
    const ev = { ...m.event, passwordHash: m.password ? await hashPw(m.password) : null };
    check(ev.passwordHash || before?.passwordHash, "Crie a senha do evento (pelo menos 4 caracteres).");
    return saveEvent(ev);
  }

  // encerrar: layouts e tema vão junto com o evento (menos os que outro evento aberto usa); reabrir traz de volta
  async function closeEvent(id) {
    const e = await json(evPath(id));
    await putJson(evPath(id), { ...e, closed: true, updated: now() });
    const others = (await events()).filter(o => o.id !== id && !o.closed);
    const inUse = new Set(others.flatMap(o => o.layouts ?? []));
    const pairs = [];
    for (const l of e.layouts ?? []) if (!inUse.has(l)) for (const p of under(`layouts/${l}/`)) pairs.push([p, `layouts/_eventos-encerrados/${id}/${p.slice(8)}`]);
    if (e.theme?.startsWith("custom:") && !others.some(o => o.theme === e.theme) && exists(`temas/${e.theme.slice(7)}.json`))
      pairs.push([`temas/${e.theme.slice(7)}.json`, `temas/_eventos-encerrados/${id}/${e.theme.slice(7)}.json`]);
    await move(pairs);
  }
  async function reopenEvent(id, password) {
    const e = await json(evPath(id));
    await checkPw(e, password, "O evento continua encerrado.");
    await putJson(evPath(id), { ...e, closed: false, updated: now() });
    const pairs = [];
    for (const p of under(`layouts/_eventos-encerrados/${id}/`)) {
      const rest_ = p.slice(`layouts/_eventos-encerrados/${id}/`.length), lid = rest_.split("/")[0];
      if (ID.test(lid) && !exists(libLayout(lid))) pairs.push([p, `layouts/${rest_}`]);
    }
    for (const p of under(`temas/_eventos-encerrados/${id}/`)) {
      const tid = p.split("/").pop().replace(/\.json$/, "");
      if (ID.test(tid) && !exists(`temas/${tid}.json`)) pairs.push([p, `temas/${tid}.json`]);
    }
    await move(pairs);
  }

  // ---------- temas ----------
  const EFFECTS = ["bokeh", "lights", "confetti", "glitter", "sparkle", "petal", "leaves", "snow", "bubbles", "hearts", "balloon", "notes", "shooting", "fireworks", "aurora", "network"];
  const DRAWINGS = ["camera", "photo", "strip", "arch", "balloon", "gift", "cake", "hat", "crown", "butterfly", "star", "rings", "heart", "leaf", "glasses", "ornament", "hexagon", "chart", "cloud", "rainbow"];
  async function themes() {
    return (await Promise.all(under("temas/").filter(p => /^temas\/[^/]+\.json$/.test(p)).map(p => json(p).catch(() => null))))
      .filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }
  const sendThemes = async savedId => out({ type: "themes", list: await themes(), savedId: savedId ?? null });
  async function saveTheme(t) {
    const d = { bgStyle: "radial", bg1: "#2B1B3D", bg2: "#120A1C", text: "#FFF6EC", accent: "#C9A96E", titleFont: "Cormorant Garamond", italic: true, bold: false,
      textFont: "Jost", fx: "bokeh", amount: 2, fxColor: "#C9A96E", glow: false, icons: [], logo: "auto" };
    const c = { ...d, ...t, id: t.id || newId("t"), name: (t.name ?? "").trim(), icons: [...new Set(t.icons ?? [])], updated: now() };
    check(c.name.length > 0 && c.name.length <= 30, "Dê um nome ao tema (até 30 letras).");
    check(["solid", "radial", "linear"].includes(c.bgStyle), "Tipo de fundo inválido.");
    check([c.bg1, c.bg2, c.text, c.accent, c.fxColor].every(x => COLOR.test(x)), "Cor inválida (use o seletor de cores).");
    check([c.titleFont, c.textFont].every(x => FONT.test(x)), "Nome de fonte inválido.");
    check(EFFECTS.includes(c.fx), "Escolha um fundo animado da lista.");
    check(c.amount >= 1 && c.amount <= 3, "Quantidade do fundo: pouco, médio ou muito.");
    check(c.icons.length <= 4 && c.icons.every(i => DRAWINGS.includes(i)), "Escolha até 4 desenhos da lista.");
    check(["auto", "light", "dark"].includes(c.logo), "Logo: automático, claro ou escuro.");
    check(ID.test(c.id), "Tema inválido.");
    await putJson(`temas/${c.id}.json`, c);
    return c;
  }

  // ---------- marca ----------
  const BRAND = { name: "Visualize Locações e Eventos", short: "Visualize", phone: "(47) 99761-3155", instagram: "@visualize360.rec", site: "", qrLink: "",
    logo: null, logoDark: null, icon: null, iconDark: null, accent: "#C9A96E", background: "#0E0D0C", text: "#F4EFE6", rec: "#BE2D24",
    titleFont: "Cormorant Garamond", textFont: "Jost", titleFontFile: null, textFontFile: null };
  const IMG = [".png", ".svg", ".jpg", ".jpeg", ".webp"], FONTS = [".ttf", ".otf", ".woff", ".woff2"];
  const SLOTS = { logo: IMG, logoDark: IMG, icon: IMG, iconDark: IMG, titleFontFile: FONTS, textFontFile: FONTS };
  const brand = async () => exists("marca/marca.json") ? { ...BRAND, ...(await json("marca/marca.json")) } : { ...BRAND };
  const sendBrand = async () => out({ type: "brand", brand: await brand(), root: ASSETS + "marca/" });
  async function saveBrand(b) {
    const t = s => (s ?? "").trim();
    const c = { ...BRAND, ...b, name: t(b.name), short: t(b.short), phone: t(b.phone), instagram: t(b.instagram), site: t(b.site), qrLink: t(b.qrLink), titleFont: t(b.titleFont), textFont: t(b.textFont) };
    check(c.name.length > 0 && c.name.length <= 80 && c.short.length > 0 && c.short.length <= 30, "Dê o nome da empresa (até 80 letras) e o nome curto (até 30).");
    check(c.phone.length <= 30 && c.instagram.length <= 40 && c.site.length <= 80, "Telefone, Instagram ou site longo demais.");
    check(!c.qrLink || (c.qrLink.length <= 300 && /^https?:\/\/\S+$/.test(c.qrLink)), "O link do QR code precisa começar com https:// (ou deixe em branco para usar o WhatsApp do telefone).");
    check(c.qrLink || c.phone.replace(/\D/g, "").length >= 10, "Telefone sem número suficiente para o QR do WhatsApp.");
    check([c.accent, c.background, c.text, c.rec].every(x => COLOR.test(x)), "Cor inválida (use o seletor de cores).");
    check([c.titleFont, c.textFont].every(x => FONT.test(x)), "Nome de fonte inválido.");
    check(Object.keys(SLOTS).every(s => !c[s] || exists("marca/" + c[s])), "Um dos arquivos da marca não existe mais. Envie de novo.");
    await putJson("marca/marca.json", c);
  }

  // ---------- tempos da sessão (os mesmos de todos os PCs da empresa) ----------
  const TIMES = { countdown: 3, phrase: 2.5, review: 4, final: 30, thanks: 8, target: 0 };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const times = async () => exists("sessao.json") ? { ...TIMES, ...(await json("sessao.json")) } : { ...TIMES };
  const sendState = async () => { const t = await times(); out({ type: "state", connected: false, profiles: [], countdown: t.countdown, session: t }); };
  async function saveTimes(m) {
    const t = await times();
    if (m.type === "countdown") t.countdown = m.seconds; else Object.assign(t, { phrase: m.phrase, review: m.review, final: m.final, thanks: m.thanks, target: m.target ?? 0 });
    await putJson("sessao.json", { countdown: clamp(Math.round(t.countdown), 0, 10), phrase: clamp(Math.round(t.phrase * 2) / 2, 1, 6), review: clamp(Math.round(t.review), 0, 15),
      final: clamp(Math.round(t.final), 10, 120), thanks: clamp(Math.round(t.thanks), 3, 20), target: t.target <= 0 ? 0 : clamp(Math.round(t.target), 30, 240) });
  }

  // ---------- layouts ----------
  let lib = null; // modelos, formatos (modelos.json, tirado do app)
  const library = async () => lib ??= await (await fetch("modelos.json")).json();
  const formatOf = async key => (await library()).formats.find(f => f.key === key) ?? fail(`Formato de layout desconhecido: ${key}`);
  async function layouts() {
    return (await Promise.all(under("layouts/").filter(p => /^layouts\/[^_/][^/]*\/layout\.json$/.test(p)).map(p => json(p).catch(() => null))))
      .filter(Boolean).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  }
  async function sendLayouts() {
    const l = await library();
    out({ type: "layouts", list: await layouts(), templates: l.templates, templatesRoot: "templates/", formats: l.formats, maxPhotos: l.maxPhotos, assetsRoot: ASSETS + "layouts/" });
  }
  const sameSize = s => s.every(x => Math.abs(x.w - s[0].w) <= 4 && Math.abs(x.h - s[0].h) <= 4);
  const blank = { backgroundImage: null, overlayImage: null, texts: [], images: [], linkPhotos: true, frameWidth: 0, frameInset: 36, frameColor: "#C9A96E", frameRadius: 0, overlayZ: 0, frameZ: 0, background2: null, gradientAngle: 180 };
  const slotDefaults = { ratio: "livre", border: 0, borderColor: "#FFFFFF", radius: 0, rotation: 0, filter: "none", outline: 0, outlineGap: 12, outlineColor: "#C9A96E", shadowBlur: 0, shadowDistance: 0, shadowOpacity: 40, shadowColor: "#000000", lockRatio: true, z: 0 };

  async function validateLayout(l) {
    check(ID.test(l.id), "Identificador de layout inválido.");
    check(l.name?.trim() && l.name.length <= 80, "Dê um nome ao layout (até 80 letras).");
    const f = await formatOf(l.format);
    check(COLOR.test(l.background), "Cor de fundo inválida.");
    check(l.background2 == null || COLOR.test(l.background2), "Segunda cor do degradê inválida.");
    check(l.slots.length <= 4, "No máximo 4 fotos por layout.");
    check(l.frameWidth >= 0 && l.frameWidth <= 60 && l.frameInset >= 0 && l.frameInset <= 300 && l.frameRadius >= 0 && l.frameRadius <= 300 && COLOR.test(l.frameColor), "Contorno da folha inválido.");
    const inside = (x, y, w, h, what) => check(w >= 20 && h >= 20 && x >= -f.w / 4 && y >= -f.h / 4 && x + w <= f.w * 5 / 4 && y + h <= f.h * 5 / 4, `${what} fora da folha.`);
    const fileOk = n => n == null || check(/^[\w\- ]{1,80}\.(png|jpg|jpeg)$/i.test(n) && exists(`layouts/${l.id}/${n}`), `Imagem "${n}" não encontrada na pasta do layout.`);
    const rot = (d, what) => check(d >= -180 && d <= 180, `Rotação de ${what} inválida.`);
    const shadow = (o, what) => check(o.shadowBlur >= 0 && o.shadowBlur <= 80 && o.shadowDistance >= 0 && o.shadowDistance <= 60 && o.shadowOpacity >= 0 && o.shadowOpacity <= 100 && COLOR.test(o.shadowColor), `Sombra de ${what} inválida.`);
    l.slots.forEach((s, i) => {
      inside(s.x, s.y, s.w, s.h, `Foto ${i + 1}`);
      check(["livre", "3:2", "4:3", "1:1", "3:4", "2:3"].includes(s.ratio), `Proporção da foto ${i + 1} inválida.`);
      check(s.border >= 0 && s.border <= 120 && s.radius >= 0 && s.radius <= 900, `Borda ou cantos da foto ${i + 1} inválidos.`);
      check(COLOR.test(s.borderColor), `Cor da borda da foto ${i + 1} inválida.`);
      check(["none", "bw", "sepia"].includes(s.filter), `Efeito da foto ${i + 1} inválido.`);
      rot(s.rotation, `foto ${i + 1}`);
      check(s.outline >= 0 && s.outline <= 60 && s.outlineGap >= 0 && s.outlineGap <= 120 && COLOR.test(s.outlineColor), `Contorno da foto ${i + 1} inválido.`);
      shadow(s, `foto ${i + 1}`);
    });
    for (const t of l.texts) {
      inside(t.x, t.y, t.w, t.size, "Texto");
      check(t.text.length <= 200, "Texto longo demais (até 200 letras).");
      check(t.size >= 8 && t.size <= 400, "Tamanho de texto inválido.");
      check(["serif", "sans"].includes(t.font), "Fonte inválida.");
      check(["left", "center", "right"].includes(t.align), "Alinhamento inválido.");
      check(COLOR.test(t.color), "Cor de texto inválida.");
      check(!t.weight || (t.font === "serif" ? [400, 500, 600] : [300, 400, 500]).includes(t.weight), "Peso de fonte inválido.");
      check(t.spacing >= 0 && t.spacing <= 60, "Espaçamento de letras inválido.");
      rot(t.rotation, "texto"); shadow(t, "texto");
    }
    for (const im of l.images) {
      inside(im.x, im.y, im.w, im.h, "Imagem"); fileOk(im.file);
      check(im.opacity >= 10 && im.opacity <= 100, "Transparência da imagem inválida.");
      rot(im.rotation, "imagem"); shadow(im, "imagem");
    }
    fileOk(l.backgroundImage); fileOk(l.overlayImage);
  }
  async function saveLayout(l) {
    // campos que o app sempre grava (layouts antigos e o editor podem mandar sem eles)
    l = { ...blank, ...l, slots: l.slots.map(s => ({ ...slotDefaults, ...s })),
      texts: l.texts.map(t => ({ weight: 0, spacing: 0, upper: false, rotation: 0, shadowBlur: 0, shadowDistance: 0, shadowOpacity: 40, shadowColor: "#000000", z: 0, ...t })),
      images: l.images.map(i => ({ rotation: 0, opacity: 100, shadowBlur: 0, shadowDistance: 0, shadowOpacity: 40, shadowColor: "#000000", z: 0, ...i })) };
    await validateLayout(l);
    const saved = { ...l, name: l.name.trim(), updated: now() };
    await putJson(`layouts/${saved.id}/layout.json`, saved);
    return saved;
  }
  /** Nome livre na pasta do layout: fundo.png, fundo-2.png… (como LayoutStore.AddImage). */
  function freeName(id, base, ext) { let n = base + ext; for (let i = 2; exists(`layouts/${id}/${n}`); i++) n = `${base}-${i}${ext}`; return n; }

  async function imageOf(blobOrUrl) {
    const img = new Image();
    img.src = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    await img.decode();
    return img;
  }
  // janelas transparentes do PNG = lugares das fotos (mesmo cálculo do SlotFinder do app)
  function findSlots(img, canvasW, canvasH, minArea = 0.015, minFill = 0.6) {
    const step = Math.max(1, Math.floor(img.naturalWidth / 240)), gw = Math.floor(img.naturalWidth / step), gh = Math.floor(img.naturalHeight / step);
    const c = Object.assign(document.createElement("canvas"), { width: img.naturalWidth, height: img.naturalHeight });
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const clear = new Uint8Array(gw * gh), seen = new Uint8Array(gw * gh), found = [];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) clear[y * gw + x] = px[((y * step) * c.width + x * step) * 4 + 3] < 128 ? 1 : 0;
    for (let sy = 0; sy < gh; sy++) for (let sx = 0; sx < gw; sx++) {
      if (!clear[sy * gw + sx] || seen[sy * gw + sx]) continue;
      let minX = sx, maxX = sx, minY = sy, maxY = sy, count = 0;
      const q = [[sx, sy]]; seen[sy * gw + sx] = 1;
      while (q.length) {
        const [x, y] = q.pop(); count++;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]])
          if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && clear[ny * gw + nx] && !seen[ny * gw + nx]) { seen[ny * gw + nx] = 1; q.push([nx, ny]); }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1, area = bw * bh / (gw * gh), fill = count / (bw * bh);
      if (area < minArea || area > 0.95 || fill < minFill) continue;
      const kx = canvasW / gw, ky = canvasH / gh;
      found.push({ ...slotDefaults, x: Math.round(minX * kx), y: Math.round(minY * ky), w: Math.round(bw * kx), h: Math.round(bh * ky) });
    }
    const row = Math.max(1, Math.floor(canvasH / 20));
    return found.sort((a, b) => Math.floor(a.y / row) - Math.floor(b.y / row) || a.x - b.x);
  }
  const hasTransparency = img => findSlots(img, img.naturalWidth, img.naturalHeight, 0, 0).length > 0;

  async function fromTemplate(key) {
    const t = (await library()).templates.find(x => x.key === key) ?? fail("Modelo não encontrado.");
    const id = newId("l");
    let images = t.images.map(i => ({ ...i }));
    // modelo novo já sai com o logo da marca no lugar do logo da Visualize (só PNG/JPG), como no app
    const b = await brand();
    if (b.logo && [".png", ".jpg", ".jpeg"].includes(extOf(b.logo)) && exists("marca/" + b.logo) && images.some(i => i.file === "logo.png")) {
      const data = await bytes("marca/" + b.logo), name = "marca" + extOf(b.logo);
      await put(`layouts/${id}/${name}`, data);
      const img = await imageOf(new Blob([data])), ratio = img.naturalHeight / img.naturalWidth;
      images = images.map(i => i.file !== "logo.png" ? i : { ...i, file: name, h: Math.round(i.w * ratio), y: Math.round(i.y + i.h / 2 - i.w * ratio / 2) });
    }
    for (const f of [...new Set([...images.map(i => i.file), t.overlay].filter(Boolean))])
      if (!exists(`layouts/${id}/${f}`)) await put(`layouts/${id}/${f}`, new Uint8Array(await (await fetch("templates/" + f)).arrayBuffer()));
    return saveLayout({ ...blank, id, name: t.name, format: t.format, background: t.background, overlayImage: t.overlay, slots: t.slots, texts: t.texts, images, linkPhotos: sameSize(t.slots) });
  }

  async function importLayout(format) {
    const f = await formatOf(format);
    const file = await pickFile("image/png,image/jpeg");
    if (!file) return null;
    check([".png", ".jpg", ".jpeg"].includes(extOf(file.name)), "Use imagens PNG ou JPG.");
    const id = newId("l"), img = await imageOf(file);
    let warning = null;
    if (Math.abs(img.naturalWidth / img.naturalHeight / (f.w / f.h) - 1) > 0.03)
      warning = `A imagem (${img.naturalWidth}×${img.naturalHeight}) não tem a proporção do formato ${f.label}; ela foi esticada para caber. Confira no editor.`;
    let slots = findSlots(img, f.w, f.h);
    if (slots.length > 4) { warning = `${warning ?? ""} A arte tem ${slots.length} janelas; usei as 4 primeiras (máximo por layout).`.trim(); slots = slots.slice(0, 4); }
    const overlay = slots.length > 0 || hasTransparency(img);
    const name = freeName(id, overlay ? "moldura" : "fundo", extOf(file.name));
    await put(`layouts/${id}/${name}`, new Uint8Array(await file.arrayBuffer()));
    if (overlay && !slots.length) warning = `${warning ?? ""} Não encontrei janelas transparentes para as fotos: posicione-as no editor.`.trim();
    if (!overlay) slots = (await library()).templates.find(t => t.key === ({ strip: "strip-3", landscape: "land-1" }[format] ?? "port-1")).slots;
    const layout = await saveLayout({ ...blank, id, name: file.name.replace(/\.[^.]+$/, "").slice(0, 80), format, background: "#FFFFFF",
      backgroundImage: overlay ? null : name, overlayImage: overlay ? name : null, slots, linkPhotos: sameSize(slots) });
    return { layout, warning };
  }

  async function addImage(id, role) {
    const base = { background: "fundo", image: "imagem" }[role] ?? fail("Tipo de imagem inválido.");
    const file = await pickFile("image/png,image/jpeg");
    if (!file) return null;
    check([".png", ".jpg", ".jpeg"].includes(extOf(file.name)), "Use imagens PNG ou JPG.");
    const name = freeName(id, base, extOf(file.name));
    await put(`layouts/${id}/${name}`, new Uint8Array(await file.arrayBuffer()));
    const img = await imageOf(file), f = await formatOf((await json(`layouts/${id}/layout.json`)).format);
    const frame = role === "image" && Math.abs(img.naturalWidth / img.naturalHeight / (f.w / f.h) - 1) < 0.03 && hasTransparency(img);
    return { type: "layoutImage", role, file: name, width: img.naturalWidth, height: img.naturalHeight, frame, slots: frame ? findSlots(img, f.w, f.h).slice(0, 4) : [] };
  }

  // ---------- as mensagens das telas ----------
  async function sendAll() { await Promise.all([sendBrand(), sendThemes(), sendState(), sendEvents(), sendLayouts()]); }

  async function handle(m) {
    const t = m.type ?? "";
    if (t.startsWith("account.") || t === "ready") return handleAccount(m);
    if (!session || !me) return; // a tela de entrada está por cima: nada a fazer até entrar
    switch (t) {
      case "brand.get": return sendBrand();
      case "brand.save": await saveBrand(m.brand); return sendBrand();
      case "brand.pick": {
        const types = SLOTS[m.slot] ?? fail("Campo de arquivo desconhecido.");
        const file = await pickFile(types === FONTS ? FONTS.join(",") : "image/png,image/jpeg,image/svg+xml,image/webp");
        if (!file) return;
        check(types.includes(extOf(file.name)), `Use um arquivo ${types.join(", ")}.`);
        check(file.size <= 20 * 1024 * 1024, "Arquivo grande demais (máx. 20 MB).");
        const name = `${m.slot}-${stamp()}${extOf(file.name)}`;
        await put("marca/" + name, new Uint8Array(await file.arrayBuffer()));
        await saveBrand({ ...(await brand()), [m.slot]: name });
        return sendBrand();
      }
      case "brand.clear": await saveBrand({ ...(await brand()), [m.slot]: null }); return sendBrand();
      case "brand.reset": await saveBrand({ ...BRAND }); return sendBrand();

      case "themes.list": return sendThemes();
      case "themes.save": return sendThemes((await saveTheme(m.theme)).id);
      case "themes.delete": await del([`temas/${m.id}.json`]); return sendThemes();

      case "session.get": return sendState();
      case "countdown": case "sessionTimes": await saveTimes(m); return sendState();

      case "events.list": return sendEvents();
      case "events.new":
        return out({ type: "eventOpen", event: { id: newId("e"), name: "", date: today(), client: "", place: "", product: "totem", layouts: [], defaultLayout: null,
          print: true, copiesPerSession: 1, closed: false, phrase: PHRASE, phrases: PHRASES, theme: "visualize", activeSeconds: 0, passwordHash: null, hashtag: "", updated: now() } });
      case "events.open": return out({ type: "eventOpen", event: masked(await json(evPath(m.id))) });
      case "events.save": {
        const saved = await saveFromForm(m);
        out({ type: "eventSaved", event: masked(saved), active: false });
        return sendEvents();
      }
      case "events.duplicate": {
        const s = await json(evPath(m.id)), name = s.name + " (cópia)";
        const lay = (s.layouts ?? []).filter(l => exists(libLayout(l)));
        await saveEvent({ ...s, id: newId("e"), name: name.slice(0, 60), closed: false, layouts: lay, galleryFolderId: null, galleryUrl: null,
          defaultLayout: lay.includes(s.defaultLayout) ? s.defaultLayout : lay[0] ?? null, theme: (await themeOk(s.theme)) ? s.theme : "visualize" });
        return sendEvents();
      }
      case "events.delete": await del([evPath(m.id)]); return sendEvents();
      case "events.close": await closeEvent(m.id); await Promise.all([sendEvents(), sendLayouts(), sendThemes()]); return out({ type: "info", message: "Evento encerrado: foi para o Histórico." });
      case "events.reopen": await reopenEvent(m.id, m.password); return Promise.all([sendEvents(), sendLayouts(), sendThemes()]);
      case "events.summary": case "events.mail": case "events.folder":
        return out({ type: "notice", message: "Os contadores e as fotos ficam no equipamento: veja no app." });

      case "layouts.list": return sendLayouts();
      case "layouts.create": return out({ type: "layoutOpen", layout: await fromTemplate(m.template) });
      case "layouts.open": return out({ type: "layoutOpen", layout: await json(`layouts/${m.id}/layout.json`) });
      case "layouts.import": { const r = await importLayout(m.format); if (r) out({ type: "layoutOpen", layout: r.layout, warning: r.warning }); return; }
      case "layouts.save": return out({ type: "layoutSaved", layout: await saveLayout(m.layout) });
      case "layouts.duplicate": {
        const s = await json(`layouts/${m.id}/layout.json`), id = newId("l");
        // a cópia aponta para os mesmos arquivos de imagem (nada é baixado nem enviado de novo)
        await rest("arquivos?on_conflict=empresa_id,caminho", "POST", under(`layouts/${m.id}/`).filter(p => !p.endsWith("/layout.json"))
          .map(p => ({ empresa_id: me.empresa, caminho: `layouts/${id}/${p.split("/").pop()}`, hash: files.get(p).hash, tamanho: files.get(p).size, excluido: false })));
        for (const p of under(`layouts/${m.id}/`)) if (!p.endsWith("/layout.json")) files.set(`layouts/${id}/${p.split("/").pop()}`, files.get(p));
        toWorker();
        await saveLayout({ ...s, id, name: (s.name + " (cópia)").slice(0, 80) });
        return sendLayouts();
      }
      case "layouts.delete": await del(under(`layouts/${m.id}/`)); return sendLayouts();
      case "layouts.addImage": { const r = await addImage(m.id, m.role); if (r) out(r); return; }
      case "layouts.print": case "layouts.preview":
        return out({ type: "notice", message: "Imprimir é no equipamento (o “Visualizar” mostra a folha como sai)." });

      case "jsError": return console.warn("Erro na tela:", m.message);
      default: return; // câmera, impressora, InstaPrint, contadores…: são do equipamento
    }
  }

  async function handleAccount(m) {
    switch (m.type) {
      case "ready": case "account.get":
        if (recovering) return sendAccount();
        if (session && !me) { try { await join(); } catch (e) { if (e.message !== "sair") { error = e.message; sendAccount(); } } return; }
        sendAccount(); if (me) await sendAll(); return;
      case "account.login":
        keep(asSession(await auth("token?grant_type=password", { email: m.email.trim(), password: m.password })));
        return join();
      case "account.signup":
        check((m.password ?? "").length >= 6, "A senha precisa ter pelo menos 6 caracteres.");
        await auth("signup?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: m.email.trim(), password: m.password });
        return out({ type: "accountCode", purpose: "signup", email: m.email.trim() });
      case "account.recover":
        await auth("recover?redirect_to=" + encodeURIComponent(location.origin + location.pathname), { email: m.email.trim() });
        return out({ type: "accountCode", purpose: "recovery", email: m.email.trim() });
      case "account.verify": // o código do e-mail (quando o Supabase manda código em vez de link)
        keep(asSession(await auth("verify", { type: m.purpose === "recovery" ? "recovery" : "signup", email: m.email.trim(), token: m.code.trim() })));
        if (m.purpose === "recovery") await auth("user", { password: m.password }, session.access);
        return join();
      case "account.newPassword":
        check((m.password ?? "").length >= 6, "A senha nova precisa ter pelo menos 6 caracteres.");
        await auth("user", { password: m.password }, await token());
        recovering = false;
        out({ type: "info", message: "Senha nova salva." });
        return join();
      case "account.createCompany":
        await rpc("criar_empresa", { nome_empresa: m.empresa, nome_pessoa: m.nome });
        return join();
      case "account.logout": keep(null); me = null; files = new Map(); recovering = false; return sendAccount();
      case "account.sync":
        await loadIndex(); await join();
        return out({ type: "info", message: "Atualizado com a nuvem." });
      case "account.members": {
        const members = await rest("membros?select=user_id,email,nome,nivel,desativado&order=nome");
        const invites = me?.nivel === "administrador" ? await rest("convites?select=email,nivel&order=criado_em.desc") : [];
        return out({ type: "members", members, invites, me: session.uid });
      }
      case "account.invite":
        await rpc("convidar", { email_pessoa: m.email, nivel_pessoa: m.nivel });
        out({ type: "info", message: `Convite feito. A pessoa cria a conta com ${m.email.trim().toLowerCase()} e já entra na empresa.` });
        return handleAccount({ type: "account.members" });
      case "account.cancelInvite": await rest("convites?email=eq." + encodeURIComponent(m.email), "DELETE"); return handleAccount({ type: "account.members" });
      case "account.setMember":
        await rpc("alterar_membro", { pessoa: m.id, nivel_pessoa: m.nivel, desativar: m.disabled });
        return handleAccount({ type: "account.members" });
    }
  }

  // ---------- link dos e-mails (confirmar conta, senha nova) voltando para esta página ----------
  (async () => {
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.size) return;
    history.replaceState(null, "", location.pathname); // o login não fica no endereço nem no histórico
    if (q.get("error")) return setTimeout(() => out({ type: "error", message: "O link do e-mail venceu ou já foi usado. Peça outro (Criar conta ou Esqueci a senha)." }), 800);
    if (!q.get("access_token")) return;
    const who = await auth("user", null, q.get("access_token")).catch(() => null);
    if (!who) return;
    keep({ access: q.get("access_token"), refresh: q.get("refresh_token"), expires: Date.now() + ((+q.get("expires_in") || 3600) - 60) * 1000, uid: who.id, email: who.email });
    if (q.get("type") === "recovery") { recovering = true; setTimeout(() => { sendAccount(); out({ type: "accountCode", purpose: "newPassword", email: who.email }); }, 800); }
  })();

  // mudanças feitas nos equipamentos (ou em outra aba) aparecem aqui sem recarregar
  let lastSig = "";
  setInterval(async () => {
    if (!session || !me || document.hidden) return;
    try {
      const before = [...files].map(([p, f]) => p + f.hash).join();
      await loadIndex();
      const after = [...files].map(([p, f]) => p + f.hash).join();
      if (lastSig && before !== after) await sendAll();
      lastSig = after;
    } catch { } // sem internet: tenta de novo daqui a pouco
  }, 15000);

  // service worker: entrega as imagens dos layouts e as fontes/logos da marca
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(() => {
      if (!navigator.serviceWorker.controller && !sessionStorage.getItem("atalaia.sw")) { sessionStorage.setItem("atalaia.sw", "1"); location.reload(); }
      toWorker();
    });
    navigator.serviceWorker.addEventListener("controllerchange", toWorker);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.title = "Atalaia Booth — Painel";
    $("home").hidden = true; // o painel não tem tela de espera (o “Ver” dos temas mostra a prévia)
    const hint = document.querySelector("#evList .lib-head .hint");
    if (hint) hint.innerHTML = "Tudo o que você cria aqui aparece nos equipamentos da empresa em segundos. Ativar o evento é feito no equipamento.";
  });
})();
