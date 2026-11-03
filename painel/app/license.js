// Configurações → Ativação (Etapa 07): a key do equipamento. Sem ela, modo demonstração (não imprime, foto com marca d'água).
(() => {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  $("lcActivate").onclick = () => {
    const key = $("lcKey").value.trim().toUpperCase();
    if (!/^VB(-[A-Z0-9]{4}){4}$/.test(key)) return toast("A key tem este formato: VB-XXXX-XXXX-XXXX-XXXX.", true);
    send({ type: "license.activate", key });
  };

  host?.addEventListener("message", e => {
    const m = e.data;
    if (m.type !== "license") return;
    // ativação desligada: sem selo e sem a aba Ativação
    document.querySelector(".rail [data-tab=license]").hidden = !m.required;
    $("demoBadge").hidden = m.active || !m.required;
    $("lcTitle").textContent = m.active ? "Equipamento ativado" : "Modo demonstração";
    $("lcState").innerHTML = m.active
      ? `<b>${esc(m.name)}</b> · key ${esc(m.key)} · ativado em ${esc(m.since)} neste PC (${esc(m.machine)}).`
      : "Sem key: o app funciona para testar, mas <b>não imprime</b> e a folha sai com <b>“DEMONSTRAÇÃO”</b>.";
    $("lcForm").hidden = m.active; // trocar ou desvincular: só pelo painel
    if (m.active) $("lcKey").value = "";
  });
  document.addEventListener("screen", e => { if (e.detail === "license") send({ type: "license.get" }); });
})();
