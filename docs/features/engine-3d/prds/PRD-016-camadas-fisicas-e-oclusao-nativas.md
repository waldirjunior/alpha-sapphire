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
