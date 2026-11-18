# ADR-003 — Zonas lazy e assets compostos

- **Status:** Aceito
- **Data:** 2026-11-17
- **Requisito:** [PRD-005](../prds/PRD-005-mapas-de-zona-no-runtime.md)

## Decisão

`src/data/maps_v2/` mantém adapter, loader e repositório de mapas separado do
core puro. O glob só inclui nomes numéricos; `_validation.json` não é mapa.
Promises de JSON são compartilhadas e removidas do cache quando falham.
O bootstrap aguarda a zona inicial/salva; cada movimento aguarda somente o
JSON de destino do warp, sem percorrer recursivamente o grafo de 536 zonas.

MapDefinition ganha campos opcionais de origem/atores/chunks/warps para manter
compatibilidade com MAPS. O modo padrão usa zone_0006 e a chave de localStorage
`alpha_sapphire_web_save_v2`; `?maps=legacy` preserva o modo e a chave antigos
`alpha_sapphire_web_save_v1`. O payload de save continua version=1: são namespaces
distintos, não uma migração destrutiva dos saves existentes.

O core testa entrada no retângulo de warp antes da permissão GR: portas podem
estar bloqueadas no GR estático. Mover dentro do retângulo de chegada não causa
retorno automático. Efeito é responsabilidade do engine: 0/ausente é imediato,
outros códigos usam fade genérico de 120+120ms. Direções 0/1/2/3 são projetadas
em down/up/left/right; outros valores mantêm a direção de movimento. Isso não
alega validação de todos os códigos/ABI do jogo original.

Chunks de 40 tiles são posicionados em offset+(19.5,19.5), escala 1/18. A troca
visual é atômica: se algum chunk falhar, permanece o grid; uma versão de request
impede resposta antiga de substituir o mapa atual. NPCs usam o índice bruto
como mm_NNNN e fallback explícito; não se mascara bits de IDs especiais por palpite.

Assets convertidos ficam locais/ignorados. O staging é limitado ao slice e um
salto de destinos, preserva texturas por GR e embute URIs externas dos atores
para evitar colisões de nomes no diretório flat de personagens. Não sobrescreve
assets existentes com bytes diferentes nem executa SPICA/Blender.

## Consequências

Sem dependências novas ou browser/Three.js no core. BGM consulta zoneId e os
encontros usam a tabela da zona atual, sem depender de nomes duplicados de
interiores. Flags, scripts, diálogos, bordas contínuas e paridade ficam em
P-013/P-017. O flag legacy é fallback explícito, não conversão silenciosa de
coordenadas de uma zona de vários GRs para um mapa manual de um GR só.
