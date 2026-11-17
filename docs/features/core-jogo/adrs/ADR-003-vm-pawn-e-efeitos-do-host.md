# ADR-003 — VM Pawn pura e completion explícita do host

- **Status:** Aceito
- **Data:** 2026-11-17
- **Escopo:** Fase 2/P-013, [PRD-003](../prds/PRD-003-execucao-amx-da-abertura.md)

## Contexto

O contrato normalizado de [ADR-002](ADR-002-runner-puro-de-chamadas-normalizadas.md)
não executa o disassembly. Os scripts reais usam memória/frames/dispatch e ABI
diferente: `TalkMdlMsg_Seq` recebe 19 células, `WarpSetID` uma e `MdlSetGPos`
usa x,y,z,ator. Não há trace de emulador que comprove as demais assinaturas.
O coordenador aprovou efeitos externos tipados com completion explícita,
sem exigir interpretação gráfica/ACMD nesta etapa.

## Decisão

- Adicionar o caminho `amxRunner` sem alterar a API normalizada anterior.
- Executar células signed-32, pilha/memória, chamadas/retornos e switches reais;
  opcodes e nativas não suportados falham com erros nomeados.
- Executar `GlobalCall` somente com candidato único no bundle fornecido;
  invocações têm memória/pilha próprias e mundo compartilhado.
- Manter flags, vars, atores e projeções de inventário/party no estado puro.
  As transições clonam os argumentos; mutação interna ocorre apenas nas cópias.
- Representar câmera/fade/áudio/ACMD/UI/consultas externas como pedidos
  `{channel,name,args}` e pausar em `await-input`. O host deve retornar uma
  célula explícita e eventuais escritas de saída válidas. Não presumir sucesso.
- Serializar conservadoramente o protocolo; não emular concorrência gráfica.
  `_Suspend`/`HALT 12` consomem ticks externos, não relógio.
- Usar disassembly real versionado e fixture JSON de dados iniciais cujo SHA
  corresponda à origem; manter testes sintéticos de regressão sem ROM/WebGL.

## Consequências e limites

Há execução real de trajetórias da abertura até término ou solicitação do host,
não uma tradução manual equivalente. O inventário diferencia declaração de
aridade e execução efetivamente coberta. Inferências, semântica de cada nativa,
projeções incompletas de objetos e evidências estão em
[script-disassembly.md](../../pipeline-rom/script-disassembly.md).

Não se declara paridade de emulador, ABI completa de ACMD/objetos Pokémon,
renderer funcional ou abertura inteira concluída. A integração ao GameState,
serviços do host e validação de todos os ramos permanecem em P-013.
