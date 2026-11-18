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

## 6. Fora do escopo

- Comparação automática com capturas do emulador (P-021).
- Cenários com estado de história aplicado pela VM AMX.
