# Status

Atualizado em 2026-11-17 (host verificado no worktree; registros de VPS abaixo são históricos).

## Extensão Petalburg–Rustboro (2026-11-17, zone-maps)

- PRD-008/A-042: IDs confirmados13→27→82→26→16 (Petalburg, Route104 sul, Woods, Route104 norte, Rustboro). Zona25 é Route103. MM4 já deriva26↔16 automaticamente; portais82 permanecem ZO reais. Nova ponte13↔27 explicitamente inferred=true liga(1,z) a(76,z), z46..50, offset76, sem mudar colisões/atores. O encaixe entre MM2/MM3 não é dado ROM extraído.
- Staging reproduzível com `--zones 13 27 82 26 16 --include-neighbors`:29 zonas/53 GRs/57 atores existentes, seis IDs especiais em fallback. Inclui somente destinos ZO diretos e um salto de vizinhos visuais das raízes; nenhum conversor/binário no Git. Public acumulado:74 GRs/68 atores, zero violações texCoord.
- Regressões antes/depois cobrem ponte, cinco lanes/retorno, flags de visibilidade, caminho com NPCs e igualdade dos encounters nativos. **215 Vitest,138 Python sem skips e build passaram**. Playwright na main ainda pendente; não se declara caminhada executada nesta revisão.

## Host de eventos AMX (2026-11-17, worktree `events-layer`)

- Continuação sobre `main 6ae4d58`, com rebase no worktree dedicado; o checkout
  principal não teve sua branch nem fontes alteradas por esta tarefa.
- ABI evidenciada no CRO: `BuildMdlGetHandleByGPos` é empacotamento signed-32,
  não query de cena. MsgLoad usa namespace/seletor e dois slots; `_MapChangeCore`
  usa zona/x/altura/z/direção/quatro flags, não warpId.
- Init opaco permanece suspenso e diagnosticado no console, sem `activeDialogue`
  e sem bloquear setas. Consultas sem retorno validado não aceitam completion.
  NPC pode executar com init opaco guardado; flags da interação são preservadas
  ao restaurá-lo. Stubs cosméticos aprovados ainda exigem Enter explícito.
- Spawn/borda preservam player autoritativo; NPCs continuam sendo projetados.
  `romOrigin` não é `worldOrigin`. O portal 7→24 é warp e borda inferida ao mesmo
  tempo: o motivo de entrada usa a ligação do passo, não a ausência de warp.
- **195 testes Vitest em 35 arquivos, seis testes Python sintéticos de ABI/memória
  e build passando**. Vite mantém o aviso herdado de chunks >500 kB.
- StoryText auxiliar usa fetch lazy/cache. Foram gerados 23 bancos e quatro imagens
  AMX adicionais (7/24 entities/map) somente em `public/assets/` local ignorado,
  com `git check-ignore -v` confirmado antes da escrita. São **23 imagens locais**
  disponíveis: 19 legadas + quatro privadas; novos manifestos só contêm metadados.
- Playwright visível em 5178, código do worktree e assets do `public/` principal:
  NPC 0/script 14 de Littleroot exibiu texto ROM após cinco confirmações cosméticas,
  enquanto o init estava suspenso. A chegada 7→24 manteve `(79,20)/right`; a seta
  seguinte caminhou a `(78,20)/left`, sem textbox de diagnóstico.
- O teste de warp usa **fixture AMX sintética** nas respostas de rede do Playwright:
  nove células chamaram `_MapChangeCore` e o engine real mudou para zona 225,
  `(7,18)/up`, renderizando o interior. Não se declara um ramo completo da ROM
  exercitado. Zero `pageerror` nos smokes finais; não se afirma resolver todo 404.
- Screenshots inspecionados: `/tmp/events-abi-rom-dialogue.png`,
  `/tmp/events-abi-scripted-warp.png`, `/tmp/events-abi-boundary-walking.png`.
  Scripts temporários: `/tmp/playwright-test-events-abi.js` e
  `/tmp/playwright-test-boundary-events.js`. O teste aguarda recursos lazy do
  destino, pois o `networkidle` anterior não representa prontidão do init novo.
- [ADR-005](features/core-jogo/adrs/ADR-005-abi-cro-e-init-nao-bloqueante.md),
  [PRD-004](features/core-jogo/prds/PRD-004-abi-e-recursos-locais-de-eventos.md)
  e A-034–A-038 registram evidência, geração e política atual. IDs a partir de
  A-034 evitam A-030–A-033 já presentes na main durante a continuação.
- **P-013/P-017 continuam abertas:** ACMD/câmera, altura/flags do warp, fluxo
  auxiliar de mensagens no emulador, ramos naturais com matemática/queries de
  ator ainda não suportadas, callbacks, persistência AMX/save/party/bag e paridade
  da história. O init de Littleroot agora alcança `BuildMdlEventAnimeSetEnd`;
  pausá-lo não equivale a reproduzir a animação.

## Adoção GF1 no runtime (2026-11-17, anim-0xef-re sobre main 6ae4d58)

- [PRD-007](features/engine-3d/prds/PRD-007-animacoes-nativas-no-runtime.md): eventos puros de golpe/dano/queda alimentam `NativeAnimationController`; physical/special por categoria, damage, faint com pose final e idle em espera. O host aguarda os clipes antes de adotar o próximo estado, com cancelamento de cargas antigas e bloqueio de input.
- [Catálogo runtime](../src/data/nativeAssets.json): **102 GLBs locais** em URLs imutáveis de `public/assets/native/`: 40 Pokémon + 56 personagens nativos, seis GLBs-base de fallback (Taillow, MM0122–0125/MM0312). Abrange 41 variantes Pokémon/39 espécies e 64 URLs de personagens/aliases, incluindo os MM já staged pela main atualizada. Dez IDs especiais de ator seguem com NPC fallback explícito. Arquivos proprietários continuam ignorados, não versionados.
- 56 personagens receberam pose GF1 `overworld_000`, com preservação estrutural validada; 38 poses existentes foram verificadas e 18 anexadas após ampliar o staging, sem sobrescrever outputs. O host prefere `_000` em repouso e `_002` no deslocamento, sem declarar semântica global dos IDs. Magikarp/Tympole/Taillow continuam como limitações explícitas em P-012.
- P-019: [auditoria de 61 modelos](features/pipeline-rom/native-uv-audit.json) encontrou **zero reparos texCoord** e UV0/UV1 idênticos em todos os pares comparados. Trocar o índice não corrige a célula nessas saídas; expressão de atlas continua aberta. Pés ausentes são limitação dos GLBs-base.
- **185 Vitest/34 arquivos, 129 testes Python (um skip) e build canônico passaram** após merge da main; aviso conhecido de chunks grandes. O skip pré-existente ocorre porque os assets públicos estão no principal, não neste worktree. Promoção checou floats dos 102 modelos e o plano validou todas as 56 poses existentes.
- Playwright visível executado no **principal/main 8cb61de**, porta 5187: Route 101/zone_0023, Torchic Lv5 contra Zigzagoon Lv2; Scratch → damage → status/special inimigo, depois Ember → damage → faint mantido. `physical` durou 2,4 s/228 canais e mudou 45 ossos entre t=0,367 e 1,0834 s. Zero pageerror/warnings/HTTP>=400; assets Pokémon nativos responderam 200. Evidência ignorada em `rom/native_runtime_validation/` (seis PNGs e `report.json`); script observador em `/tmp/playwright-test-native-battle.js`, sem substituir clipes/relógio.
- A-033 corrigiu o recorte legado `alphaTest=0,45` sobre Pokémon OPAQUE, mantendo MASK/BLEND importados e a heurística anterior dos mapas/personagens; **186 Vitest/34 arquivos e build passaram**. **Revalidado no principal/main ac4054d**, Chromium visível 149.0.7827.55/porta 5187: mesmos clipes e 45 ossos alterados entre t≈0,367 e 1,082 s, OPAQUE com alphaTest=0 sem intervenção de material, corpos restaurados e faint mantido. Zero pageerror, console error, warning ou HTTP>=400. As seis capturas finais inspecionadas e o relatório estão em `rom/native_runtime_validation/final/`, ignorados. Cores/combiners/atlas dos olhos e texturas do overworld continuam incorretos (P-007/P-017/P-019); isso não comprova paridade com emulador.

## Estado do Código e Build

- Branch deste registro histórico: `main`; verificação atual na seção do host acima.
- `npm test` (`vitest run`): **passando** (`18` arquivos, `138` testes na branch `audio-zones`; inclui `4` em [src/core/zoneAudio.test.ts](../src/core/zoneAudio.test.ts); contagem anterior: `6` em [src/core/wildPokemon.test.ts](../src/core/wildPokemon.test.ts), `15` em [src/core/battleGrowth.test.ts](../src/core/battleGrowth.test.ts), `16` em [src/core/battleProgression.test.ts](../src/core/battleProgression.test.ts), `22` em [src/core/battleMechanics.test.ts](../src/core/battleMechanics.test.ts), `13` em [src/core/battleData.test.ts](../src/core/battleData.test.ts), `4` em [src/engine/battleArena.test.ts](../src/engine/battleArena.test.ts), `4` em [src/engine/fixOrasMaterials.test.ts](../src/engine/fixOrasMaterials.test.ts), `7` em [src/core/gameState.test.ts](../src/core/gameState.test.ts), `5` em [src/core/bag.test.ts](../src/core/bag.test.ts), `6` em [src/core/battle.test.ts](../src/core/battle.test.ts), `3` em [src/core/save.test.ts](../src/core/save.test.ts), `1` em [src/core/room.test.ts](../src/core/room.test.ts) e `3` em [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts)).
- `python3 -m unittest scripts/test_pipeline.py`: **passando** (`25` testes com fixtures sintéticas: zona → BGM em `extract_zone_audio.py` (BCSAR sintético, `A-023`), parsers de evolução/natureza (`battle_progression_parsers.py`), `decompress_lz11`, `parse_gr_grid`, `decode_gen6_text` (incl. glifos ♀/♂, `A-012`), conversão de materiais PICA200 em `convert_gr_to_glb.py` (`P-007`) e `8` parsers de tabelas de batalha em `extract_battle_tables.py` (`A-010`)).
- `npm run build` (`tsc && vite build`): **passando** (bundle inicial `index-*.js` `3.22 kB`; `game-*.js` `741 kB`; tabelas de batalha em chunks sob demanda, [ADR-004](features/pipeline-rom/adrs/ADR-004-tabelas-de-batalha-sob-demanda.md), `P-015` fechada) (`dist/index.html` e bundle JS gerados sem erros de TypeScript).
- Módulos existentes:
  - [src/core/types.ts](../src/core/types.ts) e [src/core/gameState.ts](../src/core/gameState.ts): estado inicial com `spawnPos`, `isWalkable`, `isTallGrass`, `interact`, `findTriggeredTrainer` (linha de visão + derrota), `requiredFlag`/`altText` em warps/NPCs, movimentação e transição por `warp`.
  - [src/core/bag.ts](../src/core/bag.ts): inventário imutável (`createInitialBag`, `addBagItem`, `consumePokeball`, `usePotion`).
  - [src/core/battle.ts](../src/core/battle.ts): API pública da batalha (encontros ponderados, captura, troca, fuga, Centro Pokémon) sobre [battleTurn.ts](../src/core/battleTurn.ts) (ordem por prioridade −7..+5 → velocidade efetiva → empate por RNG, flinch, dano residual, vitória/derrota), [moveExecution.ts](../src/core/moveExecution.ts) (PP com Pressure, precisão Gen VI com estágios e `accuracy=101`, golpes de status/estágio/cura, dreno, recuo, multi-hit, efeitos secundários), [damage.ts](../src/core/damage.ts), [statusConditions.ts](../src/core/statusConditions.ts) (paralisia, sono, congelamento, queimadura, veneno, tóxico + imunidades de tipo), [statStages.ts](../src/core/statStages.ts) e [battlePokemon.ts](../src/core/battlePokemon.ts) (`PokemonInstance` sobre `DexSpecies`/`BattleMove`, moveset padrão Gen VI por learnset). Críticos Gen VI (1/16, 1/8, 1/2, sempre; ×1.5; ignora estágios desfavoráveis; Battle/Shell Armor) em [damage.ts](../src/core/damage.ts); XP pelas 6 curvas reais e fórmula plana Gen VI com bônus de treinador e divisão entre participantes em [experience.ts](../src/core/experience.ts); level-up com aprendizado de golpes e fila `pendingMoves` em [levelUp.ts](../src/core/levelUp.ts); times de até 6 em [battleParty.ts](../src/core/battleParty.ts) (troca voluntária, troca forçada após desmaio, treinador envia o próximo, vitória/derrota só com o time inteiro fora) e IA em [battleAi.ts](../src/core/battleAi.ts) (selvagem aleatório; treinador por dano esperado/utilidade, empate por RNG). Stats Gen VI com IV/EV/natureza em [statSpread.ts](../src/core/statSpread.ts)/[natures.ts](../src/core/natures.ts), EVs por KO (limites 252/510), Exp. Share e Lucky Egg; evolução por nível/amizade/horário/personalidade/golpe/pedra em [evolution.ts](../src/core/evolution.ts), aplicada por `game.ts` ao fechar a batalha. Geração de selvagens/treinadores com IV/natureza/personalidade e adapter de encontros de `src/data/zones/*.json` (fallback `MAP_ENCOUNTERS`) em [wildPokemon.ts](../src/core/wildPokemon.ts). Tabelas carregadas por loader injetado em [battleTables.ts](../src/core/battleTables.ts) (ADR-004). RNG sempre injetável.
  - [src/core/save.ts](../src/core/save.ts): serialização e validação de save (`serializeSave`, `deserializeSave`) incluindo `bag` para persistência em `localStorage`.
  - [src/core/room.ts](../src/core/room.ts): estado autoritativo de salas multiplayer (`createRoom`, `joinRoom`, `leaveRoom`, `applyRoomMove`) reutilizando `movePlayer`.
  - [src/data/maps/index.ts](../src/data/maps/index.ts): mapas reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`, `route_102.json`, `route_102_west.json`, `route_103.json`, `petalburg_city.json`) + interiores ([interiors.ts](../src/data/maps/interiors.ts): `brendan_house`, `birch_lab`, `oldale_pokecenter`) com `.glb` + `.png`s em `public/assets/maps/` e diálogos reais em `src/data/texts/`.
  - [src/data/pokemon/](../src/data/pokemon/species.ts): elenco derivado da ROM via `core/dex` (não é mais fonte de dados; `SPECIES`/`MOVES`/`findRosterSpecies`) — iniciais (`Treecko`, `Torchic`, `Mudkip`) e encontros da `Route 101`/`Route 102` (`Poochyena`, `Zigzagoon`, `Wurmple`, `Lotad`, `Ralts`), com `.glb` animado (`idle`, `skins: 1`) + `.png`s em `public/assets/pokemon/`.
  - [src/data/battle/](../src/data/battle/): tabelas de batalha reais da ROM ([battle-tables.md](features/pipeline-rom/battle-tables.md)): `species.json` (826 entradas personal com formas), `moves.json` (622 golpes), `types.json` (18×18), `learnsets.json` (level-up), `machines.json` (TM/HM), `evolutions.json` (826 conjuntos de `a/1/9/2`) e `natures.json` (25 naturezas). Consumidas por [src/core/typeChart.ts](../src/core/typeChart.ts) (efetividade 18×18, usada por `getTypeEffectiveness` em `battle.ts`), [src/core/dex.ts](../src/core/dex.ts) (lookup de espécie/forma/golpe) e [src/core/learnsets.ts](../src/core/learnsets.ts) (level-up, moveset padrão Gen VI, TM/HM, `canLearnMove`).
  - [src/engine/SceneManager.ts](../src/engine/SceneManager.ts): cena Three.js carregando `.glb` de mapas, personagens (`brendan.glb`, `may.glb`, `npc.glb`) com interpolação suave de movimento e animações esqueléticas `idle`/`walk`, e arena de batalha 3D (`syncBattle` com `battleMixers`) via `GLTFLoader`.
  - [src/ai/emulatorParity.test.ts](../src/ai/emulatorParity.test.ts): suíte de paridade contra o comportamento esperado da ROM original.
  - [src/main.ts](../src/main.ts): bootstrap que carrega as tabelas de batalha e importa [src/game.ts](../src/game.ts): loop de renderização, teclado, caixa de diálogo, menu estilo 3DS (`Time`, `Mochila`, `Pokédex`, `Salvar`), HUD de batalha 3D com barras de HP coloridas, time de até 6 Pokémon e auto-save em `localStorage`.
- Diretórios planejados ainda não criados: `src/ai/`.

## Corredor contínuo (2026-11-17, implementação sobre main b09a93b)

- `_neighbors.json`: 58 zonas/90 bordas dirigidas derivadas do contato MM, com ponte 7↔24 explicitamente inferred=true, aprovada pelo coordenador; não se alega extração da conexão entre MM1 e MM2. Padding permanece bloqueado; passo entre x=1 de Oldale e x=78 de Route102 mede um tile mundial.
- Core mantém colisão/direção e coordenadas locais; engine conserva chunks/atores e usa origens mundiais estáveis. Repositório só pré-carrega um salto de vizinhos; encontros vêm diretamente de zones/NNN_*.json por ID exato.
- Staging ampliado: 23 zonas (slice + destinos diretos), 35 GRs, 51 atores; glb_uv_fix aplicado antes da cópia e os 7 testes UV passaram apontando ao public principal, sem skips.
- Correções após Playwright em f4eaffa: ponte inferida suprime somente o warp ZO da mesma conexão (antes puxava chegada78,22/left para79,20/right); UV difuso PICA usa canal0, pois A/B revelou distorção no canal1. A-040/A-041 registram regressões e evidência. **211 Vitest/136 Python sem skips e build** passaram.
- **Playwright visível no checkout principal e94f6c8**, `npm run dev -- --host 127.0.0.1 --port 5200 --strictPort`: ida de213 passos e rodada ampliada de**500 passos** por teclado: 6→23→7→24→13→24→7→25→7→23→6→223→6, terminando com diálogo ROM do NPC0/script14 em24,20/up. Ponte preservou78,22/left e retorno1,22/right, sem fade nas bordas; warp real entrou em223 em15,18/up e voltou a6 em14,11/down.
- Capturas de todas as zonas inspecionadas em `/tmp/corridor-zone-{6,23,7,24,13}.png`; Route103, casa e diálogo em `/tmp/roundtrip-zone_0025.png`, `/tmp/roundtrip-house-entry.png`, `/tmp/roundtrip-house-exit.png`, `/tmp/roundtrip-npc-rom-dialogue.png`. Logs completos: `/tmp/corridor-results.json` e `/tmp/world-roundtrip-results.json`. Antes/depois UV: `/tmp/uv-channel-original.png` e `/tmp/uv-channel-zero.png`; nenhuma imagem proprietária versionada.
- Zero pageerror, erro de shader ou tela preta nas rodadas finais; auditoria HTTP sem respostas missing, mantendo os fallbacks conhecidos dos IDs especiais sem modelo. BGM real com AudioContext running alternou `bgm_sg_t_01`, `bgm_sg_r_a`, `bgm_sg_t_02`, `bgm_sg_c_01`; rotas compartilham r_a e casa compartilha t_01. Onze avisos P-013/P-008 registraram apresentações opacas e SE393216 silencioso; diálogo real apareceu após confirmações explícitas, sem fingir animação/ACMD implementada. Os dois erros de favicon.ico404 foram corrigidos por SVG inline: a rodada completa de 500 passos foi repetida em d85d534 com **zero consoleErrors, pageErrors e missing**, registrada no mesmo log.
- Texturas difusas de chão/placas/telhados restauradas; cartões de folhagem/combiners PICA e marcadores de warp debug continuam visíveis, sem alegação de paridade gráfica. Encontros foram verificados contra zones/023_route_101.json em Vitest; o harness usa PRNG distinto em0.9..1 para evitar batalhas aleatórias, não prova de disparo selvagem nessa caminhada.

## Integração maps_v2 no runtime (2026-11-17, zone-maps sobre main 5d9a3b6)

- `getZoneMap` lazy em `src/data/maps_v2/`: cache/retry/adapter, bootstrap zone_0006 e destino carregado antes da transição. SpawnDerived preservado; `?maps=legacy` mantém os mapas antigos e save v1, enquanto o modo novo usa namespace v2 sem migrar/apagar saves existentes.
- Engine posiciona chunks GR por offset e renderiza NPCs mm_NNNN com fallback npc.glb; core respeita retângulos de warp, portas no GR bloqueado e orientação básica. Efeitos diferentes de zero recebem fade genérico 120+120ms; não é ABI cinematográfica validada. BGM/encounters usam a zona atual.
- Staging no checkout principal: **15 zonas, 25 GRs com texturas, 42 atores**; 15 IDs especiais sem asset mm correspondente mantêm fallback. Nenhum conversor ou cópia dos 800+ mapas, nenhum asset no Git.
- **150 Vitest (23 arquivos), 113 Python e build**; smoke visível em Chromium instalado, servidor deste worktree, assets reais do public principal servidos por interceptação Playwright devido à ausência de public local: 6→223→6, posição (15,18)/up, somente JSONs 0006/0223 carregados e zero pageerror. Screenshots temporários `/tmp/zone-maps-house.png` e `/tmp/zone-maps-town.png` foram inspecionados; isso não prova paridade no emulador.
- [PRD-005](features/engine-3d/prds/PRD-005-mapas-de-zona-no-runtime.md), [ADR-003](features/engine-3d/adrs/ADR-003-zonas-lazy-e-assets-compostos.md), A-025/P-017 registram limites: spawn/init/VM, diálogos, spawnFlag, IDs especiais e bordas contínuas sem warp ZO ainda não ligados.

## Mapas por zona (2026-11-17, branch `zone-maps` sobre main `13c3279`)

- [build_zone_maps.py](../scripts/build_zone_maps.py) e [formato](features/pipeline-rom/maps-format.md): 431 matrizes MM fisicamente decodificadas (409 básicas/22 estendidas), 422 referenciadas por ZoneData. `mapArea` não indexa os retângulos sec1; o recorte correto vem de zoneIds na sec0 (4W×4H, células 10×10 tiles). Não há sec2 no corpus.
- `src/data/maps_v2/`: 536 mapas/1.480.000 tiles, 846 GRs compostos via `parse_gr_grid`, 911 warps com destinos existentes, 2.904 NPCs e 9.150 entradas de encontro. Escala 18 unidades/tile comprovada pelos 911 centros de warp; NPCs já estão em tiles. Route 102 agora é 80×40 e Route 103 120×40.
- Dez referências antigas: 16.000 tiles comparados por camada, zero diferenças de colisão/terreno e zero omissões. `_validation.json` preserva 48 warps e 48 targets off-region (todos da zona 0) e quatro NPCs off-map, sem correções artificiais.
- Spawn fica marcado `spawnDerived=true`, com política determinística; não é spawn canônico de init/save. Sem mudanças no loader/core/renderer nem conversão 3D. Semântica residual de flags/array auxiliar e futura integração permanecem em P-017, no limite aprovado pelo coordenador.
- Verificação: 13 regressões sintéticas novas; **107 testes Python, 134 Vitest (17 arquivos) e build canônico passando**. JSONs estruturais, sem dumps binários; A-024/PRD-003/ADR-005 registram evidência, reprodução e limites.

## Investigação de scripts ORAS (2026-11-17, Mac/worktree `zone-scripts-re`)

- [Formato documentado](features/pipeline-rom/script-format.md): 1.072 scripts de zonas e 85 entradas de `a/0/2/9` são Pawn/AMX v10, com células de 32 bits compactadas. Semântica de chamadas nativas e runner ainda pendentes (P-013/A-016).
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
- Nativas: 204/205 hashes nomeados (198 por strings dos binários locais e seis por referência comunitária); `c34ad2ab` desconhecido. Vínculos NPC/trigger/furniture: 108 únicos e 11 ambíguos, sem seleção especulativa (P-013/A-017).
- Verificação atual: `python3 -B -m unittest scripts/test_amx_disassembly.py scripts/test_zone_script_bindings.py scripts/test_zone_scripts.py scripts/test_pipeline.py` passou (40 testes); `npm install` executado; `npm test && npm run build` passou (32 testes Vitest). Nenhuma dependência foi atualizada.
- Avisos herdados: bundle Vite acima de 500 KB e nove vulnerabilidades npm (P-016). Os binários foram somente lidos; nenhuma conversão 3D executada.

## Investigação local de animações (macOS, 2026-11-17)

- Worktree `anim-0xef-re`, base `b060a9b`; os registros anteriores de VPS acima/abaixo são históricos e não foram revalidados nesta investigação.
- `P-012`: [formato nativo documentado](features/pipeline-rom/animations-format.md), incluindo offsets/hashes (`AN-E1`–`AN-E7`). `0xef` é N=239 de `GF1MotionPack`, já suportado pelo SPICA GFL; o wrapper local usava GFL2 incorretamente. `PB` contém batalha, `PK` interações, e expressões ficam em BCHs separados de material/visibilidade.
- [native_motions.py](../scripts/native_motions.py) converte um clipe por chamada; [attach_native_motions.py](../scripts/attach_native_motions.py) integra os canais ao GLB texturizado produzido pelos pipelines existentes, por manifesto explícito serial (`--plan` disponível), preservando materiais/imagens/skin e filtro `sw_parts`. Não altera `src/` ou ferramentas compartilhadas e não sobrescreve outputs existentes.
- `AN-E8`: quatro saídas novas em `rom/extracted/models/native_validation/` do checkout principal: Treecko (PC 2795/PB 2800, cinco clipes semânticos), Brendan (MM 0315), Wally (MM 0180) e Roxanne (MM 0187), os personagens com `overworld_002/093` além dos idle/walk procedurais existentes. Todos mantêm o BIN original como prefixo, geometria/material/texturas idênticos, três imagens embutidas, accessors float32 finitos e durações nativas corretas a 30 fps; paridade visual e expressões continuam não verificadas/integradas. São quatro modelos/11 clipes seriais em baixa prioridade, não batch pesado; `A-021` registra o lookup por joints e a correção dos rótulos 0314/0315.
- Ambiente observado: Python 3.12.3, .NET SDK 8.0.428 em `~/.dotnet/dotnet`, Blender 3.4.1 em `~/Applications/Blender3.4.app`. SPICA fonte em `/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/_tools/SPICA`, commit `82acbd63695e4ef8b95a92ce884f25ec1044788f` com patches locais existentes de exportação. ROM extraída no checkout principal irmão de `_tools/`, ausente no worktree.
- Verificação neste worktree: `npm ci --offline`; `npm test` (8 arquivos / 32 testes) e `npm run build` passaram; Vite manteve aviso de bundle >500 kB. A suíte Python passou com 28 testes (13 de merge/integração + 7 nativos + 8 existentes); o ataque Bulbasaur PB 8 foi exportado com 195 canais e duração 50/30 s após regressão reproduzida de perda do último frame. Detalhes em [animations-format.md](features/pipeline-rom/animations-format.md). Avisos CA1416, IOR/NumPy e bones ausentes do Blender foram registrados, sem reivindicação de fidelidade visual.

## Cobertura ampla de animações (AN-E9, macOS, 2026-11-17)

- [Manifesto versionado](features/pipeline-rom/native-models-manifest.json): 585 modelos inventariados — todos os 544 diretórios MM e 41 modelos Pokémon de 39 espécies derivadas dos encontros das zonas 6, 7, 23–30, starters/evoluções e lendários de capa (incluídas segundas variantes). Mapeamento espécie→PC usa a tabela do slot 0 de `a/0/0/8`; PB=PC+5, sem inferir espécie pelo tag interno (`A-022`).
- Lote autorizado executado com `nice 10`, concorrência 2: **388 GLBs novos / 544 clipes nativos**, em `rom/extracted/models/clips_merged/` do checkout principal, ignorado antes de gravar. Personagens: 348 merges, 177 sem seção GF1, 9 com poses de um frame e 10 falhas MM0024–0033 (bases sem skin; import sem action). Pokémon: 40 merges / 196 clipes, falha Taillow #276 (`Segment scale compensation has a zero parent scale` no SPICA). Nenhum output-base ou `src/` foi modificado; logs individuais permanecem locais.
- O runner terminou com código 1, corretamente, pelas 11 falhas registradas; não significa cobertura completa com sucesso. Magikarp #129 não tem `special/faint` solicitados e Tympole #535 não tem `physical/faint`; ausências registradas sem fallback. Não houve correção das ferramentas compartilhadas nem fabricação de clipes.
- Dez amostras passaram na validação estrutural: MM0034/0172/0263/0350/0543 e espécies 72/256/279/383 variante 1/692. BIN e campos-base preservados, imagens embutidas, floats finitos, alvos em joints e tempos/durações corretos; hashes/métricas no manifesto. Verificação: 42 testes Python, 32 Vitest e build passaram; aviso Vite >500 kB permanece. Paridade visual/emulador, looping, expressões e adoção no jogo não foram validados.

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

## Estado da ROM e Ambiente no macOS (2026-11-17)

- `rom/` no Mac: `.7z` (`1.1G`), `readme.txt` e `rom/extracted/` (`ExeFS`, `garc`, `models`, `RomFS` — `1.8G`). O `.3ds` não foi copiado (não é necessário: extração já feita).
- Ferramentas instaladas sem sudo:
  - `.NET SDK 8.0.428` em `~/.dotnet` (via `dotnet-install.sh`).
  - `Blender 3.4.1` em `~/Applications/Blender3.4.app` (necessário p/ `collada_import`; Blender 5.2.4 também instalado em `~/Applications/Blender.app`).
  - `assimp 6.0`, `p7zip 17.05`, `vgmstream r2168`, `ffmpeg 9.0.2` via Homebrew.
  - `SPICA` + `SpicaExport` em `v1/_tools/` (fora do repo), compilado com os patches locais de PNG/`ExportSkinning`; wrappers em `v1/_tools/bin/` (`SpicaExport`, `blender`). `ctrtool` não instalado no Mac (desnecessário — partições já extraídas).
- Descoberta e extração (macOS):
  - Tabela de zonas decodificada: `a/0/1/3` (`ZO` × 536 + `0536.bin` ZoneData master + `0537.bin` encontros `EN`) cruzada com `a/0/4/0` (matrizes) e metlist `a_0_7_3/0090`; `src/data/zones.json` gerado por [scripts/build_zone_catalog.py](../scripts/build_zone_catalog.py) — 536 zonas nomeadas com `grIds` e `textFile` (`A-008`).
  - `a/0/3/9` completo desempacotado (`857` `GR`s) e `a/0/1/4` (`229` `AD`s) em `rom/extracted/garc/` (`417M`).
  - `536` textos de zona em `src/data/texts/zones/` e `175` arquivos GameText em `src/data/texts/gametext/` (via `extract_texts.decode_gen6_text`).
  - `199` trilhas `.bcstm` → `.mp3` em `rom/extracted/audio/mp3/` (`281M`); [src/data/zone_audio.json](../src/data/zone_audio.json) mapeia as 536 zonas para a trilha ([audio-format.md](features/pipeline-rom/audio-format.md)); `game.ts` toca a BGM do mapa via [src/engine/audioPlayer.ts](../src/engine/audioPlayer.ts) e, em batalha, tema/fanfarra/jingles via [src/core/battleAudio.ts](../src/core/battleAudio.ts) (16 faixas do slice em `public/assets/audio/`, local; validado com Playwright, `P-008`).
  - Batch `.glb` em andamento em `rom/extracted/models/`: `gr_NNNN/` (GRs de mapa), `pokemon/` (`--all`, tags `pmNNNN_NN`), `characters/` (`mm_NNNN`).

## Correção de texCoord nos GLBs de GR (2026-11-17, fix/texcoord-uv-channels)

- Regressão visual maps_v2 (casas marrons/chão plano) rastreada a `texture.texCoord` esparso (3/4) escrito pelo assimp v6 sem atributo `TEXCOORD_n` correspondente (A-026). Fix na origem: `convert_gr_to_glb` agora chama [glb_uv_fix.py](../scripts/glb_uv_fix.py) após o export; validador [validate_glb.py](../scripts/validate_glb.py) checa qualquer `.glb`.
- Os **36 GLBs staged** em `public/assets/maps/` do checkout principal foram corrigidos in-place (todos os `gr_*` afetados; os legados/intactos não foram tocados) e `validate_glb.py` reporta 0 violações; screenshot Playwright confirma texturas restauradas e zero erros de shader.
- `python3 -B -m unittest` das suítes `test_glb_uv_fix` (+7 testes sintéticos e de assets staged) junto às demais: **120 testes, 1 skip** (assets públicos ausentes neste worktree; rodados com `GLB_MAPS_DIR` apontando ao checkout principal). `npm test` **150 testes** e `npm run build` passaram.
- Auditoria `rom/extracted/models/gr_*/`: 831/846 inválidos → `P-018`. Rosto/pés dos personagens é problema de asset, não da regressão → `P-019`.
