# Módulo: Engine 3D (`engine-3d`)

Camada de renderização WebGL com Three.js em `src/engine/` (`SceneManager.ts`), responsável por câmera, iluminação, carregamento de `.glb` e representação visual do `GameState`.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de renderização, carregamento de `.glb` e integração com `src/data/`.
- [adrs/](adrs/README.md) — decisões técnicas da camada Three.js.
- [PRD-005](prds/PRD-005-mapas-de-zona-no-runtime.md) / [ADR-003](adrs/ADR-003-zonas-lazy-e-assets-compostos.md) — bootstrap zone_0006, JSONs lazy, GRs compostos, NPCs mm_NNNN e warps retangulares; fallback explícito `?maps=legacy`.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- [SceneManager.ts](../../../src/engine/SceneManager.ts) consome GameState/MapDefinition sem mutar o core, com modelos de mapa/personagens e animações idle/walk. [zoneTerrain.ts](../../../src/engine/zoneTerrain.ts) compõe GRs de maps_v2; NPCs usam mm_NNNN ou npc.glb. O grid geométrico permanece como fallback quando faltam assets locais. Bootstrap e seleção legacy ficam no repositório de mapas, não inline no engine.
