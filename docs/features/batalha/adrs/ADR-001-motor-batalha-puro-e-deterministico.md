# ADR-001 — Motor de batalha puro com RNG injetável

- **Módulo:** [batalha](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-16

## Contexto

Batalhas Pokémon envolvem aleatoriedade (taxa de encontro, roll de dano `0.85..1.00`, acerto). Usar `Math.random()` diretamente dentro do `core/` tornaria os testes instáveis e dificultaria a comparação determinística contra o emulador (`validacao-emulador`).

## Decisão

Toda função em `src/core/battle.ts` recebe um gerador `rng: () => number` opcional (padrão `Math.random`), retornando um novo `BattleState` imutável sem mutar os argumentos.

## Consequências

- **Positivas:** Testes 100% determinísticos em Vitest e fácil reprodução de batalhas em servidor multiplayer.
- **Negativas / Custos:** Chamadores de produção precisam passar `rng` quando quiserem replay determinístico.
