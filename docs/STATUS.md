# Status

Atualizado em 2026-11-18 (host verificado no worktree; registros de VPS abaixo são históricos).

## Bondinho de Mt. Chimney e descida a Lavaridge (2026-11-18)

- PRD-013/A-069/A-070, base357692a e core/ADR-008: cadeia39→384→385→83→84→39→9 confirmada em MM/ZO/AMX, sem ponte nova. Bondinho usa demo11/12, work16699=1 e _MapChangeCore, não ZO entre estações. Gate666 dos atores39/0–2 tem FlagSet real global0028@21804 chamado por Meteor71; fixture recorta só essa flag, sem executar o evento inteiro.
- Entities385/script1 restaura work16699 e move funcionário1 de21,26 para24,57,18, liberando a chegada23,18 sem ocultá-lo nem deslocar o jogador. Duas imagens entities adicionadas por SHA a local-memory, preservando as oito anteriores; binding NPC2 e imagens map/apresentação do bondinho não promovidos. Transporte é fixture pós-demo explícita dos recortes WorkSet e _MapChangeCore, sem executar filme/embarque/RecordAdd175 ou alegar campanha natural.
- Jagged84 bloqueava emz30 mesmo sem NPCs. Inventário de223 GRs staged encontrou541 palavras0x75020021 com norte livre; geometrias de84 e outras rotas corroboram queda ao sul. Core salta dois tiles ao sul somente por metadado dessa palavra exata e aterrissagem livre; subida/lateral, bounds, atores, diálogo e prioridade ZO preservados. Variante0000/6400 e ledges laterais não implementados. Evidência estática/semântica derivada, não validação no emulador ou ABI. Animação de hop e altura visual continuam pendentes.
- Regeneração adicionou816 southLedges em28 zonas; auditoria estruturada confirmou todos os outros campos idênticos à base, inclusive colisões/terreno/warps/NPCs/encontros. Regressão após init385 alcança83→84→39→9 com os NPCs nativos; sem metadado continua bloqueada emz30. Testes negativos de Meteor71→42/72/73 continuam válidos; loop antigo não foi fechado.
- Stage33 zonas/99 GRs/91 atores existentes,18 códigos especiais em fallback, BGMs c_02/d_01/d_02/r_c/t_02. Zero assets declarados ausentes e SHA das dez imagens AMX conferidos;248 GLBs públicos de mapa sem erros UV e dry-run GR/atores sem remaps. Saídas ignoradas; nenhum binário versionado.
- **340 Vitest/52 arquivos,160 Python sem skips e build passaram.** Integração e Playwright visível na main permanecem pendentes. Preservar P-013/P-017/P-019 e limites visuais já conhecidos; nenhum aceite gráfico ou campanha completa. npm install inicial reportou9 vulnerabilidades herdadas (3 moderadas/4 altas/2 críticas); dependências não alteradas.

## Mauville–Fallarbor e entrada de Meteor Falls (2026-11-18)

- PRD-012/A-066–A-068 sobrec9be392: caminho físico15→445→37→39→85→38→36→40→10→41→71. Route113 precede Fallarbor10, Route114 liga Meteor; contatos MM7/MM8 e ZO existentes, sem ponte nova, colisão ou encontro alterado. Loop71→42→16 ainda bloqueado em P-017.
- Base chegou a37(27,117), mas quatro objetos8204/IDs2–5/script10050/spawnFlag0 bloqueiam o norte. global0046 SHA c63af4251dc7406fd89126af85cbef598c889312f303d117b51ba7547c50a362 resolve10050→5324→3984:29 funções alcançáveis, CallIwakudakiEffect@4276, sem FlagSet/MdlDel nesse grafo AMX. Efeito@5576 é10051; FlagSet2724@6792/7208 pertence a10054/10055, não prova de flag por pedra. Persistência interna do efeito na ROM não comprovada.
- Fixture autorizada é **derivada pós-RockSmash/não-natural**: só tombstones37:2..5, persistência/projeção existentes, sem executar10050 ou o efeito, sem editar posição/flags/colisão. Caminha pelos mapas nativos até71(57,35). Teste sem NPCs em71 continua sem alcançar42/72/73; alturas ZO54/-126 preservadas, causa de permissões/altura desconhecida, não atribuída a cutscene.
- Stage59 zonas/151 GRs/104 atores existentes,20 códigos especiais em fallback, BGMs c_02/d_01/d_05/r_b/r_c/r_e/t_05. Probe de mapas/MP3s zero ausentes;223 GLBs públicos de mapa válidos/zero violações, dry-run UV público sem remaps. Outputs ignorados, nenhum binário versionado.
- **328 Vitest/49 arquivos,159 Python sem skips e build passaram**; aviso de chunk >500kB herdado. Playwright visível main e12419b/5200 passou1023 passos,115 base até37(31,66) com duas tentativas bloqueadas,656 até Fallarbor sob fixture derivada e1014 até entrada71; final51,32/reload, com dois movimentos adicionais bloqueados no limite do componente. Posição/flags preservadas ao aplicar fixture, somente quatro tombstones; não é execução do efeito nem prova de persistência ROM.
- **Zero consoleErrors/pageErrors/missing/requestFailures**; encontros das onze zonas percorridas nativos, dez transições e16 capturas inspecionadas. Um aviso BuildMdlEventAnimeSetEnd(6553770,0) permanece P-013, não bloqueou input. Evidências/script em `/tmp/fallarbor-results.json` e `/tmp/playwright-test-fallarbor.js`; imagens00–15 listadas no PRD-012.
- **Aceite visual não fechado:** oclusão severa/ausência de avatar legível nas chegadas445/39/10/41/71 e no bloqueio37; só a projeção/colisão, não as imagens do terreno, comprova a remoção das quatro pedras. Fiery85 mostra exterior preto/céu,36 oclusão por árvore, encostas/folhagem/fallbacks com limites de material. Preservar P-017/P-019 e investigar câmera/altura/geometria, sem causa presumida. Loop71→42→16 e RockSmash natural continuam bloqueados/pendentes.

## Verdanturf–Mauville e acesso condicional a Slateport (2026-11-18)

- PRD-011/A-061/A-062, base3dbfd21:11→44→445→15; hall445 antes do pátio15. Contato MM6 entre11/44; demais ligações ZO preservadas, sem ponte ou grafo modificado. Continuação445→33→14 usa Route110 terrestre33, não variante34; retângulos recíprocos7/5 e5/3 não justificam continuidade lateral presumida.
- Regressão base chegou a33 mas não14 por cinco NPCs9–13/hide-flag660. Bloco real33/map7360..7475 contém WorkSet16526=2, FlagSet660 e MdlDel dos cinco IDs; fixture com halt7476 executa na VM existente e restaura/projeta progresso real, sem alterar colisões ou ocultar genericamente atores. SHA/offsets no PRD; não é função/campanha inteira.
- Stage `--zones 11 44 445 15 33 14 --include-neighbors --audio-dir`:46 zonas/100 GRs/100 atores existentes,18 códigos em fallback; BGMs c_02/c_03/r_c/t_04. Probe falhou antes com80 assets ausentes e passou depois; dry-run UV de GRs/atores públicos limpo. Outputs ignorados, nenhum binário versionado.
## Native overworld and blink follow-up (2026-11-18)

- Base173ada3; A-063–A-065, PRD-007/009, P-012/P-019. The blink helper is
  bounded random, not a clock: DllField0xbf0→code0x48ad7c→0x175d64→PRNG0x164798.
  Long waits are60–119 eligible actor updates; closed lasts two. Guard bytes,
  shared RNG, and4/8 short-wait branches are documented in
  [face-expressions](features/pipeline-rom/face-expressions.md). Manager cadence,
  seed lifecycle, and complete gate semantics remain unknown: **no automatic
  blink timer is implemented**.
- [Overworld inventory](features/pipeline-rom/overworld-motion-coverage.json):
  63 unique NPC model IDs in zones6–16 plus both player models. Of65 IDs,
  **48 have native000/002** (46 NPC models plus Brendan/May), five have no
  motion section (0000/0122/0123/0124/0312), and12 remain unmapped. Fifteen
  missing standing poses were exported serially with nice10, Blender3.4.1,
  and the existing SPICA/.NET tools. No new dependency or invented motion.
- NativeAnimationController now owns player/NPC loops as well as battle
  presentation. Standing is the constant GF1 index0 pose; movement uses002,
  retaining numeric names. Repeated state preserves phase; missing movement
  holds standing; replacement/reset releases owned actions/listeners.
- Catalog scope remains99 characters/41 Pokémon. Exactly15 character records
  get new immutable URLs and source hashes; all Pokémon records remain equal.
  Refreshed native face evidence passes all99 structural/idempotence checks:
  still79 GLBs/91 materials normalized, seven ambiguous cases intact.
- Chromium visible149.0.7827.55, isolated Vite5194, worktree code/main public
  assets: synthetic SceneManager state projection shows000→002→000 and two
  NPCs0182/0221 staying native000. **39 bones change**; four screenshots are
  inspected, no page/console errors, warnings, or HTTP failures. Reset clears
  both NPC controllers/listeners. Evidence stays ignored in the main checkout
  at rom/overworld-runtime-validation/; harness /tmp/playwright-test-overworld-runtime.js.
  No source integration in main, natural ROM route, breathing-cycle, or
  emulator-parity claim. Missing feet and other visual limitations remain.
- **319 Vitest/47 files, build, and159 Python tests pass**, one pre-existing
  public-map-assets skip. All48 native pose jobs also pass real structural
  validation. Inherited >500kB chunk warning and the explicit AMX camera
  non-parity diagnostic remain. Craft Anything discovery/CLI are unavailable;
  blink analysis uses local Capstone5.0.3 and the existing CRO resolver.
=======
- Revisão inicial:320 Vitest/150 Python/build. Após integração na **main4b7d09d:321 Vitest/48 arquivos,157 Python sem skips e build passaram**; GLB_MAPS_DIR aponta ao public principal.162 GLBs públicos de mapa válidos/zero violações; aviso de chunk >500kB herdado.
- **Playwright visível/5200:748 passos**,146 desde11(16,22) até15(17,22) sem660, passando por44 e445;514 até33(16,115). Contato11(39,22)→44(0,22)/right com deslocamento mundial unitário; portais reais/facing preservados. Duas teclas down contra16,116 foram bloqueadas pelos cinco atores visíveis, com piso0 e660 ausente.
- Fixture explícita7360..7475/halt7476 executou WorkSet16526=2, FlagSet660 e MdlDel dos cinco IDs na VM, sem mover o player. Reload conservou16,115 e aplicou as remoções reais; continuação33→14(31,1)/down e caminhada até31,22. Novo reload, retorno33(33,155)/up e visita ao bloqueio confirmaram work/tombstones; nova ida encerrou em14(31,22). Não é função/evento inteiro nem campanha New Game; PRNG0.9..1 evitou batalhas.
- **consoleErrors=[], pageErrors=[], missing=[], requestFailures=[]**. Encontros11/44/445/15/33/14 iguais aos JSONs nativos:0/61/0/0/61/61. BGMs t_04/r_c/c_02/c_03 observadas. Dois avisos init BuildMdlEventAnimeSetEnd herdados, não bloqueantes.
- Quinze capturas inspecionadas: sem frame inteiramente preto, mas forte oclusão do avatar nas chegadas15(2,20) e445(78,48), céu além da borda445(22,61), bolas/fallbacks nos bloqueadores e cartões de folhagem/marcadores debug. Causa/correção de câmera/altura/oclusão não determinada; P-017/P-019 permanecem abertas. Log `/tmp/mauville-results.json`, script `/tmp/playwright-test-mauville.js`, PNGs `/tmp/mauville-00-...` a `14-...` listados no PRD. A primeira detecção8080 era SSH/404, não o jogo; aceite executado no Vite5200 com cwd principal confirmado.

## Extensão Rustboro–Verdanturf (2026-11-18, zone-maps)

- PRD-010/A-050/A-051: IDs16→43→75→11. MM4 já deriva16↔43; portais43(62,10)→75(14,20) e75(59,27)→11(16,7) preservados. Nenhuma ponte nova, colisão ou tabela de encontros alterada.
- Teste base reproduziu bloqueio no túnel por NPCs12/13/14, spawnFlag676. Implementados MdlDel real na VM, tombstones por zona e persistência de flags em storyFlags; hide-flag é aplicada só quando setada, nunca por existir. O bloco real6176..6239 de75/map confirma FlagSet676 e remoções; fixture explícita pós-evento libera a navegação sem afirmar execução de Peeko/RockSmash.
- Stage `--zones 16 43 75 11 --include-neighbors --audio-dir`:26 zonas/41 GRs/68 atores existentes, sete IDs especiais em fallback; BGMs nativas c_02/d_01/r_b/t_04. Dry-run UV de GRs/atores públicos não propôs remaps, inclusive UV0 diffuse PICA; nenhum binário versionado.
- Revisão inicial9d89ad1:226 Vitest/145 Python. Após integração na **main9023a3f:260 Vitest/42 arquivos,148 Python sem skips e build passaram**; Python usa GLB_MAPS_DIR do public principal. Aviso de chunk >500kB herdado.
- **Playwright visível/5200:325 passos**, de16(47,65) até11(16,22), com retorno75 após reload. Contato16(79,16)→43(0,16)/right sem fade e vetor mundial unitário; portais43(62,10)→75(14,20)/up,75(59,27)→11(16,7)/down e retorno11→75(59,27)/up. Encontros0/61/61/0 iguais aos quatro JSONs nativos; BGMs c_02/r_b/d_01/t_04 observadas.
- Base sem676: BFS não alcançou11; duas teclas right em75(50,11) não moveram o player. Fixture explícita executou na VM real apenas75/map6176..6239 com stack/halt6240 sintéticos: FlagSet676 e MdlDel12/13/14 geraram progresso no save. Reload manteve50,11; as remoções continuaram na reentrada do túnel. Não houve edição direta de posições, colisões ou visibilidade nessa fixture; não é execução integral de Peeko/RockSmash. PRNG0.9..1 evitou batalhas aleatórias, sem alegação de disparo selvagem.
- **consoleErrors=[], pageErrors=[], missing=[], requestFailures=[]**. Dois avisos init AMX BuildMdlEventAnimeSetEnd não bloqueantes permaneceram. Onze capturas inspecionadas: cenários renderizados, sem frame totalmente preto; no túnel há exterior preto, céu na borda da entrada e avatar parcialmente oculto. Altura/oclusão/geometria não foram diagnosticadas neste smoke (P-017/P-019); folhagem/combiners, atores especiais fallback e marcadores de warp continuam limitações explícitas.
- Log `/tmp/verdanturf-results.json`; script `/tmp/playwright-test-verdanturf.js`. Capturas com prefixo `/tmp/verdanturf-`: `00-rustboro-start.png`, `01-zone_0043.png`, `02-zone_0075.png`, `03-rusturf-blocked-no-flag.png`, `04-rusturf-cleared-fixture.png`, `05-zone_0011.png`, `06-verdanturf-center.png`, `07-zone_0075.png`, `08-rusturf-return-cleared.png`, `09-zone_0011.png`, `10-verdanturf-final.png`.

## Extensão Petalburg–Rustboro (2026-11-17, zone-maps)

- PRD-008/A-042: IDs confirmados13→27→82→26→16 (Petalburg, Route104 sul, Woods, Route104 norte, Rustboro). Zona25 é Route103. MM4 já deriva26↔16 automaticamente; portais82 permanecem ZO reais. Nova ponte13↔27 explicitamente inferred=true liga(1,z) a(76,z), z46..50, offset76, sem mudar colisões/atores. O encaixe entre MM2/MM3 não é dado ROM extraído.
- Staging reproduzível com `--zones 13 27 82 26 16 --include-neighbors`:29 zonas/53 GRs/57 atores existentes, seis IDs especiais em fallback. Inclui somente destinos ZO diretos e um salto de vizinhos visuais das raízes; nenhum conversor/binário no Git. Public acumulado:74 GRs/68 atores, zero violações texCoord.
- Regressões antes/depois cobrem ponte, cinco lanes/retorno, flags de visibilidade, caminho com NPCs e igualdade dos encounters nativos. **215 Vitest,139 Python sem skips e build passaram**; aviso herdado de chunks >500kB.
- **Playwright visível na main b5e3efc/porta5200:306 passos**, saindo de13(39,54), ponte13(1,48)→27(76,48)/left, retorno(1,48)/right e nova ida; portal27(37,17)/up→82(28,64)/up, portal82(26,20)/up→26(33,44)/up, borda26(49,0)/up→16(49,79)/up e caminhada até16(47,65). Bordas sem fade e vetor mundial unitário; encontros das cinco zonas comparados no browser com os JSONs nativos. Fixture inicial em Petalburg e PRNG distinto0.9..1 evitam batalhas aleatórias; não é prova de disparo selvagem nem de cutscene de história.
- Primeira rodada chegou ao destino, mas encontrou MP3s ausentes: Vite retornava HTML200, causando erros de decode (A-044). Staging seletivo `--audio-dir` incluiu as faixas nativas já extraídas `bgm_sg_r_b`, `bgm_sg_d_01`, `bgm_sg_c_02`, sem conversor nem silenciar eventos. Rodada completa repetida: **consoleErrors=[], pageErrors=[], missing=[]**. Permanecem dois avisos init AMX BuildMdlEventAnimeSetEnd, sem bloquear movimento; solicitações de áudio corresponderam às faixas esperadas.
- Evidências locais: `/tmp/rustboro-results.json`, `/tmp/playwright-test-rustboro.js`, capturas `/tmp/rustboro-00-petalburg-start.png`, `01-zone_0027.png`, `02-zone_0013.png`, `03-zone_0027.png`, `04-zone_0082.png`, `05-zone_0026.png`, `06-zone_0016.png`, `07-rustboro-center.png` (mesmo prefixo `/tmp/rustboro-`). Imagens das cinco zonas inspecionadas: sem tela preta ou difusa ausente; cartões de folhagem/combiners, esferas de fallback e marcadores vermelhos de warp continuam visíveis. Não há alegação de paridade gráfica, flags ou eventos da história.

## P-019: expansão da orientação-base (2026-11-18)

- Base a0ab2ce; A-050/A-051, PRD-009 e [cobertura por modelo/zona](features/pipeline-rom/character-face-coverage.json). Auditoria ampliada de 61 para 99 MM, com 17 paletas e candidatos estáticos face/head. SHA da fonte, imagem RGBA/dimensões, UV0, transformação e BBox são obrigatórios; o tamanho da paleta não limita orientação-base.
- **79 GLBs / 91 materiais normalizados**, incluindo 74 personagens além dos cinco anteriores; sete materiais de BBox simétrica ficam intactos (0226/0232/0241/0245/0262/0270/0305), assim como 13 MM sem candidato nativo face/head. Os sete casos curtos das 12 paletas antigas foram incluídos. Os cinco anteriores também receberam correção comprovada de head, com nova URL imutável; nenhum arquivo anterior foi sobrescrito.
- Catálogo: 99 personagens + 41 Pokémon, todos os registros Pokémon inalterados. Nas zonas 6–16, 63 IDs únicos: **44 normalizados, sete intactos e 12 sem MM correspondente**, sem mascarar bits nem inventar remapeamento. Os 51 MM existentes resolvem para GLBs publicados. Ausência de motion continua distinta de ausência de GLB/face.
- Preservação estrutural e idempotência verificadas nos 99 GLBs reais; fixture reproduziu a necessidade de agregar BBox por material antes de processar primitives. Clones preservam accessors compartilhados, prefixo BIN, geometria, materiais, imagens, samplers, nodes, skins e clipes.
- A/B Playwright visível, Chromium 149.0.7827.55, Vite isolado 5194: MM0179, MM0299 e MM0221 antes/depois, NPCs reais no SceneManager com câmera/pose fixas e arquivos publicados. Seis capturas inspecionadas, rosto orientado e zero pageerror/console error/warning/HTTP>=400; evidências ignoradas no principal em rom/face_expression_validation/expanded/. Não foi repetida caminhada nem cutscene ROM; fontes da main não foram alteradas.
- **250 Vitest/40 arquivos, build e 155 testes Python passaram**, um skip pré-existente de assets públicos ausentes no worktree; aviso herdado de chunks >500 kB. SPICA/.NET existentes e Pillow 11.3.0; sem instalar dependências. Craft Anything/MCP e CLI continuaram indisponíveis, análise estática local. Piscada/timing, materiais ambíguos e paridade continuam em P-019; sem geometria de pés inventada.

## P-019: ChangeFace dinâmico por ator (2026-11-18)

- Base4f42e54, worktree anim-0xef-re; [PRD-009](features/engine-3d/prds/PRD-009-expressoes-bch-no-runtime.md), A-046–A-048 e [evidência](features/pipeline-rom/face-expressions.md). O import static.crs/0x19c7ac resolve de volta para DllField/0x389b8; lookup do ID, getter de estado e setter de frame recuperados estaticamente. Nome C++/protótipo virtual e fluxo observado no emulador seguem desconhecidos.
- ChangeFace guarda expressão pura no ator, replica casts uint16/uint8, fallback0 fora0..7 e no-op para ator ausente. Projeção por ID alcança NPC/player sem mover spawn/borda; refresh preserva expressão e save valida o campo opcional. Nenhuma lógica de batalha mudou.
- Promoção exporta somente oito frames da evidência nos mesmos cinco GLBs corrigidos. Todos os102 SHA/URLs e demais metadados permanecem iguais, exceto faceAnimations nas cinco entradas. Renderer clona material/textura por ator, aplica offset-base menos translação DccMaya, conserva UVs/skin/clipes/samplers e descarta só clones; seleção anterior à carga é mantida.
- Playwright visível149.0.7827.55, Vite isolado5194 com código do worktree e publicDir do principal: **AMX sintético**, VM/ZoneEvents/projeção/SceneManager reais, dois NPCs MM0180. Frames0→10→0 mostraram olhos abertos→fechados→abertos; três PNGs inspecionados, pose/UVs fixos, segundo ator intacto e PNG inicial/restaurado idêntico por SHA. Zero pageerror/console error/warning/HTTP>=400. Evidências ignoradas no principal em rom/face_expression_validation/dynamic/; não houve mudança de fontes na main nem cutscene ROM exercitada.
- **249 Vitest/40 arquivos, build e147 testes Python passaram**, com um skip pré-existente em test_glb_uv_fix.py por assets públicos ausentes no worktree. Aviso herdado de chunks >500kB mantido. Sem dependências novas, binários ou screenshots no Git; Craft Anything continuou indisponível.
- **Piscada automática pendente:** rotina estática usa frames10/0, contador fechado2 e espera helper(60)+60, com ramos4/8; clock/contrato do helper e condições completas não provados. Não foi inventado timer nem frame. P-019 continua aberta para timing, ramo natural AMX, outros materiais/wrap/combiners e emulador; pés continuam limitação de geometria.

## P-019: orientação-base da face e paletas BCH (2026-11-17)

- Continuação em `anim-0xef-re`, main 942fdb3 → 61fd0c6; [relatório](features/pipeline-rom/face-expressions.md), A-044/A-045 e PRD-007. Nenhuma mudança nova em core/engine; a correção é offline e o catálogo aponta aos outputs novos.
- [61 MM inspecionados](features/pipeline-rom/character-face-evidence.json): 12 paletas MaterialTexCoord1Trans na seção 2, cinco casos de 70 frames suportados. MM0180/0181/0212/0314/0315 receberam V original BCH, não remap de UV0/UV1. RGBA das faces é idêntico à fonte; a inversão V sem inversão da imagem explicava o rosto/célula incorretos.
- Cinco URLs imutáveis novas em `public/assets/native/`, ignoradas e sem sobrescrever assets; 97/102 entradas do catálogo ficam idênticas. Nos cinco casos, imagens/materiais/samplers/nodes/skins/animações, accessors anteriores e prefixo BIN estão preservados; UV compartilhado com outro material é clonado.
- Playwright visível/Chromium 149.0.7827.55, principal em porta 5187, catálogo novo por interceptação de dados: A/B real de Brendan/May/Wally com pose/câmera/luz fixas, sem mutar UV no navegador. Seis capturas inspecionadas e zero pageerror/HTTP>=400; relatório e imagens ignorados em `rom/face_expression_validation/final/`. Isso não é uma caminhada/cutscene nem paridade com emulador.
- CRO ChangeFace e paleta eye01 correlacionam ID uint8 com frames 0,10,…,70; TalkMdlSetEye e visibilidade são caminhos distintos. Nome/protótipo do stub final, estado dinâmico/piscada, demais materiais e wrap/combiners continuam desconhecidos/não implementados. Pés ausentes continuam limitação de geometria, sem malha sintetizada.
- Python 3.12.3, .NET SDK 8.0.428 (`~/.dotnet/dotnet`), SPICA.dll já existente no checkout `_tools/SpicaExport/bin/Release/net8.0`, Capstone 5.0.3 (`/tmp/events-abi-venv`). Nenhuma dependência adicionada; Craft Anything continuou indisponível. **211 Vitest/38 arquivos, build e 142 testes Python (um skip pré-existente por assets públicos ausentes no worktree) passaram** sobre 61fd0c6. O build mantém o aviso conhecido de chunks >500 kB.
Atualizado em 2026-11-18 (host verificado no worktree; seções anteriores são históricas).

## Warp natural e apresentação AMX (2026-11-18, `events-layer`)

- **264 testes Vitest em 43 arquivos, oito testes Python de ABI/memória e
  `npm test && npm run build` passando.** Permanece o aviso herdado de chunks
  maiores que 500 kB; nenhuma dependência nova.
- Init real da zona 6 e export `GetSceneChangeData` selecionam o script 2 com
  works preparados `16514=1` e `16496=3`. O script chama o global 9881 e executa
  `_MapChangeCore(227,14,2,12,0,0,0,1,0)`; a ROM altera `16496` para 4.
  Isso comprova o ramo com save preparado, **não uma campanha desde New Game**.
- Playwright visível em 5178 repetiu **6 → 227**, preservando a entrada normal
  `(19,0)` e mostrando o laboratório em `(14,12)` após o fade. Não houve
  substituição de programa, memória ou binding, warp manual nem Enter de
  completion nesse ramo. Zero `pageerror`, requests falhadas ou HTTP de erro.
- Câmera/fade/espera por terreno usam serviços de apresentação e geração da zona;
  follow não sobrescreve câmera ativa. Queries não recebem sucesso constante.
  Eye/target/FOV e giros usam ticks do renderer, sem paridade de FPS/quaternion.
- ACMD de giro: opcodes 5/6/7/250/251, durações 12/8/4/8/12, repetição byte e
  parâmetro 9 evidenciados no CRO. `Init(-1)` usa o ator do evento;
  `Update(-1)` consulta todas as filas. Direção concluída volta imutavelmente à VM.
  Fila com opcode não suportado permanece opaca, sem executar um prefixo parcial.
- Outro Playwright, com posição de interação preparada `(24,20)`, executou o
  script 14/NPC 0 e mostrou texto ROM com **zero confirmações ACMD** e uma
  confirmação explícita de `TalkMdlSetEyeToEye`, ainda opaco. Não valida progresso
  de história. O loader GameText foi exercitado separadamente: seletor 1 →
  arquivo 23 → 2.848 strings, corrigindo o envelope `{file, lines}`; isso não
  equivale a executar um ramo ROM de GameText. Ambos os probes não tiveram
  `pageerror` nem falhas de requisição no trecho exercitado.
- Evidências locais inspecionadas: `/tmp/events-natural-before.png`,
  `/tmp/events-natural-camera.png`, `/tmp/events-natural-lab.png` e
  `/tmp/events-real-turn-dialogue.png`. Testes temporários:
  `/tmp/playwright-test-natural-warp.js` e `/tmp/playwright-test-events-turn.js`.
  O teste de warp aguarda opacidade 1 no canvas e no app, além do estado/rede.
- Metadados locais de 6/227 passam a preservar os exports AMX reais; imagens,
  novos bancos StoryText e binários continuam em assets ignorados, não no Git.
- [ADR-007](features/core-jogo/adrs/ADR-007-dispatch-natural-de-cenas.md),
  [PRD-005](features/core-jogo/prds/PRD-005-warp-natural-da-rom.md) e A-052–A-058
  registram evidência e limites. **P-013 permanece aberta:** deslocamentos ACMD
  como 19, clipes GF1 de giro, objetos/eye-to-eye, callbacks, ABI de coordenadas
  de ator, cobertura de bancos/words, save/party/bag, altura/flags de warp e
  paridade com emulador. Craft Anything indisponível neste ambiente; a evidência
  ABI veio de análise estática local dos CROs e `code.bin`.

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
