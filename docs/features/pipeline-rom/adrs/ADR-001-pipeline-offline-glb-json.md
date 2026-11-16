# ADR-001 — Pipeline offline da ROM (`.3ds`) para `.glb` e `.json`

- **Módulo:** [pipeline-rom](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-16
- **Contexto:** [docs/tcc/01-pipeline-rom.md](../../../tcc/01-pipeline-rom.md), [PRD-001](../prds/PRD-001-extracao-rom.md)

## Contexto

O navegador não deve nem precisa ler containers `.3ds` ou formatos proprietários Nintendo (`BCH`, `CGFX`, `GARC`) em tempo de execução.

## Decisão

Executar a extração e conversão de forma **offline** na VPS Linux:
- `ctrtool` para extrair `RomFS` e `ExeFS` do container `.3ds` descriptografado;
- Ferramentas da comunidade (`SPICA` / `Ohana3DS` / `pk3DS` / `Blender` + `gltf-transform`) combinadas a scripts versionados para gerar `.glb` otimizados e `.json` tipados para o cliente web.

## Consequências

- **Positivas:** O cliente web consome apenas formatos nativos e leves (`.json` e `.glb`), com carregamento sob demanda e alta performance.
- **Negativas / Custos:** Exige manter scripts e documentação das ferramentas de extração na VPS (`P-001`, `P-002`).
