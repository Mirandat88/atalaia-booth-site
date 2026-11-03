// Monta o painel online com as telas do app: copia Software\Booth\src\Visualize.Booth\ui para painel/app e põe a ponte
// da nuvem (painel-fonte/nuvem.js) antes do app.js. Rode sempre que as telas do app mudarem:  node montar-painel.mjs
import { cpSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ui = join(here, "..", "Software", "Booth", "src", "Visualize.Booth", "ui");
const app = join(here, "painel", "app");
if (!existsSync(join(ui, "index.html"))) throw new Error("Não achei as telas do app em " + ui);

cpSync(ui, app, { recursive: true, force: true }); // painel/app é cópia: a fonte é a pasta ui do app (nada é apagado)
for (const f of ["nuvem.js", "nuvem.css", "sw.js", "modelos.json"]) cpSync(join(here, "painel-fonte", f), join(app, f));

const first = '<script src="app.js"></script>';
let html = readFileSync(join(app, "index.html"), "utf8");
if (!html.includes(first)) throw new Error("index.html do app mudou: confira a ordem dos scripts.");
html = html.replace("</head>", '<link rel="stylesheet" href="nuvem.css">\n<meta name="robots" content="noindex">\n</head>')
           .replace(first, '<script src="nuvem.js"></script>\n' + first);
writeFileSync(join(app, "index.html"), html);
console.log("Painel montado em", app);
