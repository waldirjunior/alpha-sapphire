# PRD-002 — Mecânicas Completas de Batalha Gen VI

- **Módulo:** [batalha](../README.md)
- **Estado:** Em andamento (Fase 3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-010`

## 1. Problema

`src/core/` já executa PP, precisão, críticos, status principais, times de até
seis Pokémon e progressão. Esta frente completa a paridade Gen VI para campo,
captura, habilidades e efeitos de golpe. P-010 continua aberta para condições
voláteis, hazards, troca forçada, itens e habilidades ainda não simulados.

## 2. Requisitos Funcionais

- **RF-01:** `BattleMove` com `currentPp` / `maxPp` e checagem de `accuracy` usando `rng` injetável.
- **RF-02:** `MajorStatus` (`paralysis`, `sleep`, `freeze`, `burn`, `poison` e `toxic`) afeta velocidade, dano residual e chance de agir.
- **RF-03:** Times de múltiplos Pokémon para treinadores (envio automático do próximo Pokémon saudável ao desmaiar) e troca forçada quando o Pokémon ativo do jogador desmaia e há outro saudável na `party`.
- **RF-04:** Tabela completa de 18 tipos da Geração VI e evoluções básicas dos iniciais/Route 101.
- **RF-05:** Prioridade da ROM, clima, telas e habilidades de entrada/dano usam
  o estado puro da batalha e o RNG injetável.
- **RF-06:** Captura usa catch rate da espécie, HP, status e os quatro shake
  checks da Geração VI.

## 3. Critérios de Aceite

- [x] Testes determinísticos cobrem PP, precisão, status, crítico, times e mecânicas de campo em `src/core/`.
- [x] Vetores de dano, captura e prioridade em `src/ai/battleParity.test.ts`.
- [x] `npm run verify` passa; cobertura de `src/core/` fica em 96,20% de linhas e 87,08% de branches.
- [ ] Implementar os itens restantes listados em `P-010`; a pendência continua aberta.

## 4. Entrega parcial — 2026-11-19

O core agora aplica os brackets de prioridade da ROM, golpes OHKO com ajuste de
accuracy por nível, Sturdy, Levitate, Intimidate e Blaze/Torrent/Overgrow.
Sunny Day, Rain Dance, Sandstorm e Hail alteram dano e duram cinco turnos;
Sandstorm aumenta Sp. Def de tipos Rock e clima causa dano residual quando
aplicável. Reflect e Light Screen reduzem dano e golpes críticos ignoram as
telas. Captura usa catch rate da espécie, HP, status e quatro shake checks Gen VI.

`npm run verify`: 508 testes Vitest passaram, build passou e 233 testes Python
passaram (1 skip por ausência de `public/assets/maps`). A implementação ainda
não cobre hazards, confusão e outros status voláteis, Protect/Substitute,
forçar troca, críticos de captura, itens segurados em combate nem as demais
habilidades e condições de evolução registradas em `P-010`.
