# AGENTS.md — alpha-sapphire

## Propósito

Este repositório hospeda a reconstrução web em **Three.js** e **TypeScript** de **Pokémon Alpha Sapphire**, alimentada por um pipeline de extração de assets, mapas, textos e tabelas a partir da ROM original (`.3ds`), com documentação contínua para TCC.

## Arquitetura atual

Detalhada em [docs/tcc/00-arquitetura.md](docs/tcc/00-arquitetura.md) e nos módulos em [docs/features/](docs/features/README.md). Resumo operacional:

- **`src/core/`**: Lógica pura de jogo (`gameState.ts`, `types.ts`, testes em `gameState.test.ts`). Proibido importar `three`, DOM (`window`, `document`) ou APIs exclusivas de browser. Deve poder rodar em Node/servidor para multiplayer futuro.
- **`src/engine/`**: Renderização Three.js (`SceneManager.ts`), carregamento sob demanda de `.glb`, câmera e iluminação. Consome estado do `core/` sem mutá-lo.
- **`src/main.ts`**: Bootstrap Vite: carrega as tabelas de batalha (`loadBattleTables`, ADR-004 de `pipeline-rom`) e importa `src/game.ts`, que conecta input de teclado, `core/` e `engine/`.
- **`src/data/`** *(planejado)*: Mapas, diálogos, encontros e tabelas convertidas da ROM para JSON.
- **`src/ai/`** *(planejado)*: Scripts/agentes de verificação e automação.
- **`rom/`** *(ignorado no Git)*: Contém a ROM local (`*.3ds`, `*.7z`) e futuros dumps (`RomFS/`, `ExeFS/`). Nunca versionar arquivos proprietários.

## Leitura obrigatória

Antes de planejar ou mudar código, pipeline ou documentação:

1. [docs/STATUS.md](docs/STATUS.md) — estado atual verificado do repositório e ambiente.
2. [docs/ROADMAP.md](docs/ROADMAP.md) — fases macro e ordem de execução.
3. [docs/PENDENCIAS.md](docs/PENDENCIAS.md) — lacunas abertas (`P-NNN`).
4. [docs/APRENDIZADOS.md](docs/APRENDIZADOS.md) — erros e regras já descobertos (`A-NNN`).
5. [docs/features/](docs/features/README.md) — módulos/features do projeto, cada um com seu `README.md`, `prds/` (`PRD-NNN`) e `adrs/` (`ADR-NNN`).
6. [docs/tcc/00-arquitetura.md](docs/tcc/00-arquitetura.md) e [docs/tcc/01-pipeline-rom.md](docs/tcc/01-pipeline-rom.md) — base técnica para o TCC.

## Método de trabalho

Para cada mudança:

1. Mapeie a tarefa para um passo do [docs/ROADMAP.md](docs/ROADMAP.md), um `PRD-NNN` ou uma pendência `P-NNN`.
2. Diga o resultado pretendido e como ele será verificado antes de editar.
3. Inspecione código, testes, documentação e `git status` atuais.
4. Para mudanças de código, escreva o teste que falha (ou ajuste a suíte), depois implemente o código que o faz passar.
5. Rode a verificação canônica (seção Testes).
6. Atualize a documentação impactada (`STATUS.md`, `PENDENCIAS.md`, `APRENDIZADOS.md`, `ADR`/`PRD`).
7. Reporte desvios, riscos e evidências observadas.

Prefira a menor mudança que completa a tarefa da fase atual. Não implemente passos futuros por especulação.

## Durante a sessão

- **Fato que faria outra sessão repetir um erro** → novo item em [docs/APRENDIZADOS.md](docs/APRENDIZADOS.md) com `A-NNN`, data, contexto, erro e regra. Nunca apague nem reescreva itens antigos; se a regra mudar, crie novo item apontando para o anterior.
- **Lacuna sem dono ou sem correção** → novo item em [docs/PENDENCIAS.md](docs/PENDENCIAS.md) com `P-NNN`, estado (`aberta`, `em andamento`, `bloqueada`, `fechada`), evidência e próximo passo. Fechar exige evidência no próprio item.
- **Mudança estrutural ou de stack** → novo registro em `docs/features/<modulo>/adrs/` (`ADR-NNN-*.md`) e atualização do `README.md` correspondente antes ou junto da implementação.
- **Novo escopo funcional ou de pipeline** → novo documento em `docs/features/<modulo>/prds/` (`PRD-NNN-*.md`) e atualização do `README.md` correspondente.
- **Mudança no estado verificado** → atualize [docs/STATUS.md](docs/STATUS.md) no mesmo trabalho.

## Estilo de código

- **TypeScript estrito**: `strict: true`, `noUnusedLocals`, `noUnusedParameters` (já configurados em [tsconfig.json](tsconfig.json)). Proibido `any` e type assertions inseguras sem guarda.
- **Separação Core vs Engine**: `src/core/` nunca importa `three` nem acessa `window`/`document`.
- **Funções pequenas e coesas**: idealmente entre 4 e 20 linhas; divida por intenção.
- **Arquivos enxutos**: mantenha módulos abaixo de 300–500 linhas; separe responsabilidades antes de crescer.
- **Nomes específicos de domínio**: evite `data`, `handler`, `manager`, `utils` genéricos.
- **Early return**: no máximo dois níveis de indentação de fluxo.
- **Imutabilidade no `core/`**: funções de transição de estado retornam novo estado sem mutar argumentos.
- **Mensagens de erro claras**: incluam o identificador/valor ofensor e o formato ou estado esperado.
- **Comentários**: expliquem o *porquê* da restrição (referenciando `A-NNN`, `P-NNN` ou `ADR-NNN` quando aplicável), nunca o que a linha faz. Preserve comentários existentes.

Essas regras valem para código novo e modificado. Violações herdadas viram pendência registrada em `PENDENCIAS.md`, não refatoração oportunista em mudança alheia.

## Testes

Verificação canônica na raiz do projeto:

```bash
npm test && npm run build
```

- Todo comportamento novo em `src/core/` ou parsers de `src/data/` exige teste unitário em Vitest.
- Correção de bug exige teste de regressão que reproduza o defeito antes do fix.
- Testes unitários não podem depender de arquivos binários da ROM em `rom/` nem de WebGL real; use fixtures sintéticas pequenas e determinísticas.
- Reporte checks pulados e o motivo. Nunca descreva validação não executada como passando.

## Dependências e Worktrees

- Dependência nova no `package.json` só quando a tarefa atual exigir justificadamente (registrada em ADR se estrutural).
- Desenvolvimento de features e scripts de pipeline deve ocorrer em worktree dedicado (via `orca worktree`) em vez de trabalhar direto sobre a branch `main` quando houver múltiplas frentes.

## Segurança e Propriedade Intelectual (ROM)

- Arquivos em `rom/`, `RomFS/`, `ExeFS/`, `*.3ds`, `*.cci`, `*.cia`, `*.cxi`, `*.7z` são **estritamente locais** e protegidos pelo [.gitignore](.gitignore).
- Nunca copie, commite ou exponha dumps binários proprietários da ROM no repositório Git.
- Apenas código do motor, scripts de extração/conversão, schemas, fixtures sintéticas de teste e documentação são versionados.
