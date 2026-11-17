# Status

Atualizado em 2026-11-17 (verificação local na VPS).

## Estado do Código e Build

- Branch atual: `main`.
- `npm test` (`vitest run`): **passando** (`8` arquivos, `32` testes: `4` em [src/engine/battleArena.test.ts](../src/engine/battleArena.test.ts), `4` em [src/engine/fixOrasMaterials.test.ts](../src/engine/fixOrasMaterials.test.ts), `7` em [src/core/gameState.test.ts](../src/core/gameState.test.ts), `5` em [src/core/bag.test.ts](../src/core/bag.test.ts), `6` em [src/core/battle.test.ts](../src/core/battle.test.ts), `2` em [src/core/save.test.ts](../src/core/save.test.ts), `1` em [src/core/room.test.ts](../src/core/room.test.ts) e `3` em [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts)).
- `python3 -m unittest scripts/test_pipeline.py`: **passando** (`8` testes com fixtures sintéticas: `decompress_lz11`, `parse_gr_grid`, `decode_gen6_text` e conversão de materiais PICA200 em `convert_gr_to_glb.py`, `P-007`).
- `npm run build` (`tsc && vite build`): **passando** (`dist/index.html` e bundle JS gerados sem erros de TypeScript).
- Módulos existentes:
  - [src/core/types.ts](../src/core/types.ts) e [src/core/gameState.ts](../src/core/gameState.ts): estado inicial com `spawnPos`, `isWalkable`, `isTallGrass`, `interact`, `findTriggeredTrainer` (linha de visão + derrota), `requiredFlag`/`altText` em warps/NPCs, movimentação e transição por `warp`.
  - [src/core/bag.ts](../src/core/bag.ts): inventário imutável (`createInitialBag`, `addBagItem`, `consumePokeball`, `usePotion`).
  - [src/core/battle.ts](../src/core/battle.ts): encontros selvagens ponderados, captura com `throwPokeball`, ganho de XP/nível e motor de batalha por turnos Gen VI determinístico.
  - [src/core/save.ts](../src/core/save.ts): serialização e validação de save (`serializeSave`, `deserializeSave`) incluindo `bag` para persistência em `localStorage`.
  - [src/core/room.ts](../src/core/room.ts): estado autoritativo de salas multiplayer (`createRoom`, `joinRoom`, `leaveRoom`, `applyRoomMove`) reutilizando `movePlayer`.
  - [src/data/maps/index.ts](../src/data/maps/index.ts): mapas reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`, `route_102.json`, `route_102_west.json`, `route_103.json`, `petalburg_city.json`) + interiores ([interiors.ts](../src/data/maps/interiors.ts): `brendan_house`, `birch_lab`, `oldale_pokecenter`) com `.glb` + `.png`s em `public/assets/maps/` e diálogos reais em `src/data/texts/`.
  - [src/data/pokemon/](../src/data/pokemon/species.ts): iniciais (`Treecko`, `Torchic`, `Mudkip`) e encontros da `Route 101`/`Route 102` (`Poochyena`, `Zigzagoon`, `Wurmple`, `Lotad`, `Ralts`), com `.glb` animado (`idle`, `skins: 1`) + `.png`s em `public/assets/pokemon/`.
  - [src/engine/SceneManager.ts](../src/engine/SceneManager.ts): cena Three.js carregando `.glb` de mapas, personagens (`brendan.glb`, `may.glb`, `npc.glb`) com interpolação suave de movimento e animações esqueléticas `idle`/`walk`, e arena de batalha 3D (`syncBattle` com `battleMixers`) via `GLTFLoader`.
  - [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts): suíte de paridade contra o comportamento esperado da ROM original.
  - [src/main.ts](../src/main.ts): loop de renderização, teclado, caixa de diálogo, menu estilo 3DS (`Time`, `Mochila`, `Pokédex`, `Salvar`), HUD de batalha 3D com barras de HP coloridas, time de até 6 Pokémon e auto-save em `localStorage`.
- Diretórios planejados ainda não criados: `src/ai/`.

## Investigação local de animações (macOS, 2026-11-17)

- Worktree `anim-0xef-re`, base `b060a9b`; os registros anteriores de VPS acima/abaixo são históricos e não foram revalidados nesta investigação.
- `P-012`: [formato nativo documentado](features/pipeline-rom/animations-format.md), incluindo offsets/hashes (`AN-E1`–`AN-E7`). `0xef` é N=239 de `GF1MotionPack`, já suportado pelo SPICA GFL; o wrapper local usava GFL2 incorretamente. `PB` contém batalha, `PK` interações, e expressões ficam em BCHs separados de material/visibilidade.
- [native_motions.py](../scripts/native_motions.py) converte um clipe por chamada; [attach_native_motions.py](../scripts/attach_native_motions.py) integra os canais ao GLB texturizado produzido pelos pipelines existentes, por manifesto explícito serial (`--plan` disponível), preservando materiais/imagens/skin e filtro `sw_parts`. Não altera `src/` ou ferramentas compartilhadas e não sobrescreve outputs existentes.
- `AN-E8`: quatro saídas novas em `rom/extracted/models/native_validation/` do checkout principal: Treecko (PC 2795/PB 2800, cinco clipes semânticos), Brendan (MM 0315), Wally (MM 0180) e Roxanne (MM 0187), os personagens com `overworld_002/093` além dos idle/walk procedurais existentes. Todos mantêm o BIN original como prefixo, geometria/material/texturas idênticos, três imagens embutidas, accessors float32 finitos e durações nativas corretas a 30 fps; paridade visual e expressões continuam não verificadas/integradas. São quatro modelos/11 clipes seriais em baixa prioridade, não batch pesado; `A-011` registra o lookup por joints e a correção dos rótulos 0314/0315.
- Ambiente observado: Python 3.12.3, .NET SDK 8.0.428 em `~/.dotnet/dotnet`, Blender 3.4.1 em `~/Applications/Blender3.4.app`. SPICA fonte em `/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/_tools/SPICA`, commit `82acbd63695e4ef8b95a92ce884f25ec1044788f` com patches locais existentes de exportação. ROM extraída no checkout principal irmão de `_tools/`, ausente no worktree.
- Verificação neste worktree: `npm ci --offline`; `npm test` (8 arquivos / 32 testes) e `npm run build` passaram; Vite manteve aviso de bundle >500 kB. A suíte Python passou com 28 testes (13 de merge/integração + 7 nativos + 8 existentes); o ataque Bulbasaur PB 8 foi exportado com 195 canais e duração 50/30 s após regressão reproduzida de perda do último frame. Detalhes em [animations-format.md](features/pipeline-rom/animations-format.md). Avisos CA1416, IOR/NumPy e bones ausentes do Blender foram registrados, sem reivindicação de fidelidade visual.

## Estado da ROM e Ambiente na VPS

- Pasta [rom/](../rom/) ignorada pelo [.gitignore](../.gitignore#L8) e contendo:
  - `Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds` (`2.0G`)
  - `Pokemon Alpha Sapphire (USA) (EnJaFrDeEsItKo) (Rev 2).7z` (`1.1G`)
  - `readme.txt` (`27` bytes)
- Espaço livre em disco (`/`): `67G` disponíveis (`65%` usado).
- Ferramentas de extração:
  - `7z`: instalado e utilizado na extração inicial.
  - `ctrtool`: instalado em `/usr/local/bin/ctrtool` (`CTRTool v1.3.0`, compilado de `Project_CTR` em 2026-11-16).
  - `ExeFS`: extraída em `rom/extracted/ExeFS/` (`5.6M`: `banner.bin`, `code.bin`, `icon.bin`).
  - `RomFS`: extraída por completo via `scripts/extract_romfs.py` em `rom/extracted/RomFS/` (`40` diretórios, `655` arquivos, `1.872.201.296` bytes; ver `A-003`).
- Worktree ativo para pipeline: `pipeline-rom` em `/root/orca/workspaces/alpha-sapphire/pipeline-rom` (branch `pipeline-rom`).
