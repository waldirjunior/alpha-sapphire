# Status

Atualizado em 2026-11-17 (verificação local na VPS).

## Estado do Código e Build

- Branch atual: `main`.
- `npm test` (`vitest run`): **passando** (`11` arquivos, `84` testes: `16` em [src/core/battleProgression.test.ts](../src/core/battleProgression.test.ts), `22` em [src/core/battleMechanics.test.ts](../src/core/battleMechanics.test.ts), `13` em [src/core/battleData.test.ts](../src/core/battleData.test.ts), `4` em [src/engine/battleArena.test.ts](../src/engine/battleArena.test.ts), `4` em [src/engine/fixOrasMaterials.test.ts](../src/engine/fixOrasMaterials.test.ts), `7` em [src/core/gameState.test.ts](../src/core/gameState.test.ts), `5` em [src/core/bag.test.ts](../src/core/bag.test.ts), `6` em [src/core/battle.test.ts](../src/core/battle.test.ts), `3` em [src/core/save.test.ts](../src/core/save.test.ts), `1` em [src/core/room.test.ts](../src/core/room.test.ts) e `3` em [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts)).
- `python3 -m unittest scripts/test_pipeline.py`: **passando** (`17` testes com fixtures sintéticas: `decompress_lz11`, `parse_gr_grid`, `decode_gen6_text` (incl. glifos ♀/♂, `A-012`), conversão de materiais PICA200 em `convert_gr_to_glb.py` (`P-007`) e `8` parsers de tabelas de batalha em `extract_battle_tables.py` (`A-010`)).
- `npm run build` (`tsc && vite build`): **passando** (bundle `1.82 MB` / `297 kB` gzip após embutir `species/moves/learnsets.json`, ver `P-015`) (`dist/index.html` e bundle JS gerados sem erros de TypeScript).
- Módulos existentes:
  - [src/core/types.ts](../src/core/types.ts) e [src/core/gameState.ts](../src/core/gameState.ts): estado inicial com `spawnPos`, `isWalkable`, `isTallGrass`, `interact`, `findTriggeredTrainer` (linha de visão + derrota), `requiredFlag`/`altText` em warps/NPCs, movimentação e transição por `warp`.
  - [src/core/bag.ts](../src/core/bag.ts): inventário imutável (`createInitialBag`, `addBagItem`, `consumePokeball`, `usePotion`).
  - [src/core/battle.ts](../src/core/battle.ts): API pública da batalha (encontros ponderados, captura, troca, fuga, Centro Pokémon) sobre [battleTurn.ts](../src/core/battleTurn.ts) (ordem por prioridade −7..+5 → velocidade efetiva → empate por RNG, flinch, dano residual, vitória/derrota), [moveExecution.ts](../src/core/moveExecution.ts) (PP com Pressure, precisão Gen VI com estágios e `accuracy=101`, golpes de status/estágio/cura, dreno, recuo, multi-hit, efeitos secundários), [damage.ts](../src/core/damage.ts), [statusConditions.ts](../src/core/statusConditions.ts) (paralisia, sono, congelamento, queimadura, veneno, tóxico + imunidades de tipo), [statStages.ts](../src/core/statStages.ts) e [battlePokemon.ts](../src/core/battlePokemon.ts) (`PokemonInstance` sobre `DexSpecies`/`BattleMove`, moveset padrão Gen VI por learnset). Críticos Gen VI (1/16, 1/8, 1/2, sempre; ×1.5; ignora estágios desfavoráveis; Battle/Shell Armor) em [damage.ts](../src/core/damage.ts); XP pelas 6 curvas reais e fórmula plana Gen VI com bônus de treinador e divisão entre participantes em [experience.ts](../src/core/experience.ts); level-up com aprendizado de golpes e fila `pendingMoves` em [levelUp.ts](../src/core/levelUp.ts); times de até 6 em [battleParty.ts](../src/core/battleParty.ts) (troca voluntária, troca forçada após desmaio, treinador envia o próximo, vitória/derrota só com o time inteiro fora) e IA em [battleAi.ts](../src/core/battleAi.ts) (selvagem aleatório; treinador por dano esperado/utilidade, empate por RNG). RNG sempre injetável.
  - [src/core/save.ts](../src/core/save.ts): serialização e validação de save (`serializeSave`, `deserializeSave`) incluindo `bag` para persistência em `localStorage`.
  - [src/core/room.ts](../src/core/room.ts): estado autoritativo de salas multiplayer (`createRoom`, `joinRoom`, `leaveRoom`, `applyRoomMove`) reutilizando `movePlayer`.
  - [src/data/maps/index.ts](../src/data/maps/index.ts): mapas reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`, `route_102.json`, `route_102_west.json`, `route_103.json`, `petalburg_city.json`) + interiores ([interiors.ts](../src/data/maps/interiors.ts): `brendan_house`, `birch_lab`, `oldale_pokecenter`) com `.glb` + `.png`s em `public/assets/maps/` e diálogos reais em `src/data/texts/`.
  - [src/data/pokemon/](../src/data/pokemon/species.ts): elenco derivado da ROM via `core/dex` (não é mais fonte de dados; `SPECIES`/`MOVES`/`findRosterSpecies`) — iniciais (`Treecko`, `Torchic`, `Mudkip`) e encontros da `Route 101`/`Route 102` (`Poochyena`, `Zigzagoon`, `Wurmple`, `Lotad`, `Ralts`), com `.glb` animado (`idle`, `skins: 1`) + `.png`s em `public/assets/pokemon/`.
  - [src/data/battle/](../src/data/battle/): tabelas de batalha reais da ROM ([battle-tables.md](features/pipeline-rom/battle-tables.md)): `species.json` (826 entradas personal com formas), `moves.json` (622 golpes), `types.json` (18×18), `learnsets.json` (level-up) e `machines.json` (TM/HM). Consumidas por [src/core/typeChart.ts](../src/core/typeChart.ts) (efetividade 18×18, usada por `getTypeEffectiveness` em `battle.ts`), [src/core/dex.ts](../src/core/dex.ts) (lookup de espécie/forma/golpe) e [src/core/learnsets.ts](../src/core/learnsets.ts) (level-up, moveset padrão Gen VI, TM/HM, `canLearnMove`).
  - [src/engine/SceneManager.ts](../src/engine/SceneManager.ts): cena Three.js carregando `.glb` de mapas, personagens (`brendan.glb`, `may.glb`, `npc.glb`) com interpolação suave de movimento e animações esqueléticas `idle`/`walk`, e arena de batalha 3D (`syncBattle` com `battleMixers`) via `GLTFLoader`.
  - [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts): suíte de paridade contra o comportamento esperado da ROM original.
  - [src/main.ts](../src/main.ts): loop de renderização, teclado, caixa de diálogo, menu estilo 3DS (`Time`, `Mochila`, `Pokédex`, `Salvar`), HUD de batalha 3D com barras de HP coloridas, time de até 6 Pokémon e auto-save em `localStorage`.
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
