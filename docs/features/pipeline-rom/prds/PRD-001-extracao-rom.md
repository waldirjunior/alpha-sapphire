# PRD-001 — Pipeline de Extração da ROM (`3DS → RomFS → JSON/GLB`)

- **Módulo:** [pipeline-rom](../README.md)
- **Estado:** Planejado (Fase 1 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-16
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-pipeline-offline-glb-json.md), [ADR-002](../adrs/ADR-002-isolamento-proprietario-e-worktrees.md)
- **Pendências relacionadas:** `P-001`, `P-002`, `P-003`

## 1. Problema

A ROM descriptografada (`Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds`) já está disponível na VPS em `rom/`, mas seus dados internos (`RomFS`, modelos 3D `BCH`/`CGFX`, mapas, colisões, textos e tabelas) ainda não foram extraídos nem convertidos para formatos web (`.glb` e `.json`).

## 2. Objetivo

Estabelecer um pipeline reproduzível em Linux na VPS capaz de:
1. Extrair as partições `RomFS` e `ExeFS` do arquivo `.3ds` usando `ctrtool`.
2. Catalogar os diretórios de mapas, textos, tabelas e modelos 3D relevantes para o vertical slice (`Littleroot Town` e `Route 101`).
3. Converter os dados selecionados para JSON tipado e modelos `.glb` otimizados, mantendo todos os binários proprietários fora do Git.

## 3. Requisitos Funcionais

- **RF-01:** Instalação/compilação de `ctrtool` na VPS com verificação de versão e execução.
- **RF-02:** Script de extração em worktree dedicado que lê `rom/*.3ds` e gera saída em diretório ignorado pelo `.gitignore` (verificado com `git check-ignore`).
- **RF-03:** Script de inventário que mapeia arquivos da `RomFS` para um manifesto legível (sem incluir binários).
- **RF-04:** Conversão inicial de pelo menos `littleroot_town` e `route_101` (matriz de colisão, warps, metadados) para JSON validado contra o contrato de `MapDefinition`.

## 4. Requisitos Não Funcionais

- **RNF-01 (Propriedade Intelectual):** Nenhum arquivo `.3ds`, `.cxi`, `RomFS`, `ExeFS` ou asset bruto pode ser rastreado pelo Git.
- **RNF-02 (Reprodutibilidade):** Scripts devem ser idempotentes e falhar com mensagem clara caso `ctrtool` ou o `.3ds` esperado não existam.
- **RNF-03 (Testabilidade):** Parsers e validadores em TypeScript/Node devem possuir testes unitários com fixtures sintéticas (sem depender da ROM real).

## 5. Critérios de Aceite

- [ ] `ctrtool` funcional na VPS (`P-001` fechada).
- [ ] `RomFS` e `ExeFS` extraídos localmente e ignorados pelo Git (`P-002` fechada).
- [ ] Manifesto de arquivos da `RomFS` documentado.
- [ ] Scripts de conversão com validação automática de schema e `npm test && npm run build` passando.
