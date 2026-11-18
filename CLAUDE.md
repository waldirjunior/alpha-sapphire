# CLAUDE.md — alpha-sapphire

@AGENTS.md

## Regras operacionais do agente

Trate `AGENTS.md` como o contrato completo do repositório e [docs/VISAO.md](docs/VISAO.md) como o objetivo. Este arquivo acrescenta apenas orientação de execução.

## Início de toda tarefa

1. Leia os três arquivos de leitura obrigatória listados em `AGENTS.md` (VISAO, STATUS, ROADMAP).
2. Rode `git status` e preserve mudanças alheias.
3. Mapeie o pedido para um item da fila de [docs/ROADMAP.md](docs/ROADMAP.md), um `PRD-NNN` ou uma pendência `P-NNN`. Sem pedido específico, pegue o primeiro item não bloqueado da fila.
4. Defina o resultado verificável antes de editar qualquer arquivo.
5. Identifique se a tarefa altera código (`src/`), pipeline (`scripts/`), documentação (`docs/`) ou assets locais.

Para trabalho de implementação, declare:

```text
Resultado:
Verificação:
Evidência:
```

## Mudanças focadas

- Use o menor conjunto de arquivos que completa o resultado pedido.
- Sem refatoração oportunista em arquivos fora do escopo da tarefa atual.
- Use os scripts de [package.json](package.json) em vez de comandos improvisados.
- Nunca importe `three` ou `document`/`window` dentro de `src/core/`.

## Pipeline da ROM

- Confirme via `git check-ignore -v` que novos diretórios de saída de extração, dump ou captura estão ignorados antes de gravar neles.
- Ferramentas externas (`ctrtool`, `SPICA`, `Blender`, `pk3DS`, `gltf-transform`, emulador) devem ter versão e caminho registrados na seção Ambiente de `docs/STATUS.md` quando instaladas.

## Verificação

Antes de concluir ou commitar:

```bash
npm run verify
```

Quando a mudança toca `src/engine/`, `src/game.ts`, assets ou dados de mapa, também:

```bash
npm run test:e2e
```

Scripts de validação nunca ficam em `/tmp`: cenário novo entra em `src/visual/scenarios.ts` ou em `e2e/`. Reporte checks pulados e o motivo.

## Comunicação

- Abra com o resultado e a evidência atual observada.
- Apresente premissas arriscadas antes de agir.
- Distinga claramente trabalho concluído de trabalho planejado.
- Cite caminhos exatos de arquivos, símbolos e saídas de comando observadas.
