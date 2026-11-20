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
