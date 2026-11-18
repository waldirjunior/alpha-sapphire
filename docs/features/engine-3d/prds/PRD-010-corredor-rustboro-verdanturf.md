# PRD-010 — Corredor Rustboro–Route116–Rusturf–Verdanturf

- **Data:** 2026-11-18.
- **Estado:** validado na main9023a3f com fixture pós-evento explícita.
- **Fase:** 2, navegação extraída da ROM, P-013/P-017.

## Resultado

Andar de Rustboro (16) pela Route116 (43), Rusturf Tunnel (75) e Verdanturf
Town (11), sem fade na borda contínua MM4 e preservando os portais do túnel.
O estado inicial não permite atravessar o bloqueio nativo. O aceite
geográfico pós-evento usa progresso explícito, não remoção manual de NPCs.

## Topologia comprovada

| Ligação | Origem | Destino | Evidência |
| --- | --- | --- | --- |
| 16→43 | (79,z), z10..16 transitáveis | (0,z) | Contato de zoneIds MM4, `inferred=false` |
| 43→75 | (62,10) | (14,20), up | ZO 43/warp0, transitionEffect5 |
| 75→11 | (59,27) | (16,7), down | ZO 75/warp2, transitionEffect5 |
| 11→75 | (16,7) | (59,27), up | ZO 11/warp0 |

O contato MM4 já é gerado automaticamente. Nenhuma ponte inter-MM foi
adicionada; nenhuma colisão, origem ou tabela de encontros foi editada.
O portal secundário 43(88,14)↔75(39,34) permanece nos dados nativos.

## Bloqueio de história e mecanismo real

NPCs 12/13/14 de 75 têm spawnFlag676. A BFS real de `movePlayer` chega ao
lado oeste do túnel, mas não a 11 com todos visíveis. O bloco AMX map
6176..6239 contém `FlagSet(676)` seguido de `MdlDel(12/13/14)`.

[ADR-006](../../core-jogo/adrs/ADR-006-hide-flags-e-remocao-persistente.md)
implementa remoção real na VM, tombstones por zona no save e projeção de
hide-flags. O teste base continua bloqueado; a fixture pós-evento passa pela
mesma restauração/projeção do host. Não usar `spawnFlag!=0` sozinho como filtro,
não inventar ligação ao redor das pedras e não alterar o JSON original.

A missão Peeko e o fluxo natural de Rock Smash não estão completos. O trecho
real isolado comprova o contrato de estado, não a execução integral da missão,
dos efeitos de câmera/fade ou das condições de progresso anteriores.

## Staging reproduzível

No worktree, a partir dos assets convertidos do checkout principal:

```bash
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" \
  --public-dir "$CHECKOUT/public" \
  --audio-dir "$CHECKOUT/rom/extracted/audio/mp3" \
  --zones 16 43 75 11 --include-neighbors
```

Seleciona 26 zonas, 41 GRs e 68 atores existentes. Sete IDs especiais sem
modelo físico correspondente continuam em fallback, sem mascarar bits.
As BGMs nativas selecionadas são `bgm_sg_c_02`, `bgm_sg_d_01`, `bgm_sg_r_b`
e `bgm_sg_t_04`. A-046: `hasMp3` não comprova presença no public.

GRs passam por `glb_uv_fix`, inclusive diffuse PICA em UV0. O dry-run no
public de GRs/atores não propôs remaps. Outputs estão ignorados; nenhum
conversor foi executado nem asset proprietário incluído no commit.

## Critérios e evidência desta revisão

- Revisão inicial9d89ad1:226 Vitest/145 Python; após integração9023a3f,
  **260 Vitest/42 arquivos,148 Python sem skips e build passaram**. O aviso
  herdado de chunks >500kB permanece. Python usa `GLB_MAPS_DIR` do principal;
  sem assets no worktree, há um skip explícito, não um sucesso presumido.
- Regressões cobrem sete lanes MM4 nos dois sentidos, vetor unitário,
  portais/facing, encontros nativos, bloqueio inicial e persistência real.
- Chromium visível na main9023a3f/5200:325 passos por teclado desde16(47,65)
  até11(16,22), incluindo retorno ao túnel após reload. Duas tentativas right
  de75(50,11) foram bloqueadas sem676; BFS não encontrou saída para11.
- Fixture explícita executou somente75/map6176..6239 na VM real, com stack
  sintética e halt6240. Persistiu FlagSet676 e MdlDel12/13/14 no save, sem
  editar posições, colisões ou visibilidade diretamente. Reload manteve o
  player em50,11 e os três atores ocultos; reentrada75 confirmou remoções.
- Portais principais:43(62,10)→75(14,20)/up e75(59,27)→11(16,7)/down;
  retorno11→75(59,27)/up. Contato16→43 em79,16→0,16 sem fade e vetor unitário.
- Encontros das quatro zonas iguais aos JSONs nativos; contagens0/61/61/0.
  BGMs observadas c_02/r_b/d_01/t_04. PRNG restrito a0.9..1 evitou batalhas;
  isso não é prova de disparo selvagem ou conclusão da missão.
- Onze screenshots inspecionados; consoleErrors/pageErrors/missing e
  requestFailures vazios. Dois avisos AMX init não bloqueantes permanecem.
  Não houve frame totalmente preto; o túnel mostra exterior preto, céu na
  borda de entrada e avatar parcialmente oculto. Altura/oclusão/geometria
  não foram diagnosticadas neste smoke (P-017/P-019); folhagem/combiners,
  atores especiais fallback e marcadores de warp também não são paridade.

Evidências locais: `/tmp/verdanturf-results.json` e
`/tmp/playwright-test-verdanturf.js`. Lista das onze capturas em
[STATUS](../../../STATUS.md).
