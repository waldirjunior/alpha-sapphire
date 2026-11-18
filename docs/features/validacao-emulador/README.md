# Módulo: Validação contra Emulador e Automação IA (`validacao-emulador`)

Responsável por `src/ai/` e pela suíte de testes comparativos que valida o comportamento do nosso motor (`src/core/`) contra o jogo original rodando em emulador (`Azahar` / `Citra`), além de alimentar registros técnicos contínuos para o livro do TCC.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de comparação automatizada e registro de evidências.
- [adrs/](adrs/README.md) — decisões sobre oráculo de emulador e fontes auxiliares de dados.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- `src/ai/emulatorParity.test.ts` fixa valores esperados escritos à mão (rota dos mapas legados, stats de inicial Lv. 5, tabela de tipos, slogans das cidades). Nenhum deles foi capturado de um emulador.
- Nenhum emulador está instalado nem há capturas de referência: a paridade visual e de fluxo ainda não foi medida (P-021, item 2 da fila do [ROADMAP](../../ROADMAP.md)).
