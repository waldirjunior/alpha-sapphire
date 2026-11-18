# PRD-003 — Fidelidade Visual de Mapas, Shaders PICA200 e Interiores

- **Módulo:** [engine-3d](../README.md)
- **Estado:** Em andamento (Fase 2 do [ROADMAP.md](../../../ROADMAP.md))
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
- [x] `npm test && npm run build` passando.

## 4. Entrega parcial verificada — P-007, 2026-11-18

[Evidência e reprodução](../../pipeline-rom/pica-materials.md), A-069/A-070:
322 GLBs/4.328 materiais auditados; 315 URLs novas imutáveis, com V
restaurado seletivamente em 206 GRs/3.625 materiais e 3.971 perfis alpha
estáticos. Alpha test e blend coexistem; fatores RGB/alpha e depthWrite
suportados vêm do BCH. UVs de atores, geometria, skin e clipes não mudam.

Doze capturas A/B visíveis GR0004/0005/0006 foram inspecionadas, com câmera
fixa e zero erros/warnings. 328 Vitest/49 arquivos, build e 168 Python sem
skips passaram. O cenário usa arquivos publicados e o configurador real;
não valida caminhada natural ou equivalência no emulador.

RF-01/RF-02 permanecem parciais: iluminação fragmentária, RGB, LUTs/toon,
projeção e múltiplas texturas não recebem implementação especulativa.
Interiores e o aceite visual integral continuam abertos em P-007/P-009.

### Continuação A-074/A-075

Auditoria ampliada aos336 GLBs staged:4.547 materiais/329 URLs imutáveis,
216 GRs/3.817 materiais com V restaurado e4.158 perfis alpha. Os três diffs
COLOR_0 foram resolvidos com fonte BCH/DAE, posição/UV e contexto único de
triângulo nas costuras:38 vértices em MM0180/MM0181/MM0319, sem mudar alpha,
índices, geometria, skin ou clipes. Sete regressões sintéticas; seis close-ups
A/B inspecionados com pose/câmera idênticas.

A caminhada por teclado em Littleroot repete32 passos por fase com save
inicial derivado pós-intro. Oito capturas inspecionadas comparam antes de
P-007 com aliases atuais, comprovando a melhora de V/alpha acumulada, não
nova iluminação nem progresso natural. Zero erros de página/console/rede/HTTP;
três avisos P-013 BuildMdlEventAnimeSetEnd por fase. Telhado ainda oculta o
avatar em(14,16). 333 Vitest/build/175 Python sem skips passaram.

Os336 BCHs de modelo não fornecem luzes/cenas/shaders externos referidos por
LightSet0/DefaultShader. A investigação CRO delimita callback0x2ee38 de
PseudoLightingListener e métodos EffectCycleLight, mas não recupera os
valores/binding do ambiente. RF-01/RF-02 continuam parciais: nenhum shader,
exposição, LUT/toon, lightmap ou multi-textura foi inferido por aparência.
