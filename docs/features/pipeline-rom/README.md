# Módulo: Pipeline da ROM (`pipeline-rom`)

Responsável por extrair as partições proprietárias (`RomFS`, `ExeFS`) da ROM `.3ds` na VPS e convertê-las offline em JSONs tipados e modelos `.glb` otimizados para o cliente web.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos e critérios de aceite do pipeline.
- [adrs/](adrs/README.md) — decisões arquiteturais e de isolamento proprietário.
- Referência TCC: [docs/tcc/01-pipeline-rom.md](../../tcc/01-pipeline-rom.md).

## Estado atual

- ROM `.3ds` (`2.0G`) disponível localmente em `rom/` (ignorada pelo Git).
- `ctrtool` ainda não instalado na VPS (`P-001`); `RomFS`/`ExeFS` ainda não extraídos (`P-002`).
