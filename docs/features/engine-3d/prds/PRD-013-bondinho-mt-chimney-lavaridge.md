# PRD-013 — Bondinho de Mt. Chimney e descida a Lavaridge

- Data: 2026-11-18.
- Estado: navegação condicional validada na main809b814; transporte natural e aceite visual pendentes.
- Base: main357692a; worktree `chimney-lavaridge`, branch `feat/chimney-lavaridge`.
- Fase2/P-013/P-017; aprendizados A-072/A-073 (renumerados de A-069/A-070 no merge).

## Resultado verificável

Partir de Mauville15/445, preservar o bloqueio RockSmash37 no estado base,
e usar somente sua fixture derivada já autorizada para o trecho condicional.
Seguir39→384→385→83→84→39→9, sem criar portais ou abrir colisões.
Bondinho, progresso666 e apresentação da viagem precisam de estados explícitos;
não declarar execução natural da campanha, do demo ou paridade visual.

## Topologia observada

| Zona | MM/GRs | Conexões |
| --- | --- | --- |
| 39 Route112 sul | MM7, GR57/58/60/61 | ZO58,23→384(15,28);14,56→84(38,112);33,38→85; contato MM com9 e37 |
| 384 estação inferior | MM288, GR639 | Único ZO15,28→39(58,23), largura3; a viagem não é esse portal |
| 385 estação superior | MM289, GR640 | Único ZO15,28→83(31,61), largura3 |
| 83 Mt. Chimney | MM44, GR287–290 | ZO38,72→84(38,5), largura5;31,61→385(15,28) |
| 84 Jagged Pass | MM45, GR291–296 | ZO38,5→83(38,72), altura486;38,112→39(14,56), altura0, largura5 |
| 9 Lavaridge | MM7, GR59, origem80,120 | Contato MM com39; interiores236–239/429 e variante430 não são a cidade exterior |

Não existem bordas MM contínuas entre estações/cume/Jagged. Nenhuma ponte
inferida é necessária. Os ZO e suas alturas/retângulos devem permanecer intactos.

## Gate666 e viagem AMX

Os atores39/0–2, modelos124/123/123, scripts4/2/3, flag666, ficam em
55,28/54,28/56,28 e bloqueiam a estação. O programa global0028, SHA
`559ded787a493cc8943fc25f2ba3905bdf35a4122c149a8286c173444d529448`,
possui FlagSet666@21804, push@21800. Dispatch9830→21896 chama8580;
Meteor71 contém GlobalCall9830. Um recorte real21800..21815 com halt sintético
21816 projeta somente o hide-group666 e libera o caminho39→384 no teste.
Não é a execução integral do evento de Meteor Falls.

NPC0 das estações usa script2; o binding é ambíguo entre entities300 e o mapa
(384/função3592,385/função3620). Não resolver a ambiguidade por conveniência.

- Mapa384 SHA `319d95e42ffbabc3560ae86cde58766906f04e232f4ac186547fa7d8dab5ec7f`.
  WorkSet16699=1@4132; RecordAdd175@4152; CallApplicationDemo11 por helper568
  em4212; call2904@4248 deriva `_MapChangeCore(385,23,57,18,1,0,0,1,0)`.
- Mapa385 SHA `2f2c80fbad529ba0350111a4d5b0df1fab407a63558c64b38386725c97e0a22c`.
  WorkSet16699=1@4160; RecordAdd175@4180; demo12 em4240;
  call2904@4276 deriva `_MapChangeCore(384,21,57,11,3,0,0,1,0)`.
- Helper2904 chama `_MapChangeCore`@2944. A VM executou os dois recortes
  pós-demo e confirmou as nove células, facing/altura/flags e aplicação do EventWarp.
  Fixture de ida: WorkSet4124..4143 com halt4144, depois4220..4255 com halt4256
  e helper2904..2963. Retorno:4152..4171/halt4172,4248..4283/halt4284 e mesmo
  helper. Dados RAM sintéticos mínimos nos testes, sem binário da ROM. Esses
  recortes não executam embarque, animação do prédio, CallApplicationDemo ou RecordAdd175.
- Entities385/script1, work16699=1, executa MdlSetGPos@256 e move funcionário1
  de21,26 para24,57,18. O teste executou o init inteiro e a projeção liberou
  a chegada23,18 até o exterior83, sem ocultar o funcionário. Sem o init,
  NPC1 fecha a única saída da cabine em21,26. Entities384 tem o par de retorno.
- Imagens entities384/385 adicionadas ao catálogo local por SHA, preservando as
  oito anteriores. Um teste do ZoneEvents real restaura work16699 antes do init,
  desloca o funcionário, libera21,26 e preserva o jogador23,18. As imagens map
  não são promovidas: binding NPC2 e apresentação do bondinho seguem P-013.
  Nenhuma interação ambígua foi trocada por um programa escolhido por conveniência.

## Jagged Pass: evidência para movimento unidirecional

O teste positivo inicial alcançou84(38,5), mas não39. Mesmo sem NPCs, o
componente do movimento binário termina emz29. A linha30
contém0x75020021 nos GR291/292, hoje reduzido a colisão1 pelo parser.

Inventário dos223 GRs staged em main, contra os GR binários locais:

| Palavra nativa | Ocorrências | Padrão |
| --- | --- | --- |
| 0x75020021 | 541 | norte livre541/541, sul livre526/541; faixas horizontais |
| 0x72020021 | 93 | vizinhos leste/oeste livres predominam; faixas verticais |
| 0x73020021 | 89 | vizinhos leste/oeste livres predominam; faixas verticais |
| 0x75000021 | 13 | Route101; variante ainda não abrangida |
| 0x75640021 | 98 | Meteor72; atributo64 ainda não abrangido |

0x75020021 aparece em zonas24/25/27/36/40/41/42/43/45/71/82/84/441.
O formato/documentação local não nomeia direção por campo; não inventar um
bitfield universal a partir desses casos. Raycast estático dos GLBs em Three,
com transformações dos nodes e a escala/offset do zoneTerrain, corrobora a queda:
GR291(33,30) norte21→sul20.5; GR292(0,30)21→20.5; GR31(26,7)2→1.5;
GR72(8,18)3→2; GR78(2,28)2→1.5. Os0x72/0x73 mostram queda para leste/oeste
nos modelos com desnível legível. Há modelos planos e superfícies sobrepostas:
raycast é evidência estática, não prova de movimento no emulador ou ABI nativa.

Um diagnóstico geométrico conservador, mantendo todas as colisões e NPCs,
só permite saltar dois tiles ao sul quando o tile intermediário é exatamente
0x75020021 e a aterrissagem é livre. Alcançou as cinco aproximações do portal
inferior emz111, com98 movimentos até38,111 e oito saltos:
29→31,32→34,45→47,50→52,62→64,67→69,89→91,96→98, todos emx38.
O portal38,112 é bloqueado no grid, mas ZO tem prioridade no core; não exigir
que o flood-fill pare sobre o portal como se fosse piso livre.

Conforme autorização do coordenador: usar a evidência consistente para uma
regra estrita unidirecional, com teste red-green de descida e bloqueio da subida;
nunca liberar todos os tiles21. Somente a palavra exata75020021 entra no escopo,
não as variantes0000/6400 ou ledges laterais. Preservar o grid binário e adicionar
metadados de ledge extraídos, com aterrissagem livre/NPC/bounds verificados.
Implementado em core/ledges.ts, gameState e adapter conforme core/ADR-008.
O pipeline regenerou os536 mapas: só28 receberam southLedges,816 coordenadas;
a comparação estruturada com357692a confirmou todos os outros campos idênticos,
inclusive colisões, terreno, warps, atores, fonte e encontros. Jagged84 recebeu192
ledges; a regressão percorre385→83→84→39→9 com todos os NPCs nativos, depois do
init real385. Sem metadado de ledge, o diagnóstico sem NPCs continua bloqueado
emz30; com metadado,38,29→38,31 e o retorno para norte permanece bloqueado.
Animação de salto, altura visual, demo do bondinho, campanha natural e paridade
não estão validados; os testes antigos de Meteor71→42/72/73 continuam negativos.

Evidências locais de investigação: `/tmp/scan-gr-ledges.py`,
`/tmp/gr-ledge-inventory.json`, `/tmp/probe-gr-heights.mjs`,
`/tmp/gr-ledge-heights.json`, `/tmp/test-jagged-ledges.py`,
`/tmp/analyze-chimney*.py` e `/tmp/analyze-jagged.py`.

## Staging reproduzível e verificação local

```bash
python3 -B -m scripts.build_zone_maps --garc-root "$CHECKOUT/rom/extracted/garc"
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" --public-dir "$CHECKOUT/public" \
  --audio-dir "$CHECKOUT/rom/extracted/audio/mp3" \
  --zones 15 445 37 39 384 385 83 84 9 --include-neighbors
python3 -B -m scripts.extract_event_memory --rom-root "$CHECKOUT/rom/extracted" \
  --zone 384 --zone 385 --out "$CHECKOUT/public/assets/native/amx" \
  --manifest /tmp/chimney-amx-candidates.json
```

CHECKOUT é o checkout local que contém a extração ignorada; execute os módulos
Python no worktree da implementação. O extrator produz quatro imagens locais;
mescle **somente** zone:0384:entities e zone:0385:entities do manifesto temporário
em local-memory.json, preservando as oito entradas existentes. Não promova as
imagens map nem a memória proprietária. Entities SHA384=963457240e051eb7d31cf18e78a7a634008d3678f302525ae29d0dfa127f82fe,
SHA385=634105739339f2aa6f8e5d6696868faf652f56b28677044a37b048cd4f51641a.

Stage selecionou33 zonas/99 GRs/91 atores existentes;18 códigos especiais em
fallback, sem máscara de bits. BGMs nativas c_02/d_01/d_02/r_c/t_02. Probe de
presença e SHA das dez imagens catalogadas passou com zero ausentes;
248 GLBs públicos de mapa válidos, zero erros UV, dry-run de GRs/atores sem remaps.
Saídas confirmadas ignoradas antes da extração; nenhum binário versionado.
Relatórios locais: `/tmp/chimney-asset-probe.json`, `/tmp/chimney-generated-audit.json`.

Red inicial: descida bloqueada em84, funcionário prendendo385 e gate666 em39.
Regressões sintéticas de ledge e adapter falharam antes da correção; composição
Python também falhou por ausência de southLedges. Agora cobrem os dois sentidos,
lateral, bounds, NPC no ledge/aterrissagem, diálogo, prioridade ZO, imutabilidade,
variantes não promovidas e ownership MM. Cinco testes do corredor/VM e um de init
no host complementam a regressão. **340 Vitest/52 arquivos e160 Python sem skips**
e build passaram; aviso herdado de chunks >500kB. Avisos herdados de câmera AMX/chunk grande
não equivalem a paridade. npm install inicial reportou9 vulnerabilidades herdadas
(3 moderadas/4 altas/2 críticas); dependências não foram alteradas nesta frente.

## Aceite condicional na main809b814

Chromium visível/1280×900, Vite127.0.0.1:5200 servido do checkout principal
confirmado por PID/cwd; HEAD809b814 limpo. Contexto de browser novo, save isolado
v2, checkpoint15(17,22). Não é New Game/campanha desde o início. RNG de teste
mantido no intervalo0.9–1 para não abrir batalhas durante o aceite de navegação;
as tabelas de encontro foram comparadas, não a distribuição estatística.

| Marco | Tile | Passos de movimento acumulados |
|---|---|---:|
| Route111/base e duas tentativas bloqueadas | 37(31,66) | 115 |
| Estação/sem666 e duas tentativas bloqueadas | 39(55,29) | 266 |
| Entrada384 por ZO/teclado | 384(15,28) | 275 |
| Aproximação ao funcionário, antes da fixture pós-demo | 384(15,25) | 278 |
| Fixture pós-demo, sem contar como passo de teclado | 385(23,18) | 278 |
| Saída da estação para o cume | 83(31,61) | 294 |
| Entrada de Jagged | 84(38,5) | 314 |
| Primeiro ledge sul | 84(38,29)→(38,31) | 338→339 |
| Saída de Jagged pelo ZO real | 39(14,56) | 413 |
| Borda MM para Lavaridge | 9(39,20) | 432 |
| Interior de Lavaridge/reload | 9(20,21) | 452 |

Oito transições por teclado e uma de fixture _MapChangeCore, oito saltos ao sul.
As duas tentativas de subir após38,31 permaneceram bloqueadas. As seis tentativas
negativas não entram nos452 passos. Contatos MM sem fade/continuidade world-unit
conferidos; ZO e células de chegada preservados.

Três estados são explicitamente rotulados no relatório e nas capturas:
1. DERIVED post-RockSmash: somente tombstones37:2..5, sem mudar posição/flags;
   não executa10050/efeito nativo.
2. REAL FlagSet666 slice: global0028/21800..21815, halt21816, mesma posição;
   esconde só os três atores666 em39, sem evento Meteor inteiro.
3. EXPLICIT POST-DEMO: recortes WorkSet/_MapChangeCore, args385,23,57,18,1,0,0,1,0;
   não executa filme, embarque, RecordAdd175 ou binding ambíguo. Entities385 real
   restaura16699=1 e projeta funcionário1 em24,18 visível antes da caminhada ao
   cume. Reload em Lavaridge preserva posição,666,16699=1 e quatro tombstones.

Encontros das nove zonas15/445/37/39/384/385/83/84/9 iguais aos JSONs nativos.
BGM observada por zona; requests c_02/r_c/d_02/d_01/t_02, mais t_01 da intro.
**consoleErrors/pageErrors/missing/requestFailures vazios** nas duas execuções;
segunda execução só corrigiu a legenda BASE inicial das capturas, sem mudar
lógica/rota. Um aviso herdado BuildMdlEventAnimeSetEnd(6553770,0) continua P-013;
nenhum Enter foi usado para completar ou simular esse efeito.

**345 Vitest/53 arquivos,169 Python sem skips e build passaram sobre809b814**,
com assets públicos apontados por GLB_MAPS_DIR; aviso de chunk >500kB herdado.
Nenhuma dependência nova, imagem/binário da ROM ou screenshot versionado.

### Inspeção das21 capturas: aceite visual NÃO fechado

- 00: pátio de Mauville e avatar legíveis.01: chegada445(78,48) totalmente ocluída
  por fachada próxima.02: saída37 parcialmente coberta por estrutura.
- 03/04: gate RockSmash37 antes/depois sem avatar legível; mudança lógica confirmada
  por projeção/teclado, não por imagem de quebra da pedra.
- 05–07: Route11239(79,65/55,29) mostra superfícies próximas e oculta o avatar;
  imagens não provam visualmente a remoção dos atores666.
- 08/09: estação inferior384 legível, mas exterior azul/céu e limites de apresentação.
- 10: estação superior385 mostra escada/cabine sem jogador/funcionário legíveis;
  a posição/abertura da saída são evidência do estado e movimento, não da imagem.
- 11/12: exterior83 visível, avatar parcialmente enterrado/ocluído junto à porta.
- 13–15: Jagged84(38,5/38,29/38,31) mostra céu/avatar e marcador de warp, **sem
  terreno visível**, apesar de zero recursos faltantes. Não chamar isso de salto
  nativo animado ou descida visual validada.
- 16–20: retorno39(14,56) e Lavaridge9(39,20/20,21) com avatar ausente/ocluído;
  chegada sob árvore e oclusão persistente após reload.

Manter P-013/P-017/P-019: investigar câmera/altura/geometria/seleção de camada e
renderização de Jagged com evidência antes de corrigir; causa não diagnosticada.
Não atribuir ausência de terreno a assets faltantes, inferir altura ou alterar
colisões para mascarar o problema. Transporte/campanha natural, RecordAdd175,
variantes de ledge e animação/altura continuam abertos.

Relatório `/tmp/chimney-results.json`, script `/tmp/playwright-test-chimney.js`,
imagens `/tmp/chimney-00-mauville-base.png` até
`/tmp/chimney-20-lavaridge-reload-fixtures-preserved.png` (nomes completos no
relatório). Executor do skill copilot com NODE_PATH apontando para a instalação
Playwright já existente em cursor; sem instalar ou modificar dependências.
