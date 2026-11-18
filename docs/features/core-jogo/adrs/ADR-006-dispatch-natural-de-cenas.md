# ADR-006 — Dispatch natural de cenas AMX

- **Estado:** aceita e implementada no recorte verificado em 2026-11-18.
- **Data:** 2026-11-17.
- **Escopo:** Fase 2, P-013, [PRD-005](../prds/PRD-005-warp-natural-da-rom.md).

## Contexto e evidência

Executar um case existente não comprova que o jogo original o selecionaria.
A fixture de warp da ADR-005 valida somente o adaptador do engine.

O `code.bin` SHA-256
`b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`
procura o export AMX `GetSceneChangeData` em VA `0x3ff5fc`. O consumidor em
`0x3ff628–0x3ff6c4` lê células por índice, agrupa-as em triplas
`scriptId, workId, valor` e termina ao ler `-1` no campo de script.
Armazena até oito registros. Em `0x3ff6f4–0x3ff794`, compara o valor
unsigned-16 do work e executa o primeiro registro correspondente.
O script `2000` funciona como ausência de evento.

Na zona 6, o export está em `5536` e lê a tabela iniciada no endereço AMX
`336`. A primeira condição usa work `16514 = 0`; a segunda usa
`16496 = 3`, selecionando o script 2. Este chama o global 9881, que escreve
`16496 = 4` e pede `_MapChangeCore` para a zona 227, tile `(14,12)`.
Playwright confirmou o ramo com works preparados `16514=1` e `16496=3`, sem
substituição de programa/memória/binding nem confirmação manual de efeitos.
O laboratório ficou visível após o fade e o work `16496` passou a 4 (A-044).

## Decisão

- Executar exports com os argumentos e a pilha da VM, sem substituir a memória
  ou traduzir a tabela para um encadeamento manual de cases.
- Extrair metadados dos exports junto das imagens locais verificadas por SHA.
  Memória, tabelas de cenas e textos novos permanecem em assets ignorados.
- Separar leitura/seleção pura das condições e apresentação assíncrona no engine.
- Restaurar somente flags/works reais no estado de eventos; não derivar condições
  de história de nomes de zonas ou de um contador de demonstração.
- Concluir câmera, fade e ACMD somente por serviços cujo estado comprove término.
  Um retorno hipotético usado em pesquisa não pode entrar no host de produção.
- Invalidar cargas e continuações de apresentação ao trocar a geração da zona.

## Limites

A ordem dos callbacks de entidades e a semântica audiovisual exigem evidência
própria. Esta decisão não autoriza escolher `map/case 1` como init universal,
nem concluir queries opacas com uma constante. O aceite do recorte está
registrado em PRD-005; uma campanha desde New Game continua não demonstrada.

## Projeção e validação do host

`EventPresentation` concentra câmera, fade e giros, preservando follow enquanto
não há câmera de evento. O terreno só conclui a query após seu promise real;
reset cancela filas e cargas da geração anterior. `ZoneEvents` devolve as direções
concluídas à VM por cópia do estado, preservando coordenadas/visibilidade e o
contexto do ator ao suspender/restaurar init durante interação.

A-043–A-046 registram wrappers, hashes e handlers. ACMD cobre giros
5/6/7/250/251, não caminhada: `Init(-1)` resolve o ator do evento e `Update(-1)`
consulta todas as filas. A duração vem do CRO, mas yaw em ticks do renderer não
reproduz quaternion/FPS/clipes GF1. Lote com comando não suportado fica opaco.
GameText lê `.lines` do envelope legado, preservando os dois slots MsgLoad.

O warp natural passou sem Enter de completion. O smoke separado do NPC 0/script
14 usou posição preparada e uma confirmação cosmética de eye-to-eye, mas nenhuma
confirmação ACMD. O probe GameText é do loader, não de um ramo de diálogo ROM.
Não se declara paridade no emulador; P-013/P-017 continuam abertas.
