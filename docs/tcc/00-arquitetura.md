# Arquitetura do Projeto — Pokémon Alpha Sapphire Web (Three.js)

## 1. Objetivo
Reconstruir a experiência de **Pokémon Alpha Sapphire** para navegador web utilizando **Three.js** e **TypeScript**, alimentado por assets, mapas, textos e tabelas extraídos da ROM original, com:
- Separação estrita entre **lógica de jogo (`src/core/`)** e **renderização (`src/engine/`)**;
- Suporte futuro a **multiplayer em salas** (mesmo `core/` rodando no servidor);
- **Fluxo guiado por IA** para extração de dados, implementação incremental, testes comparativos contra emulador e documentação contínua para o TCC.

## 2. Estrutura de Pastas
- `src/core/`: Estado do jogo, movimentação, colisões, warps, batalha e flags de história (sem dependência de DOM/Three.js).
- `src/engine/`: Renderização Three.js, carregamento sob demanda de `.glb`, câmera e iluminação.
- `src/data/`: Mapas, diálogos, encontros e tabelas convertidas para JSON.
- `src/ai/`: Agentes/scripts de verificação e automação.
- `docs/tcc/`: Registros técnicos e decisões de arquitetura para o livro do TCC.
