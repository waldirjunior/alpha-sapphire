# PRD-001 — Estado Imutável, Movimentação em Grid e Warps

- **Módulo:** [core-jogo](../README.md)
- **Estado:** Ativo (base implementada; expansão planejada na Fase 2 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-16
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-separacao-core-engine.md)

## 1. Problema

O jogo precisa gerenciar posição do jogador, direção, colisões de mapa, transições por `warp` e flags de história de forma determinística, testável em Node e reutilizável em servidor multiplayer futuro.

## 2. Requisitos Funcionais

- **RF-01:** `createInitialState(startMapId)` gera estado inicial válido e imutável.
- **RF-02:** `isWalkable(map, pos)` valida limites do mapa e matriz `collisions`.
- **RF-03:** `movePlayer(state, direction, maps)` retorna novo `GameState` atualizando `facing`, `pos` e executando `warp` quando aplicável, sem mutar o estado anterior.
- **RF-04 (Fase 2):** Suporte a interações com NPCs/placas e atualização de `storyFlags`.

## 3. Critérios de Aceite

- [x] `createInitialState`, `isWalkable` e `movePlayer` implementados e testados em Vitest.
- [ ] Interação e flags de história cobertas por testes unitários na Fase 2.
