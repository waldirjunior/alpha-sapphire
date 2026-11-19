# PRD-001 — Regressão visual por cenário e smoke do jogo real

- **Módulo:** [validacao-visual](../README.md)
- **Estado:** Entregue
- **Data:** 2026-11-18
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-probe-da-cena-real-e-baselines-locais.md)

## 1. Problema

Toda validação visual anterior foi feita por scripts Playwright avulsos em `/tmp`, com capturas inspecionadas uma vez e guardadas em `rom/`. Nada era reexecutável: uma mudança em material, câmera, altura ou conversão de modelo podia quebrar um ponto já validado sem ninguém perceber. `src/game.ts` e `SceneManager.ts`, que concentram a apresentação, tinham 0% e 13% de cobertura unitária.

## 2. Objetivo

Um comando que diga, para um conjunto fixo de pontos do jogo, se a imagem e o fluxo continuam como aprovados — e que transforme cada defeito visual conhecido em um teste que acusa tanto a piora quanto a correção.

## 3. Requisitos funcionais

- **RF-01:** Renderizar a cena de produção (`SceneManager` real, assets reais) em pose e câmera fixas, sem depender de relógio ou de entrada.
- **RF-02:** Medir oclusão do avatar, fração de vazio, distância sola–chão e assets com falha.
- **RF-03:** Comparar métricas com valores versionados e imagem com baseline local.
- **RF-04:** Registrar defeitos conhecidos por cenário, ligados a uma pendência, com falha tanto na regressão quanto na correção não registrada.
- **RF-05:** Exercitar o jogo real por teclado: intro, movimento, colisão, diálogo, warp, save e batalha.
- **RF-06:** Funcionar em worktree sem copiar assets.
- **RF-07:** Não versionar nenhuma imagem derivada da ROM.

## 4. Critérios de aceite

- [x] `npm run test:e2e` verde na base: 5 fluxos de smoke e 25 cenários, duas execuções seguidas sem diferença de imagem.
- [x] Mutação de controle detectada: alterar a altura da câmera de produção de 8,5 para 6,5 derruba os cenários testados (28% e 5% dos pixels diferentes; `avatarVisibility` fora da tolerância).
- [x] Defeitos atuais registrados: avatar encoberto em `z0006-littleroot-telhado` e `z0445-mauville-hall`; pés ausentes em `avatar-brendan` e `avatar-may`; atores sem modelo em 23 cenários.
- [x] Lógica de métricas, portões, catálogo e galeria com testes unitários em `src/visual/*.test.ts`.
- [x] `git check-ignore` confirma `rom/visual-baselines/` e `rom/visual-report/` ignorados.

## 5. Entregas

### 2026-11-18 — implantação

- Probe `visual.html` + `src/visual/probe.ts`; acesso de leitura `SceneManager.inspect()`.
- Catálogo de 25 cenários: 2 close-ups do jogador e 23 pontos do corredor documentado (Littleroot a Lilycove), reaproveitando os checkpoints dos PRD-006 a PRD-014 do engine.
- `vite.config.ts` com `ALPHA_PUBLIC_DIR`; `e2e/support/checkoutPaths.ts` resolve assets e baselines do checkout principal.
- Achado durante a implantação: o close-up mostrou as pernas do jogador terminando sem tênis; a inspeção do BCH com SPICA provou que a malha existe na ROM (`sw_parts02`) e é removida pelo conversor (P-019, A-095).
- Placar inicial: 2 de 25 cenários aceitos sem defeito conhecido.

### 2026-11-18 — comparação lado a lado com o original (Azahar)

Com as 25 capturas de referência 400×240 em `rom/visual-reference/` (câmera de produção a partir do save pós-relógio em `zone 6`) ligadas na galeria (`rom/visual-report/index.html`):

| Grupo / Cenário | Câmera e escala | Oclusão e geometria | Iluminação, cor e texturas |
| --- | --- | --- | --- |
| `avatar-brendan`, `avatar-may` | Probe usa câmera `closeup` frontal; referência usa câmera overworld em `(17, 14)` (observação: `avatar-may.png` foi capturada com o save masculino). | Mesmo enquadramento de solo em Littleroot no original; no port o avatar tem proporção e tênis fieis (`sw_parts02`), sem sombreamento direcional forte. | Port usa luz difusa fria/neutra; original aplica tonalidade ambiente mais quente/rosada nos telhados e placas. |
| `z0006-littleroot-spawn`, `z0006-littleroot-centro`, `z0006-littleroot-telhado` | Escala de mundo idêntica; câmera do port mostra leve extensão vertical adicional no topo e mais chão abaixo. | Em `z0006-littleroot-telhado`, telhado e chaminé também encobrem o jogador no jogo original em `(14, 16)`. Port adiciona marcador de porta/tapete vermelho nas entradas abertas e posiciona NPC bloqueando logo abaixo em `spawn`. | Original tem sombras projetadas densas (árvores, casas, postes) e verde mais escuro/quente; port tem verde mais saturado/claro e contraste reduzido em placas (`sign`). |
| `z0227-laboratorio-birch` | Original com câmera ligeiramente mais alta/horizontal; port vaza azul de fundo nos cantos superiores atrás das paredes. | Mobiliário e piso coincidem; port renderiza faixa escura aberta no vão inferior das paredes sem máscara preta externa. | Tela do monitor/globo do laboratório mais azul-turquesa no original e brilho maior nos armários no port. |
| `z0007-oldale`, `z0011-verdanturf`, `z0013-petalburg`, `z0014-slateport`, `z0015-mauville-patio`, `z0016-rustboro`, `z0009-lavaridge`, `z0010-fallarbor`, `z0018-lilycove` | Câmera e proporção muito próximas; port tem FOV/inclinação que mostra um pouco mais de terreno distante no topo (`z0007`, `z0013`, `z0014`). | Centro Pokémon no port sem porta de vidro iluminada e com Pokébola substituta (`P-017`) dentro do vão; em `z0015-mauville-patio` o monumento ocupa a mesma posição relativa; em `z0016-rustboro` a distância ao Centro Pokémon bate. | Cidades com luz/LUT quente-alaranjada ou dourada no original (`z0014`, `z0015`, `z0016`, `z0009`, `z0010`); port renderiza pedra cinza/azulada (`z0014`, `z0016`), monumento claro em `z0015`, e paleta trocada em `z0018-lilycove` (cercas e placa roxo/magenta e calçada azulada em vez de azul/laranja e pedra quente). |
| `z0445-mauville-hall` | Original emoldura o corredor inteiro com vazio preto limpo ao redor. | Divergência clara: no original o jogador fica visível sob o arco; no port uma parede marrom de primeiro plano bloqueia a câmera (com fundo borrado). | Corredor do original bem mais luminoso e com especular suave no piso. |
| `z0082-petalburg-woods`, `z0075-rusturf-tunnel`, `z0071-meteor-falls`, `z0385-chimney-chegada`, `z0083-mt-chimney`, `z0084-jagged-pass`, `z0037-route111`, `z0039-route112`, `z0047-route119` | Enquadramento próximo na maioria; em `z0385-chimney-chegada` o port corta a lateral direita por uma viga estrutural em primeiro plano. `z0075-rusturf-tunnel` exibe céu azul no topo e preto seco embaixo no port, em vez de vinheta escura nas bordas. | Original não exibe o retângulo vermelho de warp visível no chão do port em `z0082-petalburg-woods`. Em `z0083-mt-chimney`, portas de vidro da estação ocultam/entreveem o jogador nos dois casos. | Original traz raios volumétricos e sombra de copa em `z0082`, neblina quente/roxa nos penhascos (`z0037`, `z0039`, `z0084`, `z0010`), água mais profunda e partículas de cinzas em `z0083`; no port, `z0047-route119` tem estriamento vertical nos penhascos (UV/normal) e pedras em tom bege/neutro (`z0037`, `z0071`). |

## 6. Fora do escopo

- Comparação automática com capturas do emulador (P-021).
- Cenários com estado de história aplicado pela VM AMX.
