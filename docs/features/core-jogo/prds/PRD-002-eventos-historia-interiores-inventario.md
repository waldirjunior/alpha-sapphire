# PRD-002 — Eventos de História, Interiores, Itens e Inventário

- **Módulo:** [core-jogo](../README.md)
- **Estado:** Em andamento (Fase 2–3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-009`, `P-013`

## 1. Problema

Atualmente o jogador começa direto na praça de Littleroot Town sem a sequência inicial da história (caminhão de mudança, quarto, escolha do inicial salvando o Prof. Birch na Route 101, rival na Route 103), sem interiores de casas/ginásios e sem mochila/itens (`Potion`, `Poké Ball`).

## 2. Requisitos Funcionais

- **RF-01 (Eventos e História):** Suporte em `src/core/` a gatilhos por tile/flag (`storyEvents[]`), diálogos multi-página com escolhas (`sim`/`não`, seleção de inicial) e bloqueio condicional de rotas antes de completar marcos da história.
- **RF-02 (Inventário / Bag):** Estrutura imutável `BagState` com `pokeballs`, `potions` e `keyItems`, consumindo Poké Balls ao capturar e permitindo usar Potion fora e dentro de batalha.
- **RF-03 (Treinadores no Overworld):** Campo de visão (*line of sight*) e flag de derrota por treinador para não repetir batalha após vencer.

- **RF-04 (Runner determinístico):** Executar um contrato explícito de chamadas normalizadas de transformação de NPC/player, texto, espera e warp no core puro; rejeitar nativas não implementadas pelo nome. [ADR-002](../adrs/ADR-002-runner-puro-de-chamadas-normalizadas.md) delimita esse estágio e a futura integração com AMX.

## 3. Critérios de Aceite

- [x] Fluxo inicial com interiores (`brendan_house`, `birch_lab`, `oldale_pokecenter`), mochila (`Poké Ball`/`Potion`), flags de história e Rival May na `Route 103` controlados por `storyFlags` em `src/core/`.
- [x] Cobertura de testes unitários em Vitest para eventos, inventário (`bag.test.ts`) e linha de visão de treinadores (`findTriggeredTrainer`).
- [x] `npm test && npm run build` passando.
