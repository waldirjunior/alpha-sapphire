# Pendências

Lacunas abertas no projeto. Um item novo entra no fim com o próximo número (`P-NNN`), data, estado (`aberta`, `em andamento`, `bloqueada` ou `fechada`), evidência e próximo passo. Fechar exige registrar a evidência de resolução no próprio item. Não apague o histórico.

## P-001 `ctrtool` não instalado na VPS

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Compilado a partir de `3dsguy/Project_CTR` e instalado em `/usr/local/bin/ctrtool` (`CTRTool v1.3.0`). Validado com `which ctrtool` e `ctrtool --help`.
- **Próximo passo:** Concluído.

## P-002 Partições `RomFS` e `ExeFS` ainda não extraídas

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** `ExeFS` extraída via `ctrtool` (`5.6M`: `banner.bin`, `code.bin`, `icon.bin`) e `RomFS` completa extraída via `scripts/extract_romfs.py` (`40` diretórios, `655` arquivos, `1.872.201.296` bytes) em `rom/extracted/` (ignorado pelo `.gitignore`), com resumo em [romfs-manifest.json](features/pipeline-rom/romfs-manifest.json).
- **Próximo passo:** Concluído. Seguir com desempacotamento de GARCs (`a/`) e conversão de mapas/modelos ([pipeline-rom/PRD-001](features/pipeline-rom/prds/PRD-001-extracao-rom.md)).

## P-003 Worktree de desenvolvimento ainda não criado

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Worktree `pipeline-rom` criado via `orca worktree create` em `/root/orca/workspaces/alpha-sapphire/pipeline-rom` (branch `pipeline-rom`, id `b9c77879-82c0-4da4-8d62-3850abb34acf::/root/orca/workspaces/alpha-sapphire/pipeline-rom`).
- **Próximo passo:** Concluído.

## P-004 Mapas placeholder hardcoded em `src/main.ts`

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** `MAPS` inline removido de [src/main.ts](../src/main.ts) e substituído por [src/data/maps/index.ts](../src/data/maps/index.ts) com os grids reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`) extraídos de `a/0/3/9` (`GR 0006`, `0005`, `0004`) via [scripts/extract_gr_maps.py](../scripts/extract_gr_maps.py). Validado com `npm test` (`3/3`) e `npm run build`.
- **Próximo passo:** Concluído.

## P-005 Conversão de modelos 3D `BCH`/`CGFX` para `.glb`

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Instalados `.NET 8.0.428` (`/root/.dotnet`), `SPICA` + `SpicaExport` (`/opt/tools/SpicaExport`), `libgdiplus` e `assimp-utils` (`5.2`). Criado [scripts/convert_gr_to_glb.py](../scripts/convert_gr_to_glb.py) gerando `littleroot_town.glb` (`669 KB`), `route_101.glb` (`491 KB`) e `oldale_town.glb` (`991 KB`) em `public/assets/maps/` (ignorado pelo `.gitignore`), e integrado `GLTFLoader` em [SceneManager.ts](../src/engine/SceneManager.ts).
- **Próximo passo:** Concluído para o vertical slice inicial; extrair texturas/modelos de personagens e Pokémon na sequência.

## P-006 Personagens em T-pose sem animação esquelética (idle/walk)

- **Estado:** fechada
- **Data:** 2026-11-17
- **Evidência:** `SpicaExport` atualizado com `ExportSkinning = true` e fallback seguro em `DAEExporter.PaletteBone`; [scripts/convert_character_glb.py](../scripts/convert_character_glb.py) agora converte `.dae → .glb` via `Blender 3.4.1` gerando `brendan.glb`, `may.glb` e `npc.glb` com `skins: 1` e `animations: ['idle', 'walk']`. [SceneManager.ts](../src/engine/SceneManager.ts) reproduz `idle`/`walk` via `THREE.AnimationMixer`. Verificado visualmente via Chromium headless em `http://localhost:5173/` (personagens em pose relaxada `idle`, sem T-pose).
- **Próximo passo:** Concluído para personagens (`a/0/2/1`); aplicar o mesmo pipeline aos Pokémon (`a/0/0/8`) e interpolação suave de tiles na sequência.

## P-007 Materiais PICA200, placas brancas e sombras/flores nos mapas

- **Estado:** em andamento
- **Data:** 2026-11-17
- **Evidência:** Em [SceneManager.ts](../src/engine/SceneManager.ts), materiais de sombra (`kage`/`shadow`) agora usam `transparent: true`, `alphaTest: 0.02`, `depthWrite: false`, e os interiores (`brendan_house`, `birch_lab`, `oldale_pokecenter`) renderizam piso/paredes/tapetes próprios. Ainda faltam multi-textura (`Texture1`/`Texture2`) e texturas das placas brancas na conversão Collada.
- **Próximo passo:** Reproduzir multi-textura/vertex-color PICA200 no pipeline de exportação ([engine-3d/PRD-003](features/engine-3d/prds/PRD-003-fidelidade-visual-mapas-e-interiores.md)).

## P-008 Áudio da ROM (`RomFS/sound/*.bcstm`) não integrado

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** `201` arquivos `.bcstm` e `sango_sound.bcsar` já foram extraídos em `rom/extracted/RomFS/sound/`, mas o motor web ainda é silencioso.
- **Próximo passo:** Converter trilhas principais (Littleroot, Route 101, Batalha, Cura) para `.ogg`/`.mp3` e reproduzir via Web Audio API ([pipeline-rom/PRD-002](features/pipeline-rom/prds/PRD-002-extracao-audio-bcstm.md)).

## P-009 Interiores, eventos de história, itens e inventário ausentes

- **Estado:** em andamento
- **Data:** 2026-11-17
- **Evidência:** Implementados [src/core/bag.ts](../src/core/bag.ts), `requiredFlag`/`altText` em [gameState.ts](../src/core/gameState.ts), `findTriggeredTrainer` (linha de visão + flag `defeated_trainer:<id>`) em `gameState.ts`, interiores iniciais ([interiors.ts](../src/data/maps/interiors.ts)), Rival May na Route 103 e Youngster Calvin na Route 102 com `sightRange`, além de botão `Potion` e consumo de `Poké Ball` em [src/main.ts](../src/main.ts). Falta apenas a cutscene inicial do caminhão de mudança.
- **Próximo passo:** Integrar sequência inicial do caminhão de mudança (`intro_completed`) ou seguir para fidelidade visual PICA200 (`P-007`) e áudio (`P-008`).

## P-010 Mecânicas avançadas de batalha Gen VI (PP, precisão, status, treinadores multi-Pokémon)

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** `src/core/battle.ts` cobre dano básico, STAB, efetividade, Poké Ball e 1 Pokémon por treinador, mas ainda faltam PP, precisão/esquiva, condições de status, críticos e times de múltiplos Pokémon.
- **Próximo passo:** Expandir o motor de batalha conforme [batalha/PRD-002](features/batalha/prds/PRD-002-mecanicas-completas-gen6.md).

## P-011 HUD de desenvolvimento em vez de menus estilo Nintendo 3DS

- **Estado:** fechada
- **Data:** 2026-11-17
- **Evidência:** Em [index.html](../index.html) e [src/main.ts](../src/main.ts), a barra de debug (`#starter-bar`) foi ocultada por padrão (exibida apenas com `?debug=1`), substituída pelo menu estilo 3DS (`#ds-menu`: `Time`, `Mochila`, `Pokédex`, `Salvar`), uso de `Potion` fora da batalha e barras de HP coloridas (`createHpBarMarkup`).
- **Próximo passo:** Concluído.
