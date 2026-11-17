# PRD-003 — Mapas por zona a partir de MM/GR/ZO

- **Estado:** Implementado no escopo de extração; semântica residual em P-017
- **Data:** 2026-11-17
- **Fases:** 1–2 do ROADMAP
- **Decisão:** [ADR-005](../adrs/ADR-005-recorte-de-mapas-por-zone-grid.md)

## Problema e requisitos

O pipeline anterior seleciona GRs individualmente, separando artificialmente
Route 102 e omitindo dois terços da Route 103. Coordenadas mundiais de warps
não podem ser tratadas como tiles locais nem como coordenadas já usadas por NPCs.

1. Decodificar as duas variantes MM, incluindo todos os arrays/retângulos,
   testar a hipótese de mapArea e preservar campos de significado não comprovado.
2. Gerar um JSON por zona, com origem/chunks e IDs únicos, compondo colisão e
   terreno pelo parser GR existente, sem converter modelos 3D.
3. Converter warps para tiles locais, resolver destinationMap/destinationTile,
   preservar NPCs/encontros e marcar explicitamente spawn fallback como derivado.
4. Comparar os recortes aos mapas anteriores, tile a tile, com diagnóstico
   espacial que não oculte anomalias ou corrija os dados artificialmente.

## Aceite verificado

- [x] 431 matrizes validadas; mapArea não é índice da sec1; sem sec2 no corpus.
- [x] 536 mapas, 846 GRs compostos, 911 destinos de warp resolvidos.
- [x] 18 unidades/tile; 911 warps centralizados e NPCs tratados em tiles.
- [x] Dez referências, 16.000 tiles por camada, zero diferenças/omissões.
- [x] 13 regressões sintéticas novas; 107 Python, 134 Vitest e build passando.
- [x] Campos desconhecidos e 48 warps/targets da zona 0 + quatro NPCs off-map
  preservados, conforme limite aprovado pelo coordenador.

Não inclui substituir o loader ativo, navegar entre zonas contínuas, reproduzir
spawn canônico de init/save, interpretar todos os bits de GR ou provar paridade
no emulador. Layout, comandos e evidências em [maps-format.md](../maps-format.md).
