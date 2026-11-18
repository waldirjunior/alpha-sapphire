# PRD-005 — Mapas de zona no runtime

- **Estado:** Implementado no escopo abaixo
- **Data:** 2026-11-17
- **Fase:** 2, P-017; [ADR-003](../adrs/ADR-003-zonas-lazy-e-assets-compostos.md)

## Requisitos e aceite

- [x] `getZoneMap(number | zone_NNNN)` usa glob lazy restrito aos JSONs numéricos,
  valida dimensões/ID/schema e adapta para MapDefinition sem perder spawnDerived.
- [x] Bootstrap padrão em zone_0006; carregar o destino antes de aplicar o warp,
  deduplicar requests e permitir retry sem modificar o estado numa falha.
- [x] Manter `?maps=legacy`, mapas e saves manuais antigos. Usar namespace de save
  separado para que uma sessão antiga não anule o bootstrap de zonas novas.
- [x] NPCs usam `mm_NNNN.glb`, com fallback de carregamento para npc/npc.glb;
  preservar modelo/script/spawnFlag sem fabricar diálogos ou avaliar flags da VM.
- [x] Compor GRs pelo offset de cada chunk; respeitar width/height de warp e
  orientação básica, com fade simples para transitionEffect diferente de zero.
- [x] Disponibilizar somente GRs do slice 6/7/23/24/25/223–231 e destinos diretos;
  copiar assets já convertidos e texturas, sem executar conversores.
- [x] Regressões sintéticas em Vitest, verificação canônica e smoke em navegador.

## Limites

Não inclui ligação da VM/ACMD, diálogos nativos, visibilidade por spawnFlag,
spawn canônico de init/save, modelos de IDs especiais sem asset correspondente,
transições cinematográficas exatas ou navegação nas bordas contínuas sem warp ZO.
Esses limites permanecem em P-013/P-017; o fallback visual não é paridade gráfica.

Reprodução, assets copiados e evidência em
[maps-format.md](../../pipeline-rom/maps-format.md#integração-no-jogo-2026-11-17).
