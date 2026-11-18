# PRD-012 — Mauville, Fallarbor e entrada de Meteor Falls

- **Data:** 2026-11-18.
- **Estado:** navegação validada na main e12419b até Meteor sob fixture derivada; loop e aceite visual pendentes.
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

O catálogo interno não deve ser aplainado:71/MM32 tem os dois portais externos
e três internos, um para72 e dois para73;72/MM33 retorna a71 e tem três
portais para73;73/MM34 tem dois para71, três para72 e um para74/MM35;
74 só retorna a73. Nenhuma dessas zonas tem borda MM contínua gerada.
O binding do trigger0/script1 de71 é ambíguo entre entities/função576,
map/função4372 e global0033/função128. Não foi executado ou identificado
como causa do bloqueio; cenas e seus pré-requisitos continuam por resolver.
O stage de um salto a partir de71 inclui72/73, não o74 de segundo salto;
não há promessa de passeio ou evento completo nesses andares.

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

## Aceite Playwright na main e12419b

Chromium visível,1280×900, em `http://127.0.0.1:5200`; main permaneceu limpa
em `e12419b` durante o cenário. Save isolado começa no checkpoint15(17,22),
não em uma campanha natural desde Littleroot. RNG controlado evita batalhas
na caminhada; encontros são comparados aos JSONs, não substituídos.

| Fase | Passos acumulados e evidência |
| --- | --- |
| Base15→445→37(31,66) | 115; dois ArrowUp realmente bloqueados; piso31,65 é0, quatro atores visíveis/flag0 na projeção,39 inalcançável |
| Fixture derivada | Somente tombstones37:2..5; posição/flags preservadas, reload confirma31,66 e somente os quatro atores ocultos |
| Pós-fixture39→85→38→36→40→10 | 656 até Fallarbor10(39,23);676 até o centro10(20,22) |
| Route114 e entrada de Meteor | 1014 até71(57,35); BGMs e portal nativos, sem salto de posição de conveniência |
| Componente de entrada71 | 1023 até51,32;42/72/73 continuam inalcançáveis,50,32 é bloqueado e dois ArrowLeft conservam51,32 |
| Reload final | Posição51,32 e quatro tombstones conservados; não afirma persistência de pedra na ROM |

**Zero consoleErrors/pageErrors/missing/requestFailures**; dez transições,
comparação de encontros das onze zonas percorridas e16 capturas inspecionadas.
Nenhum check do cenário foi pulado. Um aviso não-erro de apresentação
`BuildMdlEventAnimeSetEnd(6553770,0)` continua explícito em P-013; o script
permanece suspenso sem bloquear movimento, sem simular o efeito com Enter.
Requisições BGM observadas: c_02/r_c/d_01/r_e/t_05/d_05 no corredor e t_01
no bootstrap. r_b foi staged para o ramo de retorno, não foi validado como
reprodução na parte inacessível da caminhada.

### Limites visuais observados, não escondidos pelos checks verdes

O avatar não fica legível ou sofre oclusão severa em445(78,48),37(31,66),
39(79,65),10(39,23/20,22),41(79,22) e71(57,35/51,32); em36(0,57) há
oclusão parcial pela árvore. Os screenshots base/pós-fixture das pedras
mostram terreno, mas não permitem validar visualmente os quatro objetos:
visibilidade/remoção é comprovada na projeção e no bloqueio por teclado,
não por uma animação de quebra. Fiery85(50,76) mostra exterior preto/céu e
silhueta na chegada; bandas claras nas encostas, cartões de folhagem e
fallbacks persistem.15(17,22),38(7,17) e40(159,22) têm avatar legível.
Investigar câmera/altura/geometria/materiais em P-017/P-019 sem causa presumida
ou correção oportunista. Aceite de navegação não fecha o aceite visual.

Evidências locais: `/tmp/fallarbor-results.json`,
`/tmp/playwright-test-fallarbor.js` e as16 capturas
`/tmp/fallarbor-00-mauville-checkpoint-base.png` até
`/tmp/fallarbor-15-meteor-final-reload-DERIVED-state.png`.
Não declarar o loop71→42→16, RockSmash natural, campanha completa, física
vertical ou paridade visual concluídos.
