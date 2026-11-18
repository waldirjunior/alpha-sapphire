# PRD-005 — Warp natural da ROM

- **Data:** 2026-11-17; verificado em 2026-11-18.
- **Estado:** recorte implementado e validado; P-013 permanece aberta.
- **Escopo:** Fase 2/P-013, continuação de PRD-003/004.
- **Decisão:** [ADR-007](../adrs/ADR-007-dispatch-natural-de-cenas.md).

## Resultado verificável

Partir do init da zona 6, selecionar um evento pelas condições da ROM e chegar
a uma transição real de mapa solicitada por `_MapChangeCore`. Programa, bindings
e memória não podem ser substituídos por uma fixture no navegador.

## Aceite

- [x] Executar `GetSceneChangeData` pelo export e respeitar ordem, oito registros
  e sentinela `-1`, com regressões sintéticas.
- [x] Identificar works/flags e distinguir save preparado de New Game.
- [x] Ligar seleção natural à entrada, sem inferir init universal de mapa.
- [x] Implementar câmera/fade/terreno exigidos pelo ramo, término pelo host e reset.
- [x] Investigar ACMD e implementar apenas giros evidenciados; demais comandos
  e clipes ausentes têm diagnóstico explícito.
- [x] Exercitar GameText/slots sem adicionar bancos proprietários ao Git.
- [x] Playwright: seleção ROM, global real, warp e destino visível; monitorar
  erros de página e HTTP, sem substituir scripts ou confirmar efeitos.
- [x] Testes determinísticos, Python pertinente e `npm test && npm run build`.
- [x] Registrar A-052–A-058, estado verificado, limitações e entrega versionada.

## Evidência observada

Com works preparados `16514=1` e `16496=3`, o init real e a tabela da ROM
selecionam script 2, global 9881. A chamada
`_MapChangeCore(227,14,2,12,0,0,0,1,0)` chega ao laboratório `(14,12)` e escreve
`16496=4`. Playwright aguarda opacidade 1; capturas locais inspecionadas em
`/tmp/events-natural-{before,camera,lab}.png`, sem erros de página/rede no ramo.

Outro smoke executou NPC 0/script 14 com posição preparada `(24,20)`, sem
confirmação ACMD e com uma confirmação cosmética de eye-to-eye. O loader
GameText foi verificado separadamente: seletor 1 → arquivo 23 → 2.848 strings;
não se afirma execução de um ramo ROM de mensagem auxiliar. Regressão do glob
usa envelope sintético `{file, lines}`. Verificação: 264 Vitest/43 arquivos,
oito testes Python de ABI/memória e build. Scripts de navegador ficam em `/tmp`.

## Fora do aceite

Não se exige nem se declara campanha desde New Game ou paridade integral no
emulador. P-013/P-017 retêm ACMD de deslocamento, clipes GF1 de giro,
FPS/quaternion, eye-to-eye/objetos, coordenadas de ator, words/bancos ausentes,
altura/flags de warp, callbacks e estado completo de save/party/bag.
