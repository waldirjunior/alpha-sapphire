# Visão — o que é este projeto e quando ele termina

Leia este arquivo primeiro. Ele quase não muda; o que muda a cada entrega está em [STATUS.md](STATUS.md) e na fila de [ROADMAP.md](ROADMAP.md).

## Objetivo

Portar **Pokémon Alpha Sapphire** para o navegador. A ROM é a fonte de tudo; o jogo em Three.js + TypeScript deve se comportar e parecer com o original: mesmo mapa, mesma história, mesma dinâmica de movimento e batalha, mesmo layout e mesmo visual. Só a plataforma muda (3DS → web).

Não é um jogo inspirado em Pokémon nem um remake com liberdade criativa. Onde o port difere do original existe um **defeito a registrar e corrigir**, nunca uma decisão de design.

## Como o port é feito

| Camada | Onde | Papel |
| --- | --- | --- |
| Extrair | `scripts/` (Python, offline) | ROM → RomFS → JSON, GLB e áudio. Reproduzível; nada proprietário entra no Git. |
| Interpretar | `src/core/` (TypeScript puro) | Regras do original como funções puras: grade, colisão, warps, batalha e a VM Pawn/AMX que executa os scripts de evento da própria ROM. |
| Apresentar | `src/engine/`, `src/game.ts` | Three.js e DOM desenham o estado do core. Não decidem regra de jogo. |

Preferência permanente: **executar o dado da ROM em vez de reescrevê-lo à mão**. Um evento de história roda pela VM AMX; um mapa vem do JSON extraído; um modelo vem do GLB convertido.

## Definição de pronto

O projeto termina quando cada dimensão abaixo está pronta. O estado atual de cada uma fica em [STATUS.md](STATUS.md).

| Dimensão | Pronto quando | Medido por |
| --- | --- | --- |
| Mundo | As 536 zonas carregam e se conectam como no original, sem pontes inferidas. | `zoneContracts.test.ts`, testes de corredor |
| Movimento | Andar, correr, ledges, bike, Surf e demais HMs aceitam e recusam os mesmos passos que o original. | Testes do core + observação no emulador |
| História | De New Game à Liga, os eventos rodam pela VM AMX sem fixture nem atalho manual. | e2e de campanha |
| Batalha | Fórmulas, ordem de turno, IA e progressão iguais à Gen VI. | Testes do core, `emulatorParity.test.ts` |
| Visual | Todo cenário do catálogo visual aceito e equivalente à captura do emulador no mesmo ponto. | `npm run test:e2e` (placar de cenários) |
| Áudio | BGM, jingles e efeitos tocam nos mesmos gatilhos. | Testes de `zoneAudio`/`battleAudio` + e2e |
| Interface | Menus, diálogos e telas seguem o layout do 3DS. | e2e + revisão visual |

## Fonte de verdade: escada de evidência

Toda regra implementada precisa de uma evidência. Use o **degrau mais barato que responde à pergunta**:

1. **Dado da ROM** — tabela, mapa, texto, modelo ou script extraído.
2. **Código da ROM** — disassembly do executável e dos CROs.
3. **Comportamento observado no emulador** — captura, save state ou passo a passo no Azahar com a mesma ROM ([validacao-emulador/ADR-001](features/validacao-emulador/adrs/ADR-001-oraculo-emulador-e-tabelas-abertas.md)).
4. **Referência pública consolidada** — pk3DS, Pokémon Showdown, PokéAPI — para tabelas e fórmulas.
5. **Inferência marcada** — permitida apenas como dado rotulado (`inferred: true`, `spawnDerived`) com pendência aberta apontando o que falta provar.

Sem nenhum desses degraus é **hipótese**, e hipótese não vira regra de jogo.

O disassembly explica *por que* o original faz algo; o emulador mostra *o que* ele faz. Para o port ficar igual basta o "o quê". Não gaste uma sessão provando por disassembly o que uma observação no emulador fecha.

## Regra de continuidade

O trabalho é contínuo: uma sessão termina com o placar movido ou com um bloqueio real registrado.

- **Sempre há próxima tarefa**: o primeiro item não bloqueado da fila em [ROADMAP.md](ROADMAP.md).
- **Entrega é algo executável**: teste novo passando, cenário visual aceito, pendência fechada, ou defeito novo registrado com reprodução. "Inconclusivo" e "entrega documental" não são entregas.
- **Investigação tem orçamento de uma sessão**. Se a pergunta não fechou: registre o que falta na pendência, troque de degrau na escada (normalmente o emulador) ou pegue o próximo item da fila. Não abra uma segunda sessão só de documentação sobre a mesma pergunta.
- **Defeito conhecido não bloqueia**: registre na pendência e, se for visual, em `src/visual/scenarios.ts`; depois siga.
- **Pare e pergunte somente** por decisão de escopo ou produto, ferramenta ou acesso ausente (por exemplo, emulador não instalado), ou ação destrutiva e irreversível.

## Fora do objetivo

- Conteúdo, mecânica ou arte que o original não tem.
- Versionar ROM, dumps, modelos, texturas, áudio ou capturas derivadas da ROM.
- Emulação no navegador: o emulador é apenas oráculo offline.
