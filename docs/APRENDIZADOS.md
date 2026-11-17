# Aprendizados

Erros, restrições reais e regras operacionais descobertas durante o projeto. Um item novo entra no fim com o próximo número (`A-NNN`). Nunca apague nem reescreva um aprendizado antigo; se a regra mudar, acrescente um novo item apontando para o anterior.

## A-001 ROM proprietária fica exclusivamente em `rom/` e fora do Git

- **Data:** 2026-11-16
- **Contexto:** Transferência do arquivo `.7z` (`1.1G`) e extração do `.3ds` (`2.0G`) para `/opt/orca-pilot/projetos/externo/alpha-sapphire/rom/`.
- **Erro potencial:** Commitar arquivos da ROM, `RomFS/`, `ExeFS/` ou assets binários proprietários no repositório Git.
- **Regra:** Verificar sempre com `git check-ignore -v <caminho>` antes de gerar novos outputs de extração. Somente código, schemas, scripts e documentação são versionados ([pipeline-rom/ADR-002](features/pipeline-rom/adrs/ADR-002-isolamento-proprietario-e-worktrees.md)).

## A-002 `src/core/` não pode depender de Three.js nem de APIs de DOM

- **Data:** 2026-11-16
- **Contexto:** Arquitetura definida em [tcc/00-arquitetura.md](tcc/00-arquitetura.md) e implementada em [src/core/gameState.ts](../src/core/gameState.ts).
- **Erro potencial:** Importar `three`, `window` ou `document` dentro de `src/core/`, acoplando a regra de jogo ao navegador e impedindo testes rápidos em Node e reuso em servidor multiplayer.
- **Regra:** Toda lógica de estado, colisão, warps, batalha e flags permanece pura em `src/core/` com testes unitários em Vitest usando fixtures sintéticas ([core-jogo/ADR-001](features/core-jogo/adrs/ADR-001-separacao-core-engine.md)).

## A-003 `ctrtool` v1.3.0 aborta extração da `RomFS` em arquivos de 0 byte

- **Data:** 2026-11-16
- **Contexto:** Extração de `RomFS` de `Pokemon Alpha Sapphire (USA) ... (Rev 2).3ds` com `ctrtool --romfsdir`.
- **Erro:** `ctrtool` v1.3.0 interrompe após 234 arquivos com `[tc::io::VirtualFileSystem::openFile() ERROR] File does not exist.` ao encontrar o arquivo vazio `a/0/8/7` (0 bytes).
- **Regra:** Usar [scripts/extract_romfs.py](../scripts/extract_romfs.py) para extração completa da `RomFS` (`655` arquivos, `40` diretórios) e manter `ctrtool` para inspeção de headers NCSD/NCCH e extração da `ExeFS`.

## A-004 Texturas de cenário ficam em `a/0/1/4` (`AD`) e `.NET 8` Linux não suporta `System.Drawing.Common`

- **Data:** 2026-11-16
- **Contexto:** Conversão de `GR` (`a/0/3/9`) via `SPICA` para `.dae`/`.glb` no Debian 12.
- **Erro:** `GR` sozinho gera malha sem texturas (`Textures=0`), e `DAE.Save()` falha em Linux `.NET 8` com `System.PlatformNotSupportedException` ao chamar `System.Drawing.Bitmap`.
- **Regra:** Mesclar as texturas de área (`a/0/1/4`, ex.: `0008.bin` para Hoenn inicial) via `SpicaExport`, exportar PNGs diretamente de `H3DTexture.ToRGBA()` com `ZLibStream` no `DAE.cs` e copiar os `.png`s junto ao `.glb` em `public/assets/maps/<mapa>/`.

## A-006 Peças trocáveis (`sw_parts01..05`) nos modelos de personagens e fidelidade de UI/portas

- **Data:** 2026-11-17
- **Contexto:** Inspeção visual em `brendan.glb`/`may.glb` (`a/0/2/1`) e feedback do usuário sobre portas dos prédios e menus estilo 3DS (`P-011`).
- **Erro:** Exportar todas as malhas `sw_parts01..05` ao mesmo tempo empilha chapéus/cabelos/acessórios alternativos na cabeça do personagem. Além disso, colocar warps atrás de bloqueios (`collisions === 1`) impede entrar pelas portas visuais, e menus genéricos não atendem ao critério de fidelidade de interface do 3DS.
- **Regra:** Filtrar `sw_parts02..05` na conversão de personagens em [convert_character_glb.py](../scripts/convert_character_glb.py) (mantendo apenas a peça padrão `sw_parts01`), abrir `collisions[z][x] = 0` exatamente nos tiles das portas visuais dos prédios, e só fechar `PRD`/`P-NNN` após validar fidelidade visual com o jogo original.
