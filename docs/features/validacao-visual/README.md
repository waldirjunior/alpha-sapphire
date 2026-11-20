# Módulo: Validação visual e de jogo real (`validacao-visual`)

Rede de proteção contra regressão de imagem e de fluxo: roda o jogo de produção em Chromium headless, mede a cena e compara com o que já foi aprovado. Responsável por `src/visual/`, `e2e/`, `visual.html` e `playwright.config.ts`.

## Documentos do módulo

- [prds/](prds/README.md) — o que a validação precisa garantir.
- [adrs/](adrs/README.md) — decisões de desenho.

## O que roda

`npm run test:e2e` executa duas suítes:

| Suíte | Arquivo | Garante |
| --- | --- | --- |
| Smoke do jogo real | `e2e/smoke.spec.ts` | Intro, movimento em grade, bloqueio por NPC, diálogo da ROM, warp de porta, save/reload e batalha selvagem funcionam com teclado, sem erro de página, console ou HTTP. |
| Cenários visuais | `e2e/visual.spec.ts` | Os cenários de mundo renderizam a cena de produção em pose fixa e passam por três verificações. `POKENAV_MAP_SCENARIOS` também captura a tela do Mapa, verifica métricas DOM e grava uma comparação local com o Azahar quando há referência. |

As três verificações dos cenários de mundo:

1. **Portões de qualidade** — limites absolutos sobre métricas da cena (`src/visual/gates.ts`):
   - `assetsLoaded`: nenhum asset falhou ao carregar;
   - `avatarVisible`: pelo menos 70% do avatar chega à tela (detecta telhado, parede ou terreno encobrindo);
   - `terrainPresent`: no máximo 30% do frame sem geometria (detecta "céu sem chão");
   - `feetOnGround`: sola do modelo a no máximo 0,02 tile do chão (detecta pés ausentes ou avatar enterrado), medido só nos close-ups.
2. **Métricas versionadas** — os números do cenário não podem se afastar de `e2e/visual-metrics/<id>.json` além da tolerância.
3. **Imagem de referência** — o frame não pode diferir do baseline local em mais de 0,2% dos pixels.

O cenário UI `pokenav-hoenn-map` mede o tamanho do painel e do SVG, a
quantidade de locais e conexões, o marcador do jogador e o local selecionado.
Suas métricas ficam em `e2e/visual-metrics/pokenav-hoenn-map.json`; a captura e
a comparação local ficam em `rom/visual-report/`. O baseline de screenshot
protege contra regressão do port. A comparação manual com Azahar é a evidência
de fidelidade e pode continuar apontando uma diferença conhecida.

## Defeito conhecido não é teste desligado

Um portão que falha hoje por um defeito já registrado fica em `knownDefects` do cenário, com a pendência. O teste então exige que ele **continue falhando**:

- se piorar ou outro portão quebrar → `regressão`, suíte vermelha;
- se alguém corrigir → `corrigido`, suíte vermelha até o registro ser removido e a pendência atualizada.

Assim o placar de [STATUS.md](../../STATUS.md) (cenários aceitos / total) só anda para a frente.

## Fluxo de uma mudança visual

1. `npm run test:e2e` antes de mexer: precisa estar verde.
2. Faça a mudança.
3. `npm run test:e2e`: as falhas mostram quais cenários mudaram e quanto.
4. Abra `rom/visual-report/index.html` (galeria com todas as capturas e veredictos) e, para os diffs, `rom/visual-report/playwright/index.html`. **Olhe as imagens.**
5. Mudança esperada e correta → `npm run visual:approve`, commit das métricas em `e2e/visual-metrics/`. Mudança inesperada → é regressão, corrija.

## Novo cenário

Para uma cena de mundo, acrescente uma linha em `VISUAL_SCENARIOS` de
`src/visual/scenarios.ts` (zona, célula e câmera) e use uma célula livre de
NPCs. Inspecione as capturas e a comparação com o Azahar antes de atualizar o
baseline.

Para uma tela do PokéNav, acrescente um item em `POKENAV_MAP_SCENARIOS`, inclua
as métricas esperadas em `e2e/visual-metrics/<id>.json` e inspecione a captura e
`rom/visual-report/<id>-comparison.html` antes de atualizar o baseline.
Um defeito visual novo sempre entra primeiro como cenário que falha.

## Onde ficam os arquivos

| O quê | Onde | No Git |
| --- | --- | --- |
| Catálogo, métricas puras, portões | `src/visual/` | Sim |
| Métricas aprovadas por cenário | `e2e/visual-metrics/*.json` | Sim |
| Imagens de referência | `rom/visual-baselines/<plataforma>/` no checkout principal | Não (derivam da ROM) |
| Capturas, galeria e relatório da última execução | `rom/visual-report/` | Não |

Em máquina nova não há imagens de referência: rode `npm run visual:approve` na `main` uma vez. As métricas versionadas valem desde o primeiro minuto.

## Limites

- O probe monta a cena com a lista bruta de NPCs do mapa, sem rodar a VM AMX: valida renderização, não estado de história.
- Os portões medem legibilidade, não fidelidade ao original. Fidelidade exige a captura de referência do emulador (P-021).
- Baselines de imagem são por plataforma; métricas toleram a diferença entre GPUs.
