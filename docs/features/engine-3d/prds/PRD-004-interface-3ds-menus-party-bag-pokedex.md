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

## 6. Pokédex persistente — 2026-11-20

`src/core/pokedex.ts` guarda em estado imutável os IDs de espécies vistas e
capturadas. `SaveData` grava as duas listas; saves anteriores sem o campo
Pokédex são carregados com as espécies do time inicial como vistas e
capturadas. O host registra o inimigo ativo ao iniciar/atualizar uma batalha,
marca capturas e registra como capturada toda espécie que passa a integrar o
time, incluindo evoluções.

A aba Pokédex apresenta contadores reais de Vistos/Capturados e status por
espécie a partir do catálogo da ROM. `pokedex.test.ts`, `save.test.ts` e
`menus.test.ts` cobrem estado, migração e apresentação; `battleUi.test.ts`
cobre a contagem persistida usada nas capturas críticas.

Verificação: `npm run verify` passou com 594 testes Vitest e 241 testes Python
(1 skip); `ALPHA_E2E_PORT=5500 npx playwright test e2e/smoke.spec.ts` passou
com 7/7 e `ALPHA_E2E_PORT=5500 npm run test:e2e -- --workers=1` passou com
39/39. As capturas da galeria foram inspecionadas sem regravar baselines.
Continua pendente a comparação visual com o Azahar.

## 7. Comparação visual da AreaNav — 2026-11-20

`POKENAV_MAP_SCENARIOS` declara `pokenav-hoenn-map`. O teste Playwright abre a
aba **Mapa**, seleciona Route 101 e verifica a posição em Littleroot, o local
selecionado, os marcadores e as métricas de tamanho/contagem. Os números ficam
em `e2e/visual-metrics/pokenav-hoenn-map.json`; a captura do port fica em
`rom/visual-report/captures/pokenav-hoenn-map.png`.

A referência Azahar `rom/visual-reference/pokenav-hoenn-map-azahar.png` é o
recorte 320×240 da tela inferior; o frame duplo original está em
`rom/visual-reference/pokenav-hoenn-map-azahar-full.png`. Ambos vieram do save
local avançado, em uma cópia temporária do perfil relocalizada para Littleroot.
A comparação revisada está em
`rom/visual-report/pokenav-hoenn-map-comparison.html`.

O Azahar mostra a AreaNav texturizada, o nome da cidade atual e quatro ícones
na faixa inferior. O port mostra um mapa vetorial com conexões, marcador,
detalhes do local selecionado e o dock do PokéNav web. O cenário e o baseline
Chromium dão uma reprodução executável e protegem contra regressões; a
diferença visual mantém P-011 aberto. Nenhum PNG derivado da ROM foi
versionado.

Verificação: `ALPHA_E2E_PORT=5513 npx playwright test e2e/visual.spec.ts
e2e/pokemonBattleModels.spec.ts --workers=3` passou com 31/31; `npm run verify`
passou com 634 testes Vitest e 249 testes Python (1 skip), incluindo build.

## 8. Composição AreaNav — 2026-11-20

`areaNav.ts` compõe o painel no recorte 320×240 observado no Azahar, com o
título AreaNav, mapa Hoenn, rótulo da localização e quatro ícones decorativos.
O cenário `pokenav-hoenn-map` agora seleciona Littleroot para comparar o mesmo
estado que a referência; `e2e/visual.spec.ts` verifica dimensões, título, ícones,
marcador, seleção e captura. O JSON de métricas foi atualizado e a baseline
Chromium foi regravada depois da revisão da captura lado a lado.

A implementação usa um preenchimento vetorial texturizado e formas de ícone
temporárias. A costa, os detalhes do mapa e os glifos continuam diferentes do
Azahar; os ícones não têm nomes de ação nem bindings. P-011 permanece aberto até
identificar e extrair os recursos originais com pipeline reproduzível.

Verificação: `npm run verify` passou com 638 testes Vitest, build e 250 testes
Python (1 skip); os 36 testes Playwright passaram. A captura foi inspecionada
antes da aprovação da baseline:

```sh
ALPHA_PUBLIC_DIR=/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/public \
ALPHA_E2E_PORT=5513 npx playwright test e2e/visual.spec.ts e2e/smoke.spec.ts --workers=1

ALPHA_PUBLIC_DIR=/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/public \
ALPHA_E2E_PORT=5513 npm run visual:approve -- --grep 'visual pokenav-hoenn-map' --workers=1
```
