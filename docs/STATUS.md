# Status

Atualizado em 2026-11-16 (verificação local na VPS).

## Estado do Código e Build

- Branch atual: `main` (repositório limpo antes da inclusão desta governança).
- `npm test` (`vitest run`): **passando** (`1` arquivo, `2` testes em [src/core/gameState.test.ts](../src/core/gameState.test.ts)).
- `npm run build` (`tsc && vite build`): **passando** (`dist/index.html` e bundle JS gerados sem erros de TypeScript).
- Módulos existentes:
  - [src/core/types.ts](../src/core/types.ts) e [src/core/gameState.ts](../src/core/gameState.ts): estado inicial, verificação de caminhabilidade (`isWalkable`), movimentação e transição por `warp`.
  - [src/engine/SceneManager.ts](../src/engine/SceneManager.ts): cena Three.js básica com cápsula placeholder para o jogador e blocos placeholder para mapa/colisões/warps.
  - [src/main.ts](../src/main.ts): loop de renderização, binding de teclado (`WASD`/setas) e definição `MAPS` placeholder inline (`littleroot_town` e `route_101`).
- Diretórios planejados ainda não criados: `src/data/`, `src/ai/`, `scripts/`.

## Estado da ROM e Ambiente na VPS

- Pasta [rom/](../rom/) ignorada pelo [.gitignore](../.gitignore#L8) e contendo:
  - `Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds` (`2.0G`)
  - `Pokemon Alpha Sapphire (USA) (EnJaFrDeEsItKo) (Rev 2).7z` (`1.1G`)
  - `readme.txt` (`27` bytes)
- Espaço livre em disco (`/`): `67G` disponíveis (`65%` usado).
- Ferramentas de extração:
  - `7z`: instalado e utilizado na extração inicial.
  - `ctrtool`: instalado em `/usr/local/bin/ctrtool` (`CTRTool v1.3.0`, compilado de `Project_CTR` em 2026-11-16).
  - `RomFS` / `ExeFS`: **não extraídos** (`P-002`, pronto para extração).
- Worktree ativo para pipeline: `pipeline-rom` em `/root/orca/workspaces/alpha-sapphire/pipeline-rom` (branch `pipeline-rom`).
