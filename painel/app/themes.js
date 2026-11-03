// Temas da tela do evento e da sessão (Etapa 06). Escolhido no evento; “visualize” é o padrão e o da tela de espera.
// Cada tema: cores (variáveis CSS), fonte da frase, logo clara ou escura, contornos que flutuam e o que anima no fundo.
const THEME_ICONS = (() => {
  const o = d => `<svg viewBox="0 0 64 64">${d}</svg>`; // contornos (traço fino, sem preenchimento)
  return {
    camera: o('<rect x="6" y="18" width="52" height="36" rx="5"/><circle cx="32" cy="36" r="11"/><circle cx="32" cy="36" r="6"/><path d="M22 18l4-7h12l4 7"/>'),
    strip: '<svg viewBox="0 0 40 110"><rect x="4" y="4" width="32" height="102" rx="2"/><rect x="9" y="10" width="22" height="26"/><rect x="9" y="42" width="22" height="26"/><rect x="9" y="74" width="22" height="26"/></svg>',
    arch: '<svg viewBox="0 0 70 100"><path d="M8 96V36a27 27 0 0154 0v60z"/><path d="M16 90V38a19 19 0 0138 0v52z"/></svg>',
    photo: o('<rect x="4" y="10" width="56" height="44" rx="3"/><path d="M4 44l16-14 12 10 10-8 18 14"/><circle cx="44" cy="22" r="4"/>'),
    balloon: o('<path d="M32 6c-11 0-18 9-18 19 0 12 10 21 18 23 8-2 18-11 18-23 0-10-7-19-18-19z"/><path d="M29 48l3 4 3-4M32 52c-3 4 3 7 0 11"/>'),
    gift: o('<rect x="10" y="26" width="44" height="30"/><rect x="6" y="18" width="52" height="9"/><path d="M32 18v38M32 18c-5-9-16-9-14-2 1 3 9 2 14 2zM32 18c5-9 16-9 14-2-1 3-9 2-14 2z"/>'),
    cake: o('<rect x="10" y="34" width="44" height="22" rx="2"/><path d="M10 42c5 4 9 4 14 0s9-4 14 0 9 4 16 0M22 34V24M32 34V22M42 34V24"/><path d="M22 18c-2 2 0 4 0 4M32 16c-2 2 0 4 0 4M42 18c-2 2 0 4 0 4"/>'),
    hat: o('<path d="M32 6L14 56h36z"/><path d="M20 40h24M24 28h16"/><circle cx="32" cy="5" r="3"/>'),
    crown: o('<path d="M8 46L4 18l16 12 12-20 12 20 16-12-4 28z"/><path d="M8 54h48"/><circle cx="32" cy="34" r="3"/>'),
    butterfly: o('<path d="M32 20v30"/><path d="M32 26C22 8 6 10 8 22s16 10 24 6zM32 26c10-18 26-16 24-4s-16 10-24 6zM32 34c-8 0-18 4-16 12s12 6 16-4zM32 34c8 0 18 4 16 12s-12 6-16-4z"/>'),
    star: o('<path d="M32 6l7 17 18 2-14 12 4 18-15-9-15 9 4-18L7 25l18-2z"/>'),
    rings: o('<circle cx="24" cy="38" r="15"/><circle cx="40" cy="38" r="15"/><path d="M36 14l4-6 4 6-4 4z"/>'),
    heart: o('<path d="M32 54C14 42 6 32 6 22a12 12 0 0126-6 12 12 0 0126 6c0 10-8 20-26 32z"/>'),
    leaf: o('<path d="M8 56C20 30 36 16 58 8"/><path d="M20 40c-8-4-10-12-8-18 8 2 12 10 8 18zM32 28c-4-8-2-16 4-20 4 6 2 16-4 20zM30 32c8-4 16-2 20 4-6 4-14 2-20-4zM18 46c6-6 14-6 18 0-6 4-12 4-18 0z"/>'),
    glasses: o('<path d="M14 6h14l-2 18a5 5 0 01-10 0zM36 10l13 4-7 16a5 5 0 01-9-3z"/><path d="M21 29v22M14 51h14M38 30l-6 20M30 52l12 3"/>'),
    ornament: o('<circle cx="32" cy="36" r="20"/><rect x="27" y="10" width="10" height="7"/><path d="M14 30c12 4 24 4 36 0M14 42c12 4 24 4 36 0"/>'),
    hexagon: o('<path d="M32 4l24 14v28L32 60 8 46V18z"/><path d="M32 18l12 7v14l-12 7-12-7V25z"/>'),
    chart: o('<path d="M6 56h52M12 56V36h8v20M28 56V24h8v32M44 56V12h8v44"/>'),
    cloud: o('<path d="M16 46h34a10 10 0 000-20 14 14 0 00-27-3 11 11 0 00-7 23z"/>'),
    rainbow: o('<path d="M4 50a28 28 0 0156 0M12 50a20 20 0 0140 0M20 50a12 12 0 0124 0"/>'),
  };
})();

const THEMES = (() => {
  const ICON = THEME_ICONS;
  return {
    visualize: {
      name: "Visualize", sub: "Padrão de todo evento",
      vars: { bg: "radial-gradient(ellipse at 50% 45%,#141210 0%,#070706 70%)", text: "#F4EFE6", accent: "#C9A96E", line: "rgba(244,239,230,.07)", btn: "rgba(14,13,12,.55)" },
      font: "italic 400 1em var(--serif)", dark: false, blades: ["#22201c", "#2c2924"],
      icons: [ICON.camera, ICON.strip, ICON.arch, ICON.photo],
      fx: [{ kind: "bokeh", n: 26, colors: ["244,239,230", "244,239,230", "201,169,110"] }],
    },
    aniversario: {
      name: "Aniversário", sub: "Confete colorido, noite em festa",
      vars: { bg: "radial-gradient(ellipse at 50% 40%,#2c1650 0%,#120a24 75%)", text: "#FFF6EC", accent: "#FFCF5A", line: "rgba(255,246,236,.09)", btn: "rgba(18,10,36,.55)" },
      font: "500 .82em var(--sans)", dark: false, blades: ["#2a1846", "#36205a"],
      icons: [ICON.balloon, ICON.gift, ICON.cake, ICON.hat],
      fx: [{ kind: "confetti", n: 70, colors: ["255,93,143", "255,207,90", "90,209,255", "138,255,193", "195,139,255"] },
           { kind: "bokeh", n: 10, colors: ["255,207,90", "195,139,255"] }],
    },
    quinze: {
      name: "15 Anos", sub: "Rosé e dourado, brilhos",
      vars: { bg: "radial-gradient(ellipse at 50% 42%,#3f1430 0%,#16060f 75%)", text: "#FFF0F5", accent: "#E8B4A0", line: "rgba(255,214,228,.09)", btn: "rgba(22,6,15,.55)" },
      font: "italic 500 1em var(--serif)", dark: false, blades: ["#3a1529", "#4a1d35"],
      icons: [ICON.crown, ICON.butterfly, ICON.star, ICON.butterfly],
      fx: [{ kind: "sparkle", n: 55, colors: ["255,240,245", "232,180,160", "255,182,206"] },
           { kind: "bokeh", n: 14, colors: ["255,182,206", "232,180,160"] }],
    },
    casamento: {
      name: "Casamento", sub: "Marfim, dourado e pétalas",
      vars: { bg: "radial-gradient(ellipse at 50% 40%,#fbf7f0 0%,#ece2d2 85%)", text: "#3A332B", accent: "#A9844F", line: "rgba(120,96,60,.13)", btn: "rgba(255,252,246,.6)" },
      font: "italic 400 1em var(--serif)", dark: true, blades: ["#e9dfcd", "#ddd0b9"],
      icons: [ICON.rings, ICON.heart, ICON.leaf, ICON.leaf],
      fx: [{ kind: "petal", n: 34, colors: ["240,200,205", "250,236,232", "222,190,160"] },
           { kind: "bokeh", n: 12, colors: ["201,169,110", "255,255,255"] }],
    },
    confraternizacao: {
      name: "Confraternização", sub: "Luzes quentes, brinde",
      vars: { bg: "radial-gradient(ellipse at 50% 40%,#123228 0%,#06120e 75%)", text: "#FDF6E3", accent: "#E8B04A", line: "rgba(253,246,227,.08)", btn: "rgba(6,18,14,.55)" },
      font: "italic 500 1em var(--serif)", dark: false, blades: ["#12281f", "#1b3529"],
      icons: [ICON.glasses, ICON.star, ICON.ornament, ICON.gift],
      fx: [{ kind: "lights", n: 40, colors: ["255,214,120", "255,184,90", "255,240,200"] }],
    },
    corporativo: {
      name: "Corporativo", sub: "Azul, linhas e rede",
      vars: { bg: "linear-gradient(160deg,#0f1d30 0%,#08111c 70%)", text: "#EEF3F8", accent: "#4FB3D9", line: "rgba(160,200,230,.08)", btn: "rgba(8,17,28,.6)" },
      font: "300 .9em var(--sans)", dark: false, blades: ["#12233a", "#1a2f4b"],
      icons: [ICON.hexagon, ICON.chart, ICON.hexagon, ICON.photo],
      fx: [{ kind: "network", n: 46, colors: ["79,179,217"] }],
    },
    infantil: {
      name: "Festa Infantil", sub: "Céu, balões e estrelas",
      vars: { bg: "linear-gradient(180deg,#bfe6ff 0%,#e8f6ff 55%,#fff1c2 100%)", text: "#25306B", accent: "#FF6B6B", line: "rgba(37,48,107,.12)", btn: "rgba(255,255,255,.6)" },
      font: "500 .85em var(--sans)", dark: true, blades: ["#ffd6d6", "#ffe9a8"],
      icons: [ICON.cloud, ICON.star, ICON.rainbow, ICON.cloud],
      fx: [{ kind: "balloon", n: 14, colors: ["255,107,107", "255,196,61", "77,171,247", "105,219,124", "190,140,255"] },
           { kind: "sparkle", n: 26, colors: ["255,196,61", "255,255,255"] }],
    },
  };
})();

/** Efeitos de fundo que o tema pode usar (nome na tela e quantidade padrão). */
const FX_KINDS = {
  bokeh: ["Luzes desfocadas", 26], lights: ["Luzes piscando", 40], confetti: ["Confete", 70], glitter: ["Purpurina", 80],
  sparkle: ["Brilhos", 55], petal: ["Pétalas", 34], leaves: ["Folhas caindo", 26], snow: ["Neve", 90],
  bubbles: ["Bolhas de sabão", 22], hearts: ["Corações", 22], balloon: ["Balões", 14], notes: ["Notas musicais", 18],
  shooting: ["Céu estrelado", 110], fireworks: ["Fogos de artifício", 2], aurora: ["Aurora (manchas de cor)", 6], network: ["Rede de pontos", 46],
};

/** Fundo animado de um tema num canvas: cada efeito anda pelo tempo (dt em segundos), não pelo nº de quadros. */
function themeParticles(theme) {
  const R = Math.random, list = [], bursts = [], meteors = [];
  const FALL = { confetti: [.03, .03], petal: [.02, .02], snow: [.02, .035], glitter: [.012, .02], leaves: [.02, .025] };
  const RISE = { balloon: [.018, .015], bubbles: [.015, .022], hearts: [.012, .02], notes: [.012, .016] };
  const SIZE = {
    bokeh: [30, 90], lights: [8, 26], balloon: [22, 22], snow: [1.5, 3.5], bubbles: [10, 26], hearts: [6, 10], glitter: [1.4, 2.4],
    leaves: [6, 7], notes: [12, 10], shooting: [.6, 1.6], aurora: [0, 0],
  };
  let fireworks = null;
  for (const fx of theme.fx) {
    if (fx.kind === "fireworks") { fireworks = { every: 2.2 / Math.max(1, fx.n), next: .4, colors: fx.colors }; continue; }
    for (let i = 0; i < fx.n; i++) {
      const [s0, s1] = SIZE[fx.kind] ?? [4, 8], fall = FALL[fx.kind], rise = RISE[fx.kind];
      list.push({
        kind: fx.kind, c: fx.colors[i % fx.colors.length], x: R(), y: R(), ph: R() * Math.PI * 2,
        r: fx.kind === "aurora" ? .28 + R() * .3 : s0 + R() * s1,
        vx: fx.kind === "aurora" ? (R() - .5) * .012 : fx.kind === "shooting" ? 0 : (R() - .5) * .02,
        vy: fall ? fall[0] + R() * fall[1] : rise ? -(rise[0] + R() * rise[1]) : fx.kind === "shooting" ? 0 : (R() - .5) * .016,
        a: .025 + R() * .06, rot: R() * 6.28, vr: (R() - .5) * 1.4,
      });
    }
  }
  const wrap = v => ((v + .08) % 1.16 + 1.16) % 1.16 - .08;
  const heart = (g, x, y, r) => {
    g.beginPath(); g.moveTo(x, y + r * .9);
    g.bezierCurveTo(x - r * 1.6, y - r * .1, x - r * .7, y - r * 1.3, x, y - r * .45);
    g.bezierCurveTo(x + r * .7, y - r * 1.3, x + r * 1.6, y - r * .1, x, y + r * .9); g.fill();
  };
  return function draw(g, W, H, dt, s) {
    g.clearRect(0, 0, W, H);
    const net = [], m = Math.min(W, H);
    for (const p of list) {
      p.x = wrap(p.x + p.vx * dt);
      p.y = wrap(p.y + p.vy * dt);
      p.rot += p.vr * dt;
      const sway = Math.sin(s * .6 + p.ph);
      const swaying = ["petal", "balloon", "snow", "leaves", "bubbles", "hearts", "notes"].includes(p.kind);
      const x = (p.x + (swaying ? sway * .02 : Math.sin(s * .25 + p.ph) * .012)) * W;
      const y = (p.y + Math.cos(s * .2 + p.ph) * .01) * H;
      switch (p.kind) {
        case "bokeh": case "lights": {
          const tw = p.kind === "lights" ? .45 + .55 * Math.abs(Math.sin(s * 1.1 + p.ph)) : .7 + .3 * Math.sin(s * .5 + p.ph);
          const a = (p.kind === "lights" ? .35 : p.a) * tw, grad = g.createRadialGradient(x, y, 0, x, y, p.r);
          grad.addColorStop(0, `rgba(${p.c},${a})`); grad.addColorStop(.6, `rgba(${p.c},${a * .5})`); grad.addColorStop(1, `rgba(${p.c},0)`);
          g.fillStyle = grad; g.beginPath(); g.arc(x, y, p.r, 0, 6.29); g.fill();
          break;
        }
        case "aurora": { // manchas grandes de cor que passeiam devagar
          const r = p.r * m * 1.4, a = .12 + .06 * Math.sin(s * .3 + p.ph), grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, `rgba(${p.c},${a})`); grad.addColorStop(1, `rgba(${p.c},0)`);
          g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
          break;
        }
        case "confetti":
          g.save(); g.translate(x, y); g.rotate(p.rot); g.scale(1, Math.cos(s * 2 + p.ph)); // vira no ar
          g.fillStyle = `rgba(${p.c},.75)`; g.fillRect(-p.r, -p.r / 2.4, p.r * 2, p.r / 1.2); g.restore();
          break;
        case "glitter": { // purpurina: losangos pequenos que brilham ao virar
          const a = .35 + .65 * Math.abs(Math.sin(s * 3 + p.ph));
          g.save(); g.translate(x, y); g.rotate(p.rot); g.scale(1, Math.abs(Math.cos(s * 2.5 + p.ph)) + .2);
          g.fillStyle = `rgba(${p.c},${a})`; g.beginPath(); g.moveTo(0, -p.r * 1.6); g.lineTo(p.r, 0); g.lineTo(0, p.r * 1.6); g.lineTo(-p.r, 0); g.fill(); g.restore();
          break;
        }
        case "petal":
          g.save(); g.translate(x, y); g.rotate(p.rot); g.fillStyle = `rgba(${p.c},.8)`;
          g.beginPath(); g.ellipse(0, 0, p.r * 1.3, p.r * .7, 0, 0, 6.29); g.fill(); g.restore();
          break;
        case "leaves":
          g.save(); g.translate(x, y); g.rotate(p.rot); g.fillStyle = `rgba(${p.c},.7)`;
          g.beginPath(); g.moveTo(-p.r * 1.4, 0); g.quadraticCurveTo(0, -p.r, p.r * 1.4, 0); g.quadraticCurveTo(0, p.r, -p.r * 1.4, 0); g.fill();
          g.strokeStyle = `rgba(${p.c},.9)`; g.lineWidth = .8; g.beginPath(); g.moveTo(-p.r * 1.4, 0); g.lineTo(p.r * 1.6, 0); g.stroke(); g.restore();
          break;
        case "snow":
          g.fillStyle = `rgba(${p.c},${.55 + .3 * Math.sin(s + p.ph)})`; g.beginPath(); g.arc(x, y, p.r, 0, 6.29); g.fill();
          break;
        case "bubbles": { // bolha: aro fino colorido com brilho
          g.strokeStyle = `rgba(${p.c},.45)`; g.lineWidth = 1.3; g.beginPath(); g.arc(x, y, p.r, 0, 6.29); g.stroke();
          const grad = g.createRadialGradient(x - p.r * .35, y - p.r * .35, 0, x, y, p.r);
          grad.addColorStop(0, "rgba(255,255,255,.35)"); grad.addColorStop(.5, `rgba(${p.c},.06)`); grad.addColorStop(1, `rgba(${p.c},.14)`);
          g.fillStyle = grad; g.fill();
          break;
        }
        case "hearts":
          g.save(); g.translate(x, y); g.rotate(Math.sin(s * .8 + p.ph) * .3); g.fillStyle = `rgba(${p.c},.6)`; heart(g, 0, 0, p.r); g.restore();
          break;
        case "notes":
          g.save(); g.translate(x, y); g.rotate(Math.sin(s * .7 + p.ph) * .25);
          g.fillStyle = `rgba(${p.c},.55)`; g.font = `${p.r * 2}px serif`; g.textAlign = "center"; g.fillText(p.ph > 3.14 ? "♪" : "♫", 0, 0); g.restore();
          break;
        case "sparkle": {
          const a = Math.max(0, Math.sin(s * 1.3 + p.ph)) * .85, k = p.r * (.6 + .4 * a);
          g.fillStyle = `rgba(${p.c},${a})`;
          g.beginPath(); // estrela de 4 pontas
          g.moveTo(x, y - k * 1.6); g.quadraticCurveTo(x, y, x + k * 1.6, y); g.quadraticCurveTo(x, y, x, y + k * 1.6); g.quadraticCurveTo(x, y, x - k * 1.6, y); g.quadraticCurveTo(x, y, x, y - k * 1.6);
          g.fill();
          break;
        }
        case "shooting": // céu: estrelas piscando (as cadentes vêm abaixo)
          g.fillStyle = `rgba(${p.c},${.25 + .6 * Math.abs(Math.sin(s * .9 + p.ph))})`; g.beginPath(); g.arc(p.x * W, p.y * H, p.r, 0, 6.29); g.fill();
          break;
        case "balloon":
          g.strokeStyle = `rgba(${p.c},.5)`; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x, y + p.r * 1.2); g.quadraticCurveTo(x + sway * 8, y + p.r * 2, x, y + p.r * 3); g.stroke();
          g.fillStyle = `rgba(${p.c},.55)`;
          g.beginPath(); g.ellipse(x, y, p.r * .85, p.r * 1.05, 0, 0, 6.29); g.fill();
          g.fillStyle = "rgba(255,255,255,.35)";
          g.beginPath(); g.ellipse(x - p.r * .3, y - p.r * .4, p.r * .18, p.r * .28, -.5, 0, 6.29); g.fill();
          break;
        case "network": net.push([x, y, p.c]); break;
      }
    }
    // estrelas cadentes: de vez em quando uma risca o céu
    if (list.some(p => p.kind === "shooting")) {
      if (R() < dt * .35) meteors.push({ x: R() * .8 + .1, y: R() * .35, t: 0, c: list[0].c });
      for (const mt of meteors) {
        mt.t += dt;
        const k = mt.t / 1.1, x = (mt.x + k * .25) * W, y = (mt.y + k * .18) * H, grad = g.createLinearGradient(x, y, x - .08 * W, y - .06 * H);
        grad.addColorStop(0, `rgba(${mt.c},${.8 * (1 - k)})`); grad.addColorStop(1, `rgba(${mt.c},0)`);
        g.strokeStyle = grad; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - .08 * W, y - .06 * H); g.stroke();
      }
      for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].t > 1.1) meteors.splice(i, 1);
    }
    // fogos de artifício: estouros que abrem, caem e somem
    if (fireworks) {
      fireworks.next -= dt;
      if (fireworks.next <= 0) {
        fireworks.next = fireworks.every * (.6 + R() * .8);
        const c = fireworks.colors[Math.floor(R() * fireworks.colors.length)], cx = .15 + R() * .7, cy = .12 + R() * .45;
        bursts.push(...Array.from({ length: 46 }, (_, i) => {
          const ang = i / 46 * 6.283 + R() * .1, v = .32 + R() * .14;
          return { x: cx, y: cy, vx: Math.cos(ang) * v * H / W, vy: Math.sin(ang) * v, t: 0, c };
        }));
      }
      for (const b of bursts) {
        b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += .07 * dt; b.vx *= 1 - dt * 1.3; b.vy *= 1 - dt * 1.1;
        const fade = Math.max(0, 1 - b.t / 1.8); // faísca com rastro
        g.strokeStyle = `rgba(${b.c},${fade})`; g.lineWidth = 2.4; g.lineCap = "round";
        g.beginPath(); g.moveTo(b.x * W, b.y * H); g.lineTo((b.x - b.vx * .12) * W, (b.y - b.vy * .12) * H); g.stroke();
        if (b.t < .25) { g.fillStyle = `rgba(255,255,255,${(.25 - b.t) * 3})`; g.beginPath(); g.arc(b.x * W, b.y * H, 2.5, 0, 6.29); g.fill(); }
      }
      for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].t > 1.8) bursts.splice(i, 1);
    }
    // rede (Corporativo): pontos que se ligam quando chegam perto
    const max = m * .18;
    for (let i = 0; i < net.length; i++) {
      const [x, y, c] = net[i];
      g.fillStyle = `rgba(${c},.55)`;
      g.beginPath(); g.arc(x, y, 2.2, 0, 6.29); g.fill();
      for (let j = i + 1; j < net.length; j++) {
        const d = Math.hypot(x - net[j][0], y - net[j][1]);
        if (d < max) {
          g.strokeStyle = `rgba(${c},${.22 * (1 - d / max)})`; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(net[j][0], net[j][1]); g.stroke();
        }
      }
    }
  };
}

/** Desenhos que podem flutuar no fundo de um tema personalizado (nome na tela). */
const ICON_NAMES = {
  camera: "Câmera", photo: "Foto", strip: "Tirinha", arch: "Espelho", balloon: "Balão", gift: "Presente", cake: "Bolo", hat: "Chapéu de festa",
  crown: "Coroa", butterfly: "Borboleta", star: "Estrela", rings: "Alianças", heart: "Coração", leaf: "Ramo", glasses: "Taças",
  ornament: "Bola de Natal", hexagon: "Hexágono", chart: "Gráfico", cloud: "Nuvem", rainbow: "Arco-íris",
};

/**
 * Tema personalizado salvo (Configurações → Sessão → Temas) → o mesmo formato dos temas fixos.
 * Cores de fundo/partículas em #RRGGBB; fontes pelo nome; até 4 desenhos; logo claro/escuro ou automático pelo fundo.
 */
function customTheme(c) {
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgb = h => hex(h).join(",");
  const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const light = h => { const [r, g, b] = hex(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55; };
  const bg = c.bgStyle === "solid" ? c.bg1
    : c.bgStyle === "linear" ? `linear-gradient(170deg,${c.bg1} 0%,${c.bg2} 100%)`
    : `radial-gradient(ellipse at 50% 42%,${c.bg1} 0%,${c.bg2} 78%)`;
  const amount = [0, .55, 1, 1.6][c.amount] ?? 1, fxColors = [rgb(c.accent), rgb(c.text), rgb(c.fxColor || c.accent)];
  const fx = [{ kind: c.fx, n: Math.max(1, Math.round((FX_KINDS[c.fx]?.[1] ?? 30) * amount)), colors: fxColors }];
  if (c.glow && c.fx !== "bokeh") fx.unshift({ kind: "bokeh", n: 10, colors: [rgb(c.accent), rgb(c.text)] });
  return {
    name: c.name, sub: "Personalizado", custom: true, id: c.id,
    vars: { bg, text: c.text, accent: c.accent, line: `rgba(${rgb(c.text)},.09)`, btn: `rgba(${rgb(c.bg1)},.55)` },
    font: `${c.italic ? "italic " : ""}${c.bold ? 600 : 400} ${c.titleFont === "Jost" || /Segoe|Arial|Verdana|Trebuchet|Calibri|Candara|Corbel|Century/.test(c.titleFont) ? ".85em" : "1em"} "${c.titleFont}",Georgia,serif`,
    dark: c.logo === "dark" || (c.logo !== "light" && light(c.bg1)),
    blades: [mix(c.bg1, c.text, .1), mix(c.bg1, c.text, .17)],
    sansFont: `"${c.textFont}","Segoe UI",sans-serif`,
    icons: (c.icons ?? []).filter(k => THEME_ICONS[k]).map(k => THEME_ICONS[k]),
    fx,
  };
}

/** Miniatura de um tema (Sessão e formulário do evento): fundo, câmera da logo e uma frase de exemplo. */
function themeCard(key, phrase = "Toque na tela e sorria!") {
  const t = THEMES[key], el = document.createElement("div");
  el.className = "tcard";
  el.dataset.theme = key;
  el.innerHTML = `<div class="tmini" style="background:${t.vars.bg};color:${t.vars.text}">
      <img data-logo="${t.dark ? "iconDark" : "icon"}" src="${brandImg(t.dark ? "iconDark" : "icon")}" alt="">
      <i style="font:${t.font};color:${t.vars.text}">${phrase}</i>
      <span style="background:${t.vars.accent}"></span>
    </div><b>${t.name}</b><small>${t.sub}</small>`;
  return el;
}
