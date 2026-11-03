// Conta na nuvem: tela de entrada (por cima de tudo até entrar), aba Conta e pessoas da empresa (administrador).
(() => {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const LEVEL = { administrador: "Administrador", gerente: "Gerente", operador: "Operador" };
  let signup = false, acc = null, pending = null; // pending: esperando o código do e-mail ({ purpose, email })
  let signupPass = ""; // a senha que acabou de criar: depois de abrir o link, “Entrar” usa ela (sem digitar de novo)
  $("lgShow").onclick = () => {
    const show = $("lgPass").type === "password";
    $("lgPass").type = show ? "text" : "password";
    $("lgShow").textContent = show ? "esconder" : "ver";
  };

  // ---------- tela de entrada ----------
  const msg = (text, isError) => { $("lgMsg").textContent = text ?? ""; $("lgMsg").style.color = isError ? "var(--rec)" : ""; };
  const mode = s => {
    signup = s;
    pending = null;
    $("lgCodeRow").hidden = true;
    $("lgPassRow").hidden = false;
    $("lgEmail").disabled = false;
    $("lgPassLabel").textContent = "Senha";
    $("lgTitle").textContent = s ? "Criar conta" : "Entrar";
    $("lgGo").textContent = s ? "Criar conta" : "Entrar";
    $("lgMode").textContent = s ? "Já tenho conta" : "Criar conta";
    $("lgPass").autocomplete = s ? "new-password" : "current-password";
    msg("");
  };
  $("lgMode").onclick = () => mode(pending ? false : !signup);
  // o código chegou por e-mail: confirmar a conta nova ou criar a senha nova
  const askCode = (purpose, email) => {
    pending = { purpose, email };
    $("lgEmail").value = email;
    $("lgEmail").disabled = true;
    $("lgCodeRow").hidden = false;
    $("lgCode").value = "";
    $("lgPassRow").hidden = purpose === "signup";
    $("lgCodeRow").hidden = purpose === "newPassword"; // veio pelo link: só falta a senha
    $("lgPassLabel").textContent = "Senha nova (pelo menos 6 caracteres)";
    $("lgPass").value = "";
    $("lgTitle").textContent = purpose === "signup" ? "Confirme o e-mail" : "Senha nova";
    $("lgGo").textContent = purpose === "signup" ? "Entrar" : "Salvar senha e entrar";
    if (purpose === "newPassword") { msg("Crie a senha nova (pelo menos 6 caracteres)."); $("lgForm").hidden = false; $("lgPass").focus(); return; }
    $("lgMode").textContent = "Voltar";
    // sem servidor de e-mail próprio, o Supabase manda um link no lugar do código
    msg(purpose === "signup"
      ? `Mandamos um e-mail para ${email} (veja o spam). Abra o link do e-mail NESTE computador: o app entra sozinho.`
      : `Mandamos um e-mail para ${email} (veja o spam). Abra o link do e-mail NESTE computador para criar a senha nova.`);
    $("lgCode").focus();
  };
  $("lgGo").onclick = () => {
    if (pending) {
      if (pending.purpose === "newPassword") {
        if ($("lgPass").value.length < 6) return msg("A senha nova precisa ter pelo menos 6 caracteres.", true);
        return send({ type: "account.newPassword", password: $("lgPass").value });
      }
      const code = $("lgCode").value.trim();
      if (!code && pending.purpose === "signup") { // abriu o link do e-mail: entra com a senha que acabou de criar
        msg("Entrando…");
        return send({ type: "account.login", email: pending.email, password: signupPass });
      }
      if (!/^\d{6,10}$/.test(code)) return msg("Digite o código de números que chegou no e-mail.", true);
      msg("Conferindo…");
      return send({ type: "account.verify", ...pending, code, password: $("lgPass").value });
    }
    const email = $("lgEmail").value.trim(), password = $("lgPass").value;
    if (!email || !password) return msg("Digite o e-mail e a senha.", true);
    msg(signup ? "Criando a conta…" : "Entrando…");
    if (signup) signupPass = password;
    send({ type: signup ? "account.signup" : "account.login", email, password });
  };
  $("lgPass").onkeydown = e => { if (e.key === "Enter") $("lgGo").click(); };
  $("lgForgot").onclick = () => {
    const email = $("lgEmail").value.trim();
    if (!email) return msg("Digite o seu e-mail e toque de novo em “Esqueci a senha”.", true);
    send({ type: "account.recover", email });
  };
  $("lgCreate").onclick = () => {
    const empresa = $("lgCompanyName").value.trim(), nome = $("lgName").value.trim();
    if (!empresa || !nome) return msg("Digite o nome da empresa e o seu nome.", true);
    send({ type: "account.createCompany", empresa, nome, bring: $("lgBring").checked });
  };
  $("lgRetry").onclick = () => send({ type: "account.sync" });
  $("lgOut").onclick = $("acOut").onclick = () => {
    if (!acc?.ready || confirm("Sair desta conta neste PC?\n\nOs eventos, layouts e configurações continuam no PC; para usar o app de novo, entre com uma conta da empresa."))
      send({ type: "account.logout" });
  };

  // ---------- aba Conta ----------
  $("acSync").onclick = () => send({ type: "account.sync" });
  $("acInvite").onclick = () => {
    const email = $("acEmail").value.trim();
    if (!email) return toast("Digite o e-mail da pessoa.", true);
    send({ type: "account.invite", email, nivel: $("acLevel").value });
    $("acEmail").value = "";
  };

  function renderMembers(m) {
    const levels = l => Object.entries(LEVEL).map(([v, t]) => `<option value="${v}"${v === l ? " selected" : ""}>${t}</option>`).join("");
    $("acMembers").innerHTML = m.members.map((p, i) => `
      <div class="adm-row${p.desativado ? " off" : ""}">
        <span><b>${esc(p.nome || p.email)}</b><br><small>${esc(p.email)}${p.user_id === m.me ? " · você" : ""}${p.desativado ? " · desativado" : ""}</small></span>
        <select data-i="${i}">${levels(p.nivel)}</select>
        <button class="ghost" data-off="${i}">${p.desativado ? "Reativar" : "Desativar"}</button>
      </div>`).join("");
    const set = (p, nivel, disabled) => send({ type: "account.setMember", id: p.user_id, nivel, disabled });
    $("acMembers").querySelectorAll("select").forEach(s => (s.onchange = () => { const p = m.members[s.dataset.i]; set(p, s.value, p.desativado); }));
    $("acMembers").querySelectorAll("[data-off]").forEach(b => (b.onclick = () => { const p = m.members[b.dataset.off]; set(p, p.nivel, !p.desativado); }));
    $("acInvites").innerHTML = m.invites.length ? "<h2>Convites esperando a pessoa entrar</h2>" + m.invites.map((c, i) => `
      <div class="adm-row"><span><b>${esc(c.email)}</b><br><small>${LEVEL[c.nivel]}</small></span><span></span><button class="ghost" data-cancel="${i}">Cancelar</button></div>`).join("") : "";
    $("acInvites").querySelectorAll("[data-cancel]").forEach(b => (b.onclick = () => send({ type: "account.cancelInvite", email: m.invites[b.dataset.cancel].email })));
  }

  host?.addEventListener("message", e => {
    const m = e.data;
    if (!$("login").hidden && (m.type === "error" || m.type === "info")) msg(m.message, m.type === "error"); // a tela de entrada cobre os avisos
    if (m.type === "members") return renderMembers(m);
    if (m.type === "accountCode") return askCode(m.purpose, m.email);
    if (m.type !== "account") return;
    acc = m;
    $("login").hidden = m.ready;
    $("lgForm").hidden = m.logged && pending?.purpose !== "newPassword";
    $("lgCompany").hidden = !m.logged || m.disabled || !m.needsCompany;
    if (m.logged && m.disabled) msg("O seu acesso foi desativado pelo administrador da empresa.", true);
    if (m.ready) { mode(false); $("lgPass").value = ""; msg(""); }
    for (const l of Object.keys(LEVEL)) document.body.classList.toggle("role-" + l, m.ready && m.level === l);
    $("acWho").innerHTML = m.ready ? `<b>${esc(m.name || m.email)}</b> · ${esc(m.email)}<br>${esc(m.company)} · ${LEVEL[m.level]}` : "";
    $("acState").textContent = m.error ?? (m.lastSync ? `Sincronizado às ${m.lastSync}.` : "Sincronizando…");
    $("acPeople").hidden = m.level !== "administrador";
  });
  document.addEventListener("screen", e => { if (e.detail === "account") send({ type: "account.members" }); });
})();
