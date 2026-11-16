# ADR-002 — Isolamento de arquivos proprietários e uso de worktrees

- **Módulo:** [pipeline-rom](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-16
- **Contexto:** [docs/tcc/01-pipeline-rom.md](../../../tcc/01-pipeline-rom.md)

## Contexto

O repositório contém código-fonte open-source do motor e scripts de TCC, enquanto a pasta `rom/` armazena a ROM proprietária (`.3ds`, `.7z`) e futuramente dumps (`RomFS/`, `ExeFS/`). Desenvolver o pipeline e o motor diretamente na `main` aumenta o risco de conflitos ou commits acidentais.

## Decisão

1. Manter `rom/`, `RomFS/`, `ExeFS/`, `*.3ds`, `*.cci`, `*.cia`, `*.cxi` e `*.7z` estritamente fora do Git via [.gitignore](../../../../.gitignore), validando novos diretórios de saída com `git check-ignore -v`.
2. Isolar novas frentes de código (como os scripts do pipeline de extração) em worktrees dedicados via `orca worktree` antes de integrar à `main`.

## Consequências

- **Positivas:** Repositório Git limpo, seguro quanto a propriedade intelectual e com histórico organizado por frente de trabalho.
- **Negativas / Custos:** Exige atenção ao criar worktrees, pois a pasta `rom/` ignorada pelo Git permanece apenas no workspace principal (ou deve ser referenciada por caminho absoluto/symlink controlado).
