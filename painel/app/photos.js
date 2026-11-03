// Configurações → Fotos: pasta das fotos neste PC, guardar a original da câmera e o que vai para a galeria online.
(() => {
  $("phPick").onclick = () => send({ type: "photos.pickFolder" });
  $("phOpen").onclick = () => send({ type: "photos.open" });
  $("phReset").onclick = () => send({ type: "photos.resetFolder" });
  const save = () => send({ type: "photos.save", saveOriginals: $("phOriginals").checked, uploadSheets: $("phSheets").checked, uploadSingles: $("phSingles").checked });
  for (const id of ["phOriginals", "phSheets", "phSingles"]) $(id).onchange = save;

  host?.addEventListener("message", e => {
    const m = e.data;
    if (m.type !== "photos") return;
    $("phFolder").textContent = m.folder + (m.isDefault ? " (padrão)" : "");
    $("phReset").hidden = m.isDefault;
    $("phOriginals").checked = m.saveOriginals;
    $("phSheets").checked = m.uploadSheets;
    $("phSingles").checked = m.uploadSingles;
  });
  document.addEventListener("screen", e => { if (e.detail === "photos") send({ type: "photos.get" }); });
})();
