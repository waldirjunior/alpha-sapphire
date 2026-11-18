# AGENTS.md — alpha-sapphire

## Propósito

Portar **Pokémon Alpha Sapphire** para o navegador em **Three.js** e **TypeScript**: mesma história, mesmo mapa, mesma dinâmica e mesmo visual do original, com a ROM (`.3ds`) como fonte de tudo. O objetivo completo, a definição de pronto, a escada de evidência e a regra de continuidade estão em [docs/VISAO.md](docs/VISAO.md) — é o contrato do projeto.

## Arquitetura atual

Detalhada em [docs/tcc/00-arquitetura.md](docs/tcc/00-arquitetura.md) e em [docs/features/](docs/features/README.md).

- **`scripts/`**: pipeline offline em Python (extração da ROM, conversão para JSON/GLB/áudio, disassembly AMX) e automação do emulador (`azahar_*.py`), com testes `scripts/test_*.py`.
- **`src/core/`**: lógica pura do jogo — grade, colisão, warps, batalha, save e a VM Pawn/AMX dos scripts de evento. Proibido importar `three`, `src/engine/` ou APIs de browser (`window`, `document`). Roda em Node.
- **`src/engine/`**: apresentação Three.js — `SceneManager.ts`, terreno e atores por zona, animações nativas, host de eventos AMX, áudio. Consome o estado do core sem mutá-lo.
- **`src/data/`**: dados gerados pelo pipeline — `maps_v2/` (536 zonas), `zone_scripts/`, `texts/`, `zones/` (encontros), `battle/`. Não editar à mão: regenerar pelo script correspondente.
- **`src/game.ts`** e **`src/main.ts`**: bootstrap e host — teclado, HUD, menus, batalha e save ligados ao core e ao engine.
- **`src/visual/`** e **`e2e/`**: validação visual e de jogo real (ver Testes).
- **`src/ai/`**: paridade contra valores observados no original.
- **`rom/`** e **`public/assets/`** *(fora do Git)*: ROM, dumps, assets convertidos, baselines de imagem e relatórios locais.

## Leitura obrigatória

Curta de propósito. Nesta ordem, antes de planejar:

1. [docs/VISAO.md](docs/VISAO.md) — objetivo, definição de pronto, evidência, continuidade.
2. [docs/STATUS.md](docs/STATUS.md) — placar e limites atuais.
3. [docs/ROADMAP.md](docs/ROADMAP.md) — a fila de execução; sua tarefa é um item dela ou entra nela.

Sob demanda, só o que a tarefa toca:

- **Pendências**: `grep -n '^## P-' docs/PENDENCIAS.md` lista os títulos; leia os itens citados pela tarefa.
- **Aprendizados**: `grep -n '^## A-' docs/APRENDIZADOS.md` lista as 90+ regras já descobertas pelo título; leia as da área em que vai mexer antes de editar.
- **PRD e ADR** do módulo em [docs/features/](docs/features/README.md).
- **Máquina nova ou ferramenta faltando**: [docs/SETUP.md](docs/SETUP.md).
- [docs/historico/](docs/historico/) guarda relatos antigos de entrega; não é leitura obrigatória.

## Método de trabalho

1. Mapeie a tarefa para um item da fila do [ROADMAP](docs/ROADMAP.md), um `PRD-NNN` ou uma pendência `P-NNN`.
2. Declare resultado, verificação e evidência antes de editar.
3. Inspecione código, testes e `git status`.
4. Para mudança de código, escreva primeiro o teste que falha; depois o código que o faz passar. Para defeito visual, o teste é um cenário em `src/visual/scenarios.ts`.
5. Rode a verificação (seção Testes).
6. Atualize a documentação impactada no mesmo trabalho.
7. Reporte desvios, riscos e evidências observadas.

Prefira a menor mudança que completa o item. Não implemente itens futuros por especulação.

### Continuidade

Vale a regra de continuidade de [docs/VISAO.md](docs/VISAO.md#regra-de-continuidade). Em resumo:

- Entrega é executável: teste passando, cenário aceito, pendência fechada ou defeito novo com reprodução. "Inconclusivo" não é entrega.
- Pergunta de engenharia reversa que não fechou em uma sessão muda de degrau na escada de evidência (emulador) ou cede a vez ao próximo item da fila.
- Regra de jogo sem evidência não é implementada; mas falta de prova por disassembly não impede usar o que o emulador mostra.
- Pare para perguntar apenas por escopo, ferramenta ausente ou ação irreversível.

## Durante a sessão

- **Estado verificado mudou** → edite as linhas de [docs/STATUS.md](docs/STATUS.md). É um retrato com tamanho limitado por teste: não acrescente seções nem relatos.
- **Relato de entrega** (o que foi feito, números, evidências) → seção no PRD da frente, não em STATUS nem em ROADMAP.
- **Fato que faria outra sessão repetir um erro** → novo `A-NNN` em [docs/APRENDIZADOS.md](docs/APRENDIZADOS.md) com data, contexto, erro e regra. Nunca apague nem reescreva itens antigos; se a regra mudar, crie novo item apontando para o anterior.
- **Lacuna sem dono ou sem correção** → novo `P-NNN` em [docs/PENDENCIAS.md](docs/PENDENCIAS.md) com estado, evidência e próximo passo. Fechar exige evidência no próprio item.
- **Mudança estrutural ou de stack** → `ADR-NNN` em `docs/features/<modulo>/adrs/`.
- **Novo escopo funcional ou de pipeline** → `PRD-NNN` em `docs/features/<modulo>/prds/`.
- **Item da fila concluído** → remova da fila do ROADMAP.

## Estilo de código

- **TypeScript estrito**: `strict`, `noUnusedLocals`, `noUnusedParameters`. Proibido `any` e type assertions inseguras sem guarda.
- **Separação Core vs Engine**: `src/core/` nunca importa `three` nem acessa `window`/`document`.
- **Funções pequenas e coesas**: idealmente entre 4 e 20 linhas; divida por intenção.
- **Arquivos enxutos**: até 500 linhas; separe responsabilidades antes de crescer.
- **Nomes específicos de domínio**: evite `data`, `handler`, `manager`, `utils` genéricos.
- **Early return**: no máximo dois níveis de indentação de fluxo.
- **Imutabilidade no `core/`**: transições de estado retornam novo estado sem mutar argumentos.
- **Mensagens de erro claras**: incluam o identificador ou valor ofensor e o formato ou estado esperado.
- **Comentários**: expliquem o *porquê* da restrição (citando `A-NNN`, `P-NNN` ou `ADR-NNN` quando aplicável), nunca o que a linha faz. Preserve comentários existentes.

`src/architecture.test.ts` verifica pureza do core, ausência de `any`, limite de linhas e ausência de binários da ROM no Git. Violações herdadas viram pendência e entrada na catraca do teste, não refatoração oportunista.

## Testes

| Comando | O que garante | Precisa de assets da ROM |
| --- | --- | --- |
| `npm test` | Unitários Vitest: core, engine, dados, regras de arquitetura e de documentação. | Não |
| `npm run verify` | `npm test` com cobertura (catraca em `src/core`), build e testes Python do pipeline. **Verificação canônica antes de concluir ou commitar.** | Não |
| `npm run test:e2e` | Playwright: smoke do jogo real (intro, movimento, diálogo, warp, save, batalha) e 25 cenários visuais. **Obrigatório quando a mudança toca `src/engine/`, `src/game.ts`, assets ou dados de mapa.** | Sim |
| `npm run visual:approve` | Regrava baselines de imagem e métricas depois de uma mudança visual intencional e revisada. | Sim |

- Comportamento novo em `src/core/` ou em parser de `src/data/` exige teste unitário.
- Correção de bug exige teste de regressão que reproduza o defeito antes do fix.
- Testes unitários não dependem de `rom/`, `public/assets/` nem de WebGL real: use fixtures sintéticas pequenas e determinísticas.
- Mudança visual: rode `npm run test:e2e`, abra `rom/visual-report/index.html`, **olhe as capturas** e só então aprove. Aprovar baseline sem olhar a imagem invalida a rede de proteção. Fluxo completo em [validacao-visual](docs/features/validacao-visual/README.md).
- Reporte checks pulados e o motivo. Nunca descreva validação não executada como passando.

## Dependências e worktrees

- Dependência nova só quando a tarefa exigir, registrada em ADR se estrutural.
- Todo desenvolvimento ocorre em worktree dedicado (`orca worktree create`), nunca direto na `main`.
- Worktrees não têm `public/assets/`: o Playwright resolve os assets e baselines do checkout principal sozinho; para `npm run dev`, use `ALPHA_PUBLIC_DIR=<checkout principal>/public`.

## Segurança e propriedade intelectual (ROM)

- `rom/`, `public/assets/`, `RomFS/`, `ExeFS/`, `*.3ds`, `*.cci`, `*.cia`, `*.cxi`, `*.7z` são **estritamente locais** e protegidos pelo [.gitignore](.gitignore).
- Nunca commite dumps, modelos, texturas, áudio ou **capturas de tela** derivados da ROM. Baselines de imagem ficam em `rom/visual-baselines/`; só as métricas numéricas (`e2e/visual-metrics/`) são versionadas.
- Versionam-se apenas código, scripts de extração e conversão, dados estruturais derivados já presentes em `src/data/`, fixtures sintéticas e documentação.
