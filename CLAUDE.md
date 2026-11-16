# CLAUDE.md — alpha-sapphire

@AGENTS.md

## Regras operacionais do agente

Trate `AGENTS.md` como o contrato completo do repositório. Este arquivo acrescenta apenas orientação de execução.

## Início de toda tarefa

1. Leia os arquivos de leitura obrigatória listados em `AGENTS.md`.
2. Rode `git status` e preserve mudanças alheias.
3. Mapeie o pedido para uma fase de [docs/ROADMAP.md](docs/ROADMAP.md), um `PRD-NNN` ou uma pendência `P-NNN`.
4. Defina o resultado verificável antes de editar qualquer arquivo.
5. Identifique se a tarefa altera código (`src/`), pipeline/scripts, documentação (`docs/`) ou ambiente da VPS.

Para trabalho de implementação, declare:

```text
Resultado:
Verificação:
Evidência:
```

## Mudanças focadas

- Use o menor conjunto de arquivos que completa o resultado pedido.
- Sem refatoração oportunista em arquivos fora do escopo da tarefa atual.
- Use os scripts de [package.json](package.json) (`npm test`, `npm run build`, `npm run dev`) em vez de comandos improvisados.
- Nunca importe `three` ou `document`/`window` dentro de `src/core/`.

## Pipeline da ROM e Ambiente VPS

- Confirme sempre via `git check-ignore -v` que novos diretórios de saída de extração/dump estão ignorados pelo `.gitignore` antes de gravar binários ou assets extraídos da ROM.
- Ferramentas de extração externas (`ctrtool`, `SPICA`, `Blender`, `pk3DS`, `gltf-transform`) devem ter versão e caminho verificados na VPS e registrados em `docs/STATUS.md` / `docs/APRENDIZADOS.md` quando instaladas.

## Verificação

Antes de concluir ou commitar:

```bash
npm test && npm run build
```

Reporte checks pulados e o motivo.

## Comunicação

- Abra com o resultado e a evidência atual observada.
- Apresente premissas arriscadas antes de agir.
- Distinga claramente trabalho concluído de trabalho planejado.
- Cite caminhos exatos de arquivos, símbolos e saídas de comando observadas.
