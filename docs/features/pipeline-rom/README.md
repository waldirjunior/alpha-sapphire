# Módulo: Pipeline da ROM (`pipeline-rom`)

Responsável por extrair as partições proprietárias (`RomFS`, `ExeFS`) da ROM `.3ds` na VPS e convertê-las offline em JSONs tipados e modelos `.glb` otimizados para o cliente web.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos e critérios de aceite do pipeline.
- [adrs/](adrs/README.md) — decisões arquiteturais e de isolamento proprietário.
- [battle-tables.md](battle-tables.md) — offsets e formato de personal, golpes, tipos, learnsets e TM/HM (`A-010`).
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
