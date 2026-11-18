# PRD-004 — ABI e recursos locais de eventos

- **Data:** 2026-11-17.
- **Estado:** recorte do host implementado; história/paridade em P-013.
- **Fase:** 2, continuação de PRD-003.
- **Decisão:** [ADR-005](../adrs/ADR-005-abi-cro-e-init-nao-bloqueante.md).

## Resultado

Avançar init, mensagens auxiliares e warp AMX por evidência do CRO, sem fazer
um efeito não implementado bloquear a navegação ou inventar retorno de query.
Distribuir somente extratores, adaptadores, manifestos e fixtures sintéticas;
novos textos e memória proprietários permanecem em assets locais ignorados.

## Requisitos e aceite do recorte

- [x] Implementar `BuildMdlGetHandleByGPos` pela operação ARM observada, com
  overflow signed-32 testado. Init real chega ao próximo efeito de apresentação.
- [x] Resolver namespace e selector de `MsgLoad`, slots de swap/release e banco
  escolhido por `TalkMdlMsg_Seq`, com manifesto derivado do CRO e testes sintéticos.
- [x] Carregar StoryText auxiliar por fetch lazy/cache, validar resposta e permitir
  retry; não incluir os bancos extraídos no bundle/Git.
- [x] Decodificar nove células de `_MapChangeCore`, carregar mapa real e proteger
  commit contra reset/carga antiga. Diagnosticar altura/flags não reproduzidos.
- [x] Expandir memória além das 19 imagens legadas por manifesto SHA e assets
  locais, sem zerar dados ausentes. Registrar entities/map de 7/24: quatro imagens.
- [x] Suspender efeito opaco sem textbox, mantendo movimento disponível. Sem ABI
  de retorno, Enter não completa a query. Stubs aprovados continuam explícitos.
- [x] Preservar chegada de spawn/borda; permitir projeção autorizada de player em
  warp/interação. NPC pode executar enquanto o init está opaco e suspenso.
- [x] Validar em Chromium visível: texto ROM do NPC de Littleroot, chegada/caminhada
  7→24 e fixture AMX sintética provocando warp no engine real, distinguindo as
  evidências. Executar Vitest, build e testes sintéticos do parser.

## Fora do aceite deste recorte

Não se declara uma cutscene de warp completa da ROM validada, nem a abertura
inteira jogável. Consultas de ator, matemática Pawn ainda ausente, ACMD/câmera,
formatação de palavras, cenários de mensagens auxiliares no emulador, callbacks,
save/party/bag e paridade audiovisual continuam em P-013/P-017.
