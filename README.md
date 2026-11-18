# Pokémon Alpha Sapphire — port web em Three.js

Port de **Pokémon Alpha Sapphire** para o navegador em **Three.js + TypeScript**: mesma história, mesmo mapa, mesma dinâmica e mesmo visual do original, alimentado por um pipeline que extrai mapas, modelos, textos, scripts e tabelas da ROM. Projeto de estudo com documentação contínua para TCC.

A ROM e tudo o que deriva dela (modelos, texturas, áudio, capturas) ficam fora do Git.

## Comandos

```bash
npm install
npm run dev            # servidor de desenvolvimento (Vite)
npm test               # testes unitários (Vitest)
npm run verify         # unitários com cobertura + build + testes do pipeline Python
npm run test:e2e       # jogo real e cenários visuais em Chromium (precisa dos assets locais)
npm run visual:approve # regrava baselines visuais após mudança revisada
```

Primeira vez com Playwright: `npx playwright install chromium`.

## Documentação

- [docs/VISAO.md](docs/VISAO.md) — objetivo e definição de pronto.
- [docs/STATUS.md](docs/STATUS.md) — estado atual medido.
- [docs/ROADMAP.md](docs/ROADMAP.md) — o que vem a seguir.
- [AGENTS.md](AGENTS.md) — regras de engenharia para pessoas e agentes.
- [docs/](docs/README.md) — índice completo.
