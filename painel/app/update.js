// Configurações → Atualização: versão instalada, procurar a nova e atualizar pelo botão (o app fecha, instala e abre de novo).
(() => {
  $("upCheck").onclick = () => {
    $("upState").textContent = "Procurando…";
    send({ type: "update.check" });
  };
  $("upInstall").onclick = () => {
    if (confirm("Atualizar agora?\n\nO app fecha, instala a versão nova e abre de novo em alguns segundos. Eventos, layouts, fotos e configurações ficam como estão."))
      send({ type: "update.install" });
  };

  host?.addEventListener("message", e => {
    const m = e.data;
    if (m.type === "updating") {
      $("upState").textContent = `Baixando a versão ${m.version}… o app fecha e abre sozinho.`;
      $("upInstall").disabled = $("upCheck").disabled = true;
      return;
    }
    if (m.type === "error") $("upInstall").disabled = $("upCheck").disabled = false; // falhou ao baixar: dá para tentar de novo
    if (m.type !== "update") return;
    $("updateBadge").hidden = !m.available;
    $("upInstall").hidden = !m.available;
    $("upTitle").textContent = m.available ? "Atualização disponível" : "Versão instalada";
    $("upState").textContent = m.error ?? (m.available
      ? `Versão nova: ${m.latest} (esta é a ${m.current}).`
      : `Versão ${m.current}${m.latest ? " — é a mais nova." : "."}`);
    $("upNotes").textContent = m.available ? m.notes ?? "" : "";
  });
  document.addEventListener("screen", e => { if (e.detail === "update" && !$("upState").textContent) send({ type: "update.check" }); });
})();
