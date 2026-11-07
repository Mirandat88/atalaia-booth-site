// Configurações → Fotos: pasta das fotos neste PC, guardar a original da câmera e o que vai para a galeria online.
(() => {
  $("phPick").onclick = () => send({ type: "photos.pickFolder" });
  $("phOpen").onclick = () => send({ type: "photos.open" });
  $("phReset").onclick = () => send({ type: "photos.resetFolder" });
  const save = () => send({ type: "photos.save", saveOriginals: $("phOriginals").checked, uploadSheets: $("phSheets").checked, uploadSingles: $("phSingles").checked });
  for (const id of ["phOriginals", "phSheets", "phSingles"]) $(id).onchange = save;

  $("phConnect").onclick = () => send({ type: "drive.connect" });
  $("phDisconnect").onclick = () => {
    if (confirm("Desconectar o Google Drive de todos os PCs da conta?\n\nAs fotos que já estão no Drive continuam lá; as novas param de ir."))
      send({ type: "drive.disconnect" });
  };

  host?.addEventListener("message", e => {
    const m = e.data;
    if (m.type === "driveConnecting") {
      $("phDrive").textContent = "Termine o login do Google no navegador…";
      $("phConnect").disabled = true;
      return;
    }
    if (m.type === "drive") {
      $("phConnect").disabled = false;
      $("phConnect").hidden = m.connected;
      $("phDisconnect").hidden = !m.connected;
      $("phDrive").textContent = (m.connected ? `Google Drive conectado: ${m.email}.` : "Google Drive: não conectado.") + (m.status ? " " + m.status : "");
      return;
    }
    if (m.type === "error") $("phConnect").disabled = false;
    if (m.type !== "photos") return;
    $("phFolder").textContent = m.folder + (m.isDefault ? " (padrão)" : "");
    $("phReset").hidden = m.isDefault;
    $("phOriginals").checked = m.saveOriginals;
    $("phSheets").checked = m.uploadSheets;
    $("phSingles").checked = m.uploadSingles;
  });
  document.addEventListener("screen", e => { if (e.detail === "photos") { send({ type: "photos.get" }); send({ type: "drive.get" }); } });
})();
