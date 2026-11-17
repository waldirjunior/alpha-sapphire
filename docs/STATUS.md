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

## Investigação de scripts ORAS (2026-11-17, Mac/worktree `zone-scripts-re`)

- [Formato documentado](features/pipeline-rom/script-format.md): 1.072 scripts de zonas e 85 entradas de `a/0/2/9` são Pawn/AMX v10, com células de 32 bits compactadas. Semântica de chamadas nativas e runner ainda pendentes (P-013/A-010).
- [Extrator](../scripts/extract_zone_scripts.py) validado nas 536 zonas; JSONs gerados somente em `rom/extracted/zones_scripts/` ignorado, sem mudanças em `src/` nem binários no Git.
- `python3 -m unittest scripts/test_zone_scripts.py scripts/test_pipeline.py`: 18 testes passando (10 novos + 8 existentes), fixtures sintéticas sem ROM.
- A verificação `npm test && npm run build` neste worktree parou em `vitest: command not found` (sem `node_modules`); build não executado. As aprovações de build da seção anterior são históricas, não desta investigação.

## Corpus completo e runner puro inicial (2026-11-17)

- `src/data/zone_scripts/`: 536 zonas + 85 globais (todas as entradas), 530.246 instruções e 82 opcodes; 615/615 nomes nativos resolvidos por strings locais, inclusive `c34ad2ab=MdlSetVisible` (A-012).
- Vínculos construídos dos ZOs, conferidos com o catálogo externo: 2.892 únicos, 584 ambíguos e 673 sem case estático. Os 911 warps registram navegação, sem inventar script. Globais incluem vínculos inversos; `--all` é o comando canônico de regeneração completa.
- `src/core/scriptRunner.ts`: runner puro, imutável e determinístico de chamadas normalizadas de movimento/visibilidade/texto/warp/espera; falha explícita em nativa desconhecida. Sete testes sintéticos, sem DOM/Three.js. Não é VM AMX e não está ligado ao jogo ativo; ADR-002/core-jogo e P-013 documentam limites.
- Verificação: 44 testes Python, 39 Vitest e `npm run build`; geração completa repetida sem diferenças. Sem dependências novas nem execução de conversores.

## VM Pawn real e abertura headless (2026-11-17)

- `src/core/amxRunner.ts`: caminho distinto do IR normalizado, executando memória/pilha/frames/call/retn/casetbl e chamadas globais reais; estado/clonagem puros. Efeitos opacos exigem completion explícita do host em `await-input`; nativas/opcodes fora do registro falham por nome.
- Fixture `opening-memory.json`: 19 imagens iniciais verificadas por SHA, com inventário por programa e 82 nomes diretos adicionais nas quatro zonas pedidas. O registro confere aridades das 89 nativas diretas; isso não prova execução de todos os ramos.
- Testes reais executam inits 223/225 até término; diálogo de móvel 223 até término após respostas; laboratório 227, Littleroot 6/global78, mãe/relógio global47 e Route 101/23 até pedido do host. Cenários de mundo/respostas são controlados, não snapshots do emulador.
- Verificação: 61 Vitest (22 novos), 47 Python e build canônico. Sem dependências novas nem mudanças no renderer. ADR-003/PRD-003 e script-disassembly.md registram inferências de assinatura e projeções de estado.
- P-013 continua aberta para serviços do host, ABI ACMD/objetos, integração ao jogo ativo e paridade de todos os ramos; a abertura gráfica inteira não foi declarada pronta.

## Disassembly do slice (2026-11-17, histórico da etapa anterior)

- [Gerador](../scripts/disassemble_zone_scripts.py) e [documentação](features/pipeline-rom/script-disassembly.md): 12 zonas (6, 7, 23, 223–231), oito scripts globais referenciados, 28.507 instruções e 71 opcodes em `src/data/zone_scripts/`.
- Nativas: 204/205 hashes nomeados (198 por strings dos binários locais e seis por referência comunitária); `c34ad2ab` desconhecido. Vínculos NPC/trigger/furniture: 108 únicos e 11 ambíguos, sem seleção especulativa (P-013/A-011).
- Verificação atual: `python3 -B -m unittest scripts/test_amx_disassembly.py scripts/test_zone_script_bindings.py scripts/test_zone_scripts.py scripts/test_pipeline.py` passou (40 testes); `npm install` executado; `npm test && npm run build` passou (32 testes Vitest). Nenhuma dependência foi atualizada.
- Avisos herdados: bundle Vite acima de 500 KB e nove vulnerabilidades npm (P-015). Os binários foram somente lidos; nenhuma conversão 3D executada.

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
