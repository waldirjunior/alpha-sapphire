# PRD-014 — Trechos leste de Mauville e acesso parcial a Lilycove

- **Data:** 2026-11-18.
- **Fase:** 2; P-013/P-017/P-019; A-078/A-079.
- **Base:** main `b358b5a`, worktree `eastern-lilycove`.
- **Estado:** aceite funcional parcial na main `665aca4`: quatro trechos
  independentes,375+139+85+175 passos;22 capturas inspecionadas, zero erros.
  **O corredor conectado até Lilycove e o aceite visual não estão concluídos.**

## Resultado e limites

Mapear a sequência nativa e validar somente os trechos alcançáveis pelo core,
sem alterar colisões, encontros, portais, alturas ou regras de movimento para
fabricar conexão. A investigação encontrou bloqueios físicos, mesmo sem NPCs.
O coordenador autorizou aceite parcial por checkpoints independentes após uma
passada adicional de inventário e geometria. Checkpoints **não são transportes
ROM, fixtures de história nem evidência de travessia entre os trechos**.

Não há mudança de runtime, parser ou JSON nativo nesta entrega. A única fixture
de progresso executa um recorte real de Route121 no mecanismo AMX existente.
Surf, variantes de ledge, bike, física multicamada, campanha e paridade visual
não são implementados nem declarados validados.

## IDs e conexões observadas

`src/data/zones.json`, `maps_v2/*.json` e `_neighbors.json` dão a sequência:

| Trecho | Zona e MM | Conexão preservada |
| --- | --- | --- |
| Mauville | 15/MM14, hall445/MM347 | ZO15→445→45 |
| Route118 | 45/MM9 | ZO oeste445 e norte47; contato leste52 |
| Route119 sul | 47/MM24 | ZO45; contato MM ao norte46 |
| Route119 norte | 46/MM24 | Contato47; ZO17 |
| Fortree | 17/MM15 | ZO46/48 |
| Route120 | 48/49, MM25 | Contatos internos48↔49; ZO48→50 |
| Route121 | 50/MM26 | ZO48,51,18 e Safari395 |
| Lilycove | 18/MM16 | Chegada real de50 em9,21 |
| Ramal Route123 | 52/MM9 | Contato45 e ZO51; não tem ZO50 |
| Route122 | 51/MM27 | ZO52/50/Mt.Pyre86 |

A sequência topológica prioritária é
`15→445→45→47→46→17→48→50→18`. O pedido inicial pelo ramal é
`45→52→51→50→18`, não `52→50` direto. Route119 tem duas zonas externas;
Route120 inclui a zona49, cujo recorte se encaixa na48. Mesmo catálogo de GRs
em `zones.json` não significa o mesmo recorte: o runtime usa ownership MM.
Não foi criada ponte inter-MM ou inferência `inferred=true` nesta tarefa.

## Bloqueios reproduzidos antes de definir o aceite

1. O core atual navega `15(17,22)→445→45→47(37,90)` com NPCs nativos.
   Isso **não prova passagem terrestre nativa por Route118**: permissões
   residuais continuam reduzidas a piso livre pelo parser.
2. `47→46` falha desde37,90: 2.443 células com atores e 2.459 sem atores;
   componente próprio `x9..66/z3..90`. A fronteira inclui `6e000021` em41,22,
   mas o topo continua bloqueado por `01000021`. Não se atribuiu a cutscene.
3. Checkpoint independente na chegada ZO real `46(75,19)` alcança
   `17(2,14)` e depois `48(11,20)` com todos os NPCs preservados. Isso não
   comprova a chegada de47 nem o percurso da metade sul de46.
4. `48→50` falha: 1.635 células com atores e 1.707 sem atores, componente
   `z<=55`. O diagnóstico inclui49 e permite visitar todos os mapas carregados.
   A fronteira alcançável não contém a família6x. `48(42,56)` é `01000021`.
5. `52→51` falha desde a chegada oeste0,20: 858 células com atores e 863 sem
   atores, `x<=77`. Em78,26..31 há `73020021`, classe lateral não suportada.
   `45/52` têm64/112 palavras `75020021`; nenhuma outra variante75 nesses GRs.
6. Checkpoint independente em `50(1,17)` continua bloqueado pelo grupo670.
   A fixture real descrita abaixo libera apenas essa etapa até Lilycove.

As primeiras regressões exigindo a ligação completa falharam. A suíte final
`src/data/maps_v2/lilycove.test.ts` mantém negativos explícitos, positivos dos
segmentos independentes, prioridade ZO e imutabilidade dos dados de mapa.
Não houve correção fictícia desses bloqueios nem promoção de uma hipótese a
regra de movimento para deixar o teste verde.

## Passada delimitada na família6x

Inventário sobre **315 GRs staged**, lendo u32 nativos com
`scripts.extract_gr_maps.read_gr_permissions` e contando por zona somente o
ownership de `scripts.map_matrix.owns_tile`:

| Palavra exata | Tiles únicos nos GRs | Zonas observadas |
| --- | --- | --- |
| `0x6d000021` | 14 | 46:14 |
| `0x6e000021` | 77 | 46:59,47:18 |
| `0x6f000021` | 30 | 18:6,84:24 |

O padrão pesquisado foi `(word & 0xf0ffffff) == 0x60000021`, apenas como filtro
numérico de inventário, **não como bitfield semântico comprovado**.6e tem norte
bloqueado em77/77 casos e apenas7 vizinhos oeste livres;6d tem leste/oeste
bloqueados em14/14 casos.6f tem norte livre27/sul25, mas isso não determina a
mecânica, a direção universal, a condição de bike ou a altura física.

Raycasts nos GLBs públicos preservaram nodes, escala1/18 e offset19,5; foram
registradas todas as superfícies relevantes, sem escolher a mais baixa como
altura universal do jogador. Exemplos estáticos:

- GR214/6e em1,22 (`47(41,22)`): oeste com superfícies0,5/1,348, centro2,282
  inclinado (`normalY=0,264`), leste2,5. Não é um ledge sul isolado.
- GR207/6d em6,23: centro com15/15,5/17,483, norte17,5 e várias superfícies
  sobrepostas. O enquadramento não prova qual superfície a lógica nativa usa.
- GR157/6f em34,13 tem norte5/sul4,5; GR292/6f em13,35 tem leste18/oeste19.
  A mesma palavra não sustenta uma regra universal de dois tiles ao sul.
- A fronteira superior de47 em GR214/7,2 tem base2,5 e geometria inclinada
  sobreposta; a fronteira48 em GR222/2,16 tem piso-3,5 e superfícies ao sul em
  -3/-2,135. Há pontos sem interseção em GR221/38..39,16. Esses dados não
  autorizam abrir a colisão `01000021` nem inventar uma rampa.

Um contrafactual local sem NPCs, abrindo **somente**6x no diagnóstico, não
conectou47→46 (2.459→2.631 células) nem48→50 (1.707→1.707). Não foi aplicado
ao runtime, aos JSONs ou ao aceite.6d/6e/6f permanecem desconhecidos em P-017;
sem expansão do ADR-008 ou de `75020021`.

Artefatos locais da passada: `/tmp/investigate-east-permissions.py`,
`/tmp/east-6x-inventory.json`, `/tmp/east-6x-ray-input.json`,
`/tmp/probe-east-heights.mjs`, `/tmp/east-6x-heights.json`. Reproduza o
inventário lendo os GRs presentes em `public/assets/maps/gr_*/*.glb`, aplicando
o filtro acima aos GRs correspondentes em `garc/a_0_3_9`, e contando ownership
com os chunks/matrizes de `maps_v2`. Geometria corrobora observações estáticas,
não execução da ROM, ABI, direção ou condição de movimento.

## Classe06 candidata, não água comprovada

`0x3d1a0006` ocorre817 vezes em45 e1.306 em51. O parser atual trata esses
pontos como `collision=0/terrain=0`. No checkpoint diagnóstico45(50,16),
Chromium visível permitiu o passo para51,16. Capturas38,16/50,16/70,16 mostram
superfícies rochosas/verdes, **não água inequívoca**. Não se determinou a causa
de material/camada/geometria. Portanto a palavra continua candidata não
provada; não há classificação de água, bloqueio novo ou Surf inventado.

Script/relatório: `/tmp/playwright-test-east-water.js`,
`/tmp/east-water-results.json`; imagens `/tmp/east-water-38-16.png`,
`/tmp/east-water-50-16.png`, `/tmp/east-water-70-16.png`. Zero erros/recursos
faltantes nessa investigação não fecha visual ou semântica de terreno.

## Fixture explícita de Route121, não evento completo

A própria `0050.json/programs.map` contém o recorte real:

- `5388/5392`: argumentos2 e16530; `WorkSet(16530,2)@5396`.
- `FlagSet(670)@5412`.
- `MdlDel(13/14/15/16/10/11)@5428/5444/5460/5476/5492/5508`.

A fixture executa `[5388,5520)` com halt **sintético rotulado** em5520, em vez
de executar câmera, diálogo, movimentos ou o evento inteiro. A VM usa dados
mínimos porque esse recorte só acessa argumentos imediatos. O resultado tem
work16530=2, flag670 e seis tombstones da zona50; `projectEventActors` usa o
mecanismo existente. Sem fixture, os seis atores670 continuam presentes.
Posição, colisões, terreno, warps e encontros não são alterados para liberar
passagem. A chegada real em Lilycove é9,21.

## Staging e verificações reproduzíveis

Execute no worktree; CHECKOUT é o checkout local com a extração ignorada:

```bash
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" \
  --public-dir "$CHECKOUT/public" \
  --audio-dir "$CHECKOUT/rom/extracted/audio/mp3" \
  --zones 15 445 45 47 46 17 48 50 18 51 52 --include-neighbors
GLB_MAPS_DIR="$CHECKOUT/public/assets/maps" \
  python3 -B -m unittest discover -s scripts -p 'test_*.py'
npm test && npm run build
```

Stage selecionou60 zonas,139 GRs e111 atores existentes;21 códigos especiais
ficam em fallback explícito, sem remapeamento de IDs. BGMs principais: `c_02`,
`c_04`, `c_05`, `r_f`, `r_g`, `starting2`, todas `bgm_sg_*.mp3`.
`--include-neighbors` seleciona modelos, mas `stage_audio` recebe as raízes do
CLI. O probe ampliado encontrou cinco MP3s declarados por vizinhos ausentes:
`ajito`, `art_gallery`, `contest_lobby`, `d_03`, `gym`. Foram copiados dos
originais locais, sem selecionar outros modelos. Para reproduzir essa parte:

```bash
python3 -B - "$CHECKOUT" <<'PY'
import json, sys
from pathlib import Path
from scripts.stage_zone_assets import select_slice, stage_audio
checkout = Path(sys.argv[1])
folder = Path('src/data/maps_v2')
maps = {int(p.stem): json.loads(p.read_text())
        for p in folder.glob('[0-9][0-9][0-9][0-9].json')}
neighbors = json.loads((folder / '_neighbors.json').read_text())['zones']
selected = select_slice(maps, (15,445,45,47,46,17,48,50,18,51,52), neighbors)
stage_audio(checkout / 'rom/extracted/audio/mp3', checkout / 'public',
            json.loads(Path('src/data/zone_audio.json').read_text()),
            tuple(selected))
PY
```

Probe final das60 zonas:15 BGMs declaradas presentes, zero mapas/MP3s ausentes
e zero remaps propostos em dry-run nos139 GRs/atores existentes.315 GLBs
públicos de mapa passaram no validador UV0/PICA. **356 Vitest/54 arquivos,
169 Python sem skips e build passaram.** Warning de chunks grandes e nove
vulnerabilidades do lock são herdados; dependências não foram alteradas.
Assets ignorados; nenhum dump, screenshot ou binário proprietário versionado.
Não houve promoção de imagem AMX ou mudança no manifesto local-memory.

## Aceite separado na main

**Main `665aca4`, Chromium visível, porta5200:** roteiro parcial autorizado
executado em quatro segmentos independentes rotulados.774 é apenas a soma de
375+139+85+175 inputs de movimento aceitos; **não é uma caminhada conectada**.
A preparação usa save isolado, RNG diagnóstico0,95 para não iniciar batalhas,
e só os quatro checkpoints de partida aprovados. Durante cada segmento,
a posição resulta exclusivamente de teclado/core/ZO, não de teleporte.

| Segmento independente | Passos aceitos | Resultado observado |
| --- | --- | --- |
| A:15(17,22)→445→45→47 | 375 | Chegada47 em262; bloqueios em42,22 (esquerda/6e) e47,3 (norte/parede) |
| B:checkpoint46(75,19)→17→48 | 139 | 73 até48; bloqueio sul em42,55; não comprova47→46 |
| C:checkpoint52(0,20) | 85 | Bloqueio lateral direito em77,28; não comprova chegada terrestre de45 |
| D:checkpoint50(1,17)→18 pós-fixture | 175 | Base bloqueada em48,17; fixture mantém posição;148 até18 e resto inclui interior/reload/reentrada |

Cada um dos cinco bloqueios recebeu duas tentativas por teclado. O planner
confirmou47→46,48→50 (incluindo49),52→51 e50→18 sem670 inalcançáveis. A passagem
de45 é somente navegação do parser atual, não prova de piso terrestre/Surf.
Checkpoint B não comprova chegada de47; D não comprova chegada de120/122.

A fixture5388..5519 manteve50(48,17), gravou work16530=2,flag670 e os seis
tombstones de50. O save foi recarregado em18(20,21); retorno real a50(130,13)
e reentrada em18(9,21) preservaram flag/work/remoções. Sem Enter de completion,
sem efeito nativo de campanha ou classificação de terreno inventados.

Encontros de **dez zonas** (`15,445,45,47,46,17,48,52,50,18`) iguais aos JSONs
nativos em todas as capturas.51/49 não foram percorridas no browser nem
incluídas nesse aceite de encontros. `consoleErrors`, `pageErrors`, `missing`
e `requestFailures` vazios; dois avisos `BuildMdlEventAnimeSetEnd(6553770,0)`
permaneceram suspensos sem bloquear movimento. Zero erros não é zero avisos.

**22 capturas00–21 inspecionadas manualmente; aceite visual permanece aberto:**

- 00: pátio15 e avatar legíveis;01/02: fachadas/geometria em close cobrem avatar
  nas chegadas445/45. A ausência não foi confundida com recursos faltantes.
- 03: chegada47 com avatar/terreno;04/05: terreno visível, avatar oculto nos
  bloqueios42,22 e47,3.06:46(75,19) mostra céu/avatar/marcador, sem terreno.
- 07: Fortree apresenta superfícies claras/azuis repetidas.08/09:48 e seu
  bloqueio sul mostram avatar/terreno.10/11:52 também é mais legível, mas
  apresenta recortes/triângulos escuros; isso não valida paridade gráfica.
- 12/13/14:50 e grupo670 antes/depois. Em48,17 a cena aparece cinza/rochosa na
  base e verde após reload pós-fixture. **Causa não atribuída:** não é evidência
  de que o recorte AMX altere geometria, materiais ou colisões.
- 15/16/17 e20/21: Lilycove9,21/20,21 mostra superfícies repetidas cobrindo o
  avatar, inclusive após reload.18/19: reentrada50(130,13) legível, progresso
  preservado. Nem essa legibilidade nem zero missing fecham o aceite visual.

Artefatos locais: `/tmp/playwright-test-east-partial.js`,
`/tmp/east-partial-results.json`, `/tmp/east-partial-00-*` até `21-*`.
O relatório separa fases, checkpoints, inputs aceitos, encontros, avisos,
atores/progresso e inspeção visual; imagens/scripts não foram versionados.
Pós-integração: **356 Vitest/54 arquivos,176 Python sem skips e build passam**.
Não há script `npm run format` no projeto; nenhum formatter foi executado.

O percurso conectado Mauville–Lilycove, Surf, mecânicas6x/73, alturas,
multicamada, campanha completa e aceite visual continuam abertos em
P-013/P-017/P-019. Não foi feita correção especulativa de câmera/altura/material.
