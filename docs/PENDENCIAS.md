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
- **Evidência:**
  - Causa das placas brancas: o `GR` era convertido sem o AD (`a/0/1/4`) correto, deixando materiais sem imagem (`Textures=0`, avisos `references missing texture`). [convert_gr_to_glb.py](../scripts/convert_gr_to_glb.py) agora aceita `--ad-dir`, escolhe o AD que cobre as texturas ausentes (`select_texture_archive`) e regrava os 7 mapas atuais. Nos `.glb` regenerados, 0 materiais ficam sem `baseColorTexture` (Littleroot: 13 materiais e 13 imagens; antes, `Textures=0`).
  - Estado de alpha do PICA200 (`BlendFunction.ColorSrcFunc == SourceAlpha` vira `BLEND`; `AlphaTest` vira `MASK` com `alphaCutoff = (ref+1)/255`) é gravado no `.glb` com `extras.pica` (`pica_alpha_state`, `patch_glb_materials`). [fixOrasMaterials](../src/engine/SceneManager.ts) respeita esse estado e mantém a heurística antiga só para modelos sem `extras.pica`. Testes: [test_pipeline.py](../scripts/test_pipeline.py) (5 novos) e [fixOrasMaterials.test.ts](../src/engine/fixOrasMaterials.test.ts) (4 novos).
  - Interiores: extraídos os modelos `.glb` e grades de colisão reais de `RomFS/a/0/3/9` para os interiores de Littleroot (`0506.bin` = `brendan_house`, 54 texturas; `0508.bin` = `may_house`, 55 texturas; `0510.bin` = `birch_lab`, 30 texturas) e conectados em [interiors.ts](../src/data/maps/interiors.ts). Ainda faltam os `.glb` dos interiores de Oldale (`oldale_pokecenter`, `oldale_mart`) e o 2º andar (`0507.bin`).
- **Não verificado:** renderização no navegador dos `.glb` de interiores e mapas regenerados; *vertex color* (`COLOR_0`) e combiners `Texture1`/`Texture2`, LUTs ou toon shading seguem padrão Three.js.
- **Próximo passo:** (1) extrair interiores de Oldale (`oldale_pokecenter`, `oldale_mart`) e conectar a escada do 2º andar (`0507.bin`); (2) validar visualmente no navegador.

## P-008 Áudio da ROM (`RomFS/sound/*.bcstm`) não integrado

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** `201` arquivos `.bcstm` e `sango_sound.bcsar` já foram extraídos em `rom/extracted/RomFS/sound/`, mas o motor web ainda é silencioso.
- **Próximo passo:** Converter trilhas principais (Littleroot, Route 101, Batalha, Cura) para `.ogg`/`.mp3` e reproduzir via Web Audio API ([pipeline-rom/PRD-002](features/pipeline-rom/prds/PRD-002-extracao-audio-bcstm.md)).

## P-009 Interiores, eventos de história, itens e inventário ausentes

- **Estado:** fechada
- **Data:** 2026-11-17
- **Evidência:** Intro do Prof. Birch (escolha de sexo Brendan/May + nome) e cena do caminhão de mudança implementadas em [index.html](../index.html) e [src/main.ts](../src/main.ts); portas reais abertas e conectadas em [index.ts](../src/data/maps/index.ts) para 5 interiores ([interiors.ts](../src/data/maps/interiors.ts): `brendan_house`, `may_house`, `birch_lab`, `oldale_pokecenter`, `oldale_mart`), validadas em [gameState.test.ts](../src/core/gameState.test.ts); inventário ([bag.ts](../src/core/bag.ts)) e treinadores com linha de visão (`findTriggeredTrainer`) integrados.
- **Próximo passo:** Concluído para o arco inicial; expandir diálogos/itens extras conforme novas rotas forem abertas.

## P-010 Mecânicas avançadas de batalha Gen VI (PP, precisão, status, treinadores multi-Pokémon)

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** `src/core/battle.ts` cobre dano básico, STAB, efetividade, Poké Ball e 1 Pokémon por treinador, mas ainda faltam PP, precisão/esquiva, condições de status, críticos e times de múltiplos Pokémon.
- **Próximo passo:** Expandir o motor de batalha conforme [batalha/PRD-002](features/batalha/prds/PRD-002-mecanicas-completas-gen6.md).

## P-011 HUD de desenvolvimento em vez de menus estilo Nintendo 3DS

- **Estado:** em andamento
- **Data:** 2026-11-17
- **Evidência:** Reaberta após feedback do usuário: a versão inicial (`#ds-menu` com 4 abas simples no topo) ainda não reproduz o layout real da tela inferior do Nintendo 3DS / Alpha Sapphire (PlayNav, cards de Equipe, categorias de Mochila e grade de Pokédex).
- **Próximo passo:** Reconstruir layout dual-screen estilo Nintendo 3DS com tela superior limpa e tela inferior estilo PlayNav/ORAS ([engine-3d/PRD-004](features/engine-3d/prds/PRD-004-interface-3ds-menus-party-bag-pokedex.md)).

## P-012 Animações nativas da ROM (tabela overworld `0xef` em `a/0/2/1` e golpes em `a/0/0/8`)

- **Estado:** em andamento
- **Data:** 2026-11-17
- **Evidência inicial:** As animações atuais (`idle` e `walk` dos personagens; `idle` dos Pokémon) são geradas proceduralmente no Blender sobre o esqueleto real da ROM. O motion overworld foi inicialmente tratado como formato desconhecido (`0xef`) e os Pokémon ainda não exportavam clipes de ataque/dano/vitória de `a/0/0/8`.
- **Investigação:** [Formato nativo, offsets, hashes e comandos](features/pipeline-rom/animations-format.md) (`AN-E1`–`AN-E7`, `A-010`) refutam a ausência de suporte no SPICA: `0xef` é N=239 de `GFL.GF1MotionPack`; o wrapper usava incorretamente GFL2 e silenciava o erro. MM 0314/0315 possuem 12/11 clipes esparsos presentes (corrigidos os rótulos em `A-011`). Em `a/0/0/8`, PB seção 0 contém GF1 de batalha e PK contém ações `kw*`; os BCHs seguintes incluem visibilidade e expressões por UV de Eye/LIris/RIris. No PB de Bulbasaur: índices 0/1 wait, 8 físico, 12 especial, 16 dano, 17 queda, com nomes corroborados pelos BCHs.
- **Conversão individual:** [native_motions.py](../scripts/native_motions.py) lista índices originais e converte um clipe por chamada via GF1 → DAE → Blender → GLB. MM 0314 índice 2: 1 skin, 150 canais, 14/30 s; Bulbasaur PB índice 3: 1 skin, 195 canais, 15/30 s; ambos com accessors finitos e canais variáveis.
- **Integração parcial (`AN-E8`, `A-011`):** [attach_native_motions.py](../scripts/attach_native_motions.py) anexa canais nativos ao GLB-base texturizado dos pipelines existentes, por manifesto serial explícito, validando nomes em skin.joints e inverse bind matrices. Quatro saídas novas em `rom/extracted/models/native_validation/` do checkout principal: Treecko (`idle/physical/special/damage/faint`, 40/80/70/20/50 frames), Brendan MM 0315, Wally MM 0180 e Roxanne MM 0187 (`overworld_002/093`, 14/36 frames). Geometria/material/imagens/skin preservados byte a byte/campo a campo, accessors float32 finitos e durações verificadas; 28 testes Python, 32 Vitest e build passaram. Os assets-base e `src/` não foram alterados; não houve batch pesado.
- **Não verificado:** Paridade visual/looping, significado dos IDs overworld, bones Feeler de Bulbasaur/Jaw de Treecko ausentes no import e sincronização das expressões. O wrapper preserva PT/texturas do GLB-base, mas não exporta os BCHs de material/visibilidade. Os personagens mantêm idle/walk procedurais enquanto recebem clipes com IDs explícitos; o jogo não foi atualizado para selecionar os novos clipes.
- **Cobertura ampla (`AN-E9`, `A-012`):** [Manifesto por modelo](features/pipeline-rom/native-models-manifest.json) cobre 544 MM e 41 modelos Pokémon de 39 espécies selecionadas por encontros/starters/lendários. Lote `nice 10`, dois processos: 348 personagens + 40 Pokémon integrados (388 GLBs / 544 clipes); 177 MM sem seção de motion, 9 só com poses estáticas e 11 falhas explícitas. MM0024–0033 não têm skin no GLB-base e o import não produz action; Taillow #276 falha no SPICA com `Segment scale compensation has a zero parent scale`. Magikarp #129 carece de `special/faint`, Tympole #535 de `physical/faint`; nada substituído proceduralmente. Dez amostras (cinco MM/cinco Pokémon) passaram em preservação, imagens, floats e tempos; 42 testes Python, 32 Vitest e build passaram. Saídas/logs ignorados em `rom/extracted/models/clips_merged/`, sem alterar `src/` ou ferramentas externas.
- **Próximo passo:** Investigar a compensação de escala de Taillow e decidir o tratamento dos MM sem armature; validar visualmente as saídas contra emulador, resolver os avisos de importação, definir semântica overworld e transportar expressões UV/visibilidade. Só após isso promover os outputs ao carregamento do jogo, substituir os procedurais com equivalentes nativos verificados e fechar a pendência.

## P-013 Motor de scripts e eventos completos da história da ROM

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** A introdução (Birch + caminhão) e os primeiros interiores foram montados manualmente para o vertical slice inicial; faltam cutscenes com movimento coreografado de NPCs, resgate real do Prof. Birch escolhendo a Poké Ball da mochila no chão, entrega de Pokédex/Running Shoes, e todo o restante da campanha de Hoenn até a Liga Pokémon.
- **Próximo passo:** Extrair e interpretar as tabelas de scripts/eventos de mapa da ROM em `src/data/` e criar um runner determinístico de cutscenes em `src/core/`.

## P-014 Cenários 3D reais de batalha, partículas de golpes e câmera dinâmica ORAS

- **Estado:** em andamento
- **Data:** 2026-11-17
- **Evidência:** `buildBattleArena()` em [SceneManager.ts](../src/engine/SceneManager.ts) usa círculo/cilindros geométricos verdes em vez das arenas 3D reais da ROM (grama, água, caverna, ginásio), câmera cinemática de turnos e efeitos visuais de golpes/Poké Ball.
- **Progresso (parcial):** [battleArena.ts](../src/engine/battleArena.ts) cria arena procedural estilizada (chão, plataformas, luzes) e partículas 3D para `fire`, `water`, `grass`, `dark` e `normal` (demais tipos usam o efeito `normal`). `SceneManager.playAttackEffect(type)` é chamado em `main.ts` ao escolher um golpe. Testes em `battleArena.test.ts`; `npm test && npm run build` passaram. Efeito dispara antes do cálculo do turno, sem sincronizar com a animação do Pokémon.
- **Próximo passo:** Extrair os modelos de arena de batalha da ROM (grama, água, caverna, ginásio), implementar câmera dinâmica por turno, efeito de Poké Ball e estilos para os demais tipos. Só fechar após isso.
