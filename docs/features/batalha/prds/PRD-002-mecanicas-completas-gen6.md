# PRD-002 — Mecânicas Completas de Batalha Gen VI

- **Módulo:** [batalha](../README.md)
- **Estado:** Em andamento (Fase 3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-010`

## 1. Problema

`src/core/` já executa PP, precisão, críticos, status principais, times de até
seis Pokémon e progressão. Esta frente completa a paridade Gen VI para campo,
captura, habilidades e efeitos de golpe. P-010 continua aberta para condições
voláteis, hazards, troca forçada, itens e habilidades ainda não simulados.

## 2. Requisitos Funcionais

- **RF-01:** `BattleMove` com `currentPp` / `maxPp` e checagem de `accuracy` usando `rng` injetável.
- **RF-02:** `MajorStatus` (`paralysis`, `sleep`, `freeze`, `burn`, `poison` e `toxic`) afeta velocidade, dano residual e chance de agir.
- **RF-03:** Times de múltiplos Pokémon para treinadores (envio automático do próximo Pokémon saudável ao desmaiar) e troca forçada quando o Pokémon ativo do jogador desmaia e há outro saudável na `party`.
- **RF-04:** Tabela completa de 18 tipos da Geração VI e evoluções básicas dos iniciais/Route 101.
- **RF-05:** Prioridade da ROM, clima, telas e habilidades de entrada/dano usam
  o estado puro da batalha e o RNG injetável.
- **RF-06:** Captura usa catch rate da espécie, HP, status e os quatro shake
  checks da Geração VI.
- **RF-07:** Hazards pertencem ao lado do campo, acumulam até os limites Gen VI,
  aplicam seus efeitos ao entrar ou trocar e são removidos por Rapid Spin/Defog.
- **RF-08:** Confusão, Leech Seed, Taunt, Swagger e Flatter têm duração e efeitos
  voláteis corretos; voláteis são limpos ao retirar o Pokémon.
- **RF-09:** Protect/Detect usam chance decrescente em usos consecutivos;
  Roar/Whirlwind provocam troca forçada quando há substituto.
- **RF-10:** Super Luck, Scope Lens e Sniper modificam críticos; captura crítica
  usa progresso da Pokédex e um shake check.
- **RF-11:** Substitute usa 1/4 do HP máximo, absorve dano e bloqueia status;
  Fly, Dig e Solar Beam carregam um turno e executam no próximo.
- **RF-12:** Itens segurados Leftovers, Life Orb, Focus Sash, Choice Band/Specs/
  Scarf, Sitrus/Oran Berry e Eviolite alteram dano, HP, velocidade, defesa ou
  seleção de golpes conforme Gen VI.
- **RF-13:** Technician, Guts, Adaptability, Huge Power/Pure Power, Rock Head,
  Speed Boost, Static, Flame Body, Poison Point, Flash Fire, Water Absorb e
  Volt Absorb afetam dano, status ou fim de turno.
- **RF-14:** A IA de treinador pode trocar para um Pokémon saudável do time quando
  a desvantagem do ativo é clara e o reserva oferece resposta melhor.
- **RF-15:** Disable, Yawn, Perish Song, Attract e Encore mantêm duração,
  condições de aplicação e efeito por turno, e são limpos ao trocar.
- **RF-16:** Knock Off remove item removível e recebe o bônus de dano Gen VI;
  U-turn/Volt Switch trocam para um reserva saudável após acertar; Sucker Punch
  só acerta quando o alvo escolheu um golpe que causa dano.
- **RF-17:** Drizzle, Drought, Sand Stream e Snow Warning iniciam clima ao entrar;
  Moxie, Sheer Force (incluindo a remoção do recuo de Life Orb), Magic Guard,
  Natural Cure, Rough Skin e Iron Barbs aplicam seus efeitos Gen VI.
- **RF-18:** Bind, Wrap, Fire Spin e Whirlpool prendem por 4–5 turnos e causam
  dano residual de 1/8 do HP máximo e impedem troca voluntária; Baton Pass
  transfere estágios e Substitute.
- **RF-19:** Encontros ORAS preservam os 61 slots do ZO, separam os métodos e
  usam as probabilidades por slot conhecidas para selecionar espécies.

## 3. Critérios de Aceite

- [x] Testes determinísticos cobrem PP, precisão, status, crítico, times e mecânicas de campo em `src/core/`.
- [x] Vetores de dano, captura e prioridade em `src/ai/battleParity.test.ts`.
- [x] `npm run verify` passa; cobertura de `src/core/` fica em 96,20% de linhas e 87,08% de branches.
- [x] Substitute e os três golpes de carga cobertos por testes determinísticos em `src/core/`.
- [x] Itens segurados e habilidades adicionais cobertos por testes determinísticos em `src/core/`.
- [x] IA de treinador escolhe troca vantajosa com vetor determinístico em `src/core/`.
- [x] Vetores de dano dos novos modificadores registrados em `src/ai/battleParity.test.ts`.
- [x] Voláteis Disable, Yawn, Perish Song, Attract e Encore cobertos por testes
  determinísticos em `src/core/`.
- [x] Knock Off, U-turn, Volt Switch e Sucker Punch cobertos por testes e vetores
  determinísticos em `src/core/` e `src/ai/battleParity.test.ts`.
- [x] Habilidades de entrada, Moxie, Sheer Force, Magic Guard, Natural Cure,
  Rough Skin e Iron Barbs cobertos por testes determinísticos em `src/core/`.
- [x] Aprisionamento parcial e Baton Pass cobertos por testes determinísticos;
  vetores de dano registrados em `src/ai/battleParity.test.ts`.
- [x] ZO mantém os 61 slots ORAS e classifica grama, grama alta, Swarm, Surf,
  Rock Smash, varas e hordas; o adapter aplica pesos reais em grama, Surf,
  Rock Smash e varas e retém a chance das três subtabelas de horda.
- [ ] Implementar os itens restantes listados em `P-010`; a pendência continua aberta.

## 4. Entrega parcial — 2026-11-19 (campo e captura)

O core agora aplica os brackets de prioridade da ROM, golpes OHKO com ajuste de
accuracy por nível, Sturdy, Levitate, Intimidate e Blaze/Torrent/Overgrow.
Sunny Day, Rain Dance, Sandstorm e Hail alteram dano e duram cinco turnos;
Sandstorm aumenta Sp. Def de tipos Rock e clima causa dano residual quando
aplicável. Reflect e Light Screen reduzem dano e golpes críticos ignoram as
telas. Captura usa catch rate da espécie, HP, status e quatro shake checks Gen VI.

`npm run verify`: 508 testes Vitest passaram, build passou e 233 testes Python
passaram (1 skip por ausência de `public/assets/maps`). Naquele ponto, ainda
faltavam hazards, confusão e outros status voláteis, Protect/Substitute, forçar
troca, críticos de captura, itens segurados em combate e as demais habilidades
e condições de evolução registradas em `P-010`.

## 5. Entrega parcial — 2026-11-19 (hazards, voláteis e críticos)

O campo armazena Stealth Rock, Spikes, Toxic Spikes e Sticky Web por lado.
Aplicam dano por efetividade/grounding e efeitos de entrada nas trocas;
Rapid Spin limpa o lado do usuário, Defog limpa os dois lados e as telas, e
Poison aterrado absorve Toxic Spikes. Confusão usa auto-dano físico de 40 BP;
Leech Seed drena e cura o Pokémon ativo do lado oposto; Taunt, Swagger e Flatter
usam voláteis que saem ao trocar. Protect/Detect reduzem a chance pela metade
em usos consecutivos; Roar/Whirlwind escolhem um substituto saudável ou fazem
um encontro selvagem fugir. Super Luck/Scope Lens aumentam o estágio crítico e
Sniper aplica o multiplicador Gen VI. A captura crítica usa a contagem de
espécies registradas e resolve um único shake check.

`battleMechanics.test.ts`, `battleGen6Volatiles.test.ts` e
`src/ai/battleParity.test.ts` cobrem os casos com RNG determinístico. O core
recebe `caughtSpeciesCount` como argumento opcional em `throwPokeball`; o host
ainda não fornece a contagem de espécies únicas da Pokédex. `npm run verify`
passou com 530 testes Vitest, build e 233 testes Python (1 skip); a catraca de
cobertura de `src/core` passou.

## 6. Entrega parcial — 2026-11-19 (Substitute, itens, habilidades e IA)

Substitute consome 1/4 do HP máximo, absorve dano e protege contra status.
Fly, Dig e Solar Beam guardam o golpe durante a carga e o executam no turno
seguinte. Os itens Leftovers, Life Orb, Focus Sash, Choice Band/Specs/Scarf,
Sitrus/Oran Berry e Eviolite alteram a batalha; itens Choice prendem o usuário
ao golpe usado até trocar. Foram adicionados Technician, Guts, Adaptability,
Huge Power/Pure Power, Rock Head, Speed Boost, Static, Flame Body, Poison Point,
Flash Fire, Water Absorb e Volt Absorb. A IA de treinador troca quando a melhor
resposta do ativo é fraca e um reserva tem vantagem clara.

`battleGen6Completion.test.ts` cobre as regras e `src/ai/battleParity.test.ts`
registra os vetores de dano determinísticos `[28, 96, 28, 24]` para Technician,
Adaptability, Choice Band e Life Orb. A implementação segue a referência pública
do [simulador Pokémon Showdown para Gen VI](https://github.com/smogon/pokemon-showdown/tree/master/data/mods/gen6).
`npm run verify`: 555 testes Vitest passaram, build passou e 233 testes Python
passaram (1 skip); a catraca de cobertura de `src/core` passou.

## 7. Entrega parcial — 2026-11-19 (voláteis e golpes utilitários)

O core passou a guardar o último golpe usado e a derivar gênero pela tabela da
ROM. Disable e Encore consomem essa memória; Yawn tem atraso de um turno,
Perish Song conta três turnos, Attract trava a ação com chance de 50%, e todos
os voláteis saem ao trocar. Knock Off recebe ×1,5 contra item removível e o
remove após o acerto. U-turn/Volt Switch trocam pelo primeiro reserva saudável
depois do dano; Sucker Punch verifica a categoria da ação escolhida pelo alvo.

`battleGen6NextBlock.test.ts` cobre os efeitos, durações, bloqueios, trocas e
condições de falha. `src/ai/battleParity.test.ts` fixa os danos máximos
determinísticos de Knock Off com/sem item, U-turn, Volt Switch e Sucker Punch em
`[45, 30, 32, 46, 37]`. `npm run verify` passou com 578 testes Vitest, build
(aviso de chunks acima de 500 kB) e 240 testes Python (1 skip por ausência de
`public/assets/maps`); a catraca de cobertura do core passou.

## 8. Captura crítica com Pokédex persistente — 2026-11-20

`battleUi` agora passa a quantidade de espécies em `caughtSpecies` para
`throwPokeball`. A lista vem do estado persistido, portanto inclui Pokémon
guardados fora da equipe; capturas são registradas mesmo com a equipe cheia.
Saves antigos recebem uma lista inicial derivada do time presente. `save.test.ts`
e `battleUi.test.ts` cobrem a migração e a fonte da contagem; `npm run verify`
passou com 594 testes Vitest e 241 Python (1 skip), além do build.

## 9. Entrega parcial — 2026-11-20 (habilidades, aprisionamento e Baton Pass)

Drizzle, Drought, Sand Stream e Snow Warning iniciam cinco turnos de clima ao
entrar em campo. Moxie aumenta Attack após um nocaute direto; Sheer Force aumenta
em 30% o dano de golpes com efeito secundário e suprime esse efeito e o recuo de
Life Orb. Magic Guard impede dano indireto, Natural Cure limpa status ao sair,
e Rough Skin/Iron Barbs
causam 1/8 do HP máximo por contato.

Bind, Wrap, Fire Spin e Whirlpool aplicam aprisionamento de 4–5 turnos, causam
1/8 do HP máximo por turno e impedem a troca voluntária; Ghost é imune. Baton
Pass troca para um reserva e carrega os estágios e o Substitute. Os testes em
`battleGen6FinalBlock.test.ts` cobrem as mecânicas; `src/ai/battleParity.test.ts`
fixa os vetores `[42, 54, 8, 15]` para dano normal, Sheer Force, Iron Barbs e
dano de aprisionamento. As regras de habilidades foram conferidas na
[implementação Gen VI do Pokémon Showdown](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/gen6/abilities.ts)
e em suas [descrições Gen VI](https://github.com/smogon/pokemon-showdown/blob/master/data/text/abilities.ts).
`npm run verify` passou com 624 testes Vitest, build e
241 testes Python (1 skip).

## 10. Entrega parcial — 2026-11-20 (taxas e métodos de encontro ORAS)

O extrator conserva as 61 posições da seção de encontros do ZO e marca o
formato `oras-61-slot-v1` em 150 zonas. O adapter separa as tabelas de grama,
grama alta, Swarm, Surf, Rock Smash, Old Rod, Good Rod, Super Rod e hordas A/B/C.
As taxas de slot são aplicadas para grama, Surf, Rock Smash e varas; os grupos
de horda guardam as chances 60/35/5. O host usa pesos reais na seleção de
grama; não há gatilhos de Surf, pesca ou Rock Smash, batalha de horda ou taxa
de slot confirmada para Swarm neste trabalho.

`scripts/test_extract_zones.py` verifica que a extração mantém a ordem completa
e rejeita uma tabela truncada. `wildPokemon.test.ts` cobre as taxas por método,
a separação da seleção de grama e as três chances de horda. A origem da ordem e
das taxas está registrada em [A-117](../../../APRENDIZADOS.md). `npm run verify`
passou com 639 testes Vitest, build (aviso herdado de chunks acima de 500 kB) e
252 testes Python (1 skip pela ausência de `public/assets/maps` no worktree). O
smoke `e2e/smoke.spec.ts` passou em 7/7, incluindo batalha selvagem, golpe e fuga.

## 11. Entrega parcial — 2026-11-20 (extração de IVs de treinador)

`scripts/extract_battle_tables.py` agora lê classe de treinador em `a/0/3/6`,
classe nominal em `a/0/7/3/0021.bin` e os campos de espécie, forma, nível e
byte IV em `a/0/3/8`. A regeneração produziu 949 registros em
`src/data/battle/trainers.json`; os testes sintéticos verificam classe, offsets,
preservação do byte IV e rejeição de equipes malformadas.

O byte IV foi mantido literal porque ainda não há evidência ROM/emulador para a
regra que o converte aos seis IVs do Pokémon. A rotina do host também não tem
vínculo comprovado entre IDs dos eventos AMX e esses registros. O próximo passo
é observar um Pokémon adversário em batalha no Azahar via RPC, rastrear a
conversão no runtime e então integrar o ID confirmado ao `TrainerSpec`.

## 12. Entrega parcial — 2026-11-20 (quality 13: Splash)

Splash (ID 150) agora retorna “Mas não teve efeito!” sem alterar usuário ou
alvo. A tabela ROM de golpes o classifica com `quality=13`; a descrição em
`a/0/7/3/0016.bin`, linha 150, diz que o movimento não tem efeito, e a tabela de
encontros ROM inclui Magikarp em Route 104. `battleMechanics.test.ts` e
`src/ai/battleParity.test.ts` verificam o estado imutável e a mensagem; os dois
testes foram executados antes do código e falharam com o fallback P-010.

Continuam sem simulação os demais quality 13. Em encontros do corredor até
Mauville aparecem, entre outros, Focus Energy, Curse, Rest, Aqua Ring, Block,
Helping Hand, Mirror Move, Teleport, Spider Web e Bestow; vários exigem estado
de crítico, turno residual, alvo aliado ou fuga/troca. Próximo passo: confirmar
cada comportamento via runtime Azahar ou CRO antes de escolher outra regra.

## 13. Entrega parcial — 2026-11-20 (quality 13: fuga)

O parser de treinadores lê o formato do registro e preserva `moveIds` e
`heldItemId` quando esses campos aparecem no GARC ROM; a regeneração produziu
949 treinadores, 284 membros com moveset explícito e 78 com item. Registros sem
lista explícita continuam usando os golpes do learnset ROM até o nível do
Pokémon. O cruzamento encontrou Teleport no moveset padrão do Ralts do treinador
18 e, nos encontros do corredor, Teleport, Block e Spider Web.

Os textos ROM de `src/data/texts/gametext/0016.json` (linhas 100, 169, 212 e
335) comprovam fuga de batalha selvagem com Teleport e bloqueio de fuga por
Mean Look, Spider Web e Block. `battleQualityThirteen.test.ts` cobre a fuga, a
falha contra treinador e o bloqueio de fuga; `scripts/test_pipeline.py` cobre os
campos customizados de moveset/item. O teste foi escrito antes do código. O
warp de campo do Teleport e a interação de bloqueio com troca voluntária,
retirada do usuário e Ghost continuam pendentes de observação Azahar em P-010.

## 14. Entrega parcial — 2026-11-21 (quality 13: lote de 32 golpes)

O core implementa mais 32 dos 77 golpes `quality=13` pendentes, conferindo
IDs, alvos, flags e descrições em `src/data/battle/moves.json` e
`src/data/texts/gametext/0016.json`: Focus Energy (116), Endure (203), Bestow
(516), Switcheroo (415), Trick (271), Rest (156), Sleep Talk (214), Refresh
(287), Heal Bell (215), Aromatherapy (312), Belly Drum (187), Shell Smash
(504), Curse (174), Pain Split (220), Psych Up (244), Power Trick (379), Power
Swap (384), Guard Swap (385), Heart Swap (391), Topsy-Turvy (576), Aqua Ring
(392), Magnet Rise (393), Memento (262), Destiny Bond (194), Mind Reader
(170), Lock-On (199), Spite (180), Spiky Shield (596), King’s Shield (588),
Celebrate (606), Hold Hands (607) e Happy Hour (603).

Os efeitos incluem crítico e Baton Pass, Endure e escudos com chance consecutiva,
troca de itens, sono/cura e execução via Sleep Talk, estágios, compartilhamento
de HP, maldição, Aqua Ring, Magnet Rise, Destiny Bond, precisão garantida e PP.
Heal Bell e Aromatherapy limpam status do time inteiro; contato usa a flag ROM
do golpe para Spiky Shield e King’s Shield. `battleQuality13Batch2.test.ts`
cobre os grupos e `src/ai/battleParity.test.ts` fixa `[true, false, 36, 4]`
para o limite de crítico do Focus Energy, dano crítico e cura de Aqua Ring.

Restam 45 golpes quality 13 sem simulação: Mimic, Metronome, Mirror Move,
Transform, Conversion, Sketch, Conversion 2, Future Sight, Stockpile, Follow
Me, Nature Power, Helping Hand, Role Play, Wish, Assist, Magic Coat, Recycle,
Skill Swap, Imprison, Grudge, Snatch, Camouflage, Doom Desire, Healing Wish,
Acupressure, Psycho Shift, Gastro Acid, Copycat, Worry Seed, Lunar Dance,
Guard Split, Power Split, Rage Powder, Soak, Simple Beam, Entrainment, After
You, Ally Switch, Quash, Reflect Type, Trick-or-Treat, Forest’s Curse, Flower
Shield, Electrify e Powder. A lista enumerada em P-010 omite Grudge, Snatch e
Camouflage; a contagem 45 é calculada pelas 90 entradas quality 13 da tabela da
ROM, menos os 13 efeitos já cobertos antes deste lote e estes 32.

`npm run verify` passou após o lote: 663 testes Vitest em 88 arquivos, build e
263 testes Python (2 skips pela ausência de assets no worktree); a
catraca de cobertura do core passou. O build manteve o aviso existente de
chunks acima de 500 kB.

## 15. Entrega — 2026-11-21 (quality 13: lote final de 45 golpes)

O core cobre os 45 golpes que restavam no Section 14. Wish (273) agenda cura de
metade do HP máximo do slot ativo ao fim do próximo turno; Future Sight (248) e
Doom Desire (353) registram um ataque para dois turnos depois, usando o Sp. Atk
do usuário e as defesas, tipos, clima e telas no momento do impacto. Healing
Wish (361) e Lunar Dance (461) desmaiam o usuário e restauram o próximo Pokémon
daquele lado; Lunar Dance também recupera todos os PP.

Power Split (471) e Guard Split (470) calculam a média dos atributos ofensivos
ou defensivos dos dois ativos. Stockpile (254) guarda até três cargas e os
estágios aplicados; Acupressure (367) escolhe por `rng` um estágio não máximo e
o eleva em dois; Flower Shield (579) aumenta a Defesa dos ativos do tipo Grass.
Gastro Acid (380), Worry Seed (388), Simple Beam (493), Entrainment (494), Role
Play (272) e Skill Swap (285) atualizam habilidades temporárias, que voltam ao
estado anterior na troca. Soak (487), Reflect Type (513), Trick-or-Treat (567),
Forest’s Curse (571), Conversion (160), Conversion 2 (176) e Camouflage (293)
alteram tipos efetivos até a troca; Camouflage lê o biome opcional da batalha.

Electrify (582) modifica o tipo do golpe escolhido pelo alvo se ele ainda não
agiu. Powder (600) tem prioridade +1 e pune golpes Fire com dano de um quarto do
HP máximo. Recycle (278) recupera itens consumidos; Imprison (286) bloqueia os
golpes compartilhados; Grudge (288) zera o PP do golpe direto que nocauteia o
usuário; Snatch (289) tem prioridade +4 e rouba golpes de alvo próprio; Magic
Coat (277) tem prioridade +4 e reflete golpes de status direcionados. Psycho
Shift (375) transfere status maior respeitando imunidades. Copycat (383), Mirror
Move (119), Mimic (102), Metronome (118), Assist (274) e Nature Power (267)
copiam ou chamam golpes; Transform (144) copia tipos, atributos efetivos,
estágios, habilidade e golpes; Sketch (166) substitui seu espaço de golpe com
1 PP.

Em singles, Follow Me (266), Rage Powder (476), Helping Hand (270), After You
(495), Ally Switch (502) e Quash (511) falham sem efeito por não haver parceiro
ou ordem entre aliados. Essa regra segue os handlers do formato Gen VI no
[Pokémon Showdown](https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts)
e seus overrides da
[geração 6](https://github.com/smogon/pokemon-showdown/blob/master/data/mods/gen6/moves.ts).
Combates doubles continuam fora deste core 1v1.

`battleQuality13Batch3.test.ts` enumera os 90 golpes `quality=13` da tabela ROM e
verifica que nenhum usa o fallback “ainda não é simulado”; também cobre a
contagem de 45 golpes do lote, os turnos atrasados, substituição após sacrifício,
mudanças temporárias e efeitos de reação. `src/ai/battleParity.test.ts` fixa a
paridade de tipos alterados e Power Split na fórmula de dano.

`npm run verify` passou: 675 testes Vitest em 89 arquivos, build e 263 testes
Python (1 skip porque o worktree não contém os assets locais). Permanecem os
avisos de build existentes para chunks acima de 500 kB.
