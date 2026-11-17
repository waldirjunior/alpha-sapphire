# ADR-002 — Exportação de Rig e Animações `BCH` para `.glb` sem achatamento do `assimp`

- **Módulo:** [engine-3d](../README.md)
- **Status:** Proposto (Fase 2)
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-006`

## Contexto

O `assimp` 5.2 via CLI achata os nós da hierarquia Collada e descarta os ossos/animações ao exportar `.dae → .glb`, resultando em personagens em T-pose (`animations: 0`).

## Decisão

Substituir a etapa `assimp` para personagens e Pokémon animados por uma exportação direta **glTF 2.0 (`.glb`)** a partir do `SPICA` (`H3DModel` + `H3DMesh` + `H3DSkeleton` + `H3DAnimation`), ou usar `Blender` headless (`blender --background --python`) para preservar `Armature` e `AnimationAction`s (`idle`, `walk`).

## Consequências

- **Positivas:** Preserva `SkinnedMesh`, `Skeleton` e `AnimationClip` nativos para `THREE.AnimationMixer` sem perda de pesos de vértice.
- **Negativas / Custos:** Exige implementar escritor glTF 2.0 no `SpicaExport` ou instalar `Blender` headless na VPS.
