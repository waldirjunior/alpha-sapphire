# Arquitetura do Projeto — Pokémon Alpha Sapphire Web (Three.js)

## 1. Objetivo
Reconstruir a experiência de **Pokémon Alpha Sapphire** para navegador web utilizando **Three.js** e **TypeScript**, alimentado por assets, mapas, textos e tabelas extraídos da ROM original, com:
- Separação estrita entre **lógica de jogo (`src/core/`)** e **renderização (`src/engine/`)**;
- Suporte futuro a **multiplayer em salas** (mesmo `core/` rodando no servidor);
- **Fluxo guiado por IA** para extração de dados, implementação incremental, testes comparativos contra emulador e documentação contínua para o TCC.

## 2. Estrutura de Pastas
- `scripts/`: pipeline offline em Python para extração de `RomFS`, `GARC`, `GR`, textos, scripts AMX e tabelas, e conversão para `.glb` via `SpicaExport` + Blender.
- `src/core/`: lógica pura sem DOM nem Three.js — estado e movimento em grade (`gameState.ts`), warps, bordas e ledges, motor de batalha (`battle*.ts`), save (`save.ts`) e a VM Pawn/AMX dos eventos (`amx*.ts`).
- `src/engine/`: apresentação Three.js — `SceneManager.ts`, terreno por zona e contínuo, atores, animações nativas, materiais PICA, host de eventos e áudio.
- `src/data/`: dados gerados pelo pipeline — 536 mapas por zona (`maps_v2/`), scripts desmontados (`zone_scripts/`), textos (`texts/`), encontros (`zones/`) e tabelas de batalha (`battle/`).
- `src/game.ts`, `src/main.ts`: bootstrap e host de entrada, HUD, menus, batalha e save.
- `src/visual/`, `e2e/`: validação visual por cenário e smoke do jogo real ([validacao-visual](../features/validacao-visual/README.md)).
- `src/ai/`: valores esperados do original para testes de paridade.
- `docs/tcc/`: registros técnicos e decisões de arquitetura para o livro do TCC.

## 3. Eventos puros e apresentação de batalha

A [ADR-005 do engine](../features/engine-3d/adrs/ADR-005-eventos-batalha-e-clipes-nativos.md)
mantém a resolução de dano e ordem dos turnos no core. O resultado contém eventos
imutáveis de golpe, perda de HP e queda; não contém objetos Three.js. O host
aguarda a apresentação desses fatos antes de adotar o próximo estado, evitando
substituir um Pokémon antes de mostrar sua queda. O engine escolhe os clipes
GF1 pelo catálogo local e categoria do golpe, aguarda o mixer e invalida cargas
obsoletas quando a cena muda.

Essa fronteira permanece reutilizável sem WebGL no servidor. A implementação
local ainda não é um protocolo multiplayer nem comprova marcadores de impacto,
expressões BCH ou paridade temporal. Testes de mixer e eventos são distintos da
validação Playwright na main e da comparação com emulador (P-012).
