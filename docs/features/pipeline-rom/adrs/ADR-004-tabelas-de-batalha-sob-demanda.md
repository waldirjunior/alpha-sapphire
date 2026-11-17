# ADR-004 — Tabelas de batalha carregadas sob demanda com loader injetado

- **Status:** Aceito
- **Data:** 2026-11-17
- **Contexto:** `P-015`. Importar `src/data/battle/*.json` estaticamente em `src/core/` levou o bundle único a `1.87 MB` (`305 kB` gzip). Mover os JSONs para `public/assets/data` não é viável: `public/assets/` é ignorado pelo Git (assets derivados da ROM), e as tabelas de batalha são dados versionados (`A-010`).

## Decisão

- Os JSONs continuam em `src/data/battle/` (versionados). `src/data/battle/loader.ts` expõe `bundledBattleTableLoader` com um `import()` por tabela, que o Vite transforma em chunks separados.
- `src/core/battleTables.ts` define os tipos `Raw*`, `loadBattleTables(loader)` (carga única, promessa compartilhada), `registerBattleTables` e `fromTables(build)` (índices derivados memorizados por identidade das tabelas). O core não importa JSON nem `fetch`; continua puro e rodável em Node.
- `src/main.ts` virou um bootstrap: carrega as tabelas e só então faz `import('./game')` (antigo `main.ts`). Vitest registra as mesmas tabelas em `src/core/testing/setupBattleTables.ts` (`vitest.config.ts`).
- `data/pokemon/species.ts` usa getters em `SPECIES`/`MOVES` para não resolver espécies no import.

## Consequências

- Bundle inicial: `3.2 kB` (`index-*.js`); jogo `741 kB` (`game-*.js`, igual ao pré-migração) e tabelas em chunks (`species` 521 kB, `learnsets` 336 kB, `moves` 223 kB, `evolutions` 51 kB, demais < 2 kB), baixados em paralelo.
- Acesso a `dex`/`learnsets`/`evolution`/`natures`/`typeChart` antes de `loadBattleTables` lança erro explícito.
- Um servidor multiplayer pode injetar outro loader (ex.: `fs.readFile`) sem mudar o core.
