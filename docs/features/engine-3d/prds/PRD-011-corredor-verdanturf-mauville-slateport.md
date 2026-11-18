# PRD-011 — Verdanturf, Mauville e acesso pós-evento a Slateport

- **Data:** 2026-11-18.
- **Estado:** testes e staging concluídos; aceite Playwright na main pendente.
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

Playwright visível ainda pendente: teclado até445/15 sem660, tentativa real
no bloqueio33, captura/fixture rotulada, trecho pós-evento até14, encontros
nativos, screenshots inspecionados e consoleErrors/pageErrors/missing vazios.
Não declarar paridade de câmera, altura, materiais ou história por esse smoke.
