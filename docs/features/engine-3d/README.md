# Módulo: Engine 3D (`engine-3d`)

Camada de renderização WebGL com Three.js em `src/engine/` (`SceneManager.ts`), responsável por câmera, iluminação, carregamento de `.glb` e representação visual do `GameState`.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de renderização, carregamento de `.glb` e integração com `src/data/`.
- [adrs/](adrs/README.md) — decisões técnicas da camada Three.js.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- [src/engine/SceneManager.ts](../../../src/engine/SceneManager.ts) renderiza mapa placeholder (`PlaneGeometry`, `GridHelper`, `BoxGeometry`) e protagonista placeholder (`CapsuleGeometry`) a partir de `MAPS` inline em [src/main.ts](../../../src/main.ts) (`P-004`).
