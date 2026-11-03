// Galeria do evento (Etapa 06): botão no canto esquerdo da tela do evento → folhas da festa → foto grande → Imprimir de novo.
(() => {
  const view = $("galleryView");
  let ev = null, current = null, copies = 1, idle;

  // sem mexer por 90 s, volta sozinha para a tela do evento
  const touch = () => { clearTimeout(idle); idle = setTimeout(close, 90000); };

  function open(e) {
    ev = e;
    view.hidden = false;
    $("galEvent").textContent = e.name;
    detail(null);
    $("galGrid").replaceChildren();
    $("galEmpty").hidden = true;
    send({ type: "gallery.list" });
    touch();
  }
  function close() {
    clearTimeout(idle);
    view.hidden = true;
  }

  function detail(item) {
    current = item;
    $("galDetail").hidden = !item;
    $("galGrid").hidden = !!item;
    if (!item) return;
    $("galImg").src = item.url;
    copies = Math.min(3, Math.max(1, ev.copiesPerSession || 1));
    $("galCopies").textContent = copies;
    $("galPrintRow").hidden = !ev.print;
  }

  host?.addEventListener("message", e => {
    const m = e.data;
    if (m.type === "gallery" && !view.hidden) {
      $("galEmpty").hidden = m.items.length > 0;
      $("galGrid").replaceChildren(...m.items.map(it => {
        const b = document.createElement("button");
        b.className = "gal-item";
        b.innerHTML = `<img loading="lazy" src="${it.url}" alt=""><span>${it.time}</span>`;
        b.onclick = () => { touch(); detail(it); };
        return b;
      }));
    }
    if (m.type === "reprinted" && !view.hidden) toast(m.pdf ? "PDF salvo: " + m.pdf : "Imprimindo… pegue sua foto com o monitor.");
  });

  view.onclick = e => { e.stopPropagation(); touch(); };
  $("homeGallery").onclick = e => { e.stopPropagation(); if (guestEvent()) open(guestEvent()); };
  $("galClose").onclick = e => { e.stopPropagation(); close(); };
  $("galBack").onclick = e => { e.stopPropagation(); detail(null); };
  $("galMinus").onclick = () => ($("galCopies").textContent = copies = Math.max(1, copies - 1));
  $("galPlus").onclick = () => ($("galCopies").textContent = copies = Math.min(3, copies + 1));
  $("galDelete").onclick = async e => {
    e.stopPropagation();
    const item = current;
    const pw = await askPassword("Galeria", "Apagar esta foto da galeria?", "Digite a senha do evento. A folha sai da galeria, mas fica guardada na pasta do evento (Layout\\Excluídas da galeria).");
    touch();
    if (pw == null) return;
    send({ type: "gallery.delete", name: item.name, password: pw });
    detail(null);
  };
  $("galPrint").onclick = () => {
    send({ type: "gallery.print", name: current.name, copies });
    detail(null);
  };

  window.Gallery = { open, close };
})();
