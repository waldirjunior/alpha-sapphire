# Documentação — alpha-sapphire

Índice central da documentação operacional, arquitetural e de produto do projeto.

## Governança e Continuidade

- [STATUS.md](STATUS.md) — estado atual verificado do código, testes, ROM e ferramentas na VPS.
- [ROADMAP.md](ROADMAP.md) — planejamento macro em fases e critérios de pronto.
- [PENDENCIAS.md](PENDENCIAS.md) — lacunas abertas (`P-NNN`), evidências e próximos passos.
- [APRENDIZADOS.md](APRENDIZADOS.md) — erros e regras operacionais (`A-NNN`) que não devem se repetir.

## Features e Módulos (`prds/` e `adrs/` por módulo)

- [features/](features/README.md) — índice de módulos ([pipeline-rom](features/pipeline-rom/README.md), [core-jogo](features/core-jogo/README.md), [engine-3d](features/engine-3d/README.md)), cada um com seu `README.md`, `prds/` e `adrs/`.

## TCC

- [tcc/00-arquitetura.md](tcc/00-arquitetura.md) — visão de arquitetura para o livro do TCC.
- [tcc/01-pipeline-rom.md](tcc/01-pipeline-rom.md) — referência inicial do pipeline de extração 3DS → Web.
