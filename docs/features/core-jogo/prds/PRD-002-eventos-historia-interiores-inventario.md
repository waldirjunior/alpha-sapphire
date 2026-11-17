# PRD-002 — Eventos de História, Interiores, Itens e Inventário

- **Módulo:** [core-jogo](../README.md)
- **Estado:** Planejado (Fase 2–3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-009`

## 1. Problema

Atualmente o jogador começa direto na praça de Littleroot Town sem a sequência inicial da história (caminhão de mudança, quarto, escolha do inicial salvando o Prof. Birch na Route 101, rival na Route 103), sem interiores de casas/ginásios e sem mochila/itens (`Potion`, `Poké Ball`).

## 2. Requisitos Funcionais

- **RF-01 (Eventos e História):** Suporte em `src/core/` a gatilhos por tile/flag (`storyEvents[]`), diálogos multi-página com escolhas (`sim`/`não`, seleção de inicial) e bloqueio condicional de rotas antes de completar marcos da história.
- **RF-02 (Inventário / Bag):** Estrutura imutável `BagState` com `pokeballs`, `potions` e `keyItems`, consumindo Poké Balls ao capturar e permitindo usar Potion fora e dentro de batalha.
- **RF-03 (Treinadores no Overworld):** Campo de visão (*line of sight*) e flag de derrota por treinador para não repetir batalha após vencer.

## 3. Critérios de Aceite

- [ ] Fluxo completo da história inicial (`Casa → Lab → Route 101 (Birch + Inicial) → Oldale → Route 103 (Rival) → Petalburg`) controlado por `storyFlags` em `src/core/`.
- [ ] Cobertura de testes unitários em Vitest para eventos, inventário e linha de visão de treinadores.
- [ ] `npm test && npm run build` passando.
