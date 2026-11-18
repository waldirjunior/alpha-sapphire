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

## A-046 Um stub do executável pode importar de volta o CRO

- **Data:** 2026-11-18.
- **Contexto:** P-019/PRD-009, continuação sobre 4f42e54 de A-045.
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

## A-047 Expressão é estado por instância, não alteração da geometria

- **Data:** 2026-11-18.
- **Contexto:** P-019, dispatch ChangeFace, projeção AMX e material de cinco
  GLBs corrigidos em A-044.
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

## A-048 Contador de update não define uma duração em segundos

- **Data:** 2026-11-18.
- **Contexto:** Rotina de piscada DllField/0x38850–0x389ac e setup0x80a5c.
- **Observado:** Estado+0x27c habilita o caminho; o setter de ChangeFace grava
  esse byte como frame==0. O update aplica frame10, espera dois updates e
  aplica0. A espera é helper(60)+60, com caminhos curtos4/8 e byte0x27d.
- **Regra:** Separar paleta, gatilho e clock. Nem70 frames do BCH nem dois
  updates autorizam assumir30/60fps ou inventar um timer de idle. O contrato
  do helper e a frequência/condições do update ainda precisam ser provados.
- **Consequência:** Seleção explícita implementada, piscada automática
  explicitamente pendente; P-019 permanece aberta para isso, ramos naturais,
  cobertura de outros materiais e paridade. Pés ausentes não foram inventados.
