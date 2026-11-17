# Módulo: Core do Jogo (`core-jogo`)

Lógica pura e determinística do jogo em `src/core/` (`types.ts`, `gameState.ts`, `gameState.test.ts`), sem qualquer dependência de Three.js, DOM ou APIs de navegador.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de regras de jogo, movimentação, colisões, warps e batalha.
- [adrs/](adrs/README.md) — decisões arquiteturais do núcleo puro.
- [ADR-002](adrs/ADR-002-runner-puro-de-chamadas-normalizadas.md) — runner determinístico de movimento/texto/warp por chamadas normalizadas, sem fingir executar a ABI AMX.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- Implementado em [src/core/gameState.ts](../../../src/core/gameState.ts): `createInitialState`, `isWalkable` e `movePlayer` (colisão e `warp`).
- Coberto por `2` testes unitários em [src/core/gameState.test.ts](../../../src/core/gameState.test.ts).
