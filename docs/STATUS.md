# Status

Atualizado em 2026-11-16 (verificação local na VPS).

## Estado do Código e Build

- Branch atual: `pipeline-rom` (worktree `/root/orca/workspaces/alpha-sapphire/pipeline-rom`).
- `npm test` (`vitest run`): **passando** (`1` arquivo, `3` testes em [src/core/gameState.test.ts](../src/core/gameState.test.ts)).
- `npm run build` (`tsc && vite build`): **passando** (`dist/index.html` e bundle JS gerados sem erros de TypeScript).
- Módulos existentes:
  - [src/core/types.ts](../src/core/types.ts) e [src/core/gameState.ts](../src/core/gameState.ts): estado inicial com `spawnPos`, `isWalkable`, `isTallGrass`, movimentação e transição por `warp`.
  - [src/data/maps/index.ts](../src/data/maps/index.ts): mapas reais `40x40` (`littleroot_town.json`, `route_101.json`, `oldale_town.json`) extraídos de `RomFS/a/0/3/9`.
  - [src/engine/SceneManager.ts](../src/engine/SceneManager.ts): cena Three.js renderizando colisões, warps e grama alta (`terrain === 2`).
  - [src/main.ts](../src/main.ts): loop de renderização, binding de teclado (`WASD`/setas) conectado a `src/data/maps`.
- Diretórios planejados ainda não criados: `src/ai/`.

## Estado da ROM e Ambiente na VPS

- Pasta [rom/](../rom/) ignorada pelo [.gitignore](../.gitignore#L8) e contendo:
  - `Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds` (`2.0G`)
  - `Pokemon Alpha Sapphire (USA) (EnJaFrDeEsItKo) (Rev 2).7z` (`1.1G`)
  - `readme.txt` (`27` bytes)
- Espaço livre em disco (`/`): `67G` disponíveis (`65%` usado).
- Ferramentas de extração:
  - `7z`: instalado e utilizado na extração inicial.
  - `ctrtool`: instalado em `/usr/local/bin/ctrtool` (`CTRTool v1.3.0`, compilado de `Project_CTR` em 2026-11-16).
  - `ExeFS`: extraída em `rom/extracted/ExeFS/` (`5.6M`: `banner.bin`, `code.bin`, `icon.bin`).
  - `RomFS`: extraída por completo via `scripts/extract_romfs.py` em `rom/extracted/RomFS/` (`40` diretórios, `655` arquivos, `1.872.201.296` bytes; ver `A-003`).
- Worktree ativo para pipeline: `pipeline-rom` em `/root/orca/workspaces/alpha-sapphire/pipeline-rom` (branch `pipeline-rom`).
