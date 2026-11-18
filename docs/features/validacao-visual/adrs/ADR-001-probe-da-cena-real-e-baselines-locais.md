# ADR-001 — Probe da cena real, métricas versionadas e baselines de imagem locais

- **Módulo:** [validacao-visual](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-18
- **Contexto:** [PRD-001](../prds/PRD-001-regressao-visual-e-smoke.md)

## Contexto

A regressão visual clássica guarda imagens de referência no repositório. Aqui toda imagem do jogo deriva de assets da ROM e não pode ser versionada ([pipeline-rom/ADR-002](../../pipeline-rom/adrs/ADR-002-isolamento-proprietario-e-worktrees.md)). Sem referência versionada, um clone novo ou outra máquina não teria contra o que comparar. Além disso, "a imagem mudou" não diz se a mudança é defeito: é preciso um critério que reconheça avatar encoberto, chão ausente ou modelo incompleto.

## Decisão

1. **Medir a cena de produção.** Uma página de probe (`visual.html`) instancia o `SceneManager` real e aplica um estado fixo. O `SceneManager` expõe `inspect()`, somente leitura, para o probe renderizar passadas de medição com os materiais reais. Nenhum renderer paralelo.
2. **Métricas numéricas versionadas.** Oclusão do avatar, fração de vazio, distância sola–chão e contagem de assets com falha são números derivados, não assets: ficam em `e2e/visual-metrics/` e valem em qualquer máquina, com tolerância por métrica.
3. **Imagens de referência locais.** Os PNGs ficam em `rom/visual-baselines/<plataforma>/` do checkout principal, compartilhados por todos os worktrees e fora do Git.
4. **Portões absolutos com defeito conhecido estrito.** Cada portão tem limite fixo; a exceção por cenário cita a pendência e falha quando o defeito some sem atualização do registro.
5. **Playwright como executor**, com Chromium fixado pela versão do pacote, viewport 800×480 e `deviceScaleFactor` 1.

## Dependências adicionadas

- `@playwright/test` 1.64.1 — executor e comparação de imagem.
- `@vitest/coverage-v8` 2.1.9 — catraca de cobertura do core.
- `@types/node` 22.10.2 — tipos para os testes que leem arquivos e o Git.

Todas de desenvolvimento, com versão exata.

## Alternativas descartadas

- **Material de ID por objeto para medir oclusão:** exigiria shader próprio para respeitar alpha test e skinning. Renderizar com os materiais reais, com e sem o avatar, mede o que o jogador vê.
- **Imagens versionadas em repositório privado ou LFS:** continua distribuindo conteúdo derivado da ROM.
- **Somente comparação de pixels:** acusa mudança, não defeito, e não funciona em máquina sem baseline.

## Consequências

- **Positivas:** mudança visual não passa despercebida; defeito conhecido vira teste; worktree funciona sem copiar 670 MB; o placar de cenários aceitos mede fidelidade de forma reexecutável.
- **Custos:** a suíte precisa dos assets locais e de cerca de um minuto; baselines de imagem precisam ser recriados por máquina; aprovar baseline exige revisão humana ou de agente das capturas.
- **Limite:** legibilidade não é paridade. A comparação com o original depende da referência do emulador (P-021).
