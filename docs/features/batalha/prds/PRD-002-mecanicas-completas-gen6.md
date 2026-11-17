# PRD-002 — Mecânicas Completas de Batalha Gen VI

- **Módulo:** [batalha](../README.md)
- **Estado:** Planejado (Fase 3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-010`

## 1. Problema

`src/core/battle.ts` já executa turnos, STAB, efetividade, captura básica e XP, mas ainda faltam mecânicas centrais da Geração VI: PP por golpe, checagem de precisão (`accuracy`), acertos críticos, condições de status (`Paralysis`, `Poison`, `Burn`), times multi-Pokémon para treinadores e evolução por nível.

## 2. Requisitos Funcionais

- **RF-01:** `MoveInstance` com `currentPp` / `maxPp` e checagem de `accuracy` usando `rng` injetável.
- **RF-02:** Condições de status (`statusCondition`: `'none' | 'paralysis' | 'poison' | 'burn' | 'sleep'`) afetando velocidade, dano por turno e chance de agir.
- **RF-03:** Times de múltiplos Pokémon para treinadores (envio automático do próximo Pokémon saudável ao desmaiar) e troca forçada quando o Pokémon ativo do jogador desmaia e há outro saudável na `party`.
- **RF-04:** Tabela completa de 18 tipos da Geração VI e evoluções básicas dos iniciais/Route 101.

## 3. Critérios de Aceite

- [ ] Testes determinísticos em `src/core/battle.test.ts` cobrindo PP, erro de golpe, status, crítico e batalha 2v2 de treinador.
- [ ] Paridade de fórmulas validada em `src/ai/emulatorParity.test.ts`.
- [ ] `npm test && npm run build` passando.
