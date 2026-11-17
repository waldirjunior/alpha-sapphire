# PRD-002 — Animações Esqueléticas (`idle` e `walk`) sem T-Pose

- **Módulo:** [engine-3d](../README.md)
- **Estado:** Planejado (Fase 2 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **ADRs relacionados:** [ADR-002](../adrs/ADR-002-exportacao-rig-animacoes-bch-para-glb.md)
- **Pendências relacionadas:** `P-006`

## 1. Problema

Os personagens (`brendan.glb`, `may.glb`, `npc.glb`) e Pokémon convertidos via `DAE → assimp 5.2 → GLB` perdem a hierarquia de ossos e clipes de animação, renderizando em **T-pose estática**.

## 2. Requisitos Funcionais

- **RF-01:** Exportar esqueleto (`skin` / `joints`) e clipes de animação (`idle`, `walk`, `run`) diretamente do `BCH` / `a/0/2/1` e `a/0/0/8` para `.glb` válido com `animations[]`.
- **RF-02:** Integrar `THREE.AnimationMixer` no `SceneManager` para reproduzir `idle` parado e `walk` durante deslocamento suave (interpolação entre tiles).
- **RF-03:** Eliminar o movimento instantâneo (teleporte de tile) com interpolação visual suave entre `prevPos` e `pos`.

## 3. Critérios de Aceite

- [ ] `brendan.glb`, `may.glb` e `npc.glb` contêm `animations.length > 0` e não renderizam mais em T-pose.
- [ ] Inspeção visual no browser confirma ciclo `idle` e `walk` ao pressionar `WASD`/setas.
- [ ] `npm test && npm run build` passando sem erros.
