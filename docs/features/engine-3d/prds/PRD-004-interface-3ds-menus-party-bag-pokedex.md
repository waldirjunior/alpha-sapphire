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

## 9. Investigação dos toques da AreaNav — 2026-11-20

Uma nova cópia temporária do perfil Azahar chegou à AreaNav em Rustboro.
Capturas ignoradas pelo Git ficam em
`rom/visual-report/pokenav-icon-probe/`. Toques em `(80,224)`, `(112,224)`,
`(144,224)`, `(176,224)`, além de `(180,218)` e `(180,224)` em execuções
isoladas, mantiveram a tela. Uma sequência com toques anteriores e `B` mostrou
o Cartão de Treinador após `(180,224)`, mas a mesma coordenada isolada não
reproduziu a transição.

Esse resultado não identifica um dos quatro ícones. Nenhum nome, ação ou
handler foi ligado aos glifos e nenhuma baseline foi aprovada. Próximo passo:
calibrar a coordenada de toque contra um controle conhecido e repetir cada
ícone em uma execução isolada, registrando também o estado de entrada.

Verificação: o comando abaixo passou com 31/31. As capturas do mapa e da
batalha foram inspecionadas; nenhuma baseline foi regravada ou aprovada.

```sh
ALPHA_PUBLIC_DIR=/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/public \
ALPHA_E2E_PORT=56871 npx playwright test e2e/pokemonBattleModels.spec.ts \
e2e/visual.spec.ts --workers=1
```

## 10. Busca de recursos AreaNav na ROM — 2026-11-21

`scripts/inspect_arenav_assets.py` varreu os 299 arquivos de `RomFS/a/`:
298 GARCs com 51.043 entradas e um arquivo que não é GARC (`a/0/8/7`). O
scan profundo não encontrou GARC malformado; 19 entradas tiveram avisos ao
decodificar prefixos LZ11. Entre os cabeçalhos de recursos reconhecidos havia
2.347 BCH e 3.230 CGFX; nenhum BCLYT, BCFLY, BFLYT, BFLIM, CLYT, FLIM, FLYT,
CLIM ou ARC. A busca pelos
nomes de AreaNav encontrou seis entradas BCH consecutivas em `a/1/5/2`, slots
181–186, todas nomeadas `pokenavi`.

O slot 181 contém o modelo 3D `ad10_pokenavi`, com três materiais e quatro
texturas: `pokenavi_gamen01` (256×512), `pokenavi01` (512×512),
`bc_Bchara_hlight01` (64×64) e `pokenavi03` (128×128). Os slots 182–186 são
recursos nomeados como cenas/animações `ad10_pokenavi_scene*` e não contêm
modelos nem texturas. As texturas exportadas do slot 181 foram inspecionadas
localmente; elas não fornecem o mapa Hoenn nem os quatro ícones da AreaNav.
Assim, a busca produziu um candidato PokéNav extraível, mas não identificou o
recurso visual em falta e não justifica ligar esses arquivos a `areaNav.ts`.
P-011 continua aberto.

O scanner lê os índices GARC e verifica cabeçalhos sintéticos sem depender dos
assets locais no CI. A extração valida o tipo BCH e só permite gravar sob
`rom/extracted/` ou `public/assets/`, ambos destinos ignorados pelo Git. Os seis
testes sintéticos cobrem leitura de cabeçalhos, LZ11, extração, offsets
malformados e restrição do destino. Para reproduzir a varredura e extrair o
candidato em uma máquina com assets locais:

```bash
python3 scripts/inspect_arenav_assets.py \
  --romfs "$ROM_EXTRACTED/RomFS" --deep \
  --output /tmp/arenav-rom-scan.json

python3 scripts/inspect_arenav_assets.py \
  --romfs "$ROM_EXTRACTED/RomFS" \
  --extract-archive a/1/5/2 --slot 181 --expect-magic BCH \
  --extract-root "$ROM_EXTRACTED/area-nav-candidates" \
  --filename pokenavi-181.bch
```

Os arquivos extraídos e PNGs de inspeção permaneceram fora do worktree e não
foram versionados. Não foi executado e2e, pois esta entrega altera somente
scripts e documentação; nenhuma captura ou baseline foi criada ou aprovada.

## 11. Extração e integração da AreaNav — 2026-11-21

`scripts/extract_arenav_ui.py` percorre GARC → LZ11 → DARC, extrai BCLIMs
selecionados para PNG e decodifica as panes `pan1`, `pic1` e `txt1` de
`map_lower.bclyt` para `map_lower.layout.json`. A saída local contém 16 arquivos:
`poke_navi_map.png` (380×270 ETC1), `map_city_icon01..03.png`, os sprites
`hero_obj.png`/`heroine_obj.png`, `map_navi01..05.png` do subslot inglês 1,
`map.png` (320×240), `finger_icon.png` e o JSON com 335 panes. O CLYT confirma
tela raiz 320×240, pane do mapa em `(0,15)` com 380×270 e pane de título 190×30.

`areaNav.ts` mostra `poke_navi_map.png`, marcadores nativos para cidades e
vilas, e o sprite Brendan/May conforme o gênero salvo; se o mapa falhar ao
carregar, a composição vetorial anterior volta a aparecer. As coordenadas dos
marcadores existentes são ajustadas visualmente à textura, pois `map_lower`
não contém o vínculo entre cada local Hoenn e um pixel do mapa. O título textual
AreaNav permanece no host: o arquivo consultado contém panes de texto, sem uma
faixa bitmap com esse título. `pokenavi_logo.bclim` em `a/2/4/7` diz “POKEMON
MULTI NAVI”, não “AreaNav”. A busca em `a/0/6/6..9`, `a/1/5/0`, slots
181–186 de `a/1/5/2`, `a/2/4/4`, `a/2/4/7` e subslots 0–6 de `a/2/7/6` não
identificou os quatro glifos quadrados da faixa inferior. `map_navi01..05`
mostram “Places”, “Pokémon”, “Trainers”, “Bases” e “Berries”; não são essa
faixa. Os quatro glifos permanecem decorativos e sem handlers, conforme A-121.

Testes sintéticos em `scripts/test_extract_arenav_ui.py` cobrem bounds/nome de
panes e extração DARC/BCLIM. `src/game/areaNav.test.ts` cobre medidas do CLYT,
URLs, marcadores e retorno ao fallback.

No ajuste visual v2, `map_lower.layout.json` confirmou `RootPane` 320×240,
`pic1` do mapa em `(0,15)` com 380×270 e `pan1` `s` em `(0,15)` com 320×210.
A moldura visível da captura Azahar foi ajustada para 245×176 em `(0,15)`; a
imagem é desenhada 1:1 e deslocada para centralizar o marcador do jogador,
limitando o recorte aos bounds da textura. A faixa superior cobre y=0..15. Os
marcadores nativos usam 32×16 (cidade) e 16×16 (vila), conforme as panes `4v`
e `4t` do CLYT; a ordem de desenho mantém o ponto selecionado clicável mesmo
quando outro ponto fica sobreposto.

Os BCLIMs dos ícones têm pixel format 8 (`RGBA4`), portanto carregam alpha de 4
bits; pixels ciano `(0,255,255)`/`(0,255,221)` e tons próximos nas bordas chegam
com alpha opaco. O decoder aplica a chave ciano nesses quatro assets e mantém o
alpha dos demais pixels. O CLYT liga `pic1` `4t`, `4v` e `4x` aos materiais 36,
37 e 38, que apontam para `map_city_icon01..03`; seus quatro vertex colors são
`(128,128,128,255)`, por isso a integração aplica `brightness(0.5)`. O `pic1`
do mapa (`name=0`) tem os quatro vértices brancos, material index 0 e UVs
cobrindo o conteúdo.

A captura `/tmp/arenav-check-v2.png` foi comparada com a referência Azahar: o
mapa aparece em escala 1:1, recortado no sudoeste ao redor de Littleroot, com
marcadores sem caixas ciano e a faixa superior clara. Os glifos inferiores
seguem aproximados; a busca anterior não localizou seus bitmaps, e continuam
sem handlers conforme A-121. O cenário e2e passou métricas, seleção e conteúdo,
mas o snapshot visual segue diferente do baseline versionado (40.211 pixels,
53%); não regravá-lo nesta etapa. `npm run verify` e os sete cenários smoke
passaram. PNGs e relatórios locais ficam fora do Git.
