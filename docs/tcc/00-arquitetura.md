# Arquitetura do Projeto — Pokémon Alpha Sapphire Web (Three.js)

## 1. Objetivo
Reconstruir a experiência de **Pokémon Alpha Sapphire** para navegador web utilizando **Three.js** e **TypeScript**, alimentado por assets, mapas, textos e tabelas extraídos da ROM original, com:
- Separação estrita entre **lógica de jogo (`src/core/`)** e **renderização (`src/engine/`)**;
- Suporte futuro a **multiplayer em salas** (mesmo `core/` rodando no servidor);
- **Fluxo guiado por IA** para extração de dados, implementação incremental, testes comparativos contra emulador e documentação contínua para o TCC.

## 2. Estrutura de Pastas
- `src/core/`: Estado do jogo (`gameState.ts`), motor de batalha (`battle.ts`) e serialização de save (`save.ts`), 100% puros sem dependência de DOM/Three.js.
- `src/engine/`: Renderização Three.js (`SceneManager.ts`), carregamento sob demanda de `.glb` (mapas, protagonista Brendan e arena de batalha 3D), câmera e iluminação.
- `src/data/`: Mapas `40×40` (`maps/`), diálogos decodificados (`texts/`) e tabelas de espécies/encontros (`pokemon/`) em JSON/TypeScript.
- `src/ai/`: Suíte de paridade contra o comportamento esperado da ROM original (`emulatorParity.test.ts`).
- `scripts/`: Pipeline offline em Python para extração de `RomFS`, `GARC`, `GR`, textos Gen 6 e conversão `.glb` via `SpicaExport` + `assimp`.
- `docs/tcc/`: Registros técnicos e decisões de arquitetura para o livro do TCC.

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
