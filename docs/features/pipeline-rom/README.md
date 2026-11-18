# Módulo: Pipeline da ROM (`pipeline-rom`)

Responsável por extrair as partições proprietárias (`RomFS`, `ExeFS`) da ROM `.3ds` na VPS e convertê-las offline em JSONs tipados e modelos `.glb` otimizados para o cliente web.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos e critérios de aceite do pipeline.
- [adrs/](adrs/README.md) — decisões arquiteturais e de isolamento proprietário.
- [battle-tables.md](battle-tables.md) — offsets e formato de personal, golpes, tipos, learnsets, TM/HM, evolução e naturezas (`A-010`); carga em runtime por [ADR-004](adrs/ADR-004-tabelas-de-batalha-sob-demanda.md).
- [script-format.md](script-format.md) — formato Pawn/AMX v10 das zonas ORAS, offsets, compactação, evidências e limites de interpretação (P-013/A-016).
- [script-disassembly.md](script-disassembly.md) — disassembly das 536 zonas/85 globais, 615 nomes nativos, vínculos derivados dos ZOs e primeiro runner puro de chamadas normalizadas (P-013/A-017/A-018).
- [audio-format.md](audio-format.md) — cadeia zona → BGM (ZoneData `@0x08` → tabela do `code.bin` → BCSAR STRG/INFO → `.bcstm`/`.mp3`) e layout do `sango_sound.bcsar` (`P-008`, `A-023`).
- [animations-format.md](animations-format.md) — formato GF1, índices de batalha PB/PK, expressões BCH, conversão individual e integração serial por manifesto nos GLBs texturizados (`P-012`, `A-020`, `A-021`).
- [face-expressions.md](face-expressions.md) e [evidência por MM](character-face-evidence.json) — P-019/A-044–A-048: wrappers CRO, ligação ator→estado→frame, paleta BCH, orientação V original e normalização inicial de cinco faces, ampliada em A-050/A-051 para 79 GLBs com proveniência. Promoção exporta oito frames para seleção explícita no runtime; A/B de NPC validado, piscada automática pendente de clock/condições, sem alterar skin/clipes/topologia.
- [character-face-coverage.json](character-face-coverage.json) — A-050/A-051: 99 MM auditados, 79 GLBs/91 materiais normalizados e exclusões por modelo; cobertura das zonas 6–16, preservação estrutural/idempotência e razões para não aplicar flip. Orientação-base também cobre paletas curtas e faces estáticas; expressões dinâmicas continuam limitadas à paleta completa evidenciada.
- [overworld-motion-coverage.json](overworld-motion-coverage.json) — A-062/A-063: zones 6–16 plus both players; 48 native standing/movement pairs, five no-motion MM, 12 unmapped IDs, pack/source hashes, and exported clip availability. PRD-007 separates constant posture, observed locomotion, and unproven original dispatch. A-061 in face-expressions.md resolves bounded random without inventing a blink clock.
- [native-models-manifest.json](native-models-manifest.json) — cobertura dos 544 modelos MM e das 39 espécies selecionadas por encontros/starters/lendários, mapeamento PC/PB/GF1, resultados por modelo e validação amostral (`AN-E9`, `A-022`).
- [Catálogo runtime](../../../src/data/nativeAssets.json) e [auditoria UV](native-uv-audit.json) — promoção local por SHA-256 de 140 modelos (99 personagens/41 Pokémon), com fallbacks explícitos por falta de motion; [PRD-007](../engine-3d/prds/PRD-007-animacoes-nativas-no-runtime.md) documenta reprodução, poses de índice 0 e limites de atlas/pés. GLBs permanecem ignorados.
- [maps-format.md](maps-format.md) — layout completo observado das 431 MM, grid de zonas, escala e geração dos 536 mapas `maps_v2`; [PRD-003](prds/PRD-003-mapas-por-zona.md), [ADR-005](adrs/ADR-005-recorte-de-mapas-por-zone-grid.md), A-024/P-017.
- Referência TCC: [docs/tcc/01-pipeline-rom.md](../../tcc/01-pipeline-rom.md).

## Estado atual

- ROM `.3ds` (`2.0G`) disponível localmente em `rom/` (ignorada pelo Git).
- `ctrtool` instalado em `/usr/local/bin/ctrtool` (`P-001` fechada).
- `ExeFS` (`5.6M`) e `RomFS` completa (`655` arquivos, `40` diretórios) extraídas em `rom/extracted/` via `ctrtool` e [scripts/extract_romfs.py](../../../scripts/extract_romfs.py) (`P-002` fechada, `A-003`).
- Manifesto de contagem registrado em [romfs-manifest.json](romfs-manifest.json).
- Catálogo dos `299` GARCs de `RomFS/a/` gerado via [scripts/catalog_garcs.py](../../../scripts/catalog_garcs.py) em [garc-catalog.json](garc-catalog.json):
  - `a/0/0/8` (`1.07 GB`, `8067` entradas, `MINI:PC` / `BCH` / `LZ11`) — modelos/texturas/animações 3D de Pokémon.
  - `a/0/4/0` (`431` entradas, `MINI:MM`) — matrizes de mapa (`MapMatrix`).
  - `a/0/3/9` (`108 MB`, `857` entradas, `LZ11`) — gráficos/modelos de campo.
  - `a/0/8/8` (`6.6 MB`, `741` entradas), `a/1/2/9` (`109` `CGFX`), `a/1/3/6` (`158` `BCH`).
