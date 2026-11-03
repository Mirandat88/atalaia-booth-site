// Service worker do painel: as telas pedem arquivos/<caminho na nuvem> (imagens dos layouts, logos e fontes da marca)
// e este arquivo busca na nuvem com o login de quem está no painel. O mapa caminho → hash vem da página (nuvem.js);
// fica guardado no cache para quando o navegador desligar e religar este service worker.
const STORE = "atalaia-painel";
let cfg = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("message", e => {
  cfg = e.data;
  e.waitUntil(caches.open(STORE).then(c => c.put("/__config", new Response(JSON.stringify(cfg)))));
});

const TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", json: "application/json" };

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const at = url.pathname.indexOf("/arquivos/");
  if (url.origin !== location.origin || at < 0) return;
  const path = decodeURIComponent(url.pathname.slice(at + "/arquivos/".length));
  e.respondWith((async () => {
    const c = await caches.open(STORE);
    cfg ??= await c.match("/__config").then(r => r?.json()).catch(() => null);
    const hash = cfg?.map?.[path];
    if (!hash || !cfg.token) return new Response("", { status: 404 });
    const key = "/__arquivo/" + hash; // o conteúdo não muda com o mesmo hash: pode ficar guardado
    let r = await c.match(key);
    if (!r) {
      const got = await fetch(`${cfg.supa}/storage/v1/object/authenticated/arquivos/${cfg.empresa}/${hash}`, { headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.token } });
      if (!got.ok) return new Response("", { status: got.status });
      r = new Response(await got.blob(), { headers: { "Content-Type": TYPES[path.split(".").pop().toLowerCase()] ?? "application/octet-stream" } });
      await c.put(key, r.clone());
    }
    return r;
  })());
});
