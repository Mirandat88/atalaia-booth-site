# Site do Atalaia Booth

Página de vendas e painel online do Atalaia Booth. Publicado em https://visualizebooth.visualize360.com.br pela integração Git da Hostinger (ramo main).

- `index.html`: página de vendas
- `img/`: telas do app (nomes de clientes trocados por exemplos)
- `video/`: gravações do app
- `painel/app/`: o painel online — **cópia das telas do app** (Software/Booth/src/Visualize.Booth/ui) com a ponte da nuvem. Não edite aqui: rode `node montar-painel.mjs` depois de mudar as telas do app.
- `painel-fonte/`: a ponte (`nuvem.js`: faz no navegador o que o C# faz no app, gravando na mesma nuvem), o service worker (`sw.js`: imagens e fontes da nuvem), `nuvem.css` (esconde o que é do equipamento) e `modelos.json` (modelos de layout do app)
- `_antigo/`: versões anteriores guardadas (nada é apagado)
