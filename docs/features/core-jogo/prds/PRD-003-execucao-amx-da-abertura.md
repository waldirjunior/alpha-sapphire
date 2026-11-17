# PRD-003 — Execução AMX da abertura

- **Estado:** Implementado no escopo headless abaixo; integração/paridade em P-013
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

Não se exige nesta etapa um host gráfico pronto, ABI ACMD decodificada,
concorrência da ROM ou paridade no emulador. Completar todos os serviços/ramos e
ligar a execução ao jogo ativo são próximos passos de P-013, não aceites implícitos.
