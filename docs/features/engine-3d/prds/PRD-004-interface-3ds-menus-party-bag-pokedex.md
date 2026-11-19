# PRD-004 — Interface Estilo Nintendo 3DS (Menus, Party, Bag, Pokédex)

- **Módulo:** [engine-3d](../README.md)
- **Estado:** Em andamento (Fase 2–3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-011`

## 1. Problema

O HUD atual exibe controles de desenvolvimento (`Inicial: Treecko / Torchic / Mudkip / Resetar Save`) no topo da tela em vez da experiência de jogo real de Pokémon Alpha Sapphire.

## 2. Requisitos Funcionais

- **RF-01:** Substituir a barra de debug por um menu lateral/inferior estilo tela tátil do 3DS com abas: **Party (Equipe)**, **Bag (Mochila)**, **Pokédex**, **Mapa de Hoenn** e **Save**.
- **RF-02:** Exibir barras de HP coloridas (verde/amarelo/vermelho), barra de XP, tipos e ícones/status na batalha e no menu de equipe.
- **RF-03:** Mover ações de desenvolvedor/teste para um painel recolhível opcional (`?debug=1`).

## 3. Critérios de Aceite

- [ ] Layout dual-screen estilo Nintendo 3DS com PlayNav/Menu inferior fiel (Party em 6 slots, Bag categorizada e Pokédex em grade Hoenn).
- [x] Controles de debug ocultos por padrão (`?debug=1`) e barras de HP coloridas.
- [x] `npm test && npm run build` passando.

## 4. Entrega web — 2026-11-19

`index.html` apresenta o dock inferior do PokéNav com Equipe, Mochila,
Pokédex, Hora e Salvar. Hora abre um cartão com relógio local; os diálogos
exibem o nome do falante em uma faixa azul; a batalha usa cartões compactos
no canto inferior direito. Os controles de jogo e os IDs usados pelo Playwright
foram mantidos.

`menus.test.ts` cobre os rótulos/acessibilidade do dock, o relógio de 24 horas e
a separação do nome em diálogos. `battleUi.test.ts` cobre os cartões de batalha
e o escape do texto. Os quatro testes novos falharam antes dos helpers e passaram
depois.

Verificação: `npm run verify` passou com 478 testes Vitest e 233 testes Python
(1 skip); `ALPHA_E2E_PORT=5442 npx playwright test e2e/smoke.spec.ts
e2e/campaign.spec.ts` passou com 7/7; `ALPHA_E2E_PORT=5442 npm run test:e2e`
passou com 36/36.

## 5. Mapa de Hoenn — 2026-11-19

`src/core/hoennMap.ts` define cidades, vilas, as Routes 101–134 e marcos nomeados
das zonas Hoenn. O resolver `resolveHoennLocation` aceita o `mapId` atual e o
nome da zona, incluindo aliases para interiores que pertencem a uma cidade.

O dock mantém os seletores existentes e acrescenta `data-tab="map"`. A aba
renderiza ligações e pontos em SVG, marca a região atual do jogador e atualiza
nome e descrição ao selecionar um local. Os pontos e descrições são dados
estruturais da interface; `src/data/maps_v2/` não foi alterado.

`hoennMap.test.ts` cobre as 34 rotas, limites das coordenadas, conexões e
resolução de zonas. `menus.test.ts` cobre o rótulo/acessibilidade e o parser da
nova aba; o smoke e2e também verifica o marcador atual e a seleção de uma rota.

Verificação: `npm run verify` passou com 489 testes Vitest e 233 testes Python
(1 skip), incluindo build. `ALPHA_E2E_PORT=5460 npx playwright test
e2e/smoke.spec.ts e2e/campaign.spec.ts` passou com 8/8. A suíte completa
`ALPHA_E2E_PORT=5460 npm run test:e2e -- --workers=1` passou com 37/37,
incluindo os cenários visuais.

O PRD continua em andamento: falta comparar o mapa e a interface com o Azahar
antes de declarar paridade visual.
