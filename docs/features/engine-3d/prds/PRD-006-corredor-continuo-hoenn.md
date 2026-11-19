# PRD-006 — Corredor contínuo Littleroot–Petalburg

- **Estado:** Aceite verificado em testes e Playwright na main d85d534
- **Fase:** 2 / P-017
- **Data:** 2026-11-17
- **Decisão:** [ADR-004](../adrs/ADR-004-bordas-por-zone-grid.md)

## Aceite

- [x] Gerar vizinhança pelo contato de zoneIds das MM, sem converter limites em warps.
- [x] Cruzar 6→23→7→24→13 com um tile mundial por passo, sem fade/câmera teletransportada.
- [x] Verificar colisão na origem/destino; carregar apenas vizinhos imediatos, sem percorrer o mundo inteiro.
- [x] Compor/cachear chunks vizinhos, manter chunks/atores existentes nas bordas e ignorar respostas obsoletas.
- [x] Carregar encontros diretamente do JSON `zones/NNN_*.json` da zona exata.
- [x] Stage do corredor e destinos diretos com correção/validação UV, sem conversores.
- [x] Caminhada Playwright no checkout principal, screenshot por zona e auditoria de console/texturas/telas pretas.

## Evidência de aceite

Duas rodadas de 500 passos por teclado, última na main `d85d534`, cobriram
ida/retorno, Route103, warp real 6→223→6 e fala ROM do NPC0/script14.
Zero consoleErrors/pageErrors/missing; BGM WebAudio running com quatro faixas.
A ponte conservou `(78,22)/left` na ida e `(1,22)/right` no retorno.
Capturas e limites estão em `docs/STATUS.md`; log local completo em
`/tmp/world-roundtrip-results.json`. Os avisos P-013/P-008 são explícitos;
não se afirma paridade gráfica nem execução fiel dos efeitos opacos.

## Limites explícitos

6/23/7/25 pertencem à MM1; 13/24 à MM2. A ponte 7↔24 é inferência de migração
aprovada pelo coordenador, não dado extraído da ROM. Os GRs possuem uma coluna
externa bloqueada de cada lado: a ponte liga Oldale x=1 a Route102 x=78 nas
linhas 20–22. O offset 78 faz o passo medir um tile mundial e não altera os grids.
As bordas intra-MM são automáticas; outras ligações entre matrizes não são inferidas.
Flags/VM/diálogos e paridade no emulador permanecem em P-013/P-017.

## Corredor ampliado versionado (2026-11-19)

`e2e/corridor.spec.ts` inicia no spawn natural de Littleroot após a intro e
percorre Petalburg, Rustboro, Verdanturf, Mauville, Slateport, Fallarbor,
Meteor Falls, o bondinho e Lavaridge por teclado. Antes de cada trecho
condicional, confirma o bloqueio; depois usa apenas as fixtures já evidenciadas
nos PRDs 010–013: tombstones derivados de Rock Smash, fatias AMX limitadas para
Rusturf/Route110/flag 666 e `_MapChangeCore` pós-demo para o bondinho. O teste
recarrega o save nos marcos e não grava capturas.

Verificação em `corridor-e2e`: `npx playwright test e2e/corridor.spec.ts` —
1 teste passou em 5,5 min; `npm run verify` — 429 Vitest passaram, build passou
com o aviso conhecido de chunks acima de 500 kB e 224 testes Python passaram
com 1 skip por ausência de assets locais no worktree.
