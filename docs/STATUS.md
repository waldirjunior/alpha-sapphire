# Status

Atualizado em 2026-11-17 (verificação local na VPS).

## Estado do Código e Build

- Branch atual: `main`.
- `npm test` (`vitest run`): **passando** (`6` arquivos, `22` testes: `5` em [src/core/gameState.test.ts](../src/core/gameState.test.ts), `5` em [src/core/bag.test.ts](../src/core/bag.test.ts), `6` em [src/core/battle.test.ts](../src/core/battle.test.ts), `2` em [src/core/save.test.ts](../src/core/save.test.ts), `1` em [src/core/room.test.ts](../src/core/room.test.ts) e `3` em [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts)).
- `python3 -m unittest scripts/test_pipeline.py`: **passando** (`3` testes com fixtures sintéticas para `decompress_lz11`, `parse_gr_grid` e `decode_gen6_text`).
- `npm run build` (`tsc && vite build`): **passando** (`dist/index.html` e bundle JS gerados sem erros de TypeScript).
- Módulos existentes:
  - [src/core/types.ts](../src/core/types.ts) e [src/core/gameState.ts](../src/core/gameState.ts): estado inicial com `spawnPos`, `isWalkable`, `isTallGrass`, `interact`, `requiredFlag`/`altText` em warps/NPCs, movimentação e transição por `warp`.
  - [src/core/bag.ts](../src/core/bag.ts): inventário imutável (`createInitialBag`, `addBagItem`, `consumePokeball`, `usePotion`).
  - [src/core/battle.ts](../src/core/battle.ts): encontros selvagens ponderados, captura com `throwPokeball`, ganho de XP/nível e motor de batalha por turnos Gen VI determinístico.
  - [src/core/save.ts](../src/core/save.ts): serialização e validação de save (`serializeSave`, `deserializeSave`) incluindo `bag` para persistência em `localStorage`.
  - [src/core/room.ts](../src/core/room.ts): estado autoritativo de salas multiplayer (`createRoom`, `joinRoom`, `leaveRoom`, `applyRoomMove`) reutilizando `movePlayer`.
  - [src/data/maps/index.ts](../src/data/maps/index.ts): mapas reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`, `route_102.json`, `route_102_west.json`, `route_103.json`, `petalburg_city.json`) + interiores ([interiors.ts](../src/data/maps/interiors.ts): `brendan_house`, `birch_lab`, `oldale_pokecenter`) com `.glb` + `.png`s em `public/assets/maps/` e diálogos reais em `src/data/texts/`.
  - [src/data/pokemon/](../src/data/pokemon/species.ts): iniciais (`Treecko`, `Torchic`, `Mudkip`) e encontros da `Route 101`/`Route 102` (`Poochyena`, `Zigzagoon`, `Wurmple`, `Lotad`, `Ralts`), com `.glb` animado (`idle`, `skins: 1`) + `.png`s em `public/assets/pokemon/`.
  - [src/engine/SceneManager.ts](../src/engine/SceneManager.ts): cena Three.js carregando `.glb` de mapas, personagens (`brendan.glb`, `may.glb`, `npc.glb`) com interpolação suave de movimento e animações esqueléticas `idle`/`walk`, e arena de batalha 3D (`syncBattle` com `battleMixers`) via `GLTFLoader`.
  - [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts): suíte de paridade contra o comportamento esperado da ROM original.
  - [src/main.ts](../src/main.ts): loop de renderização, teclado, caixa de diálogo, HUD de batalha 3D, time de até 6 Pokémon e auto-save em `localStorage`.
- Diretórios planejados ainda não criados: `src/ai/`.

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
