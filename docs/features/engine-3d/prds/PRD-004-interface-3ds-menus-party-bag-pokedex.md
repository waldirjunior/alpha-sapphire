# PRD-004 — Interface Estilo Nintendo 3DS (Menus, Party, Bag, Pokédex)

- **Módulo:** [engine-3d](../README.md)
- **Estado:** Planejado (Fase 2–3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-011`

## 1. Problema

O HUD atual exibe controles de desenvolvimento (`Inicial: Treecko / Torchic / Mudkip / Resetar Save`) no topo da tela em vez da experiência de jogo real de Pokémon Alpha Sapphire.

## 2. Requisitos Funcionais

- **RF-01:** Substituir a barra de debug por um menu lateral/inferior estilo tela tátil do 3DS com abas: **Party (Equipe)**, **Bag (Mochila)**, **Pokédex**, **Mapa de Hoenn** e **Save**.
- **RF-02:** Exibir barras de HP coloridas (verde/amarelo/vermelho), barra de XP, tipos e ícones/status na batalha e no menu de equipe.
- **RF-03:** Mover ações de desenvolvedor/teste para um painel recolhível opcional (`?debug=1`).

## 3. Critérios de Aceite

- [ ] Jogador consegue abrir Party, Bag, Pokédex e Save pelo menu sem controles de debug expostos por padrão.
- [ ] Layout responsivo e legível em desktop e mobile.
- [ ] `npm test && npm run build` passando.
