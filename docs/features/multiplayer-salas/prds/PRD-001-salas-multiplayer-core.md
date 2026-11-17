# PRD-001 — Estado de Salas Multiplayer em `src/core/room.ts`

- **Módulo:** [multiplayer-salas](../README.md)
- **Estado:** Em andamento (Fase 4 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-estado-autoritativo-em-core.md)

## 1. Problema

A arquitetura do projeto exige que o mesmo `src/core/` rode em servidor Node para salas multiplayer sem duplicar lógica de colisão, warps e posicionamento.

## 2. Requisitos Funcionais

- **RF-01:** `createRoom(roomId, mapId?)` cria uma sala vazia imutável.
- **RF-02:** `joinRoom(room, playerId, displayName, maps)` adiciona jogador na posição inicial (`spawnPos` do mapa) sem mutar `room`.
- **RF-03:** `leaveRoom(room, playerId)` remove o jogador da sala.
- **RF-04:** `applyRoomMove(room, playerId, direction, maps)` valida colisão e warps usando `movePlayer` e atualiza apenas o jogador alvo.

## 3. Critérios de Aceite

- [x] `src/core/room.ts` 100% puro sem `three` ou DOM.
- [x] Testes unitários em `src/core/room.test.ts` cobrindo entrada, saída, colisão, warp e isolamento entre jogadores.
- [x] `npm test && npm run build` passando sem erros.
