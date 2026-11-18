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
