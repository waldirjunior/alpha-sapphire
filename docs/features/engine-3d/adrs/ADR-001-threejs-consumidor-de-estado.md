# ADR-001 — `SceneManager` como consumidor passivo de `GameState`

- **Módulo:** [engine-3d](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-16
- **Contexto:** [core-jogo/adrs/ADR-001](../../core-jogo/adrs/ADR-001-separacao-core-engine.md)

## Contexto

Em aplicações Three.js é comum misturar estado de jogo (posições, colisões, flags) dentro de `Object3D.userData` ou loops de animação, o que inviabiliza testes unitários e sincronização multiplayer.

## Decisão

`SceneManager` atua exclusivamente como **consumidor passivo** de `GameState` e `MapDefinition`:
- Recebe `state` e `maps` via `sync(state, maps)` sem mutá-los;
- Nunca decide regras de colisão, warp ou batalha.

## Consequências

- **Positivas:** Renderização desacoplada da regra de negócio; troca de placeholder por `.glb` não altera testes do `core/`.
- **Negativas / Custos:** Interpolações visuais (como caminhada suave entre tiles) ficam restritas ao estado visual interno do `SceneManager`.
