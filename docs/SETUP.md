# Setup em uma máquina nova

O Git traz código, dados estruturais (`src/data/`) e documentação. Tudo o que deriva da ROM fica fora dele e precisa ser levado ou regenerado. Siga na ordem; cada passo tem um comando que prova que funcionou.

## 1. Código e testes que não precisam da ROM

Requisitos: Node 22 ou mais novo (verificado com 26.12), Python 3.12, Git.

```bash
git clone git@github.com:waldirjunior/alpha-sapphire.git && cd alpha-sapphire
npm install
npm run verify        # 418+ testes Vitest com cobertura, build e 200+ testes Python
```

Esperado: tudo verde, com um skip nos testes Python enquanto `public/assets/maps` não existir. Isso já basta para trabalhar em `src/core/`, parsers e documentação.

## 2. Arquivos locais (fora do Git)

| Caminho | O que é | Tamanho | Como obter |
| --- | --- | --- | --- |
| `rom/cartridge/*.3ds` | Imagem do cartucho, sem criptografia | 2 GB | Copiar da máquina de origem |
| `public/assets/` | Mapas, personagens, Pokémon e áudio convertidos | 670 MB | Copiar da máquina de origem, ou regenerar pelo pipeline ([tcc/01-pipeline-rom.md](tcc/01-pipeline-rom.md)) |
| `rom/extracted/` | RomFS, ExeFS e GARCs extraídos | 4,4 GB | Só para rodar o pipeline; copiar ou reextrair |
| `../_tools/` | SPICA, SpicaExport, Blender, Azahar | — | Só para reconverter modelos e para o emulador; binários são por plataforma |

Cópia a partir da máquina de origem (ajuste host e caminho):

```bash
rsync -a --info=progress2 origem:~/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/public/assets/ public/assets/
rsync -a --info=progress2 origem:~/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire/rom/cartridge/ rom/cartridge/
git check-ignore -v public/assets/x rom/cartridge/x   # os dois precisam aparecer como ignorados
```

## 3. Jogo no browser e validação visual

```bash
npx playwright install chromium      # no Linux: npx playwright install --with-deps chromium
npm run dev                          # http://localhost:5173
npm run visual:approve               # cria as imagens de referência desta máquina (uma vez, na main)
npm run test:e2e                     # 5 fluxos de smoke + 25 cenários visuais
```

Esperado: `30 passed`. As imagens de referência são por plataforma e ficam em `rom/visual-baselines/`; as métricas versionadas em `e2e/visual-metrics/` valem em qualquer máquina. Se um cenário falhar só por métrica logo após o `visual:approve`, a GPU desta máquina difere além da tolerância: registre no PRD de [validacao-visual](features/validacao-visual/README.md) antes de mexer na tolerância.

Em worktree não é preciso copiar nada: o Playwright usa `public/` e os baselines do checkout principal. Para `npm run dev` em worktree: `ALPHA_PUBLIC_DIR=<checkout principal>/public npm run dev`.

## 4. Emulador (oráculo do jogo original)

Necessário para capturas de referência e teste diferencial. Tutorial próprio: [features/validacao-emulador/setup-emulador.md](features/validacao-emulador/setup-emulador.md).

```bash
python3 -m scripts.azahar_oracle init
python3 -m scripts.azahar_oracle check   # esperado: "Oráculo OK"
```

## 5. Reconversão de modelos (opcional)

Só para tarefas de pipeline, como a correção dos pés do jogador (P-019). Exige SPICA e SpicaExport compilados com .NET 8 e Blender 3.4; versões e caminhos usados estão na seção Ambiente de [STATUS.md](STATUS.md). Os scripts leem `SPICA_EXPORT` e `DOTNET_ROOT` do ambiente.

## Depois do setup

Atualize a seção Ambiente de [STATUS.md](STATUS.md) com o que foi instalado nesta máquina e siga a fila de [ROADMAP.md](ROADMAP.md).
