# PRD-016 — Camadas físicas e oclusão nativas

- **Data:** 2026-11-18; base `0d745b2`, P-017, A-084–A-086.
- **Estado:** investigação delimitada e auditor offline implementado; seleção
  multicamada, oclusão e aceite visual continuam abertos.
- **Decisão:** [ADR-007](../adrs/ADR-007-auditar-camadas-sem-inferir-visibilidade.md).

## Objetivo e critérios

Investigar os133 desvios de altura contra ZO,539 células classificadas como
transitáveis pelo parser atual e os oclusores em6(14,16),445(78,48) e15(2,20).
Não escolher max/min-hit, ocultar telhados por distância, alterar depth ou
promover um piso apenas porque coincide com um warp.

- [x] Recuperar índices de permissões/colisão por camada no loader nativo.
- [x] Auditar todos os GRs e manter candidatos separados de decisões runtime.
- [x] Rastrear a consulta de altura e os wrappers de visibilidade abaixo.
- [ ] Fechar origem/lifetime do Y de referência, caches e contrato do hit.
- [ ] Provar a política original de oclusão/câmera nos três pontos.
- [ ] Validar campanha natural e emulador; não substituídos pelos snapshots.

## Evidência estática

Análise local, sem executar código ARM. Capstone5.0.3 existente em
`/tmp/events-abi-venv`; `scripts/cro_native_abi.py` resolve relocations e
imports via `static.crs`. Craft Anything MCP não listou ferramentas; a análise
prosseguiu por ferramentas locais; nenhuma configuração ou proteção foi alterada.

| Alvo | SHA-256 |
| --- | --- |
| DllField.cro | `9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925` |
| code.bin | `b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16` |

### Camadas: observado e derivado

DllField/0x1e8cc (`MapFileSimple`, vtable0x107398) obtém o número de
seções por code/0x12faf4 e seções por0x12fb40. Em0x1e96c–0x1e990 deriva
`N=(sectionCount−7)/2` e limita a quatro pisos contando o primário.
Os loops0x1ea04–0x1eafc instalam colisores separados, stride0x44 a partir
de MapBlock+0xb4;0x1e60c–0x1e634 consulta grids distintos por piso.

**Derivado para o layout reconhecido:** primário=(grid0,coll2); piso
adicional i=1..N usa grid6+i e coll6+N+i. Não é uma alternância de pares.

| Seções | GRs observados | Pares grid/coll |
| --- | --- | --- |
| 7 | 819 | 0/2 |
| 9 | 34 | 0/2,7/8 |
| 11 | 4 | 0/2,7/9,8/10 |

São857 GRs/899 colisores físicos validados.0436–0439 são GRs de três
camadas, não arquivos inválidos: corrige a exclusão indevida do diagnóstico
preliminar que procurava `coll` fixo na seção8. O grounding primário anterior
não depende desse índice secundário e permanece inalterado. A fixture de
quatro pisos/13 seções testa o limite derivado do loader; não há exemplar
com13 seções neste inventário.

### Consulta de altura: observado e limite

- DllField/0x1ed00 chama0x1e52c por0x1edbc, após um ramo especial que pode
  evitar a consulta geral.0x1e52c obtém uma posição3D via0x8f00c.
- O loop0x1e60c–0x1e788 consulta cada grid, identifica o piso no campo
  do candidato+0x14, consulta altura por0xe5f20 e conserva máscaras/caches
  de permissões e hits no resultado+0x180.
- Em0x1e6bc–0x1e77c compara o desnível absoluto com o Y da consulta e
  promove o candidato aceito mais próximo para a primeira posição.
  Há guardas de validade e troca conjunta dos registros/máscaras: não é
  simplesmente selecionar o hit mais alto nem ler um bit de camada.
-0xe5f20–0xe6054 quantiza X/Z a décimos de unidade nativa e lança uma
  consulta vertical com extremos Y±250 no colisor do piso. O import
  code/0x4ed3b4 ainda não foi fechado quanto à escolha entre vários hits
  do mesmo colisor. O loader também soma2 unidades nativas à translação
  vertical do colisor; falta fechar a origem completa desse transform.
- code/0x403a40 lê o u32 de permissão, substitui os três bits baixos por
  uma tabela u16 indexada pelo byte alto, em0x5860e0, e retorna−1 fora do
  grid. Isso não prova qual bit, se algum, controla uma mudança de piso.

**Inferência limitada:** altura3D de referência, permissões de cada piso e
validade dos hits participam da consulta. Ainda não foi rastreado todo o
caminho de spawn/warp/movimento/ACMD que fornece essa referência e consome o
resultado. Copiar apenas a comparação de distância para o core iniciando
Y0 seria circular e poderia manter o ator no piso errado. Não foi publicada
seleção automática de camada, nem uma afirmação de paridade dessa ABI.

## Auditoria reproduzível

```sh
python3 -B -m scripts.audit_ground_layers \
  --gr-root /caminho/local/garc/a_0_3_9 \
  --maps-root src/data/maps_v2 \
  --output /caminho/local/rom/ground-layer-validation/audit.json
```

`gr_layers.py` valida cabeçalho, offsets, grids40×40 e cada payload `coll`;
`audit_ground_layers.py` apenas enumera candidatos. Não escreve nos mapas,
não alimenta o renderer e não altera a policy primária da ADR-006.

Dos863 warps no recorte,705 continuam concordantes com tolerância0.15 tile,
25 não têm altura primária e133 diferem. Destes133, cinco têm candidato em
outro piso:15/warps6,7,8→7.5;444/warp0→11;176/warp0→24 no piso2/GR439.
Os128 restantes não são resolvidos por trocar de camada. Amostrar X/Z
exatos do ZO em vez do centro da célula não alterou esses candidatos.
Coincidência de altura não prova o estado de camada do ator ou o papel da
altura ZO na ativação do portal.

As539 células null são423 sem hit primário e116 com alturas distintas;
nenhuma virou conhecida apenas ignorando o bounding box do raster.
101 têm algum candidato secundário, não necessariamente único/correto.
O maior grupo é311 células de268/Slateport; entre permissões aparecem318
`00000020`,84 `401a0023` e33 `40180023`. A transitabilidade aqui significa
somente `collisions==0` do exportador atual, não semântica nativa comprovada
para água, movimentação especial ou ausência de piso. Não preencher por
vizinho, zero, ZO ou seleção visual para reduzir a contagem.

## Visibilidade de prédios

**Observado:** `BuildMdlGetHandleByGPos` em0x50718 empacota duas coordenadas
em um handle de32 bits. `BuildMdlSetVisible` em0x4ef74 desempacota o handle,
consulta o registro via0x87194 e passa um booleano para0x15a54. Este chama
um método virtual+0x40 do modelo em registro+0x2c e grava o byte+0xc8.
O lookup0x87194–0x872a8 busca registros ativos, stride0xe4, por distância
XZ a `(18x+9,18z+9)`, com limite inicial36; não recebe uma câmera.
Não há interpolação de alpha nessa sequência específica.

O mesmo registro é povoado por0x271a8, chamado por0x1e8a8 ao percorrer a
seção3 GR; o BCH da seção1 segue outro ramo do loader. Não foi demonstrado
que esse handle controle os meshes da seção1 que ocluem os checkpoints.
Em445(78,48), GR713 tem seção3 vazia e somente piso primário0; GR6 também
só tem piso0. Em15(2,20), GR153 tem pisos0/7.5, mas ZO dessa chegada dá0.
Em15(2,20), os dois grids contêm o mesmo word01000021; esse word isolado
não distingue os pisos nessa posição. Elevar todo ator ao piso superior
não explica o telhado de6 ou a parede445.

O survey AMX cobre1157 programas dos536 registros de zona/85 globais:
20 chamadas BuildMdlSetVisible,143 GetHandleByGPos, duas EventMapReplace,
sete MapperBlockCalcPosSet/sete Clear, duas MdlSetVisibleMesh e quatro
MdlSetCullingOff. Não há chamada direta a SetVisible nos programas locais
6/15/445; isso não exclui globais dinâmicos, dispatch nativo ou chamadas
indiretas. A busca não recuperou uma política automática de dissolve,
corte por célula ou câmera por andar. Ausência de string não prova ausência
de mecanismo. Sect4→code/0x3c8a24 e sect5→DllField/0xa0b50 continuam como
entradas não interpretadas, não foram rotuladas como visibilidade.

## Validação e limites

Regressão red-green do auditor: import ausente antes; fixtures de1/2/3/4
pisos, índices secundários variáveis, corrupção e relatório imutável passam
depois. Não há regressão red-green de um fix visual porque o runtime não
foi alterado. `npm test && npm run build` (362 Vitest/56 arquivos) e191 testes Python passam; sem
skips com GLB_MAPS_DIR do principal. Warning de bundle e nove vulnerabilidades
npm P-016 herdadas não foram alterados. Vitest também emite o aviso P-013
esperado no teste de câmera AMX; não é warning do Chromium desta validação.

Chromium visível usa SceneManager/JSON/assets reais e snapshots controlados
sem init/AMX/campanha. Compara duas execuções frescas do mesmo runtime
primário e controle actor-only somente no harness; não é antes/depois de
uma correção de oclusão. Pontos6/445/15 conservam Y0/eyeY9 e os oclusores;
84(38,29) conserva Y21/eyeY30 e o passo core até38,31 tem alvo20.5, sem
overshoot e com câmera relativa em30 renders. Aceite não é pixel-paridade:
o primeiro check estrito de hash falhou em quatro pixels remotos do terreno
na15, com métricas idênticas; relatório/diff iniciais preservados, causa
não atribuída. A verificação final usa medidas geométricas e erros reais: oito casos/12
capturas inspecionadas em quatro contatos, zero console/page/HTTP/request
errors e zero warnings. Oclusores medidos:6 shadow1/t01_02;445 nakaniwa;
15 c1030_floor04_r/wall_top01_r/wall_3. O avatar inteiro aparece somente no
controle actor-only nesses três pontos; não há aceite de correção visual.

Evidências ignoradas no principal: `rom/ground-layer-validation/` contém
`audit.json`, `amx-survey.json`, `layout-inventory.json`, dumps ARM anotados,
checkpoints, relatórios Chromium e PNGs. Reprodutores locais:
`/tmp/probe-ground-layer-native.py`, `/tmp/scan-layer-amx.py`,
`/tmp/case-layer-evidence.py`, `/tmp/ground-layer-server.mjs` e
`/tmp/playwright-test-ground-layers.js`. Nenhum binário/PNG é versionado.

**Próximo:** fechar origem do Y/seleção de hits e transições de camada em
spawn/warp/movimento. Validar também a alcançabilidade nativa das células
com word20 e a sequência de entrada/saída dos portais: um snapshot imóvel
na chegada não prova que o original mantém o ator ali após a transição.
Mapear oclusores BCH a objetos/flags nativos e recuperar eventos de entrada
e parâmetros de FieldCameraSetting antes de comparar no emulador. Não usar
as cinco coincidências ZO ou a API booleana como autorização para workarounds.

## Continuação: callers de visibilidade e entradas ZO (base158e557)

Investigação estática em2026-11-18, A-089; decisão ADR-007 preservada.
Não há gancho comprovado para implementar. Os offsets AMX abaixo são bytes
na imagem disassemblada; coordenadas GPos são argumentos nativos, não IDs
GR, índices de meshes ou coordenadas locais do snapshot.

### Callers observados e condições derivadas

O recorte mantém1157 programas/536 zonas/85 globais. O novo levantamento
conta455 `MdlSetVisible`,20 `BuildMdlSetVisible`, quatro `MdlSetCullingOff`,
duas `MdlSetVisibleMesh` e duas `EventMapReplace`. Não há referência nomeada
a `BuildMdlGetHandleByUniqID` nos JSONs pesquisados. Os143 GPos e sete pares
MapperBlockCalcPosSet/Clear pertencem ao survey anterior; não são uma prova
de seleção de camada ou de visibilidade automática.

| Programa/função | Chamadas BuildMdlSetVisible | Handle/condição recuperados |
| --- | --- | --- |
|95/entities184 |264,292 |GPos(31,18); work16570>=3 oculta, senão mostra; callers336/360 |
|95/map4456 |7104,7460 |GPos(31,18), estados1/0 na sequência com fade; caller3720 |
|99/entities244 |372,408,548,584 |GPos(15,20)/(26,15); RomGetVersion==26 escolhe qual ocultar; work16561>=2 também oculta o outro; callers204/228 |
|172/entities184 |264,292 |GPos(48,14); work16569>=3 oculta, senão mostra; callers336/360 |
|172/map4704 |7240,7584 |GPos(48,14), estados1/0 na sequência com fade; caller3968 |
|275/entities732 |872,900,1000,1028 |GPos(8,22)/(23,13); flag2720 e work16525; callers688/716 |
|275/map6012 |6408 |handle local−4, estado0; callers11112/15080 |
|275/map6448/6636/7532 |6488/6676/7572 |GPos(23,13), estado0; callers11800/12532/15784/16516,5704,5724 |

Em275/entities, flag2720==1 põe animação0 no handle(8,22) e oculta(23,13).
Sem a flag, oculta(8,22) e mostra(23,13) somente para4<=work16525<5.
São condições de estado recuperáveis do AMX, não política por câmera.
Os callers são chamadas diretas locais; o levantamento não fecha todo
roteamento global/dinâmico nem atribui identidade BCH aos objetos.

Nos programas locais6/15/445 não há chamada direta a essas quatro APIs de
visibilidade/culling nem a EventMapReplace. Em6/entities, GPos(100,170)@572
alimenta BuildMdlEventAnimeSetEnd@596;6/map usa GPos(106,171)@9152 e
GPos(94,171)/(106,171)@9540/9572 na sequência de animação.15/entities usa
GPos(19,19)@448 com BuildMdlEventAnimeSetEnd.445 não contém essas chamadas
de lookup/animação. Isso não prova ausência de controle indireto/nativo,
mas não fornece init que esconda o telhado6 nem swap hall/pátio445/15.

As duas EventMapReplace ficam em121/map5488 e122/map5740, ambas com
argumentos(0,1), após WorkSet16621 e flags. As quatro MdlSetCullingOff ficam
em57/map, função4264:10508/13324/15664/18544, ID0 com estados1/0/1/0.
As duas MdlSetVisibleMesh são global0055@15308/26084, funções6296/17184,
callers4672/4692: ID255, ponteiros AMX288/332, estado1. Não foi demonstrado
que esse global seja chamado na entrada dos três checkpoints nem que os
seletores apontem seus meshes de mapa; não convertê-los em regra de telhado.

### Registros nativos diferentes, não aliases de política

| API | Tabela / wrapper DllField | Observação estática |
| --- | --- | --- |
|MdlSetVisible |0xf842c /0x4ca0c |Resolve ID pelo caminho0x8bfd0/import0x22b0; altera máscaras4/0x100/0x1000000 |
|MdlSetVisibleMesh |0xf843c /0x4e374 |Converte string AMX, resolve ID por0x22b0 e encaminha booleano; não usa lookup espacial0x87194 |
|MdlSetCullingOff |0xf8454 /0x4da9c |Resolve ID/contexto e alterna flag0x20000; sem distância de câmera nesse wrapper |
|BuildMdlSetVisible |wrapper0x4ef74 |Desempacota GPos e consulta registro espacial0x87194→0x15a54, descrito acima |
|EventMapReplace |0xf7d94 /0x55174 |Encaminha dois argumentos ao estado de mapa; vínculo com oclusores não recuperado |

**Derivado:** MdlSetVisible/MdlSetCullingOff usam o caminho de objetos por
ID usado para atores; BuildMdlSetVisible usa outro registro, alimentado pela
seção3 GR. Não são APIs intercambiáveis para ocultar o BCH da seção1.
Mesmo uma nativa que controla um objeto de mapa não identifica, sozinha,
o telhado/parede presente no GLB. Não foi provada troca de camada de render
entre MM347 e o pátio nem ligação dos handles aos materiais medidos abaixo.

### ZO de entrada e candidatos de culling

Os31 registros warp das zonas6/15/445 foram comparados em bytes, além dos
campos do parser. Nos três warps6→223/225/227, byte+5 (`transitionEffect`)
é3. Nos quatro15→445 é5/5/2/5; nos quatro445→15 é2/5/5/5. Em todos31,
bytes+6/+7, directionality(+0x12) e cauda+0x14..0x17 são zero. Os diferentes
valores do byte+5 não demonstram um bit de ocultação nem um alvo de modelo.
O nome transitionEffect é do parser; a enumeração nativa completa e seu
vínculo ao evento de entrada ainda não foram fechados. A altura ZO também
não foi reinterpretada como camada visual.

DllFieldEventEntranceIn contém RTTI EventEntranceIn e performances
MATE/BASE/DOOR/WARP/STAIRS/UPLADDER/DOWNLADDER/SecretBase/ONLY_SCRIPT.
Construtores/registro e trechos0x300–0x480,0x650–0x7b0,0x990–0xb90 e
0xedc–0xfdc delimitam dispatch de entrada, mas não fecham o fluxo inteiro
até ocultação de um mesh. Nome de classe não prova que DOOR remova telhados.
`setCalculateCullingFlag` existe em code/0x5a55a4; a busca de referências
não fechou consumidor de mapa/câmera. As buscas por strings e trechos de
DllField/DllBackGround não recuperaram occlusion set ou dissolve automático;
a cobertura parcial não demonstra inexistência desses mecanismos.

| Fonte adicional | SHA-256 |
| --- | --- |
|DllFieldEventEntranceIn.cro |`96813b4b15c289c28b0770ea108c98d90cac279f3da44f0359c964faeec57a89` |
|DllBackGround.cro |`22f14fa807dd1c7abf856ed7681f2a136b6f838efb391e72326162c2d3962ea2` |

### Revalidação da preservação, não correção visual

Chromium visível/5199, mesmo código158e557 e assets do principal nas fases
A/B: oito snapshots frescos/12 capturas inspecionadas. Três controles
actor-only removem terreno/NPCs somente no harness; o quarto controle é o
passo core84. Nenhum init/AMX, sequência de entrada nativa ou emulador foi
executado. Métricas normais A/B são iguais, sem exigir hashes de canvas.

| Checkpoint | PlayerY / eyeY | Materiais entre câmera e ator |
| --- | --- | --- |
|6(14,16), mundo(94,176) |0 /9 |shadow1,t01_02; telhado permanece |
|445(78,48) |0 /9 |nakaniwa; parede permanece |
|15(2,20) |0 /9 |c1030_floor04_r,wall_top01_r,wall_3; oclusão permanece |
|84(38,29) |21 /30 |Nenhum hit no segmento consultado |

84 move pelo core até(38,31), targetY20.5, sem overshoot nos30 renders e
com eyeY=playerY+9. Zero erros de console/página/HTTP/requests e zero
warnings no run final. Os retries do harness falharam primeiro no import
Vite sem query e depois acusaram duas instâncias de Three.js; o harness
final importa a mesma URL transformada de SceneManager, sem filtrar avisos.
362 Vitest/56 arquivos, build e191 Python sem skips passam; warning de
bundle/P-013 de teste permanecem herdados. Não existe regressão red-green
de fix de oclusão porque nenhum fix, parser ou runtime foi alterado.

Evidências ignoradas no principal: `rom/map-visibility-validation/` contém
amx-calls.json, zones-details.json, dumps estáticos, browser-report.json,
12 PNGs e quatro contact sheets; fontes ROM não são versionadas.
Reprodutores locais: `/tmp/probe-map-visibility.py`, `/tmp/probe-map-native.py`,
`/tmp/map-visibility-details.py`, `/tmp/map-visibility-summary.py`,
`/tmp/map-visibility-callers.py`, `/tmp/map-visibility-server.mjs`,
`/tmp/playwright-test-map-visibility.js` e `/tmp/map-visibility-contact.py`.
Craft Anything MCP voltou a falhar ao listar ferramentas; sem executar ARM
ou mudar configuração/proteções. A evidência estática não é observação da ROM
em execução e os controles Chromium não encerram aceite visual/paridade.

**Próximo passo delimitado:** rastrear o evento completo de entrada e seus
imports/virtuais até o consumidor de visibilidade, correlacionar seção1/BCH
com objetos/seletores/registry e fechar o consumidor de culling. Demonstrar
alvo e condição nos três pontos antes de teste red-green/gancho mínimo;
comparar também a transição natural no emulador, não apenas o ponto parado.
P-017 continua aberta; grounding, câmera, depth, alpha e colisões preservados.
