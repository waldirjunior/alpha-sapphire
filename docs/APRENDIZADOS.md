# Aprendizados

Erros, restrições reais e regras operacionais descobertas durante o projeto. Um item novo entra no fim com o próximo número (`A-NNN`). Nunca apague nem reescreva um aprendizado antigo; se a regra mudar, acrescente um novo item apontando para o anterior.

## A-001 ROM proprietária fica exclusivamente em `rom/` e fora do Git

- **Data:** 2026-11-16
- **Contexto:** Transferência do arquivo `.7z` (`1.1G`) e extração do `.3ds` (`2.0G`) para `/opt/orca-pilot/projetos/externo/alpha-sapphire/rom/`.
- **Erro potencial:** Commitar arquivos da ROM, `RomFS/`, `ExeFS/` ou assets binários proprietários no repositório Git.
- **Regra:** Verificar sempre com `git check-ignore -v <caminho>` antes de gerar novos outputs de extração. Somente código, schemas, scripts e documentação são versionados ([pipeline-rom/ADR-002](features/pipeline-rom/adrs/ADR-002-isolamento-proprietario-e-worktrees.md)).

## A-002 `src/core/` não pode depender de Three.js nem de APIs de DOM

- **Data:** 2026-11-16
- **Contexto:** Arquitetura definida em [tcc/00-arquitetura.md](tcc/00-arquitetura.md) e implementada em [src/core/gameState.ts](../src/core/gameState.ts).
- **Erro potencial:** Importar `three`, `window` ou `document` dentro de `src/core/`, acoplando a regra de jogo ao navegador e impedindo testes rápidos em Node e reuso em servidor multiplayer.
- **Regra:** Toda lógica de estado, colisão, warps, batalha e flags permanece pura em `src/core/` com testes unitários em Vitest usando fixtures sintéticas ([core-jogo/ADR-001](features/core-jogo/adrs/ADR-001-separacao-core-engine.md)).

## A-003 `ctrtool` v1.3.0 aborta extração da `RomFS` em arquivos de 0 byte

- **Data:** 2026-11-16
- **Contexto:** Extração de `RomFS` de `Pokemon Alpha Sapphire (USA) ... (Rev 2).3ds` com `ctrtool --romfsdir`.
- **Erro:** `ctrtool` v1.3.0 interrompe após 234 arquivos com `[tc::io::VirtualFileSystem::openFile() ERROR] File does not exist.` ao encontrar o arquivo vazio `a/0/8/7` (0 bytes).
- **Regra:** Usar [scripts/extract_romfs.py](../scripts/extract_romfs.py) para extração completa da `RomFS` (`655` arquivos, `40` diretórios) e manter `ctrtool` para inspeção de headers NCSD/NCCH e extração da `ExeFS`.

## A-004 Texturas de cenário ficam em `a/0/1/4` (`AD`) e `.NET 8` Linux não suporta `System.Drawing.Common`

- **Data:** 2026-11-16
- **Contexto:** Conversão de `GR` (`a/0/3/9`) via `SPICA` para `.dae`/`.glb` no Debian 12.
- **Erro:** `GR` sozinho gera malha sem texturas (`Textures=0`), e `DAE.Save()` falha em Linux `.NET 8` com `System.PlatformNotSupportedException` ao chamar `System.Drawing.Bitmap`.
- **Regra:** Mesclar as texturas de área (`a/0/1/4`, ex.: `0008.bin` para Hoenn inicial) via `SpicaExport`, exportar PNGs diretamente de `H3DTexture.ToRGBA()` com `ZLibStream` no `DAE.cs` e copiar os `.png`s junto ao `.glb` em `public/assets/maps/<mapa>/`.

## A-006 Peças trocáveis (`sw_parts01..05`) nos modelos de personagens e fidelidade de UI/portas

- **Data:** 2026-11-17
- **Contexto:** Inspeção visual em `brendan.glb`/`may.glb` (`a/0/2/1`) e feedback do usuário sobre portas dos prédios e menus estilo 3DS (`P-011`).
- **Erro:** Exportar todas as malhas `sw_parts01..05` ao mesmo tempo empilha chapéus/cabelos/acessórios alternativos na cabeça do personagem. Além disso, colocar warps atrás de bloqueios (`collisions === 1`) impede entrar pelas portas visuais, e menus genéricos não atendem ao critério de fidelidade de interface do 3DS.
- **Regra:** Filtrar `sw_parts02..05` na conversão de personagens em [convert_character_glb.py](../scripts/convert_character_glb.py) (mantendo apenas a peça padrão `sw_parts01`), abrir `collisions[z][x] = 0` exatamente nos tiles das portas visuais dos prédios, e só fechar `PRD`/`P-NNN` após validar fidelidade visual com o jogo original.

## A-007 O AD de texturas varia por mapa, e as GRs de interiores não estão nos 30 arquivos extraídos

- **Data:** 2026-11-17
- **Contexto:** `P-007` (placas brancas) e busca por GRs de interiores. Complementa `A-004`.
- **Erro:** (1) Converter qualquer `GR` com um único `--textures` fixo ou sem AD deixa os materiais sem imagem (`references missing texture ...` em `*.dae.warnings.txt`) e o glTF renderiza placas brancas. O AD correto muda por mapa (Littleroot usa `a/0/1/4/0008.bin`, que contém `t101_01`, `chip_wind` etc.). (2) `rom/extracted/garc/a_0_3_9` só tem 30 dos 857 `GR` de `RomFS/a/0/3/9`; todos têm seção 0 de 40x40, então o tamanho do grid não distingue interior de exterior. Falta a tabela zona→`GR` para identificar casa do jogador, laboratório, Centro Pokémon e Mart.
- **Regra:** Use `scripts/convert_gr_to_glb.py --ad-dir <a_0_1_4>`: o script converte uma vez sem texturas, lê os avisos de textura ausente e escolhe o AD que cobre mais nomes. Não associe um índice de `GR` a um interior sem evidência da tabela de zonas; arquivos `*.bin` extraídos com `unpack_garc.py --decompress` ficam em diretório temporário até a identificação.

## A-008 Tabela zona→matriz→GR está em `a/0/1/3` (ZoneData/metlist) e o macOS roda o pipeline

- **Data:** 2026-11-17
- **Contexto:** Necessidade de mapear todas as 536 zonas de Hoenn para seus `GR`s (`A-007`) e portar o pipeline Linux/VPS para macOS arm64.
- **Erro potencial:** Chutar `GR` por índice de zona ou nome (o índice do ZO **não** é o índice do nome); assumir que ferramentas compiladas na VPS funcionam no Mac; Blender ≥ 4 removeu `bpy.ops.wm.collada_import`.
- **Regra:**
  - `a/0/1/3`: entradas `0000–0535` = arquivos `ZO` por zona; `0536.bin` = tabela-mestre `ZoneData` (536 registros × `0x38` bytes, layout igual ao `sec0` de cada ZO — referência: `ZoneData` do pk3DS); `0537.bin` = pacote de encontros (`EN`).
  - `ZoneData`: `MapMatrix` `@0x04` → matriz em `a/0/4/0` cujo grid de `u16` (`EntryList`) indexa direto `a/0/3/9`; `TextFile` `@0x06` → `a/0/8/1`; `ParentMap` `@0x1C & 0x3FF` → metlist `a_0_7_3/0090` (índice 170 = `Littleroot Town`).
  - `scripts/build_zone_catalog.py` gera `src/data/zones.json` com zona → {nome, mapArea, mapMatrix, grIds, textFile}. Interiores são zonas próprias (ex.: zona 223 = casa do jogador → `GR 506`, confirmando a identificação anterior).
  - Ferramentas no Mac: `.NET 8` em `~/.dotnet` (`dotnet-install.sh`, sem sudo — casks exigem `sudo`), Blender **3.4.1** em `~/Applications/Blender3.4.app` (wrapper `_tools/bin/blender`), `SpicaExport` via wrapper `_tools/bin/SpicaExport` (apphost exige `DOTNET_ROOT`), `assimp`/`7z`/`vgmstream` via Homebrew. Scripts aceitam `SPICA_EXPORT` por env var.
  - `ffmpeg` do Homebrew não tem `libvorbis`: usar `libmp3lame` para `.mp3` (ou `aac`). `vgmstream-cli` decodifica `.bcstm` direto.

## A-009 Conteúdo interno do ZO e formato de encontros ORAS (`BBH`, não `HBB`)

- **Data:** 2026-11-17
- **Contexto:** Extração de warps/entidades/encontros por zona ([scripts/extract_zones.py](../scripts/extract_zones.py) → `src/data/zones/*.json`), seguindo `OWSEStructs.cs` do pk3DS.
- **Erro potencial:** Ler entradas de encontro como `<HBB` (specform, lvlMin, lvlMax — layout XY/pk3DS) gera espécies absurdas (ex.: 514 na Route 101).
- **Regra:**
  - `ZO sec1` = `ZoneEntities`: header `u32 length` + `u8` counts (furniture, npcs, warps, triggers1) + `u32` triggers2; depois `EntityFurniture` (0x14), `EntityNPC` (0x30), `EntityWarp` (0x18), `EntityTrigger` (0x18 ×2 grupos) e um blob de script ao final. `EntityWarp.destinationMap` indexa o `ZO`/zona de destino (ex.: zona 6 → interiores 223/225/227).
  - `ZO sec3` = tabela de encontros da zona, **idêntica** ao blob correspondente em `a/0/1/3/0537.bin` (`EN` + 536 ponteiros `u32`).
  - Entrada de encontro ORAS = `<BBH`: `levelMin u8`, `levelMax u8`, `specForm u16` (espécie `&0x7FF`, forma `>>11`). Slots zerados (`species=0`) separam sub-tabelas (grama, surf, pesca etc.) — o particionamento exato por tipo segue a refinar no uso.
  - NPC: `model` = índice em `a/0/2/1`, `script` = índice de script da zona, `sightRange`/`faceDirection`/`degrees` (÷18) permitem linha de visão estilo ORAS.

## A-010 Tabelas de batalha ORAS: personal com SPE antes de SPA/SPD, golpes em mini-pack `WD` e tipos no `DllBattle.cro`

- **Data:** 2026-11-17
- **Contexto:** Extração de personal, golpes, tipos, learnsets e TM/HM para `src/data/battle/` ([battle-tables.md](features/pipeline-rom/battle-tables.md), `P-010`). Numerado `A-010` porque `A-008`/`A-009` já existem no checkout principal.
- **Erro potencial:** (1) Ler os 6 stats como HP/ATK/DEF/SPA/SPD/SPE troca Velocidade com Ataque Especial (Treecko viraria SPA 70). (2) Tratar `a/1/8/9` como um arquivo por golpe (layout XY): no ORAS é um único `WD` mini-pack com 622 entradas. (3) Procurar a tabela de tipos em GARC: ela está em `RomFS/DllBattle.cro @0xDB428`. (4) Ler a lista de TMs do `code.bin` em sequência: HM06 e HM07 ficam intercalados (índices 97 e 106).
- **Regra:** Use [scripts/extract_battle_tables.py](../scripts/extract_battle_tables.py); a ordem dos stats no arquivo é HP, ATK, DEF, SPE, SPA, SPD. Formas alternativas (`personal 722+`) se resolvem pelo `formStatsIndex @0x1C` da espécie base, não pelo índice. Valide sempre contra Treecko (40/45/35/70/65/55) e Mega Sceptile. Só números de mecânica e nomes curtos vão para o Git; textos descritivos ficam fora.

## A-011 Consumo das tabelas de batalha no `core/`: tipos duplicados em monotipos e precisão `101`

- **Data:** 2026-11-17
- **Contexto:** Integração de `src/data/battle/*.json` em [src/core/typeChart.ts](../src/core/typeChart.ts), [dex.ts](../src/core/dex.ts) e [learnsets.ts](../src/core/learnsets.ts), substituindo o `TYPE_CHART` placeholder de `battle.ts`. Complementa `A-010`.
- **Erro potencial:** (1) A ROM grava monotipos com os dois slots iguais (Treecko = `[Grass, Grass]`); multiplicar a efetividade por slot eleva ao quadrado (Fire→Treecko ×4). (2) Golpes que nunca erram têm `accuracy = 101` (ex.: Disarming Voice), não `100`; o placeholder em `data/pokemon/species.ts` divergia e foi corrigido pelo teste de paridade.
- **Regra:** Deduplique os tipos ao montar `DexSpecies` e em `getTypeEffectivenessAgainst`. Trate `accuracy === 101` como acerto garantido ao implementar precisão (`P-010`). Mantenha o teste "placeholder data parity" em `battleData.test.ts`: qualquer valor escrito à mão em `data/pokemon/` precisa bater com a ROM. `types.json` é validado na carga contra a ordem `ELEMENTAL_TYPES`.

## A-012 Campos de efeito ORAS: `healing` com sinal, tóxico via `turnMax`, glifos ♀/♂ privados

- **Data:** 2026-11-17
- **Contexto:** Simulação de PP/precisão/status/efeitos sobre `src/data/battle/moves.json` ([moveExecution.ts](../src/core/moveExecution.ts), [statusConditions.ts](../src/core/statusConditions.ts)) e slugs de espécie em [dex.ts](../src/core/dex.ts). Complementa `A-010`/`A-011`.
- **Erro potencial:** (1) Ler `healing @0x13` sem sinal: Struggle tem `231`, que é `−25` = recuo de 1/4 do HP máximo, não cura. (2) Procurar um id próprio para tóxico: a ROM usa `inflict = 5` (veneno) com `turnMax = 15` (Toxic, Poison Fang); veneno comum tem `turnMax = 0`. (3) Sono usa `turnMin..turnMax = 2..4` como contador de tentativas (1–3 turnos dormindo e age ao acordar). (4) O decodificador de texto descartava `0xE08E`/`0xE08F` (♂/♀), fazendo os dois Nidoran virarem `"Nidoran"` e colidirem no slug.
- **Regra:** Use `DexMove.healPercent` (já convertido para `s8`) e `recoilPercent` com sinal; tóxico = `statusKindForMove`. `decode_gen6_text` mapeia `PRIVATE_GLYPHS`; `dex.ts` aborta a carga se dois slugs de espécie colidirem. Saves sem `stages`/`currentPp` (pré-migração) são rejeitados por `deserializeSave` e o jogo recomeça.

## A-013 XP Gen VI usa fórmula plana; `player`/`enemy` do `BattleState` espelham o time

- **Data:** 2026-11-17
- **Contexto:** Críticos, XP/level-up e batalhas multi-Pokémon ([experience.ts](../src/core/experience.ts), [levelUp.ts](../src/core/levelUp.ts), [battleParty.ts](../src/core/battleParty.ts)). Complementa `A-012`.
- **Erro potencial:** (1) Aplicar a fórmula escalonada da Gen V/VII: a Gen VI usa `floor(a·b·L / (7·s))` (`a = 1.5` treinador, `b = baseExp`, `s` = participantes de pé). (2) A curva `medium_slow` é negativa no nível 1 (`−54`): nível 1 vale sempre 0. (3) Atualizar `state.player` sem atualizar `playerParty[playerActive]` dessincroniza o time (XP, PP e HP somem ao trocar). (4) Sortear crítico dentro de `calculateDamage` muda o consumo de RNG de chamadas que só querem o dano; o sorteio fica em `moveExecution` e o dano recebe `{ critical }`.
- **Regra:** Toda mutação de combatente passa por `withPokemon` (ou `updateActivePlayer` fora do core). `PokemonInstance.totalExp` é a fonte de verdade; `xp`/`nextLevelXp` são só progresso da barra. Saves sem `totalExp` são rejeitados. Estágios de crítico vêm de `DexMove.critStage` (`1` = alta taxa, `6` = Frost Breath/Storm Throw).

## A-014 Gen VI dá XP integral a cada participante; evolução e naturezas na ROM

- **Data:** 2026-11-17
- **Contexto:** IV/EV/natureza, Exp. Share, Lucky Egg e evolução ([statSpread.ts](../src/core/statSpread.ts), [evolution.ts](../src/core/evolution.ts), [battle_progression_parsers.py](../scripts/battle_progression_parsers.py)). **Corrige `A-013`**, que dividia a XP entre participantes.
- **Erro:** `A-013` aplicou `s` = número de participantes (regra Gen I–V). Na Gen VI `s = 1` para quem lutou e `s = 2` para quem não lutou com Exp. Share ligado; não há divisão. Também: (1) natureza multiplicada em ponto flutuante (`0.9 × 50`) pode errar o `floor`; (2) a ROM não tem tabela de modificadores de natureza, só os nomes (`a/0/7/3/0051`); (3) evolução Gen 6 é `8 × 6` bytes por espécie em `a/1/9/2` sem byte de forma (diferente da Gen 7 com 8 bytes).
- **Regra:** `expYield` recebe `participated`/`holdsLuckyEgg`; naturezas usam `applyNature` com décimos inteiros; modificadores vêm da regra `n÷5`/`n mod 5` documentada em `battle-tables.md`. Valide stats contra o exemplo Garchomp Lv.78 Adamant da Bulbapedia (289/278/193/135/171/171). Evolução só é checada para quem subiu de nível na batalha (`BattleState.leveledUp`) e roda ao fechar a batalha. Saves sem `ivs`/`evs`/`nature` são rejeitados.

## A-015 Tabelas de batalha não podem ser resolvidas no import; `public/assets/` é ignorado

- **Data:** 2026-11-17
- **Contexto:** `P-015` / [ADR-004](features/pipeline-rom/adrs/ADR-004-tabelas-de-batalha-sob-demanda.md) e geração de selvagens ([wildPokemon.ts](../src/core/wildPokemon.ts)).
- **Erro potencial:** (1) Mover dados versionados para `public/assets/` os tira do Git (a pasta é ignorada por conter assets da ROM). (2) Qualquer constante de módulo que chame `getSpeciesById`/`getMoveById`/`getTypeMultiplier` (ex.: `STRUGGLE`, `SPECIES = { treecko: ... }`) quebra com "Tabelas de batalha não carregadas" porque roda antes de `loadBattleTables`. (3) `src/data/zones/*.json` só existe no checkout principal (não versionado ainda); importar estaticamente quebraria o build em worktrees.
- **Regra:** Derive índices com `fromTables(build)` e exponha espécies/golpes por getter ou função. Testes dependem de `vitest.config.ts` → `src/core/testing/setupBattleTables.ts`. Zonas entram por `import.meta.glob` (vazio = fallback `MAP_ENCOUNTERS`). Pokémon gerados usam `generatePokemon(species, level, rng)`; `createPokemonInstance` sem opções continua com IV 0 / natureza neutra para fixtures determinísticas.
