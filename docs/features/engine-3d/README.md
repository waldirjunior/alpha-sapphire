# Módulo: Engine 3D (`engine-3d`)

Camada de renderização WebGL com Three.js em `src/engine/` (`SceneManager.ts`), responsável por câmera, iluminação, carregamento de `.glb` e representação visual do `GameState`.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de renderização, carregamento de `.glb` e integração com `src/data/`.
- [adrs/](adrs/README.md) — decisões técnicas da camada Three.js.
- [PRD-005](prds/PRD-005-mapas-de-zona-no-runtime.md) / [ADR-003](adrs/ADR-003-zonas-lazy-e-assets-compostos.md) — bootstrap zone_0006, JSONs lazy, GRs compostos, NPCs mm_NNNN e warps retangulares; fallback explícito `?maps=legacy`.
- [PRD-007](prds/PRD-007-animacoes-nativas-no-runtime.md) / [ADR-005](adrs/ADR-005-eventos-batalha-e-clipes-nativos.md) — eventos puros de batalha dirigem clipes GF1 em `nativeAnimation.ts`, com catálogo local imutável, fallbacks explícitos e auditoria P-019; Playwright nativo na main ac4054d validado com capturas e estados alpha preservados. Paridade de texturas/combiners/expressões segue pendente.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- [SceneManager.ts](../../../src/engine/SceneManager.ts) consome GameState/MapDefinition sem mutar o core, com modelos de mapa/personagens e animações idle/walk. [zoneTerrain.ts](../../../src/engine/zoneTerrain.ts) compõe GRs de maps_v2; NPCs usam mm_NNNN ou npc.glb. O grid geométrico permanece como fallback quando faltam assets locais. Bootstrap e seleção legacy ficam no repositório de mapas, não inline no engine.
