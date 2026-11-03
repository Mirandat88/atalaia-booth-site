// Desenho único do layout: o mesmo código faz a miniatura, o editor e a folha que vai para a impressora.
// Camadas: cor de fundo → imagem de fundo → pilha (fotos, moldura, imagens, contorno e textos, na ordem de “z”).
// Com tudo em z 0 (layouts antigos), a pilha fica: fotos → moldura → imagens → contorno → textos.
const LayoutRender = (() => {
  const FORMATS = { strip: { w: 600, h: 1800 }, landscape: { w: 1800, h: 1200 }, portrait: { w: 1200, h: 1800 }, polaroid: { w: 900, h: 1200 } };
  const FAMILY = { serif: "'Cormorant Garamond'", sans: "'Jost'" };
  const DEFAULT_WEIGHT = { serif: 500, sans: 400 };
  const FILTER = { none: "none", bw: "grayscale(1)", sepia: "sepia(.85)" };
  const images = new Map();

  function loadImage(url) {
    if (!images.has(url)) {
      images.set(url, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => { images.delete(url); reject(new Error("Imagem não carregou: " + decodeURIComponent(url.split("/").pop()))); };
        img.src = url;
      }));
    }
    return images.get(url);
  }

  // {evento} e {data}: os do evento atual (Impressão → Evento); antes de o app avisar, um exemplo
  let eventData = null;
  const setEvent = data => (eventData = data);
  const sampleData = () => {
    if (eventData) return eventData;
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return { evento: "Ana & João", data: `${p(d.getDate())} · ${p(d.getMonth() + 1)} · ${d.getFullYear()}` };
  };
  const fill = (t, data) => {
    const s = t.text.replaceAll("{evento}", data.evento).replaceAll("{data}", data.data).replaceAll("{hashtag}", data.hashtag || "hashtagdoevento");
    return t.upper ? s.toLocaleUpperCase("pt-BR") : s;
  };
  const fontOf = (t, px) => `${t.italic ? "italic " : ""}${t.weight || DEFAULT_WEIGHT[t.font]} ${px}px ${FAMILY[t.font]}`;

  const rgba = (hex, opacity) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${opacity / 100})`;
  };

  /** Liga a sombra do elemento (cai na diagonal, para baixo e à direita) enquanto `draw` desenha. */
  function withShadow(ctx, item, S, draw) {
    const on = (item.shadowBlur || 0) > 0 || (item.shadowDistance || 0) > 0;
    if (on) {
      ctx.save();
      ctx.shadowColor = rgba(item.shadowColor || "#000000", item.shadowOpacity ?? 40);
      ctx.shadowBlur = S(item.shadowBlur || 0);
      ctx.shadowOffsetX = ctx.shadowOffsetY = S(item.shadowDistance || 0) * Math.SQRT1_2;
    }
    draw();
    if (on) ctx.restore();
  }

  /** Degradê da cor 1 para a cor 2; 180° = de cima para baixo, 90° = da esquerda para a direita (como no CSS). */
  function gradient(ctx, layout, w, h) {
    const a = ((layout.gradientAngle ?? 180) - 90) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2; // a linha cobre a folha inteira em qualquer ângulo
    const g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    g.addColorStop(0, layout.background);
    g.addColorStop(1, layout.background2);
    return g;
  }

  /** Gira o desenho em torno do centro da caixa (x, y, w, h já em pixels da tela). */
  function rotated(ctx, deg, x, y, w, h, drawAt) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (deg) ctx.rotate(deg * Math.PI / 180);
    drawAt(-w / 2, -h / 2);
    ctx.restore();
  }

  /** Foto preenchendo o quadro. adj (InstaPrint): zoom ≥ 1 e dx/dy = quanto o operador arrastou, em frações do quadro. */
  function cover(ctx, img, x, y, w, h, adj) {
    const zoom = Math.max(1, adj?.zoom || 1);
    const s = Math.max(w / img.width, h / img.height) * zoom, sw = w / s, sh = h / s;
    const clamp = (v, max) => Math.min(Math.max(v, 0), Math.max(0, max)); // a foto sempre cobre o quadro inteiro
    const sx = clamp((img.width - sw) / 2 - (adj?.dx || 0) * sw, img.width - sw);
    const sy = clamp((img.height - sh) / 2 - (adj?.dy || 0) * sh, img.height - sh);
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function placeholder(ctx, n, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#3a342c");
    g.addColorStop(1, "#15130f");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(201,169,110,.85)";
    ctx.font = `italic 500 ${Math.min(w, h) * 0.35}px ${FAMILY.serif}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), x + w / 2, y + h / 2);
  }

  async function drawSlot(ctx, s, n, url, S) {
    const adj = url && typeof url === "object" ? url : null; // { url, dx, dy, zoom } — foto ajustada pelo operador
    const photo = url ? await loadImage(adj ? adj.url : url) : null;
    rotated(ctx, s.rotation, S(s.x), S(s.y), S(s.w), S(s.h), (x, y) => {
      const w = S(s.w), h = S(s.h), r = Math.min(S(s.radius || 0), w / 2, h / 2);
      // sombra: desenhada por uma forma igual ao quadro, que a foto cobre logo em seguida
      withShadow(ctx, s, S, () => {
        if (!s.shadowBlur && !s.shadowDistance) return;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
      });
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.clip();
      if (photo) {
        ctx.filter = FILTER[s.filter || "none"];
        cover(ctx, photo, x, y, w, h, adj);
        ctx.filter = "none";
      } else placeholder(ctx, n, x, y, w, h);
      ctx.restore();
      if (s.border > 0) {
        // borda por dentro do quadro: o tamanho do quadro na folha não muda
        const b = S(s.border);
        ctx.lineWidth = b;
        ctx.strokeStyle = s.borderColor;
        ctx.beginPath();
        ctx.roundRect(x + b / 2, y + b / 2, w - b, h - b, Math.max(0, r - b / 2));
        ctx.stroke();
      }
      if (s.outline > 0) {
        // contorno por fora da foto, com espaço entre a linha e a foto (destaca o quadro)
        const o = S(s.outline), g = S(s.outlineGap || 0) + o / 2;
        ctx.lineWidth = o;
        ctx.strokeStyle = s.outlineColor;
        ctx.beginPath();
        ctx.roundRect(x - g, y - g, w + 2 * g, h + 2 * g, r > 0 ? r + g : 0);
        ctx.stroke();
      }
    });
  }

  async function drawOne(ctx, layout, assets, { scale, photos, data, ox }) {
    const f = FORMATS[layout.format], S = v => v * scale;
    ctx.save();
    ctx.translate(ox, 0);
    ctx.beginPath();
    ctx.rect(0, 0, S(f.w), S(f.h));
    ctx.clip();
    ctx.fillStyle = layout.background2 ? gradient(ctx, layout, S(f.w), S(f.h)) : layout.background;
    ctx.fillRect(0, 0, S(f.w), S(f.h));
    if (layout.backgroundImage) ctx.drawImage(await loadImage(assets + layout.backgroundImage), 0, 0, S(f.w), S(f.h));

    for (const e of stackOf(layout)) {
      if (e.kind === "slot") await drawSlot(ctx, layout.slots[e.i], e.i + 1, photos.length ? photos[e.i % photos.length] : null, S);
      else if (e.kind === "overlay") ctx.drawImage(await loadImage(assets + layout.overlayImage), 0, 0, S(f.w), S(f.h));
      else if (e.kind === "image") await drawImage(ctx, layout.images[e.i], assets, S);
      else if (e.kind === "frame") drawFrame(ctx, layout, f, S);
      else drawText(ctx, layout.texts[e.i], data, S);
    }
    ctx.restore();
  }

  /**
   * Ordem das camadas, de baixo para cima: [{kind, i}]. Desempate (mesmo z): fotos, moldura, imagens, contorno, textos.
   * O editor usa a mesma lista para subir/descer camadas e para saber qual caixa fica por cima no clique.
   */
  function stackOf(layout) {
    const RANK = { slot: 0, overlay: 1, image: 2, frame: 3, text: 4 };
    const list = [
      ...layout.slots.map((s, i) => ({ kind: "slot", i, z: s.z || 0 })),
      ...(layout.overlayImage ? [{ kind: "overlay", i: 0, z: layout.overlayZ || 0 }] : []),
      ...layout.images.map((im, i) => ({ kind: "image", i, z: im.z || 0 })),
      ...(layout.frameWidth > 0 ? [{ kind: "frame", i: 0, z: layout.frameZ || 0 }] : []),
      ...layout.texts.map((t, i) => ({ kind: "text", i, z: t.z || 0 })),
    ];
    return list.sort((a, b) => a.z - b.z || RANK[a.kind] - RANK[b.kind] || a.i - b.i);
  }

  async function drawImage(ctx, im, assets, S) {
    const img = await loadImage(assets + im.file);
    ctx.save();
    ctx.globalAlpha = (im.opacity ?? 100) / 100;
    rotated(ctx, im.rotation, S(im.x), S(im.y), S(im.w), S(im.h), (x, y) => withShadow(ctx, im, S, () => ctx.drawImage(img, x, y, S(im.w), S(im.h))));
    ctx.restore();
  }

  function drawFrame(ctx, layout, f, S) {
    // contorno da folha inteira, a frameInset px da borda do papel
    const fw = S(layout.frameWidth), inset = S(layout.frameInset ?? 36) + fw / 2;
    ctx.lineWidth = fw;
    ctx.strokeStyle = layout.frameColor || "#C9A96E";
    ctx.beginPath();
    ctx.roundRect(inset, inset, S(f.w) - 2 * inset, S(f.h) - 2 * inset, S(layout.frameRadius || 0));
    ctx.stroke();
  }

  function drawText(ctx, t, data, S) {
    {
      const text = fill(t, data);
      let px = S(t.size);
      ctx.font = fontOf(t, px);
      ctx.letterSpacing = S(t.spacing || 0) + "px";
      // não deixa o texto passar da caixa: diminui a letra até caber (nome do evento longo)
      const width = ctx.measureText(text).width;
      if (width > S(t.w)) { px *= S(t.w) / width; ctx.font = fontOf(t, px); }
      ctx.fillStyle = t.color;
      ctx.textAlign = t.align;
      ctx.textBaseline = "top";
      rotated(ctx, t.rotation, S(t.x), S(t.y), S(t.w), S(t.size * 1.25), (x, y) => {
        const ax = t.align === "left" ? x : t.align === "right" ? x + S(t.w) : x + S(t.w) / 2;
        withShadow(ctx, t, S, () => ctx.fillText(text, ax, y));
      });
      ctx.letterSpacing = "0px";
    }
  }

  /**
   * Desenha o layout num canvas.
   * opts.scale: 1 = tamanho real (300 dpi) · opts.photos: endereços das fotos (vazio = números no lugar)
   * opts.sheet: folha de impressão (a tirinha sai duas vezes lado a lado, para o corte no meio; o polaroide também,
   *   mas com outra foto na metade da direita: opts.photos2)
   */
  async function render(layout, assets, opts = {}) {
    const f = FORMATS[layout.format];
    const scale = opts.scale ?? 1, photos = opts.photos ?? [], data = opts.data ?? sampleData();
    const twice = opts.sheet && (layout.format === "strip" || layout.format === "polaroid");
    await Promise.all(layout.texts.map(t => document.fonts.load(fontOf(t, 20), fill(t, data))));
    const canvas = opts.canvas ?? document.createElement("canvas");
    canvas.width = Math.round(f.w * (twice ? 2 : 1) * scale);
    canvas.height = Math.round(f.h * scale);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    await drawOne(ctx, layout, assets, { scale, photos, data, ox: 0 });
    if (twice) await drawOne(ctx, layout, assets, { scale, photos: opts.photos2 ?? photos, data, ox: f.w * scale });
    if (twice && layout.format === "polaroid") { // marquinhas do corte manual no meio (só nas pontas)
      const x = f.w * scale, m = 30 * scale;
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, m); ctx.moveTo(x, f.h * scale - m); ctx.lineTo(x, f.h * scale); ctx.stroke();
    }
    return canvas;
  }

  return { FORMATS, render, loadImage, sampleData, setEvent, stackOf };
})();
