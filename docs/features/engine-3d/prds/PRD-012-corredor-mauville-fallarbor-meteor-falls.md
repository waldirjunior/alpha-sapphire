# PRD-012 — Mauville, Fallarbor e entrada de Meteor Falls

- **Data:** 2026-11-18.
- **Estado:** topologia, regressões e stage concluídos; Playwright main pendente.
- **Fase:** 2; P-013/P-017; A-066–A-068.

## Resultado e limites do corredor

Caminhar de15(17,22), pátio de Mauville, por445 e37 até as pedras que
bloqueiam Route111. Separadamente, uma fixture derivada pós-RockSmash permite
validar o caminho por Fiery Path até Fallarbor e a entrada de Meteor Falls.
O loop por Route115 até Rustboro fica bloqueado e não é prometido como pronto.

A sequência física é **15→445→37→39→85→38→36→40→10→41→71**.
Route113 precede Fallarbor; Route114 é indispensável depois da cidade. O
menor caminho apenas topológico445→37→35→36 não é prova da rota da história.

| Trecho | Evidência e mecanismo |
| --- | --- |
| 15↔445 | Portais ZO entre pátio e hall de Mauville |
| 445→37 | ZO norte78,12→27,117; Route111 sul/MM7 |
| 37↔39 | Contato de zoneIds MM7; Route112 sul |
| 39→85 | ZO33,38→50,76; Fiery Path/MM46 |
| 85→38 | ZO50,25→7,17; Route112 norte/MM8 |
| 38↔36 | Contato MM8; Route111 norte |
| 36↔40 | Contato MM8; Route113 |
| 40↔10 | Contato MM8; Fallarbor Town |
| 10↔41 | Contato MM8; Route114 |
| 41→71 | ZO16,130→57,35; Meteor Falls/MM32 |
| 71→42→16 | ZO25,64→66,83 e contato MM4 existem, mas71→42 não é alcançável |

O contato MM8 entre38 e40 também existe, mas seu trecho não é passável desde
7,17 no core atual; a caminhada passa por36. Nenhuma ponte inferida, offset,
colisão, encontro, portal ou JSON nativo foi alterado. ADRs004/006 existentes
cobrem o runtime reutilizado; não houve mudança estrutural ou novo ADR.

## RockSmash: ramo real e fixture derivada são coisas distintas

O teste inicial chegou a37(27,117), mas não alcançou39. Quatro objetos model
8204, IDs2/3/4/5, script10050, ocupam31,65 /32,64 /30,64 /29,65.
Todos têm spawnFlag0: não são um grupo ocultável por hide-flag. O componente
base tem874 células e não alcança o contato oeste; retirar só esses quatro
em diagnóstico libera a rota. Piso31,65 é0, mas o ator impede subir de31,66.

O binding de0037.json resolve10050 para global:0046/target3120/função5324.
O programa versionado global_0046.json tem SHA
`c63af4251dc7406fd89126af85cbef598c889312f303d117b51ba7547c50a362`.

- 5324 chama3984@5340; a análise de calls estáticas alcança29 funções.
- 3984 consulta TalkMdlIsExist@3996, PokePartyHaveWaza(-1,249)@4048 e
  CheckFieldSkillUse(249)@4084, apresenta confirmação e grava PokeMemorySet
  com demo37 antes de CallHidenDemo@4248 e CallIwakudakiEffect@4276.
- 10050 pode consultar GetRockCrashItemTableNo@5364 e seguir a recompensa ou
  CallWildBattleRockCrash@5724. Nada disso foi implementado ou simulado como
  execução natural neste trabalho.
- CallIwakudakiEffect@5576 está na função5480 do caso10051, não no grafo de
  calls de10050. Nenhum MdlDel aparece no programa AMX global0046 inteiro.
- Seus únicos FlagSet,6792/7208, recebem2724 nas funções6400/6984, casos
  10054/10055, fora das29 funções alcançáveis por10050. Não são prova de flag
  por pedra. As consequências internas do efeito nativo e a persistência da
  pedra na ROM continuam desconhecidas; a busca acima cobre o AMX, não o CRO.

Conforme escopo autorizado, o aceite é dividido. O estado base conserva as
quatro pedras e comprova o bloqueio por teclado; a fixture **derivada
pós-RockSmash, não-natural** popula somente tombstones37:2..5 e usa
persistAmxProgress, restoreAmxProgress e projectEventActors existentes.
Ela não muda posição, colisões, flags ou os dados de origem; não executa
10050, CallIwakudakiEffect, checks de habilidade, demo, batalha ou recompensa.
Sua persistência demonstra apenas o mecanismo do web, não a semântica da ROM.

## Meteor Falls não é um portal plano entre duas rotas

Zona71/MM32 compõe GRs260–263. Entrando em57,35, o core não alcança as
saídas para42/72/73, mesmo com todos os NPCs retirados em um teste diagnóstico.
Portanto, limpar hide-flags637/638/639 não é uma solução comprovada.
O ZO preserva rom.z=54 na saída para41 e-126 na saída para42; os outros
portais também têm alturas próprias. Não foi inferido que uma cutscene seja
a causa: investigar permissões/altura/geometria e os eventos reais em P-017.
Não abrir tiles nem criar warp ou ponte de conveniência para fechar o loop.

## Staging e regressões

```bash
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" \
  --public-dir "$CHECKOUT/public" \
  --audio-dir "$CHECKOUT/rom/extracted/audio/mp3" \
  --zones 15 445 37 39 85 38 36 40 10 41 71 42 16 --include-neighbors
```

Selecionadas59 zonas/151 GRs/104 atores existentes, com20 códigos sem modelo
físico em fallback. Um salto MM e destinos ZO diretos, sem recursão global.
Sete BGMs nativas: c_02/d_01/d_05/r_b/r_c/r_e/t_05. Probe de presença dos
mapas/MP3s selecionados passou com zero ausentes;223 GLBs públicos de mapa
válidos, zero violações. Dry-run UV dos GRs/atores públicos não propôs remaps,
inclusive diffuse UV0 para extras.pica. Saídas locais confirmadas ignoradas;
nenhum asset ou dump binário versionado.

Red inicial reproduziu37→39 bloqueado; diagnóstico condicional reproduziu
71→42 bloqueado. Cinco regressões finais separam base, fixture derivada,
limites de Meteor Falls, alcance estático de10050 e contatos/encontros nativos.
**328 Vitest/49 arquivos,159 Python sem skips e build passaram sobrec9be392**;
Python usa GLB_MAPS_DIR do public principal. Aviso de chunk >500kB herdado.

## Aceite Playwright pendente

Após integração na main: caminhar de15 até37(31,66), tentar subir contra a
pedra e capturar o estado base. Aplicar a fixture derivada explicitamente
rotulada, recarregar sem deslocar o player e caminhar por39/85/38/36/40 até10,
depois41 e71. Conferir encontros com os JSONs, BGMs e screenshots; registrar
consoleErrors/pageErrors/missing/requestFailures. Não declarar o loop71→42,
RockSmash natural, campanha completa, física vertical ou paridade visual.
