# Módulo: Core do Jogo (`core-jogo`)

Lógica pura e determinística do jogo em `src/core/` (`types.ts`, `gameState.ts`, `gameState.test.ts`), sem qualquer dependência de Three.js, DOM ou APIs de navegador.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de regras de jogo, movimentação, colisões, warps e batalha.
- [adrs/](adrs/README.md) — decisões arquiteturais do núcleo puro.
- [ADR-002](adrs/ADR-002-runner-puro-de-chamadas-normalizadas.md) — runner determinístico de movimento/texto/warp por chamadas normalizadas, sem fingir executar a ABI AMX.
- [ADR-003](adrs/ADR-003-vm-pawn-e-efeitos-do-host.md) e [PRD-003](prds/PRD-003-execucao-amx-da-abertura.md) — VM Pawn real com estado puro e pedidos tipados ao host; não implica paridade gráfica/ABI ACMD.
- [ADR-004](adrs/ADR-004-host-conservador-de-eventos.md) — host gráfico conservador inicial; não é paridade da abertura.
- [ADR-005](adrs/ADR-005-abi-cro-e-init-nao-bloqueante.md) e [PRD-004](prds/PRD-004-abi-e-recursos-locais-de-eventos.md) — ABI evidenciada no CRO, mensagens/warp, recursos privados locais e init opaco sem bloquear navegação nem sobrescrever chegada. Inclui comandos de geração e limites do smoke sintético de warp.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- Implementado em [src/core/gameState.ts](../../../src/core/gameState.ts): `createInitialState`, `isWalkable` e `movePlayer` (colisão e `warp`).
- Coberto por `2` testes unitários em [src/core/gameState.test.ts](../../../src/core/gameState.test.ts).
