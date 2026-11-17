# ADR-005 — Recorte por zone-grid e saída paralela maps_v2

- **Status:** Aceito
- **Data:** 2026-11-17
- **Requisito:** [PRD-003](../prds/PRD-003-mapas-por-zona.md)

## Contexto

MM sec1 não é uma lista de regiões indexada por ZoneData.mapArea. Usá-la para
recortar as zonas falha em MM1/mapArea8 e excluiria o warp da casa 223. O grid
estendido da sec0 contém zoneIds em células de 10×10 tiles, permitindo separar
zonas mesmo quando compartilham matriz e compor zonas com mais de um GR.

## Decisão

- Gerar `maps_v2/0000.json`–`0535.json`, IDs estáveis `zone_NNNN`, sem alterar
  mapas, nomes de runtime, loader, core ou renderer existentes.
- Variante MM1: retângulo de células de zoneId, bloqueando vazios/vizinhos;
  variante MM0: retângulo ocupado por GRs. Reusar `parse_gr_grid` sem alterar
  oportunisticamente a interpretação de colisões herdada.
- Preservar matriz decodificada, origem/chunks, hashes e atributos ROM de
  warps/NPCs; converter apenas a projeção de coordenadas, sem inventar destinos.
- Marcar `spawnDerived=true` com política determinística; init/save continuam
  autoridade para o spawn real. Coordenadas off-map não são corrigidas.
- Validar todo o corpus e produzir relatório espacial/por referência. Campo
  desconhecido permanece desconhecido; não vira entrada fictícia de navegação.

## Consequências

Route 102 torna-se 80×40 e Route 103 120×40. A escala comprovada por 911 warps
é 18 unidades/tile, sem aplicar esse divisor a NPCs já armazenados em tiles.
O schema v2 não é plug-in automático para MapDefinition: é necessário adapter
que trate retângulos de warp, bordas contínuas, scripts, spawn e assets compostos.

P-017 mantém flags sec1/grade auxiliar e anomalias abertas. O coordenador aprovou
entregar o layout completo com esses significados preservados e não comprovados,
sem exigir aprofundar CRO nesta etapa. [maps-format.md](../maps-format.md) separa
observações, inferências, limites, comandos e métricas verificadas.
