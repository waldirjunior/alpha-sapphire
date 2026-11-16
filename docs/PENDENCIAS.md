# Pendências

Lacunas abertas no projeto. Um item novo entra no fim com o próximo número (`P-NNN`), data, estado (`aberta`, `em andamento`, `bloqueada` ou `fechada`), evidência e próximo passo. Fechar exige registrar a evidência de resolução no próprio item. Não apague o histórico.

## P-001 `ctrtool` não instalado na VPS

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Compilado a partir de `3dsguy/Project_CTR` e instalado em `/usr/local/bin/ctrtool` (`CTRTool v1.3.0`). Validado com `which ctrtool` e `ctrtool --help`.
- **Próximo passo:** Concluído.

## P-002 Partições `RomFS` e `ExeFS` ainda não extraídas

- **Estado:** aberta
- **Data:** 2026-11-16
- **Evidência:** `rom/` contém `Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds` (`2.0G`), mas ainda não há diretório `RomFS/` ou `ExeFS/` extraído.
- **Próximo passo:** Extrair `RomFS` e `ExeFS` usando `ctrtool` para diretório ignorado pelo `.gitignore` e registrar a estrutura encontrada.

## P-003 Worktree de desenvolvimento ainda não criado

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Worktree `pipeline-rom` criado via `orca worktree create` em `/root/orca/workspaces/alpha-sapphire/pipeline-rom` (branch `pipeline-rom`, id `b9c77879-82c0-4da4-8d62-3850abb34acf::/root/orca/workspaces/alpha-sapphire/pipeline-rom`).
- **Próximo passo:** Concluído.

## P-004 Mapas placeholder hardcoded em `src/main.ts`

- **Estado:** aberta
- **Data:** 2026-11-16
- **Evidência:** `MAPS` (`littleroot_town` e `route_101`, grids 12x12) está definido inline em [src/main.ts](../src/main.ts#L5-L42); diretório `src/data/` ainda não existe.
- **Próximo passo:** Na Fase 2 ([engine-3d/PRD-001](features/engine-3d/prds/PRD-001-cena-3d-e-glb-sob-demanda.md)), mover definições de mapas para `src/data/` e carregar JSONs validados do pipeline.
