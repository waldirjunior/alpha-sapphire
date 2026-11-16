# Pendências

Lacunas abertas no projeto. Um item novo entra no fim com o próximo número (`P-NNN`), data, estado (`aberta`, `em andamento`, `bloqueada` ou `fechada`), evidência e próximo passo. Fechar exige registrar a evidência de resolução no próprio item. Não apague o histórico.

## P-001 `ctrtool` não instalado na VPS

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Compilado a partir de `3dsguy/Project_CTR` e instalado em `/usr/local/bin/ctrtool` (`CTRTool v1.3.0`). Validado com `which ctrtool` e `ctrtool --help`.
- **Próximo passo:** Concluído.

## P-002 Partições `RomFS` e `ExeFS` ainda não extraídas

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** `ExeFS` extraída via `ctrtool` (`5.6M`: `banner.bin`, `code.bin`, `icon.bin`) e `RomFS` completa extraída via `scripts/extract_romfs.py` (`40` diretórios, `655` arquivos, `1.872.201.296` bytes) em `rom/extracted/` (ignorado pelo `.gitignore`), com resumo em [romfs-manifest.json](features/pipeline-rom/romfs-manifest.json).
- **Próximo passo:** Concluído. Seguir com desempacotamento de GARCs (`a/`) e conversão de mapas/modelos ([pipeline-rom/PRD-001](features/pipeline-rom/prds/PRD-001-extracao-rom.md)).

## P-003 Worktree de desenvolvimento ainda não criado

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** Worktree `pipeline-rom` criado via `orca worktree create` em `/root/orca/workspaces/alpha-sapphire/pipeline-rom` (branch `pipeline-rom`, id `b9c77879-82c0-4da4-8d62-3850abb34acf::/root/orca/workspaces/alpha-sapphire/pipeline-rom`).
- **Próximo passo:** Concluído.

## P-004 Mapas placeholder hardcoded em `src/main.ts`

- **Estado:** fechada
- **Data:** 2026-11-16
- **Evidência:** `MAPS` inline removido de [src/main.ts](../src/main.ts) e substituído por [src/data/maps/index.ts](../src/data/maps/index.ts) com os grids reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`) extraídos de `a/0/3/9` (`GR 0006`, `0005`, `0004`) via [scripts/extract_gr_maps.py](../scripts/extract_gr_maps.py). Validado com `npm test` (`3/3`) e `npm run build`.
- **Próximo passo:** Concluído.

## P-005 Conversão de modelos 3D `BCH`/`CGFX` para `.glb`

- **Estado:** aberta
- **Data:** 2026-11-16
- **Evidência:** Os modelos 3D reais dos mapas (`BCH` na seção 1 de `a/0/3/9`) e Pokémon (`a/0/0/8`) foram localizados, mas `dotnet`, `mono`, `blender` e `gltf-transform` não estão instalados na VPS (`which dotnet mono blender gltf-transform` sem resultados).
- **Próximo passo:** Instalar/configurar conversor `BCH → .glb` (via `.NET` + `SPICA` ou parser Python dedicado + `gltf-transform`) e carregar no `SceneManager` via `map.modelUrl` ([engine-3d/PRD-001](features/engine-3d/prds/PRD-001-cena-3d-e-glb-sob-demanda.md)).
