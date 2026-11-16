# PRD-001 — Encontros Selvagens na Grama Alta e Batalha por Turnos

- **Módulo:** [batalha](../README.md)
- **Estado:** Em andamento (Fase 3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-16
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-motor-batalha-puro-e-deterministico.md)

## 1. Problema

O jogador já consegue caminhar entre Littleroot Town, Route 101 e Oldale Town com grama alta real (`terrain === 2`), mas pisar na grama alta ainda não dispara encontros nem inicia batalhas.

## 2. Objetivo

Implementar o ciclo completo de encontro selvagem e batalha por turnos em `src/core/battle.ts`:
1. Sorteio determinístico de encontro ao pisar em `terrain === 2` usando a tabela real da Route 101 (Poochyena, Wurmple, Zigzagoon).
2. Estado imutável de batalha (`BattleState`) com party do jogador (iniciais de Hoenn: Treecko, Torchic, Mudkip) e Pokémon selvagem.
3. Execução de turno com ordem por velocidade, fórmula de dano Gen VI, STAB, efetividade de tipos e fuga (`run`).

## 3. Critérios de Aceite

- [x] Funções puras em `src/core/battle.ts` sem importar `three` ou DOM.
- [x] Cobertura de testes unitários em `src/core/battle.test.ts` (encontro na grama alta, dano/efetividade, vitória, derrota e fuga).
- [x] Integração com HUD de batalha em `src/main.ts` + `index.html`.
- [x] `npm test && npm run build` passando sem erros.
