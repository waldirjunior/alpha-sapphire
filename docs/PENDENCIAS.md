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
- **Atualização 2026-11-17:** dados reais de espécies, golpes (PP, precisão, prioridade, efeitos), tabela de tipos e learnsets extraídos para `src/data/battle/` ([battle-tables.md](features/pipeline-rom/battle-tables.md)); `src/core/typeChart.ts`, `dex.ts` e `learnsets.ts` já os consomem e `battle.ts` usa a tabela de tipos real. Faltam PP/precisão/prioridade/status na simulação e migrar `PokemonInstance` de `data/pokemon/species.ts` para `DexSpecies`/`DexMove`.
- **Atualização 2026-11-17 (simulação):** PP (Pressure, bloqueio em 0 PP, Struggle), precisão Gen VI com estágios e `accuracy=101`, prioridade, status maiores com imunidades, estágios, cura, dreno, recuo, multi-hit e flinch implementados com dados reais e `PokemonInstance` migrado para `DexSpecies`/`BattleMove` (`battleMechanics.test.ts`, 22 testes).
- **Ainda não simulado:** `quality` 5 (Swagger/Flatter), 9 (OHKO), 10/11 (clima, telas, hazards), 12 (forçar troca) e 13 (efeito único: Protect, Substitute, golpes de dois turnos etc. — 90 golpes); `inflict` ≥ 6 (confusão, atração, Leech Seed, Taunt, Disable, Yawn, Perish Song etc.); críticos (`critStage`); habilidades além de Pressure; itens segurados; times de múltiplos Pokémon por treinador; XP pela curva real (`growthRate`/`baseExp`). Golpes não simulados registram "ainda não é simulado (P-010)" no log.
- **Próximo passo:** Expandir o motor de batalha conforme [batalha/PRD-002](features/batalha/prds/PRD-002-mecanicas-completas-gen6.md).

## P-011 HUD de desenvolvimento em vez de menus estilo Nintendo 3DS

- **Estado:** em andamento
- **Data:** 2026-11-17
- **Evidência:** Reaberta após feedback do usuário: a versão inicial (`#ds-menu` com 4 abas simples no topo) ainda não reproduz o layout real da tela inferior do Nintendo 3DS / Alpha Sapphire (PlayNav, cards de Equipe, categorias de Mochila e grade de Pokédex).
- **Próximo passo:** Reconstruir layout dual-screen estilo Nintendo 3DS com tela superior limpa e tela inferior estilo PlayNav/ORAS ([engine-3d/PRD-004](features/engine-3d/prds/PRD-004-interface-3ds-menus-party-bag-pokedex.md)).

## P-012 Animações nativas da ROM (tabela overworld `0xef` em `a/0/2/1` e golpes em `a/0/0/8`)

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** As animações atuais (`idle` e `walk` dos personagens; `idle` dos Pokémon) são geradas proceduralmente no Blender sobre o esqueleto real da ROM porque o pacote de motion overworld (`a/0/2/1` seção 1, cabeçalho `0xef`) difere do formato `GFMotionPack` suportado pelo SPICA, e os Pokémon ainda não exportam clipes de ataque/dano/vitória de `a/0/0/8`.
- **Próximo passo:** Mapear o formato binário das animações overworld (`0xef`) e exportar todos os clipes de batalha dos Pokémon (`idle`, `attack`, `hit`, `faint`) + expressões faciais.

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

## P-015 Bundle do cliente embute as tabelas de batalha completas

- **Estado:** aberta
- **Data:** 2026-11-17
- **Evidência:** após migrar `PokemonInstance` para `core/dex`, `npm run build` gera `dist/assets/index-*.js` com `1.81 MB` (`295 kB` gzip), contra `724 kB` (`175 kB` gzip) antes, porque `species.json`, `moves.json` e `learnsets.json` são importados estaticamente.
- **Próximo passo:** carregar as tabelas sob demanda (`import()`/fetch de `public/`) ou gerar uma variante enxuta só com os campos usados em runtime, mantendo `src/core/` puro.
