# Matrizes MM e mapas por zona

Investigação de 2026-11-17, Fases 1–2, [PRD-003](prds/PRD-003-mapas-por-zona.md),
[ADR-005](adrs/ADR-005-recorte-de-mapas-por-zone-grid.md), A-023 e P-017.
Os JSONs em `src/data/maps_v2/` foram inicialmente uma saída paralela. A integração
no jogo está descrita ao final; mapas manuais continuam via `?maps=legacy`, sem
alegação de paridade de navegação no emulador.

## Evidência e escopo

- 431 matrizes de `garc/a_0_4_0`: 409 básicas e 22 estendidas, todas com duas
  seções. 422 são referenciadas pelas 536 entradas da tabela ZoneData.
- Decodificação física cobre cabeçalho, arrays, registros e padding de todos
  os 431 arquivos; não atribui semântica inventada aos campos desconhecidos.
- 536 mapas gerados, 846 GRs utilizados, 1.480.000 tiles, 911 warps,
  2.904 NPCs e 9.150 entradas de encontro preservadas.
- Fontes binárias continuam locais. Cada mapa conserva SHA-256 do ZO e MM,
  os arrays/retângulos decodificados da matriz e os chunks que foram compostos.
- MM1 SHA-256: `68af7747ed22f080889de4539f3d780bba125e0a22a81bee1c2076eefd7610a0`.
  Cabeçalho: `4d4d020010000000180900005c0a0000`.

## Cabeçalho MINI MM

Todos os números inteiros abaixo são little-endian.

| Offset absoluto | Tipo | Significado observado |
| --- | --- | --- |
| `0x00` | 2 bytes | Magic `MM` |
| `0x02` | u16 | Número de seções: 2 |
| `0x04` | u32 | Início da sec0: `0x10` |
| `0x08` | u32 | Início da sec1 |
| `0x0c` | u32 | Fim do arquivo, **não uma terceira seção** |

Em MM1, sec0=`[0x10,0x918)`, sec1=`[0x918,0xa5c)`.
Nenhum dos 431 arquivos observados tem sec2. Cabeçalho, limites ou variantes
não suportados são rejeitados, em vez de interpretar bytes extras silenciosamente.

## Sec0: GRs, zonas e array auxiliar

Offsets relativos ao início da sec0; `N=W*H`.

| Offset | Tipo/tamanho | Conteúdo |
| --- | --- | --- |
| `0` | u32 | Variante 0 (básica) ou 1 (estendida); JSON chama de `version` |
| `4`,`6` | u16,u16 | W,H do grid de GRs |
| `8` | N × u16 | GR IDs, row-major; `0xffff` é célula vazia |
| `8+2N` (variante 1) | 16N × u16 | Zone IDs, row-major, dimensões **4W × 4H**; `0xffff` vazio |
| `8+34N` (variante 1) | N × u16 | Array auxiliar preservado como `auxiliaryIds`; significado desconhecido |

Variante 0 termina em `align4(8+2N)` com padding zero; variante 1 tem exatamente
`8+36N` bytes. Assim, a sec0 de MM1 (W=H=8) ocupa **2.312 bytes**, não somente
os 136 bytes do primeiro grid. Os 13 valores auxiliares não vazios observados
são 2–14, distribuídos em sete MMs; não são usados para inventar alturas/áreas.

Cada célula GR representa 40×40 tiles. Cada célula do grid de zonas representa
10×10 tiles, portanto um GR cobre 4×4 células de zona. Todos os zoneIds não
vazios das 22 matrizes estendidas referenciam zonas que declaram aquela mesma
`mapMatrix` em ZoneData; nenhuma zona de matriz estendida ficou sem região.

Posições reais em MM1 (coluna,linha), com origem no canto superior esquerdo:

| GR | Posição | Zona(s) |
| --- | --- | --- |
| 1,2,3 | (2,1),(3,1),(4,1) | 25, Route 103 |
| 4 | (2,2) | 7, Oldale |
| 5 | (2,3) | 23, Route 101 |
| 6 | (2,4) | 6, Littleroot |

## Sec1: count e retângulos, não limites de cada zona

Tamanho fixo de 324 bytes: u32 `count`, seguido de espaço para 16 registros de
20 bytes. Somente os primeiros `count` registros são ativos; o restante é zero.
O corpus tem counts entre 0 e 7, totalizando 545 registros ativos.

| Offset no registro | Tipo | Campo preservado |
| --- | --- | --- |
| `0`,`4` | f32,f32 | `x1`,`x2` |
| `8`,`12` | f32,f32 | `z1`,`z2` |
| `16` | u32 | `flags`, observado 0/1; significado não comprovado |

MM1 começa com `03000000` (count=3). O primeiro registro é
`(1485,2151,1200,1539,1)`, o segundo `(963,1359,3501,3825,1)` e o terceiro
`(711,3555,1269,3789,0)`. Não há três registros cujo primeiro campo seja flags.
O leitor experimental `MapMatrix.ParseUnk` do pk3DS lê esse count como
`Direction` e para no primeiro zero: essa interpretação foi reproduzida como
falha determinística e **não** foi adotada. O parser verifica count, tamanho,
valores finitos e todo o padding, sem descartar dados após um falso terminador.

**Hipótese refutada:** `ZoneData.mapArea` não indexa esses retângulos.
As zonas 6/7/23/25 compartilham `mapArea=8`, enquanto MM1 só tem três registros;
223 tem `mapArea=112` e seu MM164 só possui um. Os retângulos não são sequer
limites transitáveis: o warp da casa 223 está em (279,333), fora do intervalo
Z [153,297] da sec1. Limites de câmera são uma interpretação plausível, não uma
semântica confirmada. O `mapArea` original fica como metadata, sem remapeamento.

## Escalas e recorte

Os 911 warps apresentam `x % 18 == ground % 18 == 9`: centros de tiles.
São **18 unidades de mundo/tile**, 720 por lado de GR e 180 por célula de zona.
O campo que `extract_zones` chama `warp.y` é o eixo horizontal de profundidade;
`warp.z` é elevação e não entra na seleção da linha do grid.

```text
warpLocal.x = floor(warp.x / 18) - originTile.x
warpLocal.z = floor(warp.y / 18) - originTile.z
npcLocal.x  = npc.x - originTile.x
npcLocal.z  = npc.y - originTile.z
```

NPCs já usam tiles; **não dividir suas coordenadas por 18**.

Na variante 1, o recorte é o menor retângulo que contém as células daquela
zona no grid 4W×4H. Células vazias ou pertencentes a outra zona dentro do
retângulo ficam bloqueadas, sem vazar geometria transitável do vizinho.
Na variante 0, sem grid de zonas, usa-se o retângulo dos GRs não vazios.
A colisão/terreno é composta exclusivamente via `parse_gr_grid` existente:
`0x20004004` = grama, low-byte `0x21` = bloqueado. Isso preserva a projeção
herdada; não é uma nova interpretação completa de todos os bits de permissões.

Littleroot tem origem global em tiles (80,160), tamanho 40×40. O warp mundial
(1701,3087) tem centro (94,5;171,5), dentro dessa região, e vira tile local
**(14,11)**. Seu destino `223/0` vira `zone_0223`, posição local (15,18).
Route 102 é uma zona 80×40 (GR9+GR10), não dois mapas separados; Route 103 é
120×40 (GR1+GR2+GR3), não somente o primeiro GR.

## Contrato JSON e reprodução

```bash
python3 -B -m scripts.build_zone_maps \
  --garc-root "$CHECKOUT/rom/extracted/garc" \
  --out-dir src/data/maps_v2 --reference-dir src/data/maps
python3 -B -m unittest discover -s scripts -p 'test_*.py'
npm test && npm run build
```

Cada `0000.json`–`0535.json` tem `schemaVersion=2`, ID estável `zone_NNNN`,
nome da metlist, `width/height`, `collisions/terrain`, `spawnPos`, `warps`,
`npcs`, `encounters` e `source`. IDs são exclusivos mesmo para interiores com
nomes repetidos. `source` inclui origem global em tiles, MM decodificada,
SHA-256, mapArea, textFile e offsets locais/globais dos chunks GR.

- Warps preservam índice, width/height e registro `rom` inteiro; targetMapId
  deriva de destinationMap e targetPos do warp destinationTile da zona destino.
  Os 911 pares existem; nenhum destino foi substituído por aproximação.
  targetPos é o ponto bruto do warp, sem deslocamento de saída inventado.
- NPCs conservam atributos/IDs/scripts e coordenadas originais; `pos` contém
  tiles locais. Não se fabricam diálogos nem se eliminam atores off-map.
- Encontros conservam as entradas species/form/levelMin/levelMax do extrator
  existente, sem inferir método, taxa ou distribuição de pesca/grama.
- `spawnDerived=true` e `spawnPolicy` deixam explícito que spawnPos é fallback:
  primeira âncora de warp transitável, senão primeiro tile transitável em ordem
  de linha. Sem tile transitável, é null. Não é spawn canônico: init/save e a VM
  de scripts determinam o posicionamento real quando integrados.
- Não são inventados warps nas bordas entre zonas contínuas. O grid de zonas
  fica disponível para um futuro adapter de navegação, respeitando scripts.

## Comparações e anomalias preservadas

`_validation.json` não é um mapa; registra resumo, matrizes não referenciadas,
comparações e diagnóstico espacial. Os dez mapas anteriores (sete exteriores,
Brendan/May house e laboratório) tiveram **16.000 tiles comparados por camada**,
zero diferenças em colisão/terreno e zero tiles sem cobertura. O comparador
alinha cada GR por sua posição no novo recorte; não compara somente dimensões
nem afirma igualdade dos warps/spawns manuais anteriores.

Há 48 warps de origem e 48 targets fora da região, todos na zona 0; quatro NPCs
ficam off-map (zonas 23/44/177/221). Permanecem intactos e listados no relatório;
não se amplia a região, troca matriz ou força coordenadas só para zerar o erro.

Verificação: 13 regressões novas sintéticas, **107 Python** no total,
**134 Vitest/17 arquivos** e build passaram. Regeneração deve produzir os mesmos
bytes. P-017 mantém a semântica da grade auxiliar/flags, as anomalias e a futura
integração/paridade explicitamente abertas; o coordenador aprovou esse limite.

## Integração no jogo (2026-11-17)

[Engine PRD-005](../engine-3d/prds/PRD-005-mapas-de-zona-no-runtime.md) e
[ADR-003](../engine-3d/adrs/ADR-003-zonas-lazy-e-assets-compostos.md) documentam
`getZoneMap`, bootstrap zone_0006 e o modo `?maps=legacy`. O modo novo usa a chave
`alpha_sapphire_web_save_v2`; o antigo mantém v1, sem apagar/migrar seus dados.
O payload de save permanece version=1. O loader só importa JSONs numéricos e
carrega o destino antes do warp; não faz download recursivo de todas as zonas.

Staging reproduzível, após conferir que public/assets é ignorado pelo Git:

```bash
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" \
  --public-dir "$CHECKOUT/public"
```

O slice e destinos diretos incluem 15 zonas (33 é o destino adicional), 25 GRs:
1–6, 9–10, 183–190 e 506–514, com texturas; 42 atores foram disponibilizados em
assets/characters/mm_NNNN.glb, preferindo clips_merged. Texturas externas dos
atores são embutidas sem mudar o BIN de geometria; assets diferentes existentes
não são sobrescritos. Quinze IDs sem correspondente mm usam npc/npc.glb; não se
mascaram os bits altos por inferência. Nenhum conversor ou asset binário no Git.

Smoke visível no Chromium instalado verificou 6→223→6, chegada (15,18)/up e
somente JSONs 0006/0223 carregados, sem pageerror. No worktree sem public, o
Playwright serviu os assets reais do checkout principal por interceptação;
screenshots temporários foram inspecionados, não versionados. 150 Vitest/113
Python e build passaram. Flags/diálogos/VM, IDs especiais, bordas contínuas sem
warp ZO, transições exatas e paridade permanecem em P-013/P-017 (A-025).

## texCoord esparso do assimp v6 (2026-11-17, A-026)

SpicaExport emite `set="3|4"` em `TEXCOORD` para as fontes `*_mapped_uv*_id`;
`bind_vertex_input` liga `UV0` do material a esses sets. O assimp v6 compacta
os atributos para `TEXCOORD_0..k` mas mantém o número esparso em
`texture.texCoord`, e o three.js amostra `uvN` inexistente (cor plana) ou nem
compila o shader (`uvN` undeclared). `convert_gr_to_glb` roda
`scripts/glb_uv_fix.py` ao final. A política inicial de escolher o último canal
válido foi revisada pelo A/B visual descrito abaixo (A-041);
`validate_glb.py` audita os índices de qualquer `.glb`, mas não prova UV correto.

## Corredor contínuo e revisão visual (2026-11-17)

[PRD-006](../engine-3d/prds/PRD-006-corredor-continuo-hoenn.md) e
[ADR-004](../engine-3d/adrs/ADR-004-bordas-por-zone-grid.md) usam
`_neighbors.json`: 58 zonas/90 bordas dirigidas por contato ortogonal de zoneIds
nas MM. Cada borda tem span, direção, offset local→local e proveniência.
`build_zone_maps.py` regenera o grafo; para refazê-lo sem ler binários:

```bash
python3 -B -m scripts.build_zone_neighbors
```

MM1 contém 6/23/7/25; MM2 contém 13/24. A única ponte entre matrizes é
7↔24, **inferred=true**, aprovada como migração, não conexão nativa extraída.
As lanes20–22 ligam Oldale x=1 a Route102 x=78, preservando o padding bloqueado.
A ponte substitui apenas o warp ZO para o mesmo destino; caso contrário ele
puxava o jogador para a âncora79,20/right. Portas/demais warps não mudam (A-040).
O core mantém posições locais; o renderer usa um referencial mundial estável,
acrescenta chunks/atores vizinhos e não limpa a cena nem aplica fade em bordas.
O repositório carrega um salto de vizinhos, não o grafo inteiro.
Encontros vêm diretamente de `zones/NNN_*.json` pelo ID, antes de liberar o mapa.

O staging acima agora inclui Petalburg e destinos diretos: 23 zonas, **35 GRs**
e **51 atores**. Os 16 IDs sem correspondente físico mantêm fallback explícito;
nenhum bit de modelo é mascarado. Não há conversão nem binários no Git.
O script aplica `glb_uv_fix` na origem e no destino antes da comparação:
a textura difusa de materiais marcados `extras.pica=true` usa **TEXCOORD_0**,
inclusive para migrar arquivos antes remapeados para1. UVs válidos de materiais
genéricos e demais texturas do material permanecem intactos. A/B temporário no
mesmo servidor/GLB (`/tmp/uv-channel-original.png`, `/tmp/uv-channel-zero.png`)
restaurou grama, placas e telhados; índices válidos sozinhos não validavam imagem.
A caminhada integral foi validada na main d85d534: 500 passos por teclado com
ida/retorno, Route103, warp real6→223→6 e diálogo ROM. Zero consoleErrors,
pageErrors e missing; capturas por zona e A/B inspecionados (STATUS.md).
Persistem avisos explícitos AMX/SE e limites PICA/combiners; não é paridade.

## Ledge sul derivado da permissão GR (PRD-013, 2026-11-18)

`read_gr_permissions` preserva cada u32 da seção0 antes de `collision_layers`
produzir os grids binários existentes. A composição por zona acrescenta o campo
opcional `southLedges: [{x,z}]` para a palavra **exata0x75020021**, somente em
células pertencentes à zona segundo a MM, com coordenadas locais. Schema v2 é
aditivo; os grids, fonte, portais, NPCs e encontros não mudam. Regeneração de536
zonas acrescentou816 pontos a28 JSONs; os outros campos são idênticos à base.

A direção é derivada de padrões e geometrias, não um bitfield nativo generalizado:
nos223 GRs staged pesquisados havia541 ocorrências, todas com norte livre;
modelos de Jagged e outras rotas mostram queda norte→sul. O core mantém o ledge
bloqueado para caminhada/subida/lateral, mas permite salto de dois tiles ao sul
se a aterrissagem e o ledge estão livres de atores e dentro dos limites. Não
promover0x75000021/0x75640021 ou classes laterais. Detalhes, limites estáticos e
regressões em [ADR-008](../core-jogo/adrs/ADR-008-ledges-sul-por-permissao-gr.md)
e [PRD-013](../engine-3d/prds/PRD-013-bondinho-mt-chimney-lavaridge.md).
Animação/altura/multicamada e validação no emulador continuam P-017.

## Grounding pela superfície física primária (A-080/A-081)

Implementação sobre0372885, 2026-11-18; ver [engine ADR-006](../engine-3d/adrs/ADR-006-altura-por-celula-coll-gr.md).
A-078/A-079 foram usados na main durante este trabalho; o diagnóstico anterior
continua histórico abaixo, não descreve o novo runtime.

**Observado:** além da seção visual BCH, o GR contém uma seção2 `coll`.
O inventário nativo contou857 seções primárias e34 adicionais no índice8;
o diagnóstico preliminar excluiu0436–0439 por procurar coll fixo na seção8.
A-084 corrige essa exclusão: são GRs de três camadas, com grids7/8 e
colisores9/10; o inventário completo contém857 GRs/899 colisores físicos.
Ver [PRD-016](../engine-3d/prds/PRD-016-camadas-fisicas-e-oclusao-nativas.md). A geração dos
mapas usa846 GRs e todos passam pelas guardas de `scripts/gr_ground.py`.
O cabeçalho1/3/2/1/2,16 ranges uint32(start,count) a0x2a0 e vértices float4
homogêneos/w1 a0x320 delimitam triângulos até term emu32@4+16. Ranges
contíguos, divisibilidade por3, bounds, term e números finitos são validados;
outro formato não é interpretado por aproximação. A colisão reconhecida por
pk3DS/Ohana e a concordância espacial/altimétrica corroboram o payload;
isso não recupera a ABI nativa de seleção de camada.

Amostra-se o centro `(tile−19.5)×18` com coordenadas baricêntricas e Y/18,
não uma interseção com o GLB visual. Triângulos duplicados pelos ranges são
deduplicados. Ausência ou alturas distintas na mesma célula ficam null;
tolerância numérica0.0001 tile e arredondamento6 casas não escolhem topo,
piso inferior ou hit mais próximo. A seção8 não é fundida à primária.
Cada JSON recebe groundHeights e source.groundHeightPolicy
`gr-coll2-cell-center-unique-v1`; todos os demais campos dos536 mapas,
vizinhos e relatório de validação foram preservados. A segunda geração foi
idêntica nos538 JSONs, incluindo os dois índices. O recorte/máscara de
zona também se aplica à altura. São772007 células conhecidas,707993 null;
entre transitáveis,318424 conhecidas e539 null. Dos863 warps no recorte,
705 concordam com ZO em tolerância0.15,25 são desconhecidos e133 diferem,
incluindo pisos secundários e offsets/rampas não resolvidos.

`groundHeight` é puro e consulta posição local, sem confundir romOrigin ou
worldOrigin com altura. `groundedWorldPosition` mantém X/Z e deriva Y;
null continua desconhecido e conserva apenas o fallback visual anterior0.
Player/NPCs/interactables usam a mesma projeção. O player estende o damp
exponencial de apresentação X/Z já existente para Y, sem novo timer.
Isso não prova o clock original, a curva nativa ou o hop de ledge.
A câmera follow mantém eyeY=playerY+9 e targetY=playerY+0.5, sem mudar
ângulo, FOV, clipping ou câmera AMX ativa. Não há alteração de skins,
binds, clipes, shaders, alpha/depth, renderOrder ou colisões 2D.

### A/B publicado no runtime

Chromium visível e servidores separados5197/5198, código/JSON reais antes
e depois com os mesmos assets locais.12 checkpoints,24 casos e34 capturas
inspecionadas; zero erros de página/console/HTTP, requests falhos ou warnings.
Pose nativa fixa, sem init/VM/campanha; não equivale a caminhada natural ou
emulador. As capturas actor-only removem terreno apenas como diagnóstico,
nunca no produto. O passo adicional usa repo.move/core real e30 renders.

| Checkpoint | PlayerY antes→depois | Follow eyeY depois | Observação |
| --- | --- | --- | --- |
| 6(20,14) / 6(14,16) | 0→0 | 9 | Controle; telhado continua oclusor em14,16 |
| 445(78,48) / 445(22,61) | 0→0 | 9 | Paredes/visão externa não são defeito de altura |
| 39(79,65) | 0→2 | 11 | Corpo recuperado, sem oclusor no raio central |
| 385(23,18) | 0→3.150827 | 12.150827 | Avatar na plataforma física do bondinho |
| 83(31,61) | 0→1 | 10 | Corpo inteiro; nenhum fix de skin foi necessário |
| 84(38,5) | 0→27 | 36 | Terreno reaparece; câmera não fica sob ele |
| 84(38,29) | 0→21 | 30 | Piso superior correto |
| 84(38,31) | 0→20.5 | 29.5 | Piso inferior correto no mesmo GR291 |
| 15(2,20) | 0→0 | 9 | Paredes continuam ocluindo; seção adicional dá7.5 |
| 71(57,35) | 0→3 | 12 | Piso primário, não superfície visual superior20.5743 |

O passo84(38,29)→(38,31) passou pela regra de ledge do core; playerY
21→20.5 sem overshoot, eyeY−playerY=9 em todos os30 renders e alvo20.5.
O residual de corpo parcial em83 dos controles antigos não foi reproduzido
com grounding correto e render normal; não se afirma ausência de todo bug
skinned. Telhados/paredes de6/445/15 são oclusão separada comprovada pelo
controle actor-only, não motivo para alterar depth ou transparência.

Evidências ignoradas no principal: `rom/ground-height-validation/report.json`,
`data-audit.json` com hashes dos846 GRs, PNGs e contact sheets. Reprodutores:
`/tmp/ground-height-servers.mjs`, `/tmp/playwright-test-ground-height-fix.js`,
`/tmp/audit-ground-height-data.py`, `/tmp/analyze-ground-height-fix.py` e
`/tmp/verify-ground-idempotence.py`. Regressão red-green inclui NPC antesY0
vs esperado27 e câmera antesY9 vs esperado36; fixtures independem da ROM.
351 Vitest/55 arquivos, build e186 Python sem skips com GLB_MAPS_DIR do
principal passaram; bundle warning herdado. P-017 continua aberta para
células null, camadas secundárias/actor.y/warps elevados, clock e hop
nativos, oclusão de prédios e validação natural/emulador.

## Diagnóstico de altura e oclusão do avatar (A-076/A-077)

Base `287de78`, Chromium visível em5197, 2026-11-18. O diagnóstico usa o
SceneManager real e os assets públicos do principal, mas snapshots controlados
sem VM/init ou campanha. Nenhuma intervenção abaixo foi publicada no runtime.

**Observado no código:** `GridPosition`, romOrigin e worldOrigin só representam
X/Z. `zone_map_builder.warp_position` usa os eixos horizontais; o ZO original
permanece em `warps[].rom`, mas `adaptZoneMap` não promove sua elevação.
`SceneManager.sync` fixa `playerTargetPos.y=0`; `zoneEntities` fixa NPCs em Y0.
`projectEventActors/projectEventPlayer` descartam actor.y, e ZoneEvents inicia
atores e refreshPlayer com y0. O GR conserva Y do GLB: escala1/18, offset apenas
X/Z. Portanto o terreno elevado não é acompanhado pela projeção dos atores.
`EventPresentation.follow` usa eyeY9 e targetY0.5 absolutos, não relativos ao chão.

**Medido no browser:** raycasts verticais sobre geometria carregada, bounds
precisos dos seis meshes skinned, bones, raios câmera→centro/cabeça/pés e flags
dos materiais. Valores em tiles Three.js; rootY0 e geometria local mínima
0.0859303/máxima1.835139 são iguais nos14 checkpoints. Esse pequeno vão inferior
não explica um erro de2–27 tiles nem autoriza recriar pés ou recentrar a malha.

| Zona e posição local | Superfícies verticais observadas | Diagnóstico delimitado |
| --- | --- | --- |
|6(20,14)|0 e decal0.02778|Controle plano; sem oclusor no raio central.|
|6(14,16)|chão0|Telhado entre câmera e ator; não é elevação local errada.|
|445(78,48)|piso≈0, paredes5.147/6.143|ZO no ponto dá0; `nakaniwa` opaco no raio. Maior hit não é chão.|
|445(22,61)|piso0, carpet/light0.043/0.056|Borda da geometria expõe background azul; não prova recurso ausente.|
|37(31,66)|`chip_soil`2|Avatar inteiro abaixo do solo.|
|39(79,65)|chão2; oclusor adiante5|Altura e encosta na linha de visão coexistem.|
|385(23,18)|≈0,3,3.1464|Plataforma/níveis sobrepostos; piso frontal≈3.0044 oculta atorY0.|
|83(31,61)|chão1, limiar1.0408, prédio até8.0426|ZO no ponto18/18=1; max-hit colocaria ator no telhado.|
|84(38,5)|27|ZO no ponto486/18=27; câmeraY9 fica abaixo do terreno.|
|84(38,29)/(38,31)|21/20.5|Altura varia dentro do mesmo GR291; offset constante por mapa é incorreto.|
|9(20,21)|`chip_soil`4|ZO de entradas da cidade72/18=4 corrobora, sem provar toda célula.|
|15(2,20)|piso0; edifício até12.3639|ZO no ponto0; câmera vê interior/lateral de geometria, não solo errado.|
|71(57,35)|chão≈3/decal3.0411, face inferior20.5743|ZO no ponto54/18=3; encosta no raio câmera→ator.|

**A/B por hipótese:** baseline; deslocar só ator pelo maior hit voltado para
cima; deslocar também câmera; frustumCulled=false; near/far0.001/10000 contra
0.1/250; depthTest=false/renderOrder alto só no player; câmeras reversa e
superior nos casos6/445/15; ancorar o mínimo exportado em0 nos casos6/37;
elevação do ZO nos checkpoints que possuem warp exato. Matrizes e pose são
mantidas estáticas; não são caminhadas, correções de campanha ou emulador.

- Elevar só ator não resolve Jagged: ele sai do enquadramento de uma câmera
  ainda emY9. Elevar também a câmera recupera o terreno em27/21/20.5. Isso
  delimita a origem do céu em84, não aprova um sampler de chão genérico.
- Desativar depth revela o avatar através de pisos/paredes/telhados. Os
  oclusores relevantes incluem materiais opacos com depthTest/depthWrite true
  e renderOrder0. Não foi demonstrado bug de ordenação de transparência. Em6,
  o primeiro hit `shadow1` é transparente/depthWrite false: o primeiro hit de
  um raio também não basta para classificar visualmente o oclusor.
- Alterar near/far não recupera ator ou terreno. O centro do avatar está dentro
  do frustum original. Pequenas diferenças de precisão/Z-fighting existem;
  não se afirma identidade de pixels. Desativar culling não resolve o problema.
- Reverter/elevar a câmera mostra o ator em6, mas também revela backsides e
  vazios dos assets. Não há evidência para substituir o ângulo nativo, tornar
  telhados transparentes ou desenhar o player através de tudo.
- Os controles de Y ainda mostram corpo parcialmente ausente em alguns
  snapshots, mesmo com bounds CPU acima do piso e culling desativado. Uma
  execução isolada em9 mostrou corpo inteiro, mas a sequência completa não
  estabilizou esse resultado. Skinning/bindings/ordem de atualização do
  harness precisam de investigação própria; não atribuir esse residual ao
  chão nem alegar que o deslocamento experimental corrigiu o runtime.

**Decisão:** nenhum fix de Y/depth/câmera publicado. A causa do achatamento e
parte da oclusão estão provadas, mas a correção não é um offset pequeno seguro:
exige resolver altura e camada transitável por posição, preservar altura nos
contratos de movimento/warp/evento e fazer câmera acompanhar essa altura.
Native collision/height query e política de oclusão/câmera continuam desconhecidas.
Não usar maior hit, nome do material, auxiliar MM ou bits GR não decodificados
como seletor físico. Não abrir colisões, inventar plataformas ou esconder roofs.

Evidência local ignorada no principal: `rom/avatar-grounding-validation/`,
`report.json` (bounds/raios/materiais/variantes e SHA dos PNGs), `summary.json`
(correlação ZO e diferenças de clipping) e contact sheets por checkpoint.
Scripts de reprodução: `/tmp/playwright-test-avatar-grounding.js`,
`/tmp/avatar-grounding-server.mjs`, `/tmp/analyze-avatar-grounding.py`.
O script parametriza TARGET_URL, usa browser visível e congela a pose; os
controles são explicitamente diagnósticos. Craft Anything indisponível na
listagem MCP e CLI ausente; leitura de código/JSON e instrumentação local,
sem executar código da ROM. P-017 e aceite visual permanecem abertos.

## Fonte nativa dos atributos de movimento (PRD-015, A-082–A-087)

A análise estática de2026-11-18 recuperou classe alta por `LSR24`
(code403558/40356c/4038cc), low12 (402e60) e predicados de bits0/1 com sentinelas.
Defaults em5860e0 não explicam flag20 dos words21. Nenhum teste de máscara20
foi ligado ao low12 por fluxo completo; flags de controlador homônimos não
bastam. Getter4dbe14 lê `modelo+0x148`, não diretamente a célula serializada.

Consulta4dcb64 usa posição/registros ativos (stride1b4), ramo4dc22c e fallback
CRS19c3dc→Fieldda934. Este tem callbacks e caminhos4d7bdc/68684 antes do u32
com bounds em4d7d00. Ownership GR/seção8/buffer/altura segue aberto; não reduzir
a consulta ao grid plano nem à maior/menor superfície. Grounding primário
herdado da base3013f14 não comprova esse contrato de camadas sobrepostas.

Field64be0 projeta vetores para6d/e. O contexto dos gates foi identificado:
owner+164 recebe PlayerGrid (construtora1b394, vtable10723c), base FieldUnit.
+24 é modo corrente, +25 pendente; setters88090/a6b18 e tabela141fe4 antecedem
commit8e494. A-090/A-091 liga modo1→51→CycleMachStop e modo2→58→CycleDirtStop
por registro/RTTI; input/item e nome comercial Acro não fechados. Escritor
a47c4 grava0f em+14 após5d/CycleDirtWheelieJump, não quatro direções provadas.

6f exige modo2, estados0e..11 e queries; instancia EventDanielSteppingStone.
Import1664→SkatePipe1428 fornece direção;14d4/1430 solicitam ação62 até contador2.
A fila3a0c4 e consumidor401f0 usam o mesmo controladorator+8fc, ligados por
CRS19c7c4/19c7e4 e code3fae48/3f852c. Registro3d9d4/vtable10a4d0 fecha o
executor62/CycleDirtDanielSteppingJump:4b224→81b3c com distância-param1/tipo5/
limite8, atualizador83028 e estágio final3a0bc. Não garante dois deslocamentos
concluídos, clock nativo ou passagem irrestrita de6f; input e sequência abertos.

Ledges64528→e6224 chegam a resultado5/1d/24. A continuação28113e3 segue5 até
25/ActionCmdJump2G16F num ramo modo0: registro3ca4c, etapas41310→83028→3a0bc,
distância-param2 no grid/tipo1/limite16 cardinal, pose física+e8 atualizada
após destino lógico+bc. Tabelas586ea4/586eb4 dão75→sul,73→oeste,72→leste,
74→norte. **Isso não fundamenta abrir73020021 em52 oeste→leste.**

Outros gates permanecem: callbacks, máscara4e067c→4de148/e811c, landing e
seletor global+fc8. Outro ramo solicitaaa/ActionCmdBehindJump, usa4df9b8/81670
e ainda não foi provado equivalente. A máscara intermediária2/4/8/10 não é o
low12 da célula. Não generalizar75020021 do ADR-008 só pelo executor comum.

**Resultado parcial/inconclusivo para implementação:** runtime, parser, grids,
colisões,75020021 e grounding preservados.362 Vitest/56 arquivos,186 Python
sem skips/build passam novamente; nenhum novo red-green/Playwright de regra
não provada. Cinco SHA, RTTI, imports e parâmetros conferidos; offsets/VA,
aliases rejeitados e comandos reproduzíveis no
[PRD-015](../engine-3d/prds/PRD-015-permissoes-nativas-de-movimento.md).
P-017 permanece aberta: primeiro aceitação/landing/aa, depois input/Daniel;
flag20 e seleção GR/altura por último. Corredor conectado não entregue.
