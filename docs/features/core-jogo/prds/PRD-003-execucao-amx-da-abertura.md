# PRD-003 — Execução AMX da abertura

- **Estado:** VM e recortes do host implementados; campanha/paridade em P-013
- **Data:** 2026-11-17
- **Fase:** 2, continuação de PRD-002/RF-04
- **Decisão:** [ADR-003](../adrs/ADR-003-vm-pawn-e-efeitos-do-host.md)

## Requisitos

1. Executar instruções/cases reais de 6/223/225/227 no core puro, incluindo
   memória, frames, chamadas, retornos e dispatch; não substituir por IR manual.
2. Inventariar nativas adicionais/aridades/offsets e conservar evidência dos dados
   iniciais. Incluir Route 101/quartos/globais quando referenciados pela abertura.
3. Manter flags/vars/atores e projeções de inventário/party como estado determinístico.
4. Pausar efeitos externos com pedido tipado e completion explícita do host.
   Assinaturas inferidas devem ser identificadas; desconhecidos falham por nome.
5. Testar disassembly real até estado conhecido ou `await-input`, conservando
   regressões sintéticas sem ROM, browser ou WebGL.

## Aceite verificado

- [x] Inits reais 223/225 terminam; interação de móvel 223 termina após SE/texto/tecla.
- [x] Laboratório 227, Littleroot 6/global78, mãe/relógio global47 e Route 101/23
  chegam a efeitos externos explícitos, com memória e argumentos originais.
- [x] 82 nomes adicionais às nove chamadas normalizadas inventariados;
  aridades das 89 nativas diretas das quatro zonas conferidas contra o registro.
- [x] Flags/vars/itens/party/cura/escolha/tempo/erro/orçamento testados sinteticamente.
- [x] 61 testes Vitest, 47 Python e build canônico passando.

## Continuação gráfica conservadora (2026-11-17)

[ADR-004](../adrs/ADR-004-host-conservador-de-eventos.md) registra o recorte aprovado:
NPCs de `maps_v2` usam vínculo AMX único com fallback explícito; `entities/case 1`
roda na entrada, atores são projetados e texto StoryText é exibido. O texto
retorna ao script; `LastKeyWait` ou `_ABKeyWait` recebe a confirmação do jogador.
ACMD/câmera/olhar usam confirmação manual de stub, não execução de apresentação.
Smoke real em Littleroot confirmou script 14/linha 6 após cinco confirmações,
com zero pageerror; 160 Vitest/25 arquivos e build passaram.

## Diálogo do NPC com uma confirmação (2026-11-19)

O host completa `TalkMdlMsg_Seq` depois de exibir o texto e deixa a pausa para
`LastKeyWait` ou `_ABKeyWait`. O teste sintético reproduz o ciclo do host com
ambos os natives de espera; o smoke de Littleroot confirma que um Enter fecha o
texto e devolve o controle ao jogador.

`npm run verify`: 442 Vitest, build e 229 testes Python passaram (um skip por
assets locais ausentes). `ALPHA_E2E_PORT=5392 npx playwright test
e2e/smoke.spec.ts`: 6/6 passaram. O build ainda avisa sobre chunks acima de
500 kB. Campanha natural e paridade completa continuam em P-013.

Continuam pendentes: memória fora das 19 imagens, bancos GameText/MsgLoad, warp
AMX/ABI de `_MapChangeCore`, query de construções no init de Littleroot,
persistência/projeções de save/party/bag e paridade de todos os ramos.

Não se exige nesta etapa um host gráfico pronto, ABI ACMD decodificada,
concorrência da ROM ou paridade no emulador. Completar todos os serviços/ramos e
ligar a execução ao jogo ativo são próximos passos de P-013, não aceites implícitos.
