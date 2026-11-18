# ADR-007 — Auditar camadas sem inferir visibilidade

- **Data:** 2026-11-18; P-017/A-084–A-086.
- **Estado:** aceito como limite de implementação; seleção/oclusão pendentes.
- **Contexto:** [PRD-016](../prds/PRD-016-camadas-fisicas-e-oclusao-nativas.md).

## Contexto

A ADR-006 resolveu o grounding primário. A investigação seguinte reconhece
até três camadas nos857 GRs observados e uma consulta nativa dependente de
posição3D, grids distintos e caches. Ainda não fecha quem fornece o Y de
referência, o contrato de múltiplos hits nem a política visual dos prédios.

## Decisão

Publicar somente o parser/auditor offline `gr_layers.py` e
`audit_ground_layers.py`, com fixtures sintéticas e saída de candidatos.
Para7+2N seções, ler0/2 e6+i/6+N+i, i1..N; não fixar coll secundário em8.
Validar os grids e os mesmos payloads físicos aceitos pela ADR-006.

Preservar `groundHeights`, seu null/fallback anterior e o runtime primário.
Não fundir pisos, selecionar por ZO, por max/min-hit ou por proximidade
parcialmente recuperada. Não usar BuildMdlSetVisible como política de telhado:
a API booleana/lookup espacial não prova quando nem qual mesh deve sumir.

## Consequências e aceite

O auditor cobre857 fontes, separa423 células sem hit de116 ambíguas e aponta
cinco dos133 desvios ZO como candidatos secundários; não declara nenhum
resolvido no jogo. Não há alteração de câmera, materiais, depth, shader,
colisão, VM ou estado de ator. A/B controlado e ledge84 verificam preservação,
não paridade de camada ou política original de oclusão.

Uma implementação futura exige origem autoritativa do Y/camada em spawn,
warp e movimento, escolha intramalha, guardas/cache e vínculo de geometria
visível aos dados nativos. Exige também regressão red-green do comportamento
publicado e comparação visual natural/emulador. P-017 permanece aberta.
