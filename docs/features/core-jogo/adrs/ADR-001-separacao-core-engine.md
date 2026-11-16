# ADR-001 — Separação estrita entre `src/core/` e `src/engine/`

- **Módulo:** [core-jogo](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-16
- **Contexto:** [docs/tcc/00-arquitetura.md](../../../tcc/00-arquitetura.md)

## Contexto

O projeto precisa renderizar cenas 3D no navegador com Three.js, mas também exige testes unitários rápidos em Vitest (sem WebGL) e futuro suporte a multiplayer autoritativo em servidor Node.

## Decisão

1. **`src/core/`** contém exclusivamente regras puras de domínio (estado do jogo, movimentação em grid, colisões, warps, batalha e flags) usando TypeScript puro e funções imutáveis. É proibido importar `three`, `window` ou `document`.
2. **`src/engine/`** contém apenas adaptação visual em Three.js (`SceneManager`), lendo o `GameState` e sincronizando câmera, luzes e malhas.

## Consequências

- **Positivas:** Testes unitários rodam em milissegundos no Node (`vitest run`), sem mocks pesados de WebGL; o mesmo `core/` pode rodar no servidor para multiplayer.
- **Negativas / Custos:** Toda nova mecânica exige definir contratos explícitos em `src/core/types.ts` antes de refletir no `SceneManager`.
