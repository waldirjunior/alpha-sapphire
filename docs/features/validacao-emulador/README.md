# Módulo: Validação contra Emulador e Automação IA (`validacao-emulador`)

Responsável por `src/ai/` e pela suíte de testes comparativos que valida o comportamento do nosso motor (`src/core/`) contra o jogo original rodando em emulador (`Azahar` / `Citra`), além de alimentar registros técnicos contínuos para o livro do TCC.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de comparação automatizada e registro de evidências.
- [adrs/](adrs/README.md) — decisões sobre oráculo de emulador e fontes auxiliares de dados.
- [setup-emulador.md](setup-emulador.md) — instalação e uso do emulador por script.
- Referência TCC: [docs/tcc/00-arquitetura.md](../../tcc/00-arquitetura.md).

## Estado atual

- `src/ai/emulatorParity.test.ts` fixa valores esperados escritos à mão (rota dos mapas legados, stats de inicial Lv. 5, tabela de tipos, slogans das cidades). Nenhum deles foi capturado de um emulador.
- Azahar 2126.2 automatizado por script: boot, filme de entrada, leitura de memória e captura de frame ([setup-emulador.md](setup-emulador.md), [PRD-002](prds/PRD-002-infraestrutura-do-oraculo.md)).
- Ainda não há save controlável, capturas de referência nem teste diferencial: a paridade visual e de fluxo continua sem medição (P-021).
