# ADR-001 — Reuso direto de `movePlayer` em salas autoritativas

- **Módulo:** [multiplayer-salas](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-17

## Contexto

Em jogos multiplayer baseados em grid, duplicar regras de colisão e warp entre cliente e servidor gera dessincronização e bugs difíceis de rastrear.

## Decisão

`src/core/room.ts` delega todas as transições de movimento de cada jogador diretamente para `movePlayer` de `src/core/gameState.ts`, mantendo um dicionário imutável `players: Record<string, RoomPlayer>` por `roomId`.

## Consequências

- **Positivas:** Garantia de paridade 100% entre modo solo e servidor multiplayer com zero duplicação de lógica.
- **Negativas / Custos:** Futuro servidor WebSocket precisará apenas serializar `RoomState` (ou deltas de `RoomPlayer`).
