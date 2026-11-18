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

## A-016 Scripts ORAS são Pawn/AMX v10 compactado, não scripts NDS

- **Data:** 2026-11-17
- **Contexto:** Investigação de P-013; comparação dos 1.072 scripts das 536 zonas e 85 programas de `a/0/2/9`. Renumerado de `A-010` no merge (colisão com o branch `battle-tables`).
- **Erro potencial:** Tratar o `u32 length` como prefixo externo ao AMX, ler o payload como opcodes `u16`/`u32` sem expansão, chamar todos os dados de movimentos ou copiar os nomes enganosos `PtrOffset`/`PtrCount` do pk3DS.
- **Regra:** O tamanho inclui o próprio campo; `F1E0` é magic AMX de 32 bits, os dois `0A` são versões, `@08=001C` são flags e `@0A=8` é tamanho de registro. Expandir `[cod,size)` em grupos de sete bits, mais significativo primeiro, com sinal no primeiro grupo e wrap `u32`; separar código `[cod,dat)` dos dados `[dat,hea)` na imagem expandida. Preservar identificadores/hash sem inventar nomes de nativas. `ScriptFile @18` não indexa diretamente as 85 entradas de `a/0/2/9` (observado 0–537), e NPC.script não indexa diretamente uma tabela publics que é vazia em todos os scripts de entidades. Formato, offsets, hashes de evidência e limites em [script-format.md](features/pipeline-rom/script-format.md); extrator [extract_zone_scripts.py](../scripts/extract_zone_scripts.py) validado nas 536 zonas, com 10 testes sintéticos novos. P-013 permanece aberta para semântica e runner.

## A-017 IDs de scripts ORAS são valores de dispatch, não índices de função

- **Data:** 2026-11-17
- **Contexto:** Continuação de A-016/P-013 com disassembly de 12 zonas do slice e oito scripts globais referenciados, usando Pawn v10/GF e referências XAMX.
- **Erro potencial:** Associar `npc.script` ao índice de `publics`, escolher a primeira tabela switch, tratar toda coincidência de ID como roteamento provado ou resolver um índice nativo como se fosse opcode sem considerar a tabela local.
- **Regra:** Conferir IDs/counts contra o sec1 original e seguir o main `proc; load.p.pri <variável pública>; switch`. Comparar o ID com valores dos cases e conservar o programa de origem. Saltos são relativos ao opcode, mas deltas de `casetbl` são relativos à célula do valor (default relativo ao count). IDs como 2000/10591 pertencem a cases de globais `a/0/2/9[15]/[47]`, não a índices fora de faixa do script local. Colisões entre sec1/sec2 permanecem explícitas: 108 vínculos únicos e 11 ambíguos no slice. Nomes de nativas são resolvidos por hash GF (`h=h*131 XOR byte`, wrap u32), com evidência ROM ou comunitária; nomes não validam efeitos/assinaturas runtime. [script-disassembly.md](features/pipeline-rom/script-disassembly.md) documenta 204/205 nomes, 71 opcodes e testes; o nome `c34ad2ab`, o roteador runtime e o runner continuam pendentes.

## A-018 Strings C podem compartilhar sufixos; nome resolvido não define ABI

- **Data:** 2026-11-17
- **Contexto:** Geração de 536 zonas e 85 globais; continuação de A-017/P-013 e início do runner puro.
- **Erro:** O regex exigia início de identificador e não encontrava `MdlSetVisible`, cujo hash é `c34ad2ab`, pois o binário contém `BuildMdlSetVisible\0` no mesmo pool. Também seria incorreto aceitar células AMX como argumentos de um contrato local sem resolver tipos, referências e unidades.
- **Regra:** Examinar sufixos terminados em zero e resolver apenas por hash exato, conservando origem, offset e SHA-256; rejeitar colisões no corpus pesquisado. `DllField.cro+1097305` resolve o hash e a fixture sintética falha no resolver anterior. Os 615 nomes usados agora têm evidência local. O runner inicial de [ADR-002](features/core-jogo/adrs/ADR-002-runner-puro-de-chamadas-normalizadas.md) executa chamadas normalizadas, não bytecode/ABI brutos; comandos desconhecidos falham por nome. Warps do sec1 têm destino, não script: representar essa ausência explicitamente. Vínculos devem vir dos ZOs, com JSON externo apenas para metadata/conferência.

## A-019 Disassembly real exige memória/frames e ABI distinta do contrato normalizado

- **Data:** 2026-11-17
- **Contexto:** Continuação de A-018/P-013, testes das zonas 6/223/225/227 e dependências da abertura, decisão ADR-003/core-jogo.
- **Erro reproduzido:** Executar a fixture real pelo contrato anterior trocaria argumentos: `TalkMdlMsg_Seq` usa 19 células, `WarpSetID` uma, `MdlSetGPos` x/y/z/ator. Os inits de 223 e 225 ainda escolhem ramos diferentes por sexo e usam work IDs diferentes; repetir o mesmo cenário deu pausa/posição divergente. Sem memória inicial, seletor e frames, testar um IR reescrito não provaria execução do script extraído.
- **Regra:** Testar o próprio disassembly mais dados iniciais com SHA correspondente, separar cenário de mundo/respostas do host de evidência do emulador e distinguir aridade declarada de ramo executado. Inferências de assinatura ficam documentadas, não viram prova de paridade. Efeitos opacos solicitam completion explícita em vez de retornar sucesso; natives/opcodes desconhecidos falham por nome. Validar região alocada heap/stack e células de entrada (regressões reproduzem gap aceito e NaN convertido silenciosamente em zero). P-013 permanece aberta para host/renderer, concorrência e ABI ACMD/objetos.

## A-020 O “0xef” de motion overworld é o contador GF1, e batalha usa PB

- **Data:** 2026-11-17
- **Contexto:** Investigação de `P-012` no worktree `anim-0xef-re`, base `b060a9b`. Renumerado de `A-010` no merge (colisão com `battle-tables`/`zone-scripts-re`). Inspeção de MM 0314/0315, PB 8 e PK 9 e comparação com os leitores GFL do SPICA.
- **Erro:** Tratar `ef 00 00 00` como assinatura desconhecida ou chamar `GFL2.GFMotionPack`: é N=239 de `GFL.GF1MotionPack`, cujo primeiro ponteiro é esqueleto e os demais são clipes esparsos relativos à base do pack. O wrapper local usava GFL2 e silenciava a exceção, gerando DAE sem canais. Compactar ponteiros não nulos também troca IDs (o segundo clipe presente de Brendan tem índice 2, não 1).
- **Regra:** Usar GF1 e selecionar por `GF1Motion.Index`, aplicando conversão world→local pelo esqueleto BCH. Em `a/0/0/8`, verificar magic dos vizinhos: nas amostras, modelo PC em M, PB em M+5 (batalha `ba*`), PK em M+6 (interações `kw*`); não calcular espécie por `8*dex`. Expressões são BCHs separados de material/visibilidade e não acompanham automaticamente o clipe esquelético em glTF.
- **Evidência:** [Formato, offsets e hashes](features/pipeline-rom/animations-format.md) (`AN-E1`–`AN-E7`); [native_motions.py](../scripts/native_motions.py) exportou Brendan índice 2 e Bulbasaur PB índice 3 para GLB com skin, canais variáveis e accessors finitos. Isso comprova transporte do clipe, não paridade visual; avisos de bones/Blender e lacunas de expressões permanecem registrados em `P-012`.

## A-021 Anexar GF1 ao GLB-base preserva materiais; retarget deve usar os joints da skin

- **Data:** 2026-11-17
- **Contexto:** Continuação de `P-012` e `A-020`, integrando clipes aos modelos já convertidos sem perder PT/texturas nem o filtro `sw_parts`.
- **Erro:** Procurar alvos por nome global rejeitou Treecko: tanto o joint quanto um nó de modelo se chamam `pm0252_00`. Usar índices numéricos entre dois exports também pode animar o nó errado.
- **Regra:** Resolver nomes somente em `skin.joints` e conferir inverse bind matrices antes do merge. Copiar apenas accessors/bufferViews de animação, mantendo o BIN original como prefixo e todos os materiais, imagens, meshes e skin do GLB-base inalterados. Falhar em rigs incompatíveis; não aplicar retargeting aproximado ou fallback procedural silencioso.
- **Evidência:** [glb_native_clips.py](../scripts/glb_native_clips.py), [wrapper serial](../scripts/attach_native_motions.py) e [regressão sintética](../scripts/test_glb_native_clips.py), incluindo o caso joint/nó com nome duplicado que falhou antes da correção.
- **Correção de identificação:** Os rótulos iniciais Brendan/May nas notas de `A-020` foram invertidos: o pipeline `convert_character_glb.py` usa `0315=Brendan` (`rstr0002_00_fi`) e `0314=May` (`rstr0001_00_fi`). A estrutura, offsets e clipes medidos continuam válidos por ID de arquivo, não por esses rótulos.

## A-022 A tabela do slot 0 relaciona espécie a modelo; o tag interno não é sempre o número da Pokédex

- **Data:** 2026-11-17
- **Contexto:** Cobertura ampla de `P-012`: 544 diretórios `mm_NNNN` e espécies dos encontros das zonas 6, 7 e 23–30, mais starters/evoluções e lendários de capa.
- **Erro potencial:** Procurar sempre `pm{species:04d}_00` perde formas e espécies da geração 6: espécie 422 usa primeiro modelo `pm0422_11`, espécie 650 corresponde a `pm0720_00` e 692 a `pm0756_00`. O registro de encontros com espécie 0 é delimitador/slot vazio, não um alvo de conversão.
- **Regra:** No GARC `a/0/0/8`, ler o slot 0: registro `<HBB` em `4*(species-1)` contém primeiro ordinal de modelo, quantidade e flags. Para variante ordinal `v`, PC=`3+8*(first+v)` e PB=`PC+5`; validar signatures PC/PB e ler o tag real do BCH para localizar o GLB-base. Não inferir a espécie pelo tag nem atribuir significado não validado às flags.
- **Evidência:** [Gerador](../scripts/build_native_manifest.py), [manifesto de cobertura](features/pipeline-rom/native-models-manifest.json) e testes sintéticos; Treecko: registro `349,1,1` → PC 2795/PB 2800; espécie 692: `969,1,1` → PC 7755/PB 7760 → tag `pm0756_00`. A fórmula foi conferida nas assinaturas/tags dos 41 modelos Pokémon selecionados.
- **Limite:** Nem todo `mm_NNNN` é um ator animável: 177 não possuem seção de motion e 9 só possuem poses de um frame. A existência de um pack GF1 também não prova que o modelo BCH exportado possui armature; o lote registra a falha em vez de fabricar movimento. Merge binário é leve, mas o attach atual ainda exporta SPICA/Blender por clipe; limitar concorrência e manter logs individuais.

## A-023 BGM da zona é um índice indireto: ZoneData `@0x08` → tabela do `code.bin` → BCSAR

- **Data:** 2026-11-17
- **Contexto:** Mapeamento zona → trilha para `P-008` ([audio-format.md](features/pipeline-rom/audio-format.md), [extract_zone_audio.py](../scripts/extract_zone_audio.py)).
- **Erro potencial:** (1) Tratar o byte `@0x25` do ZoneData como música: vale `0x6C` em todas as zonas externas e `0x48` em interiores, então não distingue Littleroot de Route 101. (2) Usar `u16 @0x08` direto como índice de som do BCSAR: Littleroot (`5`) cairia em `STRM_BGM_STARTING2`. (3) Confiar nos nomes de campo do pk3DS (XY): no ORAS só `BGMSpring @0x08` varia; os outros três "BGM de estação" são constantes.
- **Regra:** `u16 @0x08` indexa a tabela de 216 `u32` (`0x01000000 | som`) que fica logo após `rom:/sound/sango_sound.bcsar` no `code.bin`; o som resolve rótulo (STRG) e arquivo externo (INFO `0x2106`, ref `0x220D`) no BCSAR. Valide sempre com Littleroot → `bgm_sg_t_01`, Lab do Birch → `bgm_sg_labo`, Centro Pokémon de Oldale → `bgm_sg_pokecen` e Route 101 → `bgm_sg_r_a`.
## A-024 MapArea não indexa a sec1 MM; warps e NPCs usam escalas distintas

- **Data:** 2026-11-17
- **Contexto:** Fases 1–2, geração de mapas por zona, [maps-format.md](features/pipeline-rom/maps-format.md), pipeline-rom/PRD-003/ADR-005. Renumerado de `A-023` no merge (colisão com `audio-zones`).
- **Erro reproduzido:** Ler apenas o primeiro grid MM perde zoneIds e array auxiliar; usar mapArea como índice de retângulo falha em MM1/mapArea8 (três registros) e MM164/mapArea112 (um). O leitor experimental do pk3DS também desloca a sec1, tratando count como Direction; a primeira implementação baseada nessa referência passou na fixture inicial, mas falhou no corpus quando havia outro registro após um flag zero. Nova regressão sintética com dois registros expõe esse erro antes da correção.
- **Regra:** MM usa count+1 ponteiros (o último é fim, não sec2); variante1 contém GR grid WH, zone grid 4W×4H e auxiliar WH. Recortar pelo zoneId em células de 10×10 tiles, compondo GRs de 40×40; campos desconhecidos ficam preservados. Sec1 é count seguido de até 16 slots `<4f,u32>`, sem terminador por flag. Warps são centros mundiais (911/911 têm resto9 em ambos os eixos): floor(world/18) menos origem local. NPCs já são tiles e só subtraem origem. Não forçar coordenadas off-map para esconder anomalias.
- **Evidência:** 431 matrizes validadas; 536 mapas, 911 destinos resolvidos, dez referências/16.000 tiles por camada sem diferenças. 13 testes sintéticos novos; 107 Python/134 Vitest/build passaram. Spawn fallback marcado `spawnDerived=true`; init/save definem spawn canônico. Flags sec1/grade auxiliar, anomalias e integração seguem em P-017, conforme escopo aprovado.

## A-025 Integrar zonas exige cache de destino, chunks locais e saves isolados

- **Data:** 2026-11-17
- **Contexto:** Fase 2, engine-3d/PRD-005/ADR-003 e P-017.
- **Erro reproduzido:** O core só comparava a âncora do warp depois da colisão, impedindo entrar pela segunda linha de um retângulo ou por portas bloqueadas no GR. Reusar o save v1 também faria o bootstrap de zonas novas continuar num mapa manual antigo.
- **Regra:** Resolver JSON do destino antes da transição, mantendo estado anterior em falhas e removendo promises rejeitadas do cache; detectar entrada no retângulo sem rebater dentro da região de chegada. Posicionar cada GR de 40 tiles por seu offset+19.5, não pelo centro da zona inteira. Isolar namespace v2 do save legacy, sem apagar dados antigos. Copiar apenas slice e destinos diretos; atores flat precisam de imagens embutidas para não compartilhar nomes de textura.
- **Evidência:** 150 Vitest/113 Python; smoke visível com assets reais verificou 6→223→6, posição (15,18)/direção up, apenas JSONs 0006/0223 e nenhum pageerror. Assets locais: 25 GRs e 42 atores; 15 IDs sem asset mm correspondente usam fallback sem mascarar bits. Fade genérico, flags/scripts, bordas contínuas e paridade seguem explicitamente pendentes.

## A-026 assimp v6 grava texCoord com o set COLLADA esparso; o atributo UV é compactado

- **Data:** 2026-11-17
- **Contexto:** Regressão visual após integração maps_v2 (P-017): Littleroot renderizava casas marrons/chão verde plano e `THREE.WebGLProgram` falhava com `'uv4' : undeclared identifier`.
- **Erro reproduzido:** SpicaExport emite `<input semantic="TEXCOORD" set="3|4">` (sets esparsos do PICA200, fontes `*_mapped_uv*_id`). O assimp v6 compacta os atributos para `TEXCOORD_0..k` mas escreve `baseColorTexture.texCoord` com o número de set original. O three.js (GLTFLoader, r150+) usa `texCoord` como `texture.channel`: canal 3 sem atributo `uv3` amostra um único texel (cores planas); canal 4 não compila o vertex shader e a mesh some. Os `.glb` legados (assimp v5.2.0) não trazem `texCoord` e renderizam corretamente.
- **Regra:** Após `assimp export`, remapear todo `texture.texCoord` ≥ quantidade de conjuntos `TEXCOORD_n` das primitivas do material para o maior canal válido (`valid-1`): no DAE, `<bind_vertex_input semantic="UV0" input_set="3">` liga a textura aos UVs `mapped_*`, que o assimp exporta no último slot compactado — confirmado por screenshot A/B (canal 1 restaura as texturas; canal 0 também texturiza mas usa o conjunto cru). Se só houver `TEXCOORD_0`, remapear para 0. Implementado em [glb_uv_fix.py](../scripts/glb_uv_fix.py) e chamado no fim de `convert_gr_to_glb`; validação independente em [validate_glb.py](../scripts/validate_glb.py).
- **Evidência:** `gr_0006.glb`: 12 materiais com `texCoord=3` e 1 com `texCoord=4`, primitivas só com `TEXCOORD_0/1`; após o remap, zero erros de shader e texturas corretas em screenshot. `validate_glb.py` em `rom/extracted/models/gr_*/`: 831/846 arquivos inválidos (11.972 violações) — reconversão/correção em lote em `P-018`. Testes sintéticos em [test_glb_uv_fix.py](../scripts/test_glb_uv_fix.py).

## A-027 Faixas de batalha vêm dos rótulos do BCSAR; WIN1–3 por tipo é inferência

- **Data:** 2026-11-17
- **Contexto:** Música de batalha, fanfarra e jingles para `P-008` ([battleAudio.ts](../src/core/battleAudio.ts), [audio-format.md](features/pipeline-rom/audio-format.md)). Complementa `A-023`.
- **Erro potencial:** (1) Usar os `STRM_BGM_VS_*` sem sufixo `_SG`: são resquícios do XY e todos apontam para `bgm_xy_vs_trainer_pss`. (2) Tratar `WIN1/WIN2/WIN3` como vitória selvagem/treinador/ginásio como fato lido da ROM: é a ordem dos rótulos, sem tabela que confirme. (3) Validar áudio só por teste unitário: o `AudioContext` só existe em browser e exige gesto do usuário.
- **Regra:** Use apenas `STRM_BGM_VS_*_SG` e `STRM_ME_*` (sons 100–124 e 211+). Para validar no browser, rode o dev server no worktree com `public/` do checkout principal (symlink temporário), injete um save via `import('/src/core/battlePokemon.ts')` no Playwright e verifique `document.body.dataset.bgm`, as requisições `/assets/audio/*.mp3` e o console. Confirmar WIN1–3 contra o jogo original antes de tratar como regra fechada.

## A-028 Contato de zone-grid não resolve ligações entre matrizes

- **Data:** 2026-11-17
- **Contexto:** Corredor contínuo, engine-3d/PRD-006/ADR-004, P-017. Renumerado de `A-027` no merge (colisão com `audio-zones`).
- **Erro reproduzido:** Comparar retângulos entre MM1 e MM2 inventa contatos: 6/23/7/25 estão na MM1 e 13/24 na MM2. Alinhar cegamente Oldale e Route102 pela largura também deixa duas colunas GR bloqueadas no caminho.
- **Regra:** Derivar contatos intra-MM dos owners ortogonais e spans de 10 tiles. Ligações externas devem ter proveniência explícita: a ponte 7↔24 aprovada é inferred=true, com colunas caminháveis 1/78 e offset78; grids originais não são alterados. Coordenadas locais são convertidas a um referencial mundial estável para a câmera/chunks, sem fade nem limpeza de cena a cada troca de zona.
- **Evidência:** Grafo de 58 zonas/90 bordas; regressões com passo mundial unitário e seleção de encontros por ID exato. 159 Vitest e build passaram; stage de 35 GRs/51 atores com UV fix antes da cópia. Validação Playwright na main ainda pendente nesta etapa.

## A-029 Disassembly completo não implica memória/serviços completos no host

- **Data:** 2026-11-17
- **Contexto:** Fase 2/P-013, integração `events-layer`, [ADR-004](features/core-jogo/adrs/ADR-004-host-conservador-de-eventos.md). Renumerado de `A-027` no merge (colisão com `audio-zones`).
- **Erro reproduzido:** O core permitia ocupar o tile de um NPC; regressão sintética recebeu `true` em vez de `false` antes da correção. No browser, assumir que NPC 0 de Littleroot falaria sobre ciência também falhou: script 14, no cenário corrente, escolhe a linha 6 sobre o resgate. Init de zona 6 para em `BuildMdlGetHandleByGPos`; diálogo pede ACMD/olhar antes do texto.
- **Regra:** Resolver vínculo único e SHA da imagem; não zerar memória de programas sem fixture nem tratar o nome de uma nativa como prova de sua ABI. Só existem 19 imagens iniciais validadas nesta etapa. Responder efeitos cosméticos apenas pela política explícita aprovada: Enter confirma stub visível (ACMD Update=1, setters=0), sem declarar execução. Não inferir GameText/MsgLoad ou zona/warp dos nove argumentos de _MapChangeCore; ampliar por evidência de programa/zona. Manter ausência de imagem, ambiguidade e erro de execução distintos de diálogo ROM.
- **Evidência:** Dez testes sintéticos novos, 160 Vitest/25 arquivos e build passaram. Playwright visível percorreu o mapa por teclado até (24,20)/up e exibiu o texto ROM de script 14/linha 6 após cinco confirmações; zero pageerror, screenshots `/tmp/events-layer-before-npc.png` e `/tmp/events-layer-rom-dialogue.png` inspecionados. Isso não prova spawn canônico, rota da história ou paridade gráfica; GameText, warp AMX, save/party/bag e expansão da memória permanecem em P-013.

## A-030 Animação deve consumir os eventos resolvidos antes de trocar o estado visual

- **Data:** 2026-11-17
- **Contexto:** Fase 2/P-012, [PRD-007](features/engine-3d/prds/PRD-007-animacoes-nativas-no-runtime.md).
- **Erro reproduzido:** O runtime não selecionava golpes/dano/queda a partir da resolução real. Um teste adicional encontrou peso zero no primeiro `idle`: fazer fade-in ao carregar expunha a bind pose antes da pose animada. A promoção também aceitava NaN antes da regressão de floats.
- **Regra:** Emitir eventos imutáveis no core, sem Three.js; o renderer escolhe a ação pela categoria e aguarda `finished`, não um timeout inventado. Aplicar o idle inicial com peso integral, segurar a pose final de faint e invalidar carregamentos/callbacks ao trocar a cena. Publicar cópias por hash e rejeitar accessors não finitos. Modelos sem clipe nativo preservam o GLB-base e uma razão explícita, sem retirar a espécie dos encontros nem inventar clipes.
- **Evidência:** [battleEvents.test.ts](../src/core/battleEvents.test.ts), [nativeAnimation.test.ts](../src/engine/nativeAnimation.test.ts), [nativeAssets.test.ts](../src/engine/nativeAssets.test.ts), [test_native_assets.py](../scripts/test_native_assets.py); catálogo de 102 modelos, 96 nativos e seis fallbacks. Após atualizar com main 6ae4d58, 185 Vitest e build passaram; validação visual na main ainda pendente.

## A-031 Um texCoord válido não comprova a célula correta do atlas

- **Data:** 2026-11-17
- **Contexto:** Investigação P-019 sobre os personagens promovidos ao runtime.
- **Erro potencial:** Aplicar a correção de canais esparsos de P-018 a uma face que já referencia o canal 0, ou deslocar UVs para ocultar o defeito sem provar a expressão correta.
- **Regra:** Comparar os valores dos sets, não apenas seus índices. Nos 61 GLBs auditados, os pares UV0/UV1 são idênticos e não há referência inválida; trocar 0 por 1 não muda o atlas. A seleção de célula/expressão permanece em aberto, separada do transporte esquelético e dos BCHs de material/visibilidade não exportados. Pés ausentes nos GLBs-base são limitação de geometria, não algo recuperável por alphaTest ou animação.
- **Evidência:** [audit_character_uv.py](../scripts/audit_character_uv.py) e [relatório por SHA-256](features/pipeline-rom/native-uv-audit.json); faces MM0315/MM0314/MM0180 comparadas, sem alterar `glb_uv_fix.py`. A regressão sintética confirma que sets iguais e um canal válido não exigem remap.

## A-032 Atualizar com main também exige reconciliar staging e caches derivados

- **Data:** 2026-11-17
- **Contexto:** Ampliação da promoção nativa após integrar main 6ae4d58.
- **Erro reproduzido:** O seletor omitia MM0179 já staged no principal; o plano também marcava uma pose existente como `ready`, embora o runner corretamente se recuse a sobrescrevê-la. Dois testes falharam com esses casos antes da correção.
- **Regra:** Unir atores das zonas/aliases aos MM canônicos já staged, recalcular os frames do índice selecionado e só reutilizar poses existentes após validar estrutura, prefixo-base, skin, canais e tempos. Não tratar mera existência como cache válido nem remover a proteção contra sobrescrita.
- **Evidência:** [test_native_assets.py](../scripts/test_native_assets.py): sete testes passaram após o fix; suíte Python completa com 129 testes e um skip por assets públicos ausentes no worktree. O plano verificou as 38 poses anteriores e as 18 novas, totalizando 56; catálogo final com 102 modelos e 61 personagens auditados. Assets permanecem ignorados no principal.

## A-033 Recorte legado pode apagar geometria presente em GLBs OPAQUE

- **Data:** 2026-11-17
- **Contexto:** Playwright visível na main 8cb61de, Route 101, Torchic contra Zigzagoon (P-012/P-007).
- **Erro reproduzido:** O ataque nativo alterou 45 ossos, mas partes dos corpos não apareciam. Parar todos os mixers manteve os buracos, descartando a animação como causa suficiente. Os materiais publicados eram `OPAQUE`; o renderer os convertia para `alphaTest=0,45` pela heurística sem `extras.pica`. O teste sintético recebeu 0,45 quando esperava 0 antes do fix.
- **Regra:** Pokémon preservam os estados alpha carregados pelo GLTFLoader mesmo sem metadado PICA: OPAQUE permanece sem recorte, MASK mantém seu cutoff e BLEND desliga depthWrite. Não zerar alpha indiscriminadamente nem alterar a heurística dos mapas/personagens. Geometria invisível não comprova geometria ausente; isolar material e mixer antes de atribuir o defeito ao rig.
- **Evidência:** [fixOrasMaterials.test.ts](../src/engine/fixOrasMaterials.test.ts), 186 Vitest/34 arquivos e build passaram. Comparações locais em `rom/native_runtime_validation/rest_probe/` no principal: bind-rest ainda incompleto e retirada diagnóstica do recorte recuperando os corpos. Cores/combiners/atlas dos olhos continuam em P-007/P-019; não há paridade visual declarada. Revalidação da correção integrada na main ainda pendente.

## A-034 Handle de construção pode ser uma coordenada empacotada

- **Data:** 2026-11-17.
- **Contexto:** P-013, continuação de A-029 e core-jogo/ADR-005.
- **Erro reproduzido:** Tratar `BuildMdlGetHandleByGPos` como query de cena fazia a VM pedir um efeito externo, interrompendo init de Littleroot.
- **Regra:** Seguir relocations do registro nativo até o wrapper, não deduzir semântica pelo nome. Em `DllField.cro/0x50718`, LDRD/ADD/BX calculam `(x << 16) + z` em 32 bits. Overflow e valores negativos fazem parte da operação.
- **Evidência:** Três regressões signed-32 falharam antes do fix; init real passou a alcançar `BuildMdlEventAnimeSetEnd`. Offsets/SHA e reprodução em [ADR-005](features/core-jogo/adrs/ADR-005-abi-cro-e-init-nao-bloqueante.md).

## A-035 MsgLoad usa namespace e seletor, não índice GameText direto

- **Data:** 2026-11-17.
- **Contexto:** Bancos auxiliares de mensagem, P-013.
- **Erro potencial:** Interpretar a segunda célula como arquivo ou mudar a aridade de MsgIsLoaded porque o wrapper ignora o argumento passado pela ROM.
- **Regra:** Conferir tabelas por idioma e jump table: primeira célula não zero seleciona StoryText; zero seleciona GameText. A segunda escolhe um dos 25 seletores do manifesto; 17 é inválido. `TalkMdlMsg_Seq.args[17]` escolhe o slot auxiliar, não o texto da zona. Preservar swap/release e aridade observada nos scripts.
- **Evidência:** Parser CRO com fixtures de imediato/literal; manifesto com SHA/offsets; três testes sintéticos de slots/bancos. Não equivale a um fluxo auxiliar completo validado no emulador.

## A-036 Pausa da VM não pode se tornar diálogo nem substituir chegada do core

- **Data:** 2026-11-17.
- **Contexto:** Regressão de navegação 7→24; atualiza a apresentação de stubs descrita em A-029/ADR-004.
- **Erro reproduzido:** Diagnóstico em `activeDialogue` bloqueava input; init projetava player em `(78,22)` quando o estado de chegada devia continuar autoritativo. Uma pausa opaca do init também impedia iniciar NPC.
- **Regra:** Diagnosticar no console/estado pendente, sem textbox; query sem retorno validado não recebe completion. Preservar player de spawn/borda, projetando apenas NPCs; guardar init opaco durante interação e restaurá-lo com o mundo mais recente. Classificar borda pelo passo/destino, não pela ausência de warp: o portal 7→24 possui ambos. Separar `romOrigin` de `worldOrigin`.
- **Evidência:** Regressões determinísticas de posição/direção, query sem retorno e init/NPC falharam antes do fix. Chromium preservou `(79,20)/right` e caminhou a `(78,20)/left`, com memória real adicional de 7/24, sem textbox de diagnóstico.

## A-037 Novos bancos e memória extraídos são assets locais, não fixtures versionadas

- **Data:** 2026-11-17.
- **Contexto:** StoryText auxiliar e expansão incremental além das 19 imagens legadas; P-013/ADR-005.
- **Erro evitado:** Deixar 23 bancos reais novos em `src/data/texts/story` os tornaria elegíveis a staging e ao bundle via glob.
- **Regra:** Confirmar `git check-ignore -v` antes da geração; gravar em `public/assets/texts/story` e `public/assets/native/amx`. Versionar somente extratores, manifestos de identidade/SHA, adaptadores e testes sintéticos. Fetch lazy compartilha cache em voo, rejeita HTTP/JSON/SHA inválido e remove a falha para permitir retry; nunca fornece memória zerada.
- **Evidência:** Dois destinos confirmados por `.gitignore:18`; 23 bancos e quatro imagens (7/24 entities/map) somente locais, total de 23 imagens disponíveis. Seis testes Vitest de loaders e dois Python do manifesto/guarda de SHA passam.

## A-038 Smoke do host não comprova ramo de história da ROM

- **Data:** 2026-11-17.
- **Contexto:** Aceite de mensagens/warp no navegador, P-013.
- **Erro potencial:** Confundir warp de navegação com `_MapChangeCore`, ou chamar uma fixture sintética de cutscene real. `networkidle` antigo também permitia enviar seta enquanto os imports lazy pós-transição ainda carregavam.
- **Regra:** Distinguir evidências: texto do NPC veio do AMX real; o warp do smoke veio de nove células sintéticas executadas pela VM e engine reais. Aguardar explicitamente programas/textos do destino antes da próxima tecla. Manter as lacunas naturais da ROM documentadas, sem respostas inventadas para `float`, queries de atores ou globais ausentes.
- **Evidência:** Fixture do Playwright chamou `_MapChangeCore(225,7,0,18,1,0,0,0,0)` e mudou a zona/posição renderizada. Três screenshots inspecionados, zero pageerror; 195 Vitest e build passam. Paridade/cutscene completa continua em P-013.

## A-039 Capturar movimento, política de material e limite visual separadamente

- **Data:** 2026-11-17
- **Contexto:** Fechamento da validação de adoção nativa na main ac4054d, após A-033. Renumerado de `A-034` no merge (colisão com `events-layer`).
- **Regra:** Observar clipe/tempo/ossos sem substituir animações ou relógio; conferir materiais e inspecionar imagens, não apenas requisições HTTP. Passar no transporte nativo não comprova paridade de texturas, combiners, expressões, escala ou timing de impacto.
- **Evidência:** Playwright visível/Chromium 149.0.7827.55 em porta 5187, save isolado/seed 7 na Route 101 (zone_0023, 13,4): Torchic Lv5 contra Zigzagoon Lv2, Scratch → damage → Growl/special, Ember → damage → faint. Physical de 2,4 s/228 canais, 45 ossos alterados entre amostras t≈0,367 e 1,082 s; idle retomado e faint mantido. Zero pageerror, console error, warning ou HTTP>=400; OPAQUE permaneceu alphaTest=0 e os corpos reapareceram sem intervenção diagnóstica de material. Seis PNGs inspecionados e report.json ignorados em `rom/native_runtime_validation/final/` do principal; observador em `/tmp/playwright-test-native-battle.js`.
- **Limite:** Cores/atlas dos olhos Pokémon e texturas do overworld ainda são visualmente incorretos (P-007/P-017/P-019); o teste não é uma comparação com emulador. O recorte indevido de A-033 está corrigido/revalidado, mas a fidelidade completa não foi declarada.

## A-040 Ponte inferida deve substituir o warp da mesma conexão

- **Data:** 2026-11-17.
- **Contexto:** PRD-006/ADR-004, caminhada de borda em f4eaffa. Renumerado de `A-039` no merge (colisão com `anim-0xef-re`).
- **Erro reproduzido:** Oldale (1,22)/left entrava no retângulo ZO antes de consultar a ponte, chegando a Route102 (79,20)/right. O teste antigo na linha21 só conferia distância Manhattan=1: a posição errada ainda satisfazia essa distância, mas mudava no eixo errado.
- **Regra:** Uma ponte inferred=true suprime somente o warp que coincide com seu span/direção e destino. `stepWarp` centraliza essa escolha para core, preload, razão de entrada AMX e fade; outros warps/portas continuam prioritários. Conferir posição, vetor mundial e facing, inclusive nos extremos do retângulo.
- **Evidência:** O teste da linha22 falhou com distância2 antes da correção; agora preserva (78,22)/left e o vetor(-1,0). Casos sintéticos garantem que borda não inferida ou warp para outro destino não são suprimidos. A confirmação Playwright na main aguarda integrar esta correção.

## A-041 Canal UV existente ainda pode distorcer a textura difusa PICA

- **Data:** 2026-11-17.
- **Contexto:** Revisão da política de A-026 por validação visual de PRD-006. Renumerado de `A-040` no merge (colisão com `anim-0xef-re`).
- **Erro reproduzido:** O remap para o último canal válido tirava o erro de shader, mas UV1 distorcia grama, placas e telhados. A/B do mesmo GLB na main (`/tmp/uv-channel-original.png` e `/tmp/uv-channel-zero.png`) confirmou TEXCOORD_0 correto para a textura difusa; o DAE tem sets0/3 e o assimp compacta para0/1, mas isso sozinho não prova o mapeamento semanticamente correto.
- **Regra:** Para materiais explicitamente marcados extras.pica=true, usar UV0 em baseColorTexture, migrando também arquivos antes corrigidos para1. Não modificar UVs válidos de materiais genéricos nem outros mapas do material. O staging normaliza origem e destino antes de comparar, sem substituir silenciosamente um GLB de conteúdo diferente. Validar imagem, não apenas índices/shaders.
- **Evidência:** Regressão sintética falhou com [1,1,1] onde se espera [0,0,0]; agora passa e preserva normalTexture no UV1 e idempotência. Apenas 35 GRs do slice/destinos foram reestagiados, sem conversores. No harness usar PRNG com valores distintos: fixar Math.random em uma constante também faz UUIDs de Three.js colidirem e falseia texturas.

## A-042 Âncora de warp bloqueada não é limite de borda transitável

- **Data:** 2026-11-17.
- **Contexto:** PRD-008, Petalburg13→Route104 sul27→Woods82→Route104 norte26→Rustboro16. Zona25 é Route103.
- **Erro reproduzido:** Sem ponte13↔27, o passo left de(1,48) acionava o ZO, perdia a lane e chegava a(77,46)/right, tile bloqueado do destino. Padding da Route104 ocupa77..79, diferente do padding simples de A-040; subtrair sempre uma coluna seria incorreto.
- **Regra:** Confirmar IDs e ZOs recíprocos antes de unir matrizes. A ponte explicitamente inferida usa extremos realmente transitáveis:13(1,z)↔27(76,z), z46..50, offset76. Preservar colisões e testar ida/retorno, vetor e saída do portal. Manter os dois portais reais da floresta e o contato automático26↔16 na MM4. SpawnFlag não autoriza ocultar ator: isWalkable respeita visible e a VM decide projeção; NPC visível continua bloqueando a chegada.
- **Evidência:** Regressão Vitest falhou porque stepWarp devolvia o portal em vez de undefined; fixture Python falhou pela ausência da ponte. Ambas passam após estender somente a allowlist de pares inferidos. BFS determinística percorre todo o corredor com os NPCs extraídos intactos; fixtures não dependem de binários da ROM. Encaixe entre MM2/MM3 permanece inferência, não descoberta de coordenadas nativas.

## A-043 Staging do corredor também precisa dos vizinhos visuais imediatos

- **Data:** 2026-11-17.
- **Contexto:** PRD-008 e renderer de chunks persistentes.
- **Erro potencial:** Copiar apenas raízes e destinos de warp deixa sem GLB os chunks que o renderer já compõe de Route105/115/116 ao abrir27/16. Percorrer vizinhos recursivamente, por outro lado, copiaria o mundo todo.
- **Regra:** --zones escolhe raízes; --include-neighbors acrescenta só um salto do grafo dessas raízes, além dos destinos ZO diretos. Não expandir novamente a partir do resultado. Validar assets e manter os IDs especiais em fallback, sem inventar máscaras de bits.
- **Evidência:** Fixture de seleção falhou com a API anterior e agora seleciona6/7/223 sem alcançar o vizinho8 de7. O plano13/27/82/26/16 selecionou29 zonas/53 GRs/57 atores, seis IDs especiais sem modelo; public acumulado validou74 GRs e68 atores com zero violações texCoord. Playwright permanece aceite separado.

## A-044 UV0 e UV1 idênticos não descartam inversão de V

- **Data:** 2026-11-17.
- **Contexto:** P-019, continuação da auditoria A-031 sobre main 942fdb3, atualizada para 61fd0c6 antes do fechamento. A-040/A-041 foram preservados da main. Renumerado de `A-042` no merge (colisão com `zone-maps`).
- **Erro reproduzido:** O rosto de Brendan estava inteiro invertido, não apenas com olhos fechados. O BCH contém V=0,507449–0,995244; o GLB contém 1−V, mas a imagem RGBA é idêntica à original. Os dois canais exportados sofreram a mesma inversão, logo trocar o índice não ajuda.
- **Regra:** Comparar valores e orientação com o BCH e a imagem, não somente índices. Restaurar V apenas com material/transformação e SHA de fonte comprovados; clonar accessors compartilhados, preservar BIN-base/skin/clipes e publicar nova URL imutável. Não aplicar flip global nem deslocamento arbitrário de meia célula.
- **Evidência:** [Levantamento](features/pipeline-rom/character-face-evidence.json) de 61 MM encontrou 12 paletas no canal examinado; cinco casos de 70 frames foram normalizados: 0180/0181/0212/0314/0315. Fixture determinística falhou com V=0,125 em vez de 0,875 no comportamento legado de cópia; seis regressões passam com a correção. Imagens, samplers, materiais, nodes, skins, animações e prefixo BIN permanecem idênticos nos cinco GLBs; 97/102 entradas do catálogo não mudaram. Playwright A/B carregou os assets novos de Brendan/May/Wally: seis capturas inspecionadas, rosto orientado e olhos abertos, zero pageerror/HTTP>=400. [Relatório](features/pipeline-rom/face-expressions.md).
- **Limite:** A correção é de orientação-base, não reprodução de expressões, wrap/combiners, piscada ou paridade com emulador. Pés ausentes continuam limitação do asset, sem malha inventada.

## A-045 TexCoord de material e nativa Eye não identificam sozinhos um canal UV

- **Data:** 2026-11-17.
- **Contexto:** P-019, CRO/expressões BCH. Renumerado de `A-043` no merge (colisão com `zone-maps`).
- **Regra:** Separar slot do transform de textura, fonte de coordenadas e stream glTF. Nos cinco casos suportados, MaterialTexCoord1Trans usa TextureSources[1]=0. O switch estático chamado por ChangeFace recebe expressão uint8 e escolhe floats 0,10,…,70, correspondentes às posições da paleta; isso não prova uma animação contínua de piscar. TalkMdlSetEye resolve dois atores e um modo, não é evidência de seleção de célula. Visibilidade de ator/mesh não cria topologia.
- **Evidência:** DllField.cro/ChangeFace em 0x51ac0 → stub 0x28f8 → import anônimo |static|/0x2f80e8; switch virtual 0x3f80e8 e constantes em 0x3f81a0. Nos MM0314/0315/0180, seção 2 contém material eye01 de 70 frames e nenhum clip de visibilidade. SHA/offsets, leitor SPICA e distinção observado/derivado estão no [relatório](features/pipeline-rom/face-expressions.md).
- **Limite:** O nome/protótipo do stub final 0x19c7a8 e a ligação completa ao estado de expressão do ator não foram recuperados. Ausência do elemento examinado em outros MM não prova ausência de expressões; grupos PB/PK de Pokémon são outro layout.

## A-046 HTTP200 do Vite não garante que o asset de áudio exista

- **Data:** 2026-11-17.
- **Contexto:** Playwright do PRD-008 na main b5e3efc chegou a Rustboro em306 passos, mas gerou erros repetidos Unable to decode audio data. Renumerado de `A-044` no merge (colisão com `anim-0xef-re`).
- **Erro reproduzido:** zone_audio.hasMp3 refere-se à extração local, não ao public. As BGMs r_b/d_01/c_02 existiam em rom/extracted/audio/mp3, mas faltavam no staging; o fallback SPA devolvia HTML200, sem HTTP404 e sem consoleErrors, enquanto pageErrors acumulava falhas do decoder. Auditar apenas status HTTP ou console não detectaria o defeito.
- **Regra:** Ao expandir o slice, copiar também as BGMs nativas das raízes usando --audio-dir. Não inventar música, silenciar rejeições ou falsificar hasMp3. Conferir pageerror e decodificação além da presença/HTTP; um asset200 ainda pode ser HTML. Melhorias genéricas de fallback/erros do player fora das zonas staged permanecem no escopo P-008.
- **Evidência:** Fixture sintética falhou antes de stage_audio e agora garante seleção por zona, sem copiar faixa de raiz não solicitada. Os três MP3s reais foram staged com write_new idempotente; repetição completa dos306 passos encerrou com consoleErrors=[], pageErrors=[], missing=[], sem interceptar áudio. 215 Vitest/139 Python sem skips/build passaram; oito capturas locais e encontros das cinco zonas foram conferidos, com limitações visuais e de história preservadas.

## A-047 Um stub do executável pode importar de volta o CRO

- **Data:** 2026-11-18.
- **Contexto:** P-019/PRD-009, continuação sobre 4f42e54 de A-045. Renumerado de `A-046` no merge (colisão com `zone-maps`).
- **Descoberta:** O literal static.crs/0x19c7ac importa DllField,
  segmento0/offset0x38838, que vira arquivo0x389b8 ao somar a base0x180.
  Esse setter usa objeto de estado+0x1fc, slot virtual0xcc/canal0 e o float
  escolhido pelo switch. O getter static/0x4e3d8c consulta ator+0xa18 com
  chave ator+0x96c; o lookup0x4e366c compara o u16 do registro+0xc com o ID.
- **Regra:** Resolver a tabela de imports pelo endereço do patch, distinguindo
  endereço virtual, offset de segmento e offset de arquivo. Não encerrar o
  rastreio num stub nem confundir ID do ator com speaker ou nome de modelo.
- **Evidência:** CroImage.anonymous_import_at e regressão sintética; hashes,
  offsets e reprodução no [relatório](features/pipeline-rom/face-expressions.md).
  O vínculo ator→estado→frame foi recuperado estaticamente; nome C++ e
  observação no emulador continuam desconhecidos. A-045 é o snapshot anterior.

## A-048 Expressão é estado por instância, não alteração da geometria

- **Data:** 2026-11-18.
- **Contexto:** P-019, dispatch ChangeFace, projeção AMX e material de cinco
  GLBs corrigidos em A-044. Renumerado de `A-047` no merge.
- **Erro reproduzido:** A VM anterior parava em ChangeFace como efeito opaco;
  o player autoritativo não recebia expressão quando a projeção de posição
  era bloqueada. O novo campo também exigiu validação no save.
- **Regra:** Manter expressão0..7 no ator puro, replicar casts/fallback0 da
  nativa e transportar por ID. Guardar seleção enquanto carrega o GLB;
  clonar material e textura, não UV. Aplicar offset-base menos translação
  BCH DccMaya somente nos materiais/URLs evidenciados. Descartar só clones.
- **Evidência:** Testes falharam antes e passaram após dispatch/projeção/export
  da paleta e validação do save; regressões cobrem oito frames, ator ausente,
  isolamento, restauração e descarte. Playwright real de VM/host/engine com
  AMX sintético mostrou MM0180 aberto→fechado→aberto (frames0/10/0), com
  câmera/pose/UVs fixos, segundo ator intacto e PNG inicial/restaurado com o
  mesmo SHA. Três capturas inspecionadas em rom/face_expression_validation/dynamic/
  no principal; zero erros/warnings/HTTP>=400. Não é cutscene ROM/emulador.

## A-049 Contador de update não define uma duração em segundos

- **Data:** 2026-11-18.
- **Contexto:** Rotina de piscada DllField/0x38850–0x389ac e setup0x80a5c. Renumerado de `A-048` no merge.
- **Observado:** Estado+0x27c habilita o caminho; o setter de ChangeFace grava
  esse byte como frame==0. O update aplica frame10, espera dois updates e
  aplica0. A espera é helper(60)+60, com caminhos curtos4/8 e byte0x27d.
- **Regra:** Separar paleta, gatilho e clock. Nem70 frames do BCH nem dois
  updates autorizam assumir30/60fps ou inventar um timer de idle. O contrato
  do helper e a frequência/condições do update ainda precisam ser provados.
- **Consequência:** Seleção explícita implementada, piscada automática
  explicitamente pendente; P-019 permanece aberta para isso, ramos naturais,
  cobertura de outros materiais e paridade. Pés ausentes não foram inventados.
## A-050 Uma rota bloqueada por atores não é uma borda ausente

- **Data:** 2026-11-18.
- **Contexto:** PRD-010, Rustboro16→Route11643→Rusturf75→Verdanturf11. O contato16↔43 já vem da MM4; os portais43↔75↔11 são ZO reais. Renumerado de `A-047` no merge (colisão com `anim-0xef-re`).
- **Erro reproduzido:** BFS com movePlayer e dados intactos entra em75(14,20), mas não alcança11. Os NPCs12/13/14, modelo8204/spawnFlag676, ocupam(50,10)/(51,11)/(50,12). Remover colisões, ocultar qualquer spawnFlag não zero ou inventar ponte contornaria o bloqueio de história, não corrigiria o mapa.
- **Regra:** Isolar os bloqueadores e conferir o script antes de abrir caminho. O programa75/map função6116 contém FlagSet676@6180 e MdlDel12/13/14@6196/6212/6228. A flag representa ocultação neste grupo: um NPC não zero continua visível enquanto a flag não estiver setada; flag0 nunca é gate. A-042 permanece válida: a mera existência de spawnFlag não autoriza esconder o ator.
- **Evidência:** O teste base permanece bloqueado. MdlDel falhava antes em await-input; agora o bloco real6176..6239, limitado por halt sintético, seta676 e remove os três atores sem mutar a origem. Fixture pós-evento passa pelo mecanismo real de restauração/projeção e atravessa16→43→75→11. Não prova obtenção de Rock Smash, missão Peeko ou script inteiro; Playwright continua aceite separado.

## A-051 Flags e remoções precisam sobreviver ao mundo transitório da VM

- **Data:** 2026-11-18.
- **Contexto:** ADR-006, host de eventos e save v1. Renumerado de `A-048` no merge (colisão com `anim-0xef-re`). O save já serializava storyFlags, mas flags da VM permaneciam só no AmxWorld privado, e MdlDel ainda era opaco.
- **Erro:** Apagar apenas world.actors deixa o fallback da projeção reapresentar o NPC. Recriar todos os atores na entrada também ressuscita removidos. Persistir flags somente quando player/atores são projetados perde FlagSet posterior ao warp se o save ainda contém false e a entrada restaura esse valor antigo.
- **Regra:** Remover realmente da VM e manter tombstone por zona/ID; não confundir com MdlSetVisible. Serializar flags true/false e tombstones em chaves amx distintas, restaurar antes do init e persistir mesmo quando a projeção gráfica é suprimida após warp. Não projetar atores antigos no destino. Não inferir MdlAdd ou ressurreição a partir de FlagReset.
- **Evidência:** Testes cobrem bloco real75, imutabilidade, hide-flag0/676 e reset sem sobrepor visibilidade explícita, save/reload e isolamento do ID7 entre zonas6/7; FlagSet123 após warp substitui false persistido. 226 Vitest e build passaram; Python145 sem skips com GLB_MAPS_DIR do principal. JSONs de mapas/encontros e grafo não foram alterados; apresentação/quest/save de vars/party/bag continuam fora desta correção.
- **Validação adicional (2026-11-18, main9023a3f):**325 passos por teclado e onze capturas inspecionadas. Duas tentativas right em75(50,11) ficaram bloqueadas sem676; fixture do bloco real6176..6239 com halt sintético6240 produziu flags/tombstones via VM, sem editar atores do mapa. Reload e reentrada preservaram remoções e chegada; final11(16,22), encontros0/61/61/0 iguais aos JSONs, quatro BGMs nativas e consoleErrors/pageErrors/missing/requestFailures vazios. 260 Vitest/148 Python sem skips/build passaram. O túnel ainda mostra céu na borda e avatar parcialmente oculto; causa de altura/oclusão/geometria não reavaliada neste smoke, registrada em P-017/P-019. Não equivale a missão completa nem paridade gráfica; logs/capturas em STATUS e /tmp/verdanturf-results.json.

## A-052 Conversão numérica AMX exige distinguir célula inteira de float32

- **Data:** 2026-11-18.
- **Contexto:** P-013, avanço da abertura real antes dos serviços gráficos. Renumerado de `A-040` no merge (colisão com main).
- **Erro:** `float` e `floatadd` interrompiam programas legítimos como nativas não suportadas. Reinterpretar os bits de um inteiro também não implementa a conversão numérica de Pawn.
- **Regra:** Derivar conversão e arredondamento das instruções nativas, mantendo células signed-32 e operações float32 separadas. Não implementar outras operações apenas por semelhança de nome.
- **Evidência:** `code.bin` SHA-256 `b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`, VA `0x50c9cc` (`vcvt.f32.s32`) e `0x50c9fc` (`vadd.f32`). Sete regressões falharam antes do suporte e passaram depois, incluindo `16777217 → 16777216` e arredondamento de soma.

## A-053 Um case existente não prova seleção natural de cena

- **Data:** 2026-11-18.
- **Contexto:** ADR-007/PRD-005, warp natural desde o init da zona 6. Renumerado de `A-041` no merge (colisão com main).
- **Erro potencial:** Invocar diretamente o case 2 ou interpretar o primeiro case de cada mapa como init universal.
- **Regra:** Executar o export `GetSceneChangeData` com argumentos na pilha AMX e deixar a tabela real escolher a cena. O consumidor considera até oito triplas `scriptId, workId, valor`, encerra em `-1`, ignora o marcador 2000 e usa a primeira condição correspondente. Metadados de exports acompanham somente as imagens locais, não uma cópia manual da tabela no motor.
- **Evidência:** `code.bin`, VA `0x3ff628–0x3ff6c4` e `0x3ff6f4–0x3ff794`; export `1676684628`, endereço AMX `5536` na zona 6. O work `16514 = 0` tem prioridade sobre `16496 = 3`. Com estado preparado `16514 = 1, 16496 = 3`, o init de entidades termina e o export escolhe o case 2 → global 9881. Seis testes sintéticos cobrem pilha, entrypoint, sentinela, ordem e limite.
- **Limite:** Essa evidência não estabelece a ordem completa dos callbacks de entidades 0/1/2 nem um percurso de história desde New Game.

## A-054 Works ROM e flags manuais de UI não são o mesmo estado

- **Data:** 2026-11-18.
- **Contexto:** Restauração mínima de condições de cena sem criar atalhos por nome de mapa. Renumerado de `A-042` no merge (colisão com main).
- **Erro potencial:** Traduzir `intro_completed` para uma fase ROM presumida, aceitar valores signed-32 como conteúdo de work ou restaurar um snapshot antigo a cada entrada de mapa.
- **Regra:** Persistir flags numéricas e works unsigned-16 em `GameState.romEvents`, separadamente de `storyFlags`. Validar o payload de save e normalizar índice/valor nas nativas. Restaurar o snapshot uma vez após reset; depois preservar writes da VM, inclusive os posteriores ao pedido de warp.
- **Evidência:** `DllField.cro`, wrappers `WorkGet` em `0x51438` e `WorkSet` em `0x5144c`, com `uxth` nos argumentos; imports resolvidos para VA `0x3fe110` e `0x3fe1bc`. A regressão `WorkSet(0x14000,-1)` falhou com `-1` e passou com work `16384 = 65535`. Sete payloads inválidos passaram indevidamente antes do guard e foram rejeitados depois.
- **Limite:** O save web não representa ainda todo o estado de save ORAS, inventário ou callbacks.

## A-055 Término de apresentação é estado do host, não retorno constante

- **Data:** 2026-11-18.
- **Contexto:** Câmera, fade preto e espera por terreno no ramo 9881. Renumerado de `A-043` no merge (colisão com main).
- **Regra:** Queries de câmera/fade só confirmam término após os frames projetados; reset de zona cancela a apresentação anterior. `_FieldMapBlockIsLoading` só recebe retorno de conclusão depois do promise de terreno. Modos, sentinelas, telas e easing sem implementação continuam opacos.
- **Evidência:** Wrappers CRO `EVCameraSetSlideParam` em `0x969e0`, `EVCameraBegin` em `0x51a4c`, query em `0x960f8`; `static.crs` SHA-256 `b1976b7f480ffdeaa03cc842515472a89cc6e186d58d5022f64374a3b921005c` resolve os imports para `0x4833b8`, `0x483ee4` e `0x4edb2c`. O consumidor em `0x484114` usa duração unsigned-16 e easing; a projeção deriva de eye/target/FOV. Fade: `code.bin`, VA `0x3bd480`, `0x3bd458` e `0x370774`. Testes determinísticos verificam conclusão, espera real e descarte de geração obsoleta.
- **Limite:** O renderer interpola eye/target em ticks de render e emite diagnóstico explícito: não reproduz FPS/quaternion da ROM. Apenas modo absoluto, roll zero e easing 0/1 estão implementados. Altura e flags de `_MapChangeCore` continuam com solo/fade genérico; ACMD ainda exige investigação própria.

## A-056 Estado de destino e networkidle não comprovam imagem pós-transição

- **Data:** 2026-11-18.
- **Contexto:** Playwright do warp natural, complementa A-038 sem substituir a evidência sintética anterior. Renumerado de `A-044` no merge (colisão com main).
- **Erro:** A primeira captura mostrou canvas preto embora o save já estivesse na zona 227 e a rede estivesse ociosa: a transição visual ainda não tinha terminado.
- **Regra:** Aguardar também opacidade efetiva do canvas e da superfície de transição, capturar e inspecionar a imagem. Não concluir pelo save, nome do HUD ou ausência de HTTPs pendentes isoladamente.
- **Evidência:** Playwright visível na porta 5178, sem interceptar programas, memória ou bindings e sem Enter para efeitos: init da zona 6 → seleção real do case 2 → câmera/fades → `_MapChangeCore(227,14,2,12,0,0,0,1,0)`. O work `16496` passou de 3 para 4; o laboratório aparece em `(14,12)`. Três PNGs locais em `/tmp/events-natural-{before,camera,lab}.png` foram inspecionados; zero pageerror e falha HTTP no ramo. O teste espera opacidade 1 antes do PNG final.
- **Limite:** O estado de entrada foi preparado com os dois works evidenciados, não obtido por uma campanha completa. O rótulo extraído do mapa 227 ainda é “Littleroot Town”; nome do HUD não distingue interior/exterior.

## A-057 ACMD exige seguir a fila até os handlers e distinguir BSS de código

- **Data:** 2026-11-18.
- **Contexto:** Complementa A-055: o script 14 chega a `MdlAcmdSet(7,1,1,0)`, não apenas aos giros 5/6 encontrados inicialmente. Renumerado de `A-045` no merge (colisão com main).
- **Erro evitado:** Tratar BSS+`0x310` como endereço de código do CRO ou deduzir o significado de um opcode pela direção observada. Uma relocação achatada perde a distinção entre segmentos.
- **Regra:** Conferir segmento, registro da fila, descritor e função executada antes de implementar. Concluir pela fila realmente projetada, nunca por retorno constante; opcode desconhecido bloqueia o lote inteiro. `Init(-1)` resolve o ator do evento, enquanto `Update(-1)` consulta todas as filas, não o player 255.
- **Evidência:** `DllField.cro` SHA-256 `9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`: registro global no segmento BSS 3, offset `0x310`, preenchido desde `0x3c180` e consumido por `0x401f0`. Giros 5/6/7 chamam `0x8248c` por `0x462ec`/`0x45c30`/`0x45b4c`, com 12/8/4 frames; aliases 250/251 usam 8/12. `0x81244` interpola rotação e confirma direção ao fim. Em `code.bin`, `0x3f8fb0–0x3f9170` consome registros de quatro bytes e repetição byte; estado `+0x9f6 == 3` indica fim. Repetição zero ainda executa uma vez.
- **Verificação:** Testes sem WebGL cobrem duração, repetição, reset, lote opaco, contexto e projeção imutável à VM. Playwright exibiu texto ROM do NPC 0/script 14 sem Enter de ACMD, restando uma confirmação explícita de eye-to-eye; `/tmp/events-real-turn-dialogue.png` foi inspecionado.
- **Limite:** O host projeta yaw, sem reproduzir quaternion, FPS ou clipes GF1 157–160. O opcode 19 alcança `0x40690` e depende de máscaras de movimento; não foi implementado por aproximação.

## A-058 Testar apenas o loader injetado não valida o formato do GameText real

- **Data:** 2026-11-18.
- **Contexto:** `MsgLoad(0,1)` seleciona o arquivo GameText 23 pelo switch CRO já evidenciado, mas a textbox precisa das strings, não do envelope de extração. Renumerado de `A-046` no merge (colisão com main).
- **Erro:** O glob era tipado como `string[]`, embora os JSONs sejam `{file, lines}`. Os testes anteriores injetavam arrays e não exercitavam esse caminho; o banco carregado era um objeto indexado incorretamente como array.
- **Regra:** Cobrir também o loader de produção com um módulo JSON sintético no formato real; a tipagem genérica do glob não valida o schema de origem. StoryText local e GameText legado têm envelopes diferentes.
- **Evidência:** A regressão falhou recebendo `{file:'0023', lines:[...]}` onde se esperava um array; passou após ler `.lines`. No navegador, o loader de produção resolveu seletor 1 → arquivo 23 → 2.848 strings. `MsgIsLoaded`, `MsgSwap` e `MsgRelease` foram reconferidos no CRO em `0x5202c`, `0x5d1bc` e `0x51be0`; slot ausente não recebe sucesso implícito.
- **Limite:** O probe do loader não executa um ramo ROM de diálogo auxiliar nem prova paridade no emulador. Bancos ausentes, words/formatação e outros caminhos continuam em P-013.

## A-059 Orientação-base não depende do tamanho da paleta de expressão

- **Data:** 2026-11-18; P-019, continuação sobre a0ab2ce. Renumerado de `A-050` no merge (colisão com `zone-maps`).
- **Erro reproduzido:** A guarda de 70 frames impedia corrigir V em paletas
  de 10/30 frames e em rostos estáticos. Testes sintéticos falharam antes da
  separação entre orientação e reprodução de expressão.
- **Regra:** Nome de face/head apenas seleciona candidatos para inspeção.
  Autorizar correção por material exato, SHA da fonte, RGBA/dimensões iguais
  ao BCH, UV0, transformação-base suportada e BBox nativa inequívoca. Não
  fabricar animação quando não existe paleta completa 0/10/…/70.
- **Evidência:** Auditoria de 99 MM encontrou 17 paletas e 91 materiais
  corrigíveis em 79 modelos. Isso inclui os sete casos curtos das 12 paletas
  antigas. Das zonas 6–16, 51 MM têm GLB no catálogo: 44 normalizados e sete
  intactos; 12 IDs especiais continuam sem remapeamento inventado.
- **Limite:** BBox simétrica em V não distingue original de espelhado. Os
  materiais de MM0226/0232/0241/0245/0262/0270/0305 permanecem intactos por
  ambiguidade; outros 13 MM não têm candidato nativo face/head. Próximo passo
  nesses casos é provar correspondência por vértice, não usar flip global.
  Razões por modelo em character-face-coverage.json.

## A-060 BBox de material não é BBox de cada primitive exportada

- **Data:** 2026-11-18; P-019, expansão de faces/cabeças estáticas. Renumerado de `A-051` no merge (colisão com `zone-maps`).
- **Erro reproduzido:** O BCH agrega as meshes do material, mas Blender/glTF
  pode dividi-las em primitives com limites locais menores. A publicação
  parou em rstr0010_00_head; fixture de duas primitives reproduziu a falha.
- **Regra:** Validar a união dos UVs do material contra a evidência nativa,
  depois clonar os accessors de cada primitive sem alterar os compartilhados
  com materiais não elegíveis. Não relaxar a prova de SHA/imagem/transform.
- **Evidência:** Regressão passou após a correção; validador real verificou os
  99 GLBs: prefixo BIN, accessors anteriores, materiais, imagens, samplers,
  nodes, skins, clipes e dados não UV preservados, com idempotência. A/B de
  MM0179/MM0299/MM0221 inspecionou seis capturas com pose/câmera fixas e
  arquivos publicados, sem editar UV no browser; zero erros/warnings/HTTP>=400.
- **Limite:** Isso valida orientação dos três novos exemplos, não caminhada,
  história ROM, todos os 79 rostos no browser ou paridade com emulador. Pés,
  corpos/texturas residuais e clock da piscada não foram inventados.
## A-061 Mesmo nome de cidade não identifica o corredor real

- **Data:**2026-11-18; PRD-011/P-017. Renumerado de `A-059` no merge (colisão com `anim-0xef-re`).
- **Contexto:** Verdanturf até Mauville e possível acesso terrestre a Slateport.
- **Erro evitado:** Supor44→15 ou usar34 por compartilhar o nome Route110; converter portais recíprocos com larguras diferentes em continuidade física presumida.
- **Regra:** Cruzar zones.json, zoneIds MM e destinos ZO. O caminho é11→44→445→15, seguido de445→33→14. Só11/44 é contatoMM6;445 é hall de Mauville/MM347,15 é pátio/MM14 e33 é Route110 terrestre/MM21.34/MM22 é ciclismo. Portais445↔33 têm width7/5 e33↔14 width5/3: preservar, não inventar alinhamento lateral nem offset.
- **Evidência:** Regressão percorre até33 com todos os atores visíveis e confere os quatro pares445↔15. Nenhuma ponte, colisão ou tabela de encontros alterada. Staging seletivo reproduziu80 assets de mapa/áudio ausentes e corrigiu a presença para zero ausentes,46 zonas/100GRs/100atores e BGMs c02/c03/r_c/t04; dry-run UV limpo. Aceite visual continua separado.

## A-062 Progresso pós-evento inclui work e remoções, não só hide-flag

- **Data:**2026-11-18; PRD-011/P-013. Renumerado de `A-060` no merge (colisão com `anim-0xef-re`).
- **Erro reproduzido:** A tentativa de caminhar11→44→445→15→445→33→14 falhou no último trecho. NPCs9–13 de33, hide-flag660, bloqueiamz114..116; ocultar661/532 isoladamente não libera o sul.
- **Regra:** Não contornar o grupo com nova borda. Conferir o bloco real e separar estado base de fixture pós-evento rotulada, preservando também os writes de work e os tombstones por zona. O estado inicial permanece bloqueado.
- **Evidência:** Programa33/map SHA9492e0f2e9f8bfef75e6657ffa991d3fbbc97ec101ace80b69cc550b062f4ef6 conforme disassembly: WorkSet16526=2@7368, FlagSet660@7384, MdlDel11/12/9/13/10@7400/7416/7432/7448/7464. Fixture7360..7475 com halt sintético7476 termina na VM existente, persiste/restaura progresso e alcança14 sem mutar mapas. Quatro regressões novas,320 Vitest/150 Python sem skips/build passaram sobre3dbfd21. Não executa a função inteira nem prova a campanha; Playwright ainda pendente.
- **Aceite posterior na main4b7d09d:**748 passos visíveis,146 até Mauville sem660,514 até33(16,115) e duas tentativas down bloqueadas com piso0/atores presentes. Fixture real mantém a posição, restaura work16526=2 e cinco tombstones após reload/reentrada, alcançando Slateport14(31,22); encontros dos seis mapas nativos e consoleErrors/pageErrors/missing/requestFailures vazios.321 Vitest/157 Python sem skips/build passaram. Quinze capturas inspecionadas revelam oclusão forte nas chegadas15(2,20)/445(78,48), além de céu na borda445, bolas/fallbacks e folhagem; causa não diagnosticada, P-017/P-019 abertas. Evidências em `/tmp/mauville-results.json` e PRD-011.

## A-063 A bounded random helper does not establish an update clock

- **Date:** 2026-11-18; P-019, integrated base 173ada3.
- **Context:** Resolve helper(60)+60 before adding automatic blinking. Renumbered from `A-061` on merge (collision with `zone-maps`).
- **Error avoided:** Treating 60 as FPS, vsyncs, or milliseconds, or assigning
  an independent random generator to every actor.
- **Evidence:** DllField stub0xbf0 resolves to code VA0x48ad7c, then0x175d64
  and the state-mutating PRNG0x164798. UMULL computes floor(U32*n/2^32) for
  bounds3/60. Long waits are60–119 eligible calls; closed lasts two eligible
  calls. Byte+0x27d prevents consecutive short4/8 waits. The wrapper uses a
  shared global generator; its seed lifecycle is not recovered.
- **Rule:** Separate the random bound, per-actor counters, eligibility gates,
  and scheduler cadence. Record the entire call chain before implementing a
  timer. Recover byte meanings rather than mapping them to guessed UI flags.
- **Limit:** Actor-manager0x424b0 calls0x386f4 at0x424f0 only for eligible
  entries. Dispatch cadence and several gate meanings remain unknown;
  automatic blinking stays unimplemented. Details, source hashes, and search
  boundaries are in face-expressions.md, not a runtime-parity claim.

## A-064 A merged GF1 output can still lack the native standing pose

- **Date:** 2026-11-18; P-012/P-019, zones6–16 plus both player models. Renumbered from `A-062` on merge (collision with `zone-maps`).
- **Error reproduced:** Fifteen published models contain native002 but no
  native000, so standing silently uses the old procedural idle despite a
  successful batch status. Synthetic inventory tests reject exported names
  without matching native slots and never substitute an unrelated93.
- **Rule:** Check the pack and final clip list independently. GF1 index0 is
  a constant standing pose here, not evidence of a breathing animation.
  Preserve numeric native names; do not relabel slot3/93 from duration alone.
- **Evidence:** audit_overworld_clips.py records65 IDs:48 native pairs,
  five MM without motion,12 unmapped. Fifteen index0 exports were appended
  serially with nice10, preserving existing geometry/materials/skin/clips.
  All48 pose jobs and99 final face outputs pass structural validation.
- **Limit:** The numeric dispatch of the original movement state machine and
  its cadence remain unproven. Visual locomotion of002 is demonstrated on
  Brendan; availability does not validate every model visually.

## A-065 Repeated movement projections must not restart a native loop

- **Date:** 2026-11-18; native overworld controller reuse. Renumbered from `A-063` on merge (collision with `zone-maps`).
- **Error reproduced:** The shared battle controller selects procedural idle
  even with000 available and has no movement transition API. Two regression
  tests fail before the change and pass afterward.
- **Rule:** Use NativeAnimationController for standing and movement, preserve
  phase for repeated state, use standing when movement is unavailable, and
  dispose only the actor's own actions/listener on replacement or zone reset.
- **Evidence:** Native000→002→000, initial full pose weight, unchanged phase,
  missing-clip fallback, isolated mixers, and cleanup pass without WebGL.
  Visible Playwright shows39 changing bones, stationary native NPCs0182/0221,
  four inspected captures, and zero errors/warnings/HTTP failures.
- **Limit:** The browser scenario projects synthetic map/player states through
  the real SceneManager, not a ROM script route or emulator comparison.
  Existing movement interpolation/crossfades are web presentation policies,
  not newly proven native timing; feet remain an asset-geometry limitation.

## A-066 Contato entre zonas não prova passabilidade entre todos os seus lados

- **Data:**2026-11-18; PRD-012/P-017, basec9be392.
- **Contexto:** Mauville até Fallarbor e possível loop por Meteor Falls.
- **Erro evitado:** Ordenar rotas pelo nome, escolher o menor caminho do grafo ou ignorar a diferença entre as variantes de Route111/112.
- **Regra:** Cruzar contatos MM/ZO com caminhada real sob colisões/atores. A rota física é15→445→37→39→85→38→36→40→10→41→71. Route11340 vem antes de Fallarbor10; Route11441 vem depois.37/39 são MM7;38/36/40/10/41 pertencem à MM8.35/MM23 não substitui automaticamente essa sequência.
- **Evidência:** Regressão inicial falhou em37→39. Diagnóstico isolando somente os quatro objetos de campo permite o percurso acima;38→40 é contato MM8 mas não é atravessável desde7,17, exigindo38→36→40. Nenhuma ponte inferida, colisão ou encontro alterado.

## A-067 Um objeto com spawnFlag zero não vira uma hide-flag de história

- **Data:**2026-11-18; PRD-012/P-013/P-017.
- **Erro reproduzido:** IDs2–5 de37, model8204, script10050 e spawnFlag0 bloqueiam o norte. Reutilizar uma flag arbitrária ou chamar o pós-estado de execução real de RockSmash seria falso.
- **Regra:** Investigar o grafo real e separar estado base, efeito nativo e fixture derivada. No AMX global0046 SHA c63af4251dc7406fd89126af85cbef598c889312f303d117b51ba7547c50a362,10050→5324→3984 alcança29 funções; CallIwakudakiEffect@4276 segue checks249/confirmação/demo37.5576 é do caso10051. Nenhum MdlDel no programa; FlagSet2724@6792/7208 pertence a10054/10055, fora do grafo10050. Isso não descreve o interior do efeito CRO nem prova a persistência ROM por pedra.
- **Decisão autorizada:** Fixture derivada pós-RockSmash/não-natural popula só tombstones37:2..5 pelo mecanismo existente. Preserva posição, flags, colisões e origem; não executa10050, demo, batalha/recompensa ou efeito. O aceite deve provar primeiro o bloqueio por teclado e só depois o percurso condicional, sem fabricar suporte de campo em produção.

## A-068 Entrada de uma caverna composta não garante acesso às outras saídas

- **Data:**2026-11-18; PRD-012/P-017.
- **Erro evitado:** Prometer o loop Meteor71→Route11542→Rustboro16 só porque os warps existem, ou atribuir o bloqueio a uma cutscene sem evidência.
- **Evidência:**71/MM32 usa GRs260–263. Desde57,35, o core não alcança42/72/73 mesmo sem NPCs; remover grupos637/638/639 não resolve esse diagnóstico. Os ZO preservam rom.z54 para41 e-126 para42, com alturas também distintas nas saídas internas.
- **Regra:** Preservar permissões/alturas e registrar a causa como desconhecida até investigar. O aceite atual termina na entrada71 após Fallarbor, com fixture de RockSmash rotulada; o loop fica bloqueado em P-017. Não abrir tiles, criar ponte ou warp extra para esconder a lacuna.
- **Verificação pré-browser:**328 Vitest/49 arquivos,159 Python sem skips/build; stage59 zonas/151GRs/104atores/sete BGMs,20 códigos sem modelo físico correspondente em fallback, zero mapas/MP3s ausentes e223 GLBs de mapa válidos. Dry-run UV público sem remaps; Playwright main pendente.
- **Aceite posterior main e12419b:** Chromium visível/5200,1023 passos;115 base até37(31,66), duas tentativas bloqueadas, fixture derivada sem mudar posição/flags,656 até Fallarbor e1014 até71(57,35). Final51,32/reload e duas tentativas bloqueadas à esquerda;42/72/73 continuam inalcançáveis. Onze zonas com encontros nativos,16 imagens inspecionadas, zero consoleErrors/pageErrors/missing/requestFailures, aviso BuildMdlEventAnimeSetEnd explícito P-013. Script/relatório em `/tmp/playwright-test-fallarbor.js` e `/tmp/fallarbor-results.json`.
- **Leitura das imagens:** Avatar ocluído/não legível em445/37/39/10/41/71, parcialmente atrás de árvore em36;85 tem exterior preto/céu. As capturas base/pós-fixture em37 não mostram a quebra das pedras: só projeção e bloqueio/movimento por teclado comprovam a mudança lógica. Zero erros/recursos faltantes não fecha o aceite visual ou a física vertical; manter P-017/P-019 sem inferir causa ou improvisar altura.

## A-069 Canal UV válido não prova orientação correta do atlas

- **Data:** 2026-11-18; P-007. A-066–068 já ocupados na main.
- **Erro reproduzido:** GR0006 já tinha MASK/cutoff e RGBA com alpha, mas V
  invertido amostrava áreas opacas e fachadas sobre telhados. Forçar outro
  alphaTest não corrige essa seleção de texels.
- **Regra:** Exigir identidade RGBA e correspondência posição+UV com o BCH,
  além de origem UV0 e transformação-base identidade. Restaurar somente o
  accessor comprovado, clonando referências compartilhadas; não usar flip
  global nem BBox simétrica como prova. Comparação numérica tolerante evita
  falsos negativos nas fronteiras de arredondamento float32/DAE.
- **Evidência:** auditoria de 322 GLBs/4.328 materiais; 206 GRs e 3.625
  materiais elegíveis. Preservação do BIN/accessors/geometria/skin/clipes e
  idempotência verificadas. Doze capturas A/B GR0004/0005/0006 inspecionadas,
  com recorte, casas e solo orientados e zero erros/warnings.
- **Limite:** orientação dos atores continua sob a política de P-019;
  transformações não identidade, projeção e shaders não recebem aproximação.

## A-070 Blend e alpha test são estados independentes

- **Data:** 2026-11-18; P-007.
- **Erro reproduzido:** o caminho legado escolhe BLEND e perde o cutoff.
  Regressão no configurador real falhou com alphaTest zero em vez de52/255;
  fixtures GLB sintéticas verificam a preservação do teste junto do blend.
- **Regra:** Interpretar somente o caminho alpha estático reconhecido e
  mapear fatores RGB e alpha explicitamente. O default Three de fator alpha
  não equivale sempre ao SourceAlpha nativo. Greater, Gequal e Always têm
  regras distintas; operadores, fontes ou blends desconhecidos ficam fora.
  COLOR_0 inteiro normalizado não é um accessor float32.
- **Evidência:** 3.971 perfis suportados, 709 com blend; 315 URLs novas
  imutáveis. A auditoria deduplica232 estados sem perder nomes/hashes de
  texturas. 328 Vitest, build e 168 Python sem skips passaram.
- **Limite:** Texture1/projection_dummy, PrimaryColor e LUTs não autorizam
  inventar lightmap ou unlit. O RGB e a iluminação continuam aproximados;
  wrappers CRO de weather/motion blur não provam dispatch dos materiais GR.

## A-071 GetVertices não aplica todos os atributos fixos do PICA

- **Data:** 2026-11-18; auditoria de cores P-007.
- **Erro evitado:** interpretar COLOR ausente no buffer como cor nativa zero.
  GetVertices aplica posição/escala e pesos fixos, mas o DAEExporter precisa
  aplicar FixedAttributes separadamente. O primeiro relatório indicava
  1.053 diferenças de range por não considerar a cor fixa.
- **Regra:** distinguir cor de buffer, fixa e ausente. Usar o float24 fixo
  decodificado, sem inventar branco/preto para um atributo inexistente.
- **Evidência:** 4.290/4.328 materiais possuem COLOR_0 exportado; todos os
  encodings presentes são suportados e preservados. Após corrigir o leitor,
  restam só três diferenças de range: body MM0180/MM0181 e head MM0319.
  A auditoria registra componentes, normalização e min/max nativos/GLB.
- **Limite:** igualdade de ranges não prova o shader vertex original nem
  correspondência por vértice. As três diferenças não recebem correção RGB
  nesta entrega; exigem rastrear o export/skin sem apagar as variações nativas.

## A-072 Um transporte de evento precisa do work e do init de chegada, não de um portal inventado

- **Data:**2026-11-18; PRD-013/P-013/P-017.
 Renumerado de `A-069` no merge (colisão com `pica-materials`).
- **Erro reproduzido:**384/385 só possuem ZO de saída para39/83. A chegada385(23,18) fica presa se o funcionário1 continua em21,26; removê-lo ou deslocar o jogador esconderia o init ausente.
- **Evidência:** mapa384/função3592 e385/3620 usam work16699=1, RecordAdd175, demo11/12 e helper2904/_MapChangeCore. VM dos recortes pós-demo confirmou385,23,57,18,1,0,0,1,0 e384,21,57,11,3,0,0,1,0. Entities385/script1 lê16699 e MdlSetGPos move NPC1 para24,57,18. Teste do ZoneEvents restaura o work antes do init e mantém jogador23,18/NPC visível. Gate666 em39 é FlagSet666 real global0028@21804, chamado por Meteor71; não é RockSmash.
- **Regra:** Preservar nove células/altura/facing/flags, work e init real; promover imagem entities por SHA somente na saída ignorada. Separar fixture pós-demo do embarque/filme/contador/campanha. NPC0/script2 segue ambíguo entre entities/map; não escolher candidato por conveniência. Somente duas imagens entities adicionadas ao manifesto existente; map não promovido. Biblioteca e script inteiro não foram executados pela fixture.

## A-073 Colisão binária não substitui ledge direcional nem a prioridade do ZO

- **Data:**2026-11-18; PRD-013/core-ADR-008/P-017.
 Renumerado de `A-070` no merge (colisão com `pica-materials`).
- **Erro reproduzido:**84 desde38,5 parava emz29 mesmo sem NPCs; toda palavra terminada em21 era reduzida a bloqueio, perdendo o ledge. Um diagnóstico que exigia parar sobre38,112 também produziu falso negativo: esse tile é bloqueado, mas é ZO real acessível desdez111.
- **Evidência estática:**223 GRs staged,541 palavras exatas0x75020021 em13 zonas, norte livre541/sul526. Raycast com nodes/escala1/18/offset19.5 confirma GR291(33,30)21→20.5, GR31(26,7)2→1.5, GR72(8,18)3→2 e GR78(2,28)2→1.5. Variantes0000/6400 e classes72/73 foram distinguidas, não abertas. Não é prova de execução no emulador ou ABI nativa.
- **Regra:** Metadado derivado southLedges só para palavra75020021/ownership real; manter colisão1. Core salta dois tiles ao sul, impede subida/lateral, confere bounds e NPCs no ledge/aterrissagem, respeita diálogo/ZO e é imutável. Não liberar todos os low bytes21 nem criar ponte. Semântica das variantes, animação/altura e multicamada continuam pendentes.
- **Verificação:** regressões core/adapter e composição Python falharam antes e passam depois.28 JSONs receberam816 pontos; todos os demais campos comparados à base357692a estão idênticos. Caminho385→83→84→39→9 passa com NPCs nativos após init real; diagnóstico sem metadado segue bloqueado.340 Vitest/52 arquivos,160 Python sem skips/build passaram; main/Playwright ainda pendentes. Meteor71→42/72/73 continua bloqueado.
- **Aceite posterior main809b814:**452 passos visíveis até9(20,21), com115 até o gate37,266 até o gate666 e278 até384. Fixtures rotuladas: quatro tombstones derivados, recorte real666 e pós-demo WorkSet/_MapChangeCore; init385 restaura16699=1 e move funcionário sem ocultá-lo. Oito saltos sul e duas tentativas de subida bloqueadas; reload preserva posição,666,16699 e tombstones. Nove zonas com encontros nativos,21 capturas inspecionadas e quatro arrays de erro vazios;345 Vitest/169 Python sem skips/build passam. Relatório/script em `/tmp/chimney-results.json` e `/tmp/playwright-test-chimney.js`.
- **Limite visual observado:** Jagged84 mostra céu/avatar sem terreno em38,5/38,29/38,31;385/39/9 e outros pontos escondem o avatar,83 mostra corpo parcialmente enterrado. Zero recursos faltantes não prova renderização/altura. Causa não diagnosticada; manter P-013/P-017/P-019 e investigar câmera/geometria/camadas sem inventar altura/colisão. Transporte/campanha natural e animação de salto continuam abertos.

## A-074 Costuras de cor exigem contexto de triângulo, não só posição/UV

- **Data:** 2026-11-18; continuação P-007, sucede A-071.
- **Observado:** as diferenças COLOR_0 de MM0180/MM0181 sobrevivem ao filtro
  de índices usados. O DAE regenerado contém variações RGB que os GLBs staged
  haviam reduzido a branco; assimp6.0 preserva essas variações ao converter
  esse DAE atual. Isso não identifica sozinho a versão/etapa histórica que
  perdeu a cor nos assets existentes.
- **Erro evitado:** escolher a primeira cor nativa para vértices coincidentes.
  Há vértices de posição, UV e normal iguais com RGB diferentes nas costuras.
  A correspondência simples deixou oito vértices ambíguos em MM0180.
- **Regra:** exigir correspondência única por vértice ou por triângulo inteiro,
  consistente em todas as faces incidentes do vértice exportado. Se o GLB
  fundiu cores incompatíveis, não pintar nem dividir geometria por tentativa.
  Preservar alpha; clonar COLOR_0 e manter BIN/accessors antigos intactos.
- **Evidência:** sete fixtures sintéticas red-green; restaurados12/11/15
  vértices em MM0180/MM0181/MM0319, três URLs novas e seis A/Bs inspecionados.
  Auditoria336 GLBs/4.547 materiais sem diffs de range comparáveis restantes.
  Range igual continua sem provar shader/iluminação. Proof usa hash dos dados
  DAE sem timestamps de criação, além de SHA de pack/ferramentas/entrada.

## A-075 LightSetIndex e referência de shader não são os valores da luz

- **Data:** 2026-11-18; investigação RGB P-007.
- **Observado:** os336 BCHs de modelo auditados não contêm luzes, cenas nem
  shaders embutidos; alguns atores contêm LUTs. O RGB frequente multiplica
  Texture0/PrimaryColor pelo resultado FragmentPrimaryColor, que no gerador
  SPICA inclui emission, ambiente e luzes reais. Normais fixas para cima de
  solo/madeira/telhado GR0006 permanecem no GLB.
- **Erro evitado:** tratar LightSet0/DefaultShader como luz branca, substituir
  FragmentPrimaryColor por branco/unlit ou atribuir dessaturação ao UV já
  corrigido sem medir os inputs originais.
- **Regra:** recuperar shader externo, ambiente e binding antes de mapear RGB,
  LUT/toon, projeção ou multi-textura. RTTI não é uma native AMX nem prova de
  dispatch; não ajustar exposição/saturação por aparência.
- **Evidência delimitada:** DllField SHA registrado em pica-materials.md;
  PseudoLightingListener name0x1003db/typeinfo0xfdee8/vtable0x1077e8 liga ao
  callback0x2ee38; EffectCycleLight name0x100ec0/vtable0x10822c inclui métodos
  0xde718/0xde388. O rastreio não recupera os valores de LightSet0. P-007 segue
  aberta; nenhum shader/clock/constante foi inventado.
- **Validação visual:** caminhada real de32 passos por teclado, repetida em
  Littleroot com o mesmo save inicial derivado, mostrou V/alpha acumulados
  antes/depois em oito capturas. Não é correção de iluminação nem progresso
  natural ou paridade com emulador; oclusão do avatar sob telhado permanece.

## A-076 Grid horizontal correto não implica altura visual correta

- **Data:** 2026-11-18; P-017, base287de78.
- **Observado:** romOrigin/worldOrigin só transportam X/Z; playerTargetPos e
  NPCs usamY0, projeções AMX descartam actor.y, follow usa eyeY9 absoluto.
  GRs conservam alturas da geometria:2 nas37/39,4 na9 e27/21/20.5 no mesmo
  GR de84. ZO confirma486/18=27 em84(38,5),18/18=1 em83(31,61) e54/18=3
  em71(57,35). Avatar exportado vai de0.08593 a1.83514 emY; recentrar sua
  origem não corrige erros de vários tiles.
- **Erro evitado:** tratar movimento/warp correto como grounding ou elevar
  todos os atores por um offset constante de mapa. Jagged varia por posição.
- **Regra:** resolver altura e camada transitável, manter X/Z e altura como
  contratos distintos e acompanhar altura também na câmera. Não interpretar
  auxiliares MM, palavras GR ou GPos.y sem provar semântica/unidades.
- **Evidência:**14 checkpoints/94 capturas controladas com SceneManager real,
  raios/bounds/materiais, ZOs e A/Bs; detalhes em pipeline-rom/maps-format.md.
  Runtime intocado; terreno recuperado por intervenção não é fix/paridade.

## A-077 Oclusão física, vazio exterior e seleção de chão são problemas distintos

- **Data:** 2026-11-18; P-017, diagnóstico avatar-grounding.
- **Observado:**445(78,48) e15(2,20) têm chão/ZO em0, mas a câmera vê paredes
  e partes internas de geometria. Littleroot(14,16) tem chão0 e telhado na
  linha de visão. Desativar depth no player revela o corpo, mas é overlay,
  não correção. Alterar near/far ou culling não recupera a cena. A câmera
  sob o chão27 de84 explica céu; exterior azul de445 não prova asset ausente.
- **Erro evitado:** escolher maior ray hit como piso:83 oferece chão1 e
  telhado8.0426;15 oferece chão0 e prédio12.3639. Primeiro hit também pode
  ser shadow transparente/depthWrite false, não um oclusor opaco.
- **Regra:** correlacionar ZO, geometria, flags e A/B; recuperar política
  nativa de camada/oclusão/câmera antes de esconder telhados ou forçar
  renderOrder. A/Bs de Y ainda deixam corpo parcial em algumas sequências,
  mesmo com bounds CPU acima do piso; não declarar fix sem isolar o
  residual de skinning/bindings/ordem de atualização do harness.
- **Decisão:** nenhuma alteração de runtime, assets, colisão ou shader.
  Consulta de altura/camada e aceite visual continuam abertos; snapshots
  controlados sem init/VM não substituem caminhada natural ou emulador.

## A-078 Grafo alcançável não comprova terreno nativo nem conexão entre checkpoints

- **Data:**2026-11-18; PRD-014/P-013/P-017/P-019. Renumerado de `A-074` no merge (colisão com `pica-rgb`).
- **Erro reproduzido:** o pedido45→52→50 omitia51(Route122); o grafo correto pelo norte é45→47→46→17→48→50→18. Ainda assim47→46 e48→50 falham mesmo sem NPCs/incluindo49, e52 para emx77 por73020021. BFS15→445→45→47 passa no core, mas não comprova Surf/terreno:3d1a0006 é817 vezes45/1306 em51 e o parser trata como collision0/terrain0.
- **Evidência:** capturas visíveis exploratórias45 em38,16/50,16/70,16 mostram superfícies rochosas/verdes, não água inequívoca; passo50,16→51,16 permitido não resolve a semântica. Bloco50/map5388..5519 contém WorkSet16530=2,FlagSet670 e MdlDel13/14/15/16/10/11; base50 bloqueada e fixture delimitada libera18 sem mudar mapas/posição. Checkpoint46(75,19) chega17/48, mas não prova o trecho desde47.
- **Regra:** testar cada ligação com NPCs e diagnóstico isolado, preservar ZO/MM e separar transporte ROM, fixture real e checkpoint independente. Não concatenar checkpoints como caminhada contínua nem promover classe a água por frequência/nome/BFS. Semântica candidata permanece desconhecida e o corredor conectado continua aberto; nenhum Surf ou ponte fabricado. Stage precisa conferir também áudio declarado dos vizinhos: cinco MP3s foram copiados seletivamente, sem expandir GRs (A-046).
- **Verificação:**11 regressões separadas,356 Vitest/54 arquivos,169 Python sem skips e build passam;315 GLBs válidos/probe sem ausentes/remaps. Staging60 zonas/139GRs/111atores, seis BGMs principais e15 com vizinhos. Integração/Playwright parcial na main pendentes.

- **Aceite posterior main665aca4:**375+139+85+175 passos em quatro segmentos independentes (774 somados, não caminhada conectada);262 até chegada47, depois bloqueios6e/norte;checkpoint46 até17/48 e parede sul;checkpoint52 até ledge lateral;checkpoint50 base670 bloqueada, fixture real mantendo posição e148 passos nesse segmento até18, depois reload/reentrada. Dez zonas com encontros nativos,22 capturas inspecionadas, zero consoleErrors/pageErrors/missing/requestFailures. Dois avisos BuildMdlEventAnimeSetEnd permaneceram suspensos, sem Enter artificial.356 Vitest/54 arquivos,176 Python sem skips e build passam.
- **Limite visual observado:**445/45 e18 nas chegadas/interior/reload escondem o avatar;46(75,19) não mostra terreno;47 nos bloqueios também esconde o avatar. Fortree tem superfícies claras/azuis repetidas;50(48,17) aparece cinza/rochosa na base e verde após reload da fixture, sem causa atribuída nem prova de mudança AMX na geometria.48/52 e reentrada50 são legíveis, mas não há aceite de paridade. Preservar P-013/P-017/P-019, terreno/camadas/corredor/Surf abertos. Artefatos: `/tmp/playwright-test-east-partial.js`, `/tmp/east-partial-results.json`,22 imagens `/tmp/east-partial-00-*` a `21-*`.

## A-079 Inventário e raycast podem refutar uma generalização de permissões

- **Data:**2026-11-18; PRD-014/P-017, complemento restritivo de A-073. Renumerado de `A-075` no merge (colisão com `pica-rgb`).
- **Hipótese testada:** a família6x000021 poderia explicar os novos bloqueios e ter uma direção simples como75020021. Em315 GRs staged há6d14 (46),6e77 (46/47),6f30 (18/84); ownership evita duplicar recortes.6e tem norte bloqueado77/77,6d lados bloqueados14/14; a vizinhança não é o padrão do ledge sul.
- **Geometria estática:** GR214/1,22 (47/41,22) possui oeste0,5/1,348, centro inclinado2,282 e leste2,5. GR207/6,23 (6d) sobrepõe15/15,5/17,483.6f em GR157/34,13 cai norte5→sul4,5, mas GR292/13,35 tem oeste19→leste18. Não escolher uma superfície como altura universal nem deduzir direção/condição de bike da classe alta.
- **Contrafactual isolado:** abrir somente6x, sem NPCs, mudou47 de2459 para2631 células, mas não conectou46;48 ficou1707 e não conectou50, cuja fronteira alcançável não tem6x. Nenhum JSON/runtime foi alterado pelo diagnóstico. Fronteiras também têm01000021; a geometria não autoriza abrir paredes ou inventar rampas.
- **Regra:** filtro numérico não é bitfield semântico. Manter6d/6e/6f e classe lateral73 fechados até prova de mecânica/condições, sem generalizar75020021. Registrar resultado inconclusivo, método e artefatos do inventário/raycast no PRD; não transformar ausência de erro visual ou um desnível em implementação arbitrária.

## A-080 O GR contém colisão física distinta do BCH visual

- **Data:** 2026-11-18; P-017/engine ADR-006, base0372885.
- **Observado:** seção2 `coll` dos857 GRs inventariados usa cabeçalho
  1/3/2/1/2,16 ranges a0x2a0 e triângulos float4/w1 a0x320 até o marcador
  term emu32@4+16.846 GRs compõem os536 mapas. Ranges repetem triângulos;
  deduplicar evita repetir trabalho e confundir repetição com outra camada.
- **Erro evitado:** continuar usando o raycast do BCH e selecionar telhados.
  A colisão física dá1 em83,3.150827 em385 e27/21/20.5 no GR291, enquanto
  telhados e plataformas visuais oferecem hits superiores diferentes.
- **Regra:** amostrar o centro `(tile−19.5)×18` da seção física primária por
  coordenadas baricêntricas e dividir Y por18; nenhuma escolha max/min-hit.
  Sem superfície ou com alturas diferentes além de tolerância0.0001 tile,
  exportar null. Não fundir a seção8: em15(2,20) ela dá7.5 contra chão0.
- **Evidência:** fixtures sintéticas red-green,846 GRs aceitos pelo parser,
 536 JSONs preservados após retirar apenas groundHeights e sua policy.
  Auditoria:318424 células transitáveis conhecidas/539 desconhecidas;
 705 warps concordantes com ZO,25 desconhecidos e133 diferenças dentro do
  recorte, incluindo camada secundária e offsets/rampas não resolvidos.

## A-081 Corrigir a projeção do piso não resolve a oclusão por prédios

- **Data:** 2026-11-18; P-017/engine ADR-006.
- **Observado:** player/NPCs agora usam altura da célula local e preservam a
  projeção X/Z; câmera follow mira playerY+0.5 com eyeY=playerY+9. O corpo
  inteiro aparece em83 com o renderer normal, sem mudar skin, bind, depth,
  culling, origem ou clipes. O residual dos controles anteriores não foi
  reproduzido nesse fluxo; isso não prova ausência de todo defeito skinned.
- **Erro evitado:** chamar o corpo parcial de83 de bug de skinning sem
  reproduzi-lo após grounding correto.6(14,16),445(78,48) e15(2,20) mantêm
  telhado/paredes entre câmera e ator emY0 correto; actor-only mostra corpo
  íntegro. Não esconder geometria para declarar aceite visual completo.
- **Regra:** interpolar Y com o mesmo mecanismo de apresentação X/Z já
  existente, sem novo timer; documentar que coeficiente18 não prova o clock
  nativo. Preservar câmera AMX ativa e battle camera. Null não vira altura
  comprovada: a apresentação usa o fallback anterior0 até resolver a camada.
- **Evidência:** A/B de12 checkpoints/34 capturas visíveis contra0372885,
  zero erros/requests falhos/warnings; passo core real84(38,29)→(38,31)
  comY21→20.5 em30 renders e câmera relativa preservada. Snapshots sem init
  e campanha não são caminhada natural nem validação no emulador.

## A-082 Classe alta, flags da célula e defaults têm consumidores diferentes

- **Data:**2026-11-18; PRD-015/P-017; base202d74b. Complementa A-079 sem abrir permissões.
- **Erro evitado:** chamar qualquer CMP21 de teste do low-byte ou supor que o default de classe explica o word inteiro. Código ARM observado:403558/40356c/4038cc fazemLSR24 antes de testar6d/e/f;403260 agrupa6d/e/61.402e60 extrai12 bits baixos,403b2c/403b7c testam bits0/1 com flags1 para word-1/classeff.403af4 lê defaults u16 em5860e0:6d/e/f/73/75→1, não21. Papel adicional20 continua desconhecido;3d→6 não nomeia água/Surf.
- **Fonte e regra:** conferir SHA/VA/offset e fluxo do operando, não só constantes. Getter4dbe14 lê `modelo+0x148`; consulta4dcb64 resolve importCRS19c3dc→Fieldda934 e faz leitura u32 com bounds em4d7d00 após seleção de registros/buffers/callbacks. Esse caminho ainda não fecha ownership GR/altura; não substituir a consulta por abertura do grid plano. SHA e reprodução no [PRD-015](features/engine-3d/prds/PRD-015-permissoes-nativas-de-movimento.md). CroImage/Capstone5.0.3 existentes, MCP indisponível/CLI ausente, nenhuma execução da ROM ou dependência nova.
- **Verificação:**356 Vitest/54 arquivos,176 Python sem skips e build passam. Entrega documental; sem mudança de runtime ou red-green de mecânica não comprovada.

## A-083 Decoder direcional e nome de CRO não provam a regra de movimento

- **Data:**2026-11-18; PRD-015/P-017, complemento de A-073/A-078/A-080.
- **Erro evitado:** transformar75→1/73→2 do decoder402e6c em direção permitida, ou nomear6f como lama/rampa/SkatePipe só pela aparência/módulo. Chamadores Fielde6224/e8b10 testam direção fornecida e oposta. O switch7764c recebe entrada em `r1` e escala vetores, sem lineage que o prove como dispatch de permissões; comparação coincidente não basta.
- **Evidência:** Field64be0 zera componentes `+0x8/+0x10` do vetor para6d/e e recalcula norma/direção; e613c ainda consulta `contexto+0x24` em1/2 e flags/outros estados. Em23cd8..23e50,6f usa `+0x24=2`, `+0x14=0x0e..0x11`, queries e direção válida antes de chamar import165c→DllFieldEventSkatePipe/segmento0+13d8=arquivo1558. A construtora escreve vtable21e8; typeinfo203c aponta string20df: EventDanielSteppingStone. O módulo também contém IceFloor/WaterFlow/KuruKuruPanel; SlopeSlip/MachCycleSlopeSlip tem outro CRO, sem vínculo provado às palavras.
- **Regra e limite:** provar enum de estado, significado das direções, camada, input e transição completa antes de implementar. Os gates numéricos são fatos locais, não um modelo fiel de bike/ponte/salto. Sem condição completa, preservar colisões e registrar desconhecidos, não criar fixture de estado inventado. Nenhum Playwright novo nesta análise estática;22 capturas PRD-014 continuam históricas e independentes. Corredor conectado,20,6x/73,Surf/bike/camadas seguem abertos. Relatório `/tmp/native-permissions-findings.json`;356 Vitest/176 Python sem skips/build passam.

## A-084 Colisão secundária não fica sempre na seção8

- **Data:**2026-11-18; P-017/PRD-016/engine ADR-007, base0d745b2.
- **Observado:** loader DllField/0x1e8cc deriva pisos do número de seções;
  para7+2N, grids extras são6+i e colisores6+N+i. Inventário:819 GRs com7
  seções,34 com9 e quatro com11;857 GRs/899 colisores validados.
- **Erro corrigido:**0436–0439 não são inválidos; possuem três camadas e
  seção8 é grid, não coll. O parser offline novo reconhece9/10 como colisão.
  Isso acrescenta o quinto candidato secundário aos133 desvios ZO:
 176/warp0,GR439,piso2,Y24. Os outros são15/6,7,8 e444/0.
- **Regra:** recuperar o agrupamento no consumidor antes de generalizar um
  índice observado. Não alterar a primária nem promover candidatos ao jogo.
- **Verificação:** fixtures red-green de índices variáveis,1–4 pisos,
  corrupção e relatório imutável; auditoria completa reproduzível no PRD.

## A-085 Um candidato de piso não fecha o estado de camada do ator

- **Data:**2026-11-18; P-017/PRD-016.
- **Observado:** DllField/0x1e52c compara desnível ao Y da consulta, com
  grids por piso, caches e máscaras;0xe5f20 faz consulta verticalY±250,
  X/Z quantizados a décimos. Origem do Y, transforms e escolha intramalha
  ainda não fechados. Não copiar só a comparação de distância para Y0.
- **Auditoria:**539 null são423 sem hit/116 ambíguos, não falha de bbox;
 101 têm algum candidato extra.133 desvios ZO: cinco candidatos/128 não
  resolvidos;25 outros warps são null e705 concordam em tolerância0.15.
- **Regra:** `collisions==0` é classificação do exportador, não prova de
  transitabilidade nativa. Não preencher água/pisos especiais por vizinho,
  ZO ou max/min-hit. Coincidência não autoriza escolher a camada do ator.

## A-086 Visibilidade booleana não prova dissolve por câmera

- **Data:**2026-11-18; P-017/PRD-016/engine ADR-007.
- **Observado:** BuildMdlSetVisible/0x4ef74 consulta registro espacial por
  handle e passa booleano a0x15a54; não recebe distância de câmera. Lookup
  usa X/Z e raio inicial36. O registry recebe objetos da seção3; não foi
  demonstrado vínculo com os meshes oclusores da seção1. GR713 não tem
  registros de seção3; GR6 e713 não possuem piso secundário.
- **Cobertura:**1157 programas AMX pesquisados,20 chamadas SetVisible;
  nenhuma direta nos programas locais6/15/445. Não exclui dispatch/global
  dinâmico nem chamadas indiretas. Ausência de string não prova ausência.
- **Regra:** não esconder telhados nem trocar câmera/camada por aparência.
  Controle actor-only pertence ao harness e não é uma correção publicada.
  Um hash de canvas estrito falhou por quatro pixels remotos na15 com
  medidas iguais; preservar esse limite, sem alegar paridade de pixels.

## A-087 Ownership e fila de modos precedem a identificação de enums

- **Data:**2026-11-18; PRD-015/P-017, base3013f14; complementa A-082/A-083.
- **Erro evitado:** promover qualquer STR+24 ou+164 a escritor do contexto de movimento. Field3d7b0 escreve+164 num registro de ActionCmdCycleDirtMove, não no contexto consultado pelo ramo6f. A fronteira8808c é literal; o setter começa88090. Busca sem ownership ou função correta pode produzir falso negativo e enum inventado.
- **Evidência:** Field9dbcc aloca7ec,9dbdc chama1b394,9dbe0 gravaowner+164. RTTI10723c/fdd78 identifica PlayerGrid, base10a830 FieldUnit. A basea7b08 zera+14/+24 e inicia+25/+26=14hex. e613c aparece em107250/10a844 como slot virtual14hex, não em BL direto. Setter88090 agenda+25;8e44c despacha callback141fe4;8e494 copia+25→+24 com gate+694. Modos1/2 usamcallbacks a5014/a4ee8, seletores1b/1a e ator+59=2/3, sem vínculo completo a Mach/Acro/foot.
- **Regra:** separar modo corrente, pendente, estado+14, direção e comando solicitado. a47c4 grava0f após pedir5d;75cac grava0/1, não o comando recebido emr1. Não converter o conjunto0e..11 em quatro direções nem os modos1/2 em bike sem binding de input/item. Fonte, reprodução e lacunas no [PRD-015](features/engine-3d/prds/PRD-015-permissoes-nativas-de-movimento.md); nenhuma fixture de enum presumido ou mudança de runtime.

## A-088 Pedir ação não prova deslocamento nem permissão completa

- **Data:**2026-11-18; PRD-015/P-017, continuação de A-083/A-084; renumerado de A-084/A-085 no merge (colisão).
- **Evidência:** importField1664→SkatePipe1428 grava direção emevento+30. EventDanielSteppingStone14d4/1430 solicita comando62, incrementa contador até2 e manipula flag800 do ator. code3fae48→CRS19c7c4→Field3a0c4 só agenda comando/direção emator+8fc; executor e duração/deslocamento não fechados. Não traduzir contador2 em dois tiles ou nome do evento em slide.
- **Outros limites:** ledges64528→e6224 reescrevem código intermediário5/1d/24, mas ainda há queries e gates; decoder comum72/73/74/75 não prova salto comum completo. Máscara20 no PlayerGrid+20 ou emregistro+1e não prova o bit5 da célula sem linhagem. Consulta4dcb64/da934 escolhe registros/buffers/callbacks e ramos4dc22c/68684; grounding primário não prova esse contrato multicamada.
- **Regra e resultado:** só implementar após fechar entrada, estado, consulta e efeito. A continuação preservou runtime, colisões, mapas e75020021;362 Vitest/56 arquivos,186 Python sem skips/build passaram (testes extras herdados da base), cinco SHA/imports reconferidos. Sem nova mecânica, não fabricar red-green ou Playwright; aceite anterior continua histórico. P-017/corredor conectado seguem abertos, com próximo consumidor e offsets explícitos no PRD-015.

## A-089 Resolver o registro do objeto antes de transportar uma API de visibilidade

- **Data:**2026-11-18; P-017/PRD-016, continuação sobre158e557.
- **Contexto:** distinguir visibilidade de atores/objetos por ID, objetos
  espaciais da seção3 GR e meshes BCH da seção1 nos oclusores6/445/15.
- **Observado:** MdlSetVisible/0x4ca0c e MdlSetCullingOff/0x4da9c resolvem
  ID/contexto; BuildMdlSetVisible/0x4ef74 usa lookup espacial0x87194.
  As20 chamadas AMX desta última estão em95/99/172/275, com condições de
  works/flags/versão; nenhuma direta nos programas locais6/15/445.
  MdlSetVisibleMesh global0055 usa ID255 e seletores AMX, sem vínculo
  demonstrado aos meshes desses mapas. EntranceIn/DOOR e a string
  setCalculateCullingFlag também não fecham um gatilho de ocultação.
- **Erro a evitar:** transportar o efeito visual de uma API homônima para
  outro registro ou converter transitionEffect do ZO em flag de telhado
  sem rastrear o consumidor e o alvo. Ausência local não exclui globals,
  dispatch indireto ou comportamento nativo.
- **Regra:** exigir cadeia evento→argumentos→registro→modelo/mesh antes de
  implementar visibilidade. Sem ela, documentar candidatos e preservar o
  runtime; repetir A/B do mesmo código ou remover terreno no harness não
  constitui correção nem paridade. Nesta entrega,12 capturas preservaram
  os três oclusores e o ledge84,Y21→20.5; nenhum gancho foi publicado.

## A-090 Normal de ledge precisa do vetor, não da intenção do corredor

- **Data:**2026-11-18; PRD-015/P-017, base28113e3; complementa A-083/A-085.
- **Erro evitado:** traduzir decoder73→2 como leste porque a fronteira desejada
  está à direita. As tabelas code586ea4/586eb4 dão direção2=(-1,0), oeste;
  75→1=(0,+1),72→3=(+1,0),74→0=(0,-1). No ramo e6224 com último argumento0,
  a saída recebe a normal após consultas. Abrir73 em52 oeste→leste contrariaria
  essa evidência, mesmo que um executor aceite as quatro direções por parâmetro.
- **Evidência nova:**645f0 aplica deslocamento8f3a8 antes da consulta de célula;
  77310→64410 transforma resultado-base2 em5; PlayerGrid1b17c/a76e0 encaminha
  um ramo modo0 a a29e0, que solicita25. Registro3ca4c/vtable108fc4 fecha
  ActionCmdJump2G16F, etapas41310→83028→3a0bc. Consumidor401f0 lê o comando da
  filaator+8fc por importCRS19c7e4/code3f852c. Inicialização usa parâmetro de
  distância2, tipo1 e limite16 cardinal; atualizador aplica X/Z e altura.
- **Regra:** separar direção normal, direção de entrada e oposta; preservar o
  teste negativo52 oeste→leste. Identificar o executor não fecha os callbacks,
  máscara residual/e811c, landing ou ramoaa/ActionCmdBehindJump. Não generalizar
  75020021 nem abrir células enquanto esses gates não corresponderem ao core.

## A-091 Executor e família de bike não são binding de input nem relógio

- **Data:**2026-11-18; PRD-015/P-017, continuação de A-087/A-088; renumerado de A-086/A-087 no merge (colisão).
- **Evidência:** callback modo1→51→vtable109844/ActionCmdCycleMachStop;
  modo2→58→1097fc/ActionCmdCycleDirtStop. Estado+14=0f em a47c4 vem após5d,
  registrado como ActionCmdCycleDirtWheelieJump. São famílias nativas Mach/Dirt;
  isso não prova item/menu, Acro como nome comercial ou os estados0e–11 completos.
- **Executor62:** registro3d9d4/vtable10a4d0 identifica
  ActionCmdCycleDirtDanielSteppingJump. Etapas4b224→83028→3a0bc; parâmetros de
  81b3c são distância1, tipo5 e limite8. Há ramo específico de tipo5 na
  atualização de posição/altura. Duas solicitações Daniel ainda não garantem
  dois deslocamentos concluídos; limite8 não prova8 frames em tempo real.
- **Erro evitado:** confundir destino lógico+bc, escrito na inicialização,
  com pose física+e8, atualizada durante o salto e reprojetada ao terminar.
  Não equiparar a máscara intermediária2/4/8/10 ao low12 do permission word.
  Import anônimo usa patch no literal stub+4;19c47c resolve8f3a8, enquanto
  19c478 é início do stub, não um patch válido.
- **Resultado:** runtime, parser, mapas, colisões, grounding e75020021 intactos;
  362 Vitest/56 arquivos,186 Python sem skips/build passaram novamente. Cinco
  SHA, seis RTTI, dois imports e parâmetros reconferidos pela receita do
  [PRD-015](features/engine-3d/prds/PRD-015-permissoes-nativas-de-movimento.md).
  Entrega parcial sem novo red-green/Playwright; aceitação/input continuam
  abertos. Flag20 e seleção GR/altura ficam depois, sem descartar a pendência.

## A-092 Fallback e endpoint não são aceitação de landing

- **Data:**2026-11-18; PRD-015/P-017, baseffd1154; refina A-085–A-087.
- **Evidência:** máscara zero em64594 já devolve o resultado corrente; e811c
  retorna0/0f/10, não5. Busca alternativas laterais, não valida um ledge5.
  Callback default107820/FieldUniqueSequenceNone tem slot24→2ad5c que retorna0;
  fábricas31b40/31d30 também selecionam CROs específicos, não assumir None.
- **Landing:**4de148 usa footprint150/151 e interseção3f3498→3f1a00 com flags,
  altura e geometria. Não foi fechado destino+2 livre só por NPC visível.
  aa tem etapas4513c→48eb4→3a0bc;4df9b8 calcula endpoint2, mas81670/tick usam
  vetores/velocidade/pose e podem terminar antes do limite16.
- **Regra:** não substituir esses contratos por colisão booleana do core nem
  generalizar75020021 pelo endpoint comum. Fonte e receita no PRD-015;
  runtime preservado e sem novo red-green/Playwright por regra ainda parcial.

## A-093 Campo com mesmo offset não prova ownership ou input

- **Data:**2026-11-18; PRD-015/P-017, continuação da A-087.
- **Evidência:**9d09c guarda objeto1438hex emglobal+100; construtoraa0488 chama
  1d634 emobjeto+e50. O alias subobjeto+178 é global100+fc8: inicializado0 em
  1d6f0 por alias16c+c e escrito em1cf74. a0448 passa o parâmetro7 do modelo;
  pacote com três parâmetros fornece baixo8 do primeiro, caso contrário0.
- **Erro evitado:** chamarfc8 de enum de botões/bike, fixar1 sem ler o perfil,
  ou atribuir o STRB code12267c ao mesmo objeto só porque usa offsetfc8.
  Busca por stores imediatos não encontra todos os aliases e não prova ausência.
- **Regra:** rastrear alocação, subobjetos e argumento antes de nomear estado.
  Perfil7 efetivo, seletores dos callbacks e contrato de landing/pose ainda
  faltam; input/item/+14/Daniel e depois flag20/GR continuam abertos.
  362 Vitest/56 arquivos,186 Python sem skips/build e receita estática de15
  instruções/callback/tick/alias passaram nesta entrega documental parcial.

## A-094 Validação visual que mora em `/tmp` não protege nada

- **Data:** 2026-11-18; validacao-visual/PRD-001.
- **Contexto:** cada entrega de corredor ou material foi validada por um script Playwright novo em `/tmp`, com capturas inspecionadas uma vez. Em 2026-11-18 havia 35 desses scripts só no disco temporário da máquina.
- **Erro:** tratar "N capturas inspecionadas, zero erros de console" como aceite durável. Nada era reexecutado na entrega seguinte, então uma mudança de material, câmera ou altura podia quebrar um ponto já aceito sem aviso; e zero erro de console não diz se a imagem está certa.
- **Regra:** validação visual só conta se for reexecutável pelo repositório: cenário em `src/visual/scenarios.ts` ou teste em `e2e/`, rodado por `npm run test:e2e`. Defeito visual encontrado vira cenário com defeito conhecido antes de qualquer correção. Nenhum script de validação fica fora do Git.

## A-095 "Limitação do asset" só vale depois de conferir a fonte na ROM

- **Data:** 2026-11-18; P-019.
- **Contexto:** Brendan e May renderizam sem pés. Registros anteriores (P-019, A-031, A-044, A-049 e relatos de entrega) concluíram que "os pés não existem como geometria" e proibiram reconstruí-los, medindo apenas o GLB já convertido.
- **Erro:** o GLB é saída do nosso conversor, não a fonte. O BCH da ROM tem a malha `sw_parts02` com os tênis; `scripts/convert_character_glb.py` a apaga junto com `sw_parts03..05` por supor que eram duplicatas de `sw_parts01`. A conclusão errada foi copiada de documento em documento e bloqueou a correção.
- **Regra:** antes de registrar que algo "não existe no asset", liste o que o arquivo original declara (meshes, nós, materiais, texturas, ossos) e compare com a saída convertida. Diferença entre os dois é defeito do pipeline. Um filtro que descarta partes do modelo precisa citar a evidência do que está descartando.

## A-096 STATUS como diário e leitura obrigatória extensa fazem a sessão parar antes de entregar

- **Data:** 2026-11-18.
- **Contexto:** `STATUS.md` chegou a 482 linhas de relatos de entrega e o conjunto de leitura obrigatória (STATUS, ROADMAP, PENDENCIAS, APRENDIZADOS, features, tcc) a cerca de 140 mil tokens. Não havia documento dizendo o objetivo final nem a próxima tarefa; a regra em vigor aceitava só disassembly como prova.
- **Erro:** as sessões gastavam a maior parte do contexto lendo histórico, não encontravam uma próxima ação definida e encerravam com "entrega documental" ou "inconclusivo". Duas frentes (PRD-015 e PRD-016) acumularam várias sessões seguidas sem mudança de runtime.
- **Regra:** [VISAO.md](VISAO.md) guarda objetivo, evidência e continuidade; [STATUS.md](STATUS.md) é um retrato de tamanho limitado por teste; [ROADMAP.md](ROADMAP.md) tem uma fila ordenada com verificação por item; relatos de entrega vão para o PRD da frente. Pendências e aprendizados são consultados por título, sob demanda.

