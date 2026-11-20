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

## Campanha natural até Petalburg (2026-11-19)

`MdlGetGPosX/Z` agora retorna células inteiras de grade; regressões em
`amxNativeState.test.ts` confirmam o PRI bruto. `e2e/campaign.spec.ts` segue o
New Game com teclas desde Birch até Route 102 e cruza a borda natural para
Petalburg (`zone_0013`) por teclas, mantendo os gates ROM observados sem injetar
estado ou disparar warp manualmente. A rota 102 só possui um warp ROM explícito
de retorno a Oldale; Petalburg é alcançada pela borda de zona.
Isso não afirma que todos os gatilhos e cutscenes dessas zonas estejam
implementados ou validados no Azahar.

`npm run verify`: 540 Vitest em 77 arquivos, build e 233 testes Python passaram
(um skip por assets locais ausentes no worktree). `ALPHA_E2E_PORT=5480 npx
playwright test e2e/campaign.spec.ts e2e/smoke.spec.ts`: 8/8 passaram. O aviso
conhecido de chunk acima de 500 kB permanece; P-013 continua aberta.

## Campanha natural até Rustboro (2026-11-20)

`e2e/campaign.spec.ts` segue de Petalburg (`zone_0013`) por Route 104 sul
(`zone_0027`), Petalburg Woods (`zone_0082`), Route 104 norte (`zone_0026`) e
chega a Rustboro (`zone_0016`) com entradas de teclado. O teste percorre os
warps extraídos da ROM e a saída contínua para Rustboro sem fixture ou escrita
de posição/flags. Também verifica que os atores com hide-flags já ativas
`773`, `624/706/1066` e `826` ficam ocultos após a projeção do AMX.

A caminhada não depende de um gate de evento nesses trechos. As cutscenes e os
triggers narrativos da floresta continuam em P-013; chegar a Rustboro não prova
que o resgate de Peeko ou os demais ramos de história estejam implementados.

`npm run verify` passou (Vitest com cobertura, build e 241 testes Python; um
skip porque os assets locais não estão neste checkout). `ALPHA_E2E_PORT=5504
npx playwright test e2e/campaign.spec.ts e2e/smoke.spec.ts` passou 8/8. O aviso
existente de chunks acima de 500 kB permanece.

Continuam pendentes: memória fora das 19 imagens, bancos GameText/MsgLoad, warp
AMX/ABI de `_MapChangeCore`, query de construções no init de Littleroot,
persistência/projeções de save/party/bag e paridade de todos os ramos.

Não se exige nesta etapa um host gráfico pronto, ABI ACMD decodificada,
concorrência da ROM ou paridade no emulador. Completar todos os serviços/ramos e
ligar a execução ao jogo ativo são próximos passos de P-013, não aceites implícitos.

## Entrada natural no Ginásio de Rustboro e binding de Roxanne (2026-11-20)

A rota `(47,61)` de Rustboro (`zone_0016`) entra no Poké Mart (`zone_0285`),
não no Ginásio. O Ginásio é `zone_0441`, alcançado pelo warp `(62,24)` em
`(18,38)`; `textFile=563` contém as falas de Roxanne e da Stone Badge. O
disassembly e a observação no Azahar identificam o dispatch `map/case 2` da
líder. `loader.test.ts` aceita esse vínculo somente para a zona e o SHA ROM
esperados. A correção da identificação e os hashes estão em A-114 e P-013.

`e2e/campaign.spec.ts` chega a `zone_0441` por teclas e acompanha o início
natural da cena. O fluxo avança câmera/ACMD suportados e para em
`FadeRequestOut(0,2,30)` (`map` offset `7068`); o significado do modo 2 não foi
confirmado, então o teste verifica a pausa e ausência de mutação. A cena para
antes da conversa com Roxanne. A entrada no Ginásio não prova interação,
batalha ou badge.

## ABI CRO das natives de Roxanne (2026-11-20)

O `map` real de `zone_0441` chama `PokePartyGetParam` com três células nos
offsets `204/248/280/360/448`, `_CallTrainerBattleCore` com sete células em
`1892`, e `BadgeGetFlag`, `BadgeSetFlag` e `GymSetVictoryInfo` com uma célula
em `7280/9188/9204`. Os wrappers correspondentes em `DllField.cro`
(`SHA-256 9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`)
confirmam a contagem e o formato de `_CallTrainerBattleCore` (três `u16`, um
`u32`, três `u8`). Isso não identifica os campos consultados da party, a equipe
de Roxanne, o callback/resultado da batalha ou a persistência host da badge.

O runner conhece essas assinaturas e o host suspende os cinco pedidos sem
presumir retorno ou mutar party/badge. Regressões AMX validam as aridades da ROM
e a pausa explícita; campanha Playwright passa 1/1 e smoke 7/7. `npm run
verify` passa com 637 testes Vitest, build e 249 testes Python (um skip por
assets locais ausentes). P-013 continua aberta até validar o Fade mode 2 no
emulador e decodificar seletores de party e dados/callbacks de treinador.

## Fade mode 2 e primeira consulta natural de party (2026-11-20)

Azahar 2126.2 iniciou a ROM com um save local copiado e relocalizado por
`scripts/oras_save.py` a `zone_0441 (18,38)`. O RPC leu zona `441` e posição
mundial `(333,2,693)`. A captura anterior ao primeiro A mostra o interior
visível; a captura após um A mostra as duas telas pretas. Esse é o fluxo da
cena natural cujo AMX chama `FadeRequestOut(0,2,30)` em `map` offset `7068` e
consulta `FadeIsEnd` em loop na função `2232`. As capturas `mode2-before-a.png`
e `mode2-after-one-a.png` ficam somente no diretório ignorado
`rom/emulator/roxanne-probe/`.

`EventFade` aceita agora o modo 2 e anima para preto durante os 30 frames. A
regressão unitária prova o progresso em 15/30 frames e o retorno de `FadeIsEnd`;
`e2e/campaign.spec.ts` segue o init até `WorkSet(16553,1)`, chega diante de
Roxanne e inicia sua interação natural. O teste para na primeira consulta real
`PokePartyGetParam(0,8,0)` e confirma que outro Enter não altera `romEvents` ou
`storyFlags` nem abre a batalha.

O disassembly de `map` função `128` mostra a iteração pelos slots da party e os
seletores `8`, `49`, `44`, `53` e `0`. O wrapper `DllField.cro` em `0x4e618`
confirma que o segundo argumento seleciona rotinas diferentes: `44` lê o bit 0
do byte `0x15` do registro, `53` lê o byte `0x2f`, `8` combina bits do estado
interno e `0` lê um `u16` no início do registro, comparado pelo script a
`374/375/376`. O CRO não dá nomes semânticos a esses campos; nenhum foi ligado
ao party do host. Os wrappers de `_CallTrainerBattleCore`, `BadgeSetFlag` e
`GymSetVictoryInfo` continuam sem retorno presumido, equipe inventada ou
mutação de recompensa. A campanha avançou até a primeira query sem ABI de campo;
diálogo posterior, batalha, callback e badge seguem em P-013.

`npm run verify` passou: 639 Vitest em 85 arquivos, build e 250 testes Python
(um skip por assets locais ausentes no worktree). `npx playwright test
e2e/campaign.spec.ts --reporter=list` passou 1/1 em 4,7 min. Smoke não foi
repetido porque o host de eventos não mudou; a suíte completa Playwright não foi
executada nesta etapa.
