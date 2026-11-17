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
