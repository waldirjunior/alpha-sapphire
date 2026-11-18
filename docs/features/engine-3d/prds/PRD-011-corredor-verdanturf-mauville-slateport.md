# PRD-011 — Verdanturf, Mauville e acesso pós-evento a Slateport

- **Data:** 2026-11-18.
- **Estado:** navegação validada na main4b7d09d;748 passos, Slateport pós-evento explícito; paridade visual pendente.
- **Fase:** 2; P-013/P-017; A-061/A-062.

## Resultado e topologia

Caminhar desde11(16,22) por44(Route117),445(Mauville/hall) e15(Mauville/pátio)
sem alterar atores ou flags. Depois alcançar33(Route110 terrestre), provar
o bloqueio inicial e testar separadamente uma fixture explícita pós-evento
até14(Slateport). Zona34 é a variante de ciclismo, não o corredor terrestre.
O nome Mauville não identifica sozinho o mapa: o acesso oeste usa445/MM347,
com12 GRs, antes de15/MM14, um GR.

| Conexão | Mecanismo observado |
| --- | --- |
| 11→44 | Contato zoneIds MM6, x39→0, length40, inferred=false |
| 44→445 | ZO0:77,20→22,61, retângulo1×5; volta445/17 |
| 445↔15 | Quatro pares ZO; acesso oeste445/14:50,61→2,20 |
| 445→33 | ZO15:77,110→27,9, width7; volta33/1 tem width5 |
| 33→14 | ZO0:33,155→31,1, width5; volta14/13 tem width3 |

Os retângulos recíprocos não provam correspondência lateral tile a tile.
Nenhum offset/ponte foi inventado; todas essas ligações continuam portais.
Nenhum JSON nativo, colisão, encontro ou grafo precisou ser alterado.
ADRs004/006 existentes cobrem o reuso; não há mudança estrutural para um
novo ADR. A continuidade comprovada é11↔44, não uma borda contínua33↔14.

## Bloqueio nativo e fixture autorizada

A primeira regressão percorreu11→44→445→15→445→33 e falhou em33→14.
NPCs9/10/11/12/13, hide-flag660, ocupam16,116 /18,116 /16,114 /
15,116 /17,116. A análise de componentes de piso com todos visíveis chega
somente atéz121; ocultar661 ou532 não libera o sul. A flag660 libera atéz154.
Não foi feito filtro genérico de spawnFlag não zero.

O disassembly versionado `zone_scripts/0033.json`, programa map, declara SHA
`9492e0f2e9f8bfef75e6657ffa991d3fbbc97ec101ace80b69cc550b062f4ef6`.
O bloco real contém WorkSet16526=2@7368, FlagSet660@7384 e MdlDel
11@7400,12@7416,9@7432,13@7448,10@7464.

A fixture executa somente7360..7475 com memória/pilha sintéticas e halt7476.
A VM existente remove realmente os atores e produz tombstones33:9..13.
O teste persiste/restaura esse progresso, aplica a projeção real e alcança14,
sem mutar a origem. Não executa a função inteira nem comprova o gatilho,
a campanha anterior ou a cutscene. O estado base deve continuar bloqueado.

## Assets e verificação reproduzível

```bash
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" \
  --public-dir "$CHECKOUT/public" \
  --audio-dir "$CHECKOUT/rom/extracted/audio/mp3" \
  --zones 11 44 445 15 33 14 --include-neighbors
```

Seleciona46 zonas/100 GRs/100 atores existentes, só destinos ZO diretos e
um salto MM das raízes;18 códigos sem modelo físico permanecem em fallback,
sem mascarar bits. BGMs nativas c_02/c_03/r_c/t_04. Probe local de presença
falhou antes com80 mapas/MP3s ausentes e passou após o stage. GRs/atores
públicos não propuseram remaps em `glb_uv_fix --dry-run`, inclusive UV0 PICA.
Outputs conferidos como ignorados; nenhum binário ou conversor versionado.

320 Vitest/48 arquivos,150 Python sem skips e build passaram sobre3dbfd21.
Python usa GLB_MAPS_DIR do public principal. Aviso de chunk >500kB herdado.
Quatro testes novos cobrem caminho base/bloqueio, bloco real/persistência,
portais/retângulos e igualdade dos encontros das seis zonas com JSON nativo.

## Aceite visível na main4b7d09d

321 Vitest/48 arquivos,157 Python sem skips e build passaram após a integração.
Foram validados162 GLBs públicos de mapa, zero inválidos/violações. O Vite já
ativo em127.0.0.1:5200 foi confirmado por processo/cwd no checkout principal,
sem editar fontes nele. A detecção inicial encontrou8080, um encaminhamento
SSH com404, não o jogo; essa tentativa não iniciou a caminhada. Os resultados
abaixo são da execução subsequente no Vite correto. O relatório foi fechado
às01:46:36-03, antes do avanço posterior da main para5880bf1 às01:52:21-03;
o aceite e as contagens acima referem-se a4b7d09d, não às mudanças posteriores.

- **146 passos** de11(16,22) até15(17,22), passando por44 e445, sem660.
  Fixture inicial de localização em Verdanturf, não uma campanha New Game.
- Contato11(39,22)→44(0,22)/right: deslocamento mundial(119,102)→(120,102),
  unitário e sem fade. Portal44(77,22)→445(22,61)/left usou uma linha interna
  do retângulo1×5, não somente sua âncora77,20.
- Portal445(50,61)→15(2,20)/left; volta15(17,8)→445(78,48)/up e saída
  sul445(77,110)→33(27,9)/down. Warps/chegadas e facing nativos preservados.
- **514 passos base** até33(16,115); BFS não alcançou14 e duas teclas down
  não avançaram para16,116, apesar de o piso ali ter colisão0. Os cinco atores
  estavam visíveis e660 ausente, sem desbloqueio ou desvio artificial.
- Fixture explicitamente rotulada executou7360..7475 na VM real com halt7476
  sintético. Não moveu o player nem editou colisão/visibilidade: persistiu
  work16526=2, flag660 e tombstones33:9..13. Reload manteve16,115 e a projeção
  real ocultou somente os cinco atores; não executou a função/cutscene inteira.
- Continuação via ZO33(33,155)→14(31,1)/down, caminhada até14(31,22), reload,
  retorno14→33(33,155)/up e reentrada no ponto do bloqueio com as remoções
  preservadas; nova ida a Slateport. **748 passos no total**, além das duas
  tentativas bloqueadas;234 passos pertencem à fase pós-evento.
- Encontros11/44/445/15/33/14: **0/61/0/0/61/61**, iguais aos seis JSONs
  nativos. PRNG0.9..1 evitou batalhas aleatórias; não é prova de disparo selvagem.
  BGMs observadas: t_04 em11, r_c em44/33, c_02 em445/15 e c_03 em14.
- **consoleErrors=[], pageErrors=[], missing=[], requestFailures=[]**.
  Dois avisos init BuildMdlEventAnimeSetEnd herdados, sem bloquear o movimento.

### Capturas e limites

Quinze screenshots inspecionados, com opacidade efetiva1 no app e canvas.
Nenhum frame inteiramente preto. Há oclusão forte por geometria próxima nas
chegadas15(2,20) e445(78,48), escondendo o avatar;445(22,61) mostra céu além
da borda.15(17,22), as rotas e14(31,22) aparecem. A causa e a correção de
câmera/altura/oclusão não foram determinadas neste smoke (P-017/P-019).
Bloqueadores aparecem como bolas/fallbacks; folhagem em cartões, marcadores
vermelhos de warp e outras limitações de materiais/modelos permanecem.
Não declarar paridade visual ou missão/campanha completa por esse aceite.

Evidências locais: `/tmp/mauville-results.json` e
`/tmp/playwright-test-mauville.js`. PNGs com prefixo `/tmp/mauville-`:

- `00-verdanturf-start-base.png`, `01-zone_0044.png`, `02-zone_0445.png`;
- `03-zone_0015.png`, `04-mauville-courtyard-base.png`, `05-zone_0445.png`;
- `06-zone_0033.png`, `07-route110-blocked-base-no-660.png`;
- `08-route110-post-event-fixture.png`, `09-zone_0014.png`;
- `10-slateport-post-event-center.png`, `11-zone_0033.png`;
- `12-route110-return-after-reload.png`, `13-zone_0014.png`;
- `14-slateport-final-post-event.png`.
