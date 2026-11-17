# PRD-003 — Fidelidade Visual de Mapas, Shaders PICA200 e Interiores

- **Módulo:** [engine-3d](../README.md)
- **Estado:** Planejado (Fase 2 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-007`, `P-009`

## 1. Problema

Na conversão genérica `BCH → DAE → GLB`, materiais multi-textura PICA200 (`Texture1`/`Texture2`, *vertex color blending*, máscaras de transparência e água) perdem informações visuais — deixando placas/telhados brancos e sombras de flores como faixas escuras — e as portas de casas/Centros Pokémon ainda não levam a mapas internos.

## 2. Requisitos Funcionais

- **RF-01:** Extrair e mapear todas as camadas de textura de `a/0/1/4` (`AD`) e *vertex colors* sem perder transparência suave (`alphaMap` / `ShaderMaterial` ou `MeshStandardMaterial` customizado).
- **RF-02:** Renderizar água animada, sombras suaves e vegetação/árvores completas (incluindo seções adicionais e `propsUrl`).
- **RF-03:** Extrair e conectar mapas internos (`player_house_1f`, `player_house_2f`, `birch_lab`, `oldale_pokecenter`, `oldale_pokemart`, `petalburg_gym`) a partir de `a/0/3/9` e `a/0/4/0` (`MM`).

## 3. Critérios de Aceite

- [ ] Zero placas/telhados brancos não intencionais ou faixas pretas de sombra nos mapas iniciais.
- [ ] Portas de Littleroot Town e Oldale Town executam `warp` para seus respectivos interiores 3D e retornam para a porta correta.
- [ ] `npm test && npm run build` passando.
