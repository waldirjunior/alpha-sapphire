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

## A-007 O AD de texturas varia por mapa, e as GRs de interiores não estão nos 30 arquivos extraídos

- **Data:** 2026-11-17
- **Contexto:** `P-007` (placas brancas) e busca por GRs de interiores. Complementa `A-004`.
- **Erro:** (1) Converter qualquer `GR` com um único `--textures` fixo ou sem AD deixa os materiais sem imagem (`references missing texture ...` em `*.dae.warnings.txt`) e o glTF renderiza placas brancas. O AD correto muda por mapa (Littleroot usa `a/0/1/4/0008.bin`, que contém `t101_01`, `chip_wind` etc.). (2) `rom/extracted/garc/a_0_3_9` só tem 30 dos 857 `GR` de `RomFS/a/0/3/9`; todos têm seção 0 de 40x40, então o tamanho do grid não distingue interior de exterior. Falta a tabela zona→`GR` para identificar casa do jogador, laboratório, Centro Pokémon e Mart.
- **Regra:** Use `scripts/convert_gr_to_glb.py --ad-dir <a_0_1_4>`: o script converte uma vez sem texturas, lê os avisos de textura ausente e escolhe o AD que cobre mais nomes. Não associe um índice de `GR` a um interior sem evidência da tabela de zonas; arquivos `*.bin` extraídos com `unpack_garc.py --decompress` ficam em diretório temporário até a identificação.

## A-008 Tabela zona→matriz→GR está em `a/0/1/3` (ZoneData/metlist) e o macOS roda o pipeline

- **Data:** 2026-11-17
- **Contexto:** Necessidade de mapear todas as 536 zonas de Hoenn para seus `GR`s (`A-007`) e portar o pipeline Linux/VPS para macOS arm64.
- **Erro potencial:** Chutar `GR` por índice de zona ou nome (o índice do ZO **não** é o índice do nome); assumir que ferramentas compiladas na VPS funcionam no Mac; Blender ≥ 4 removeu `bpy.ops.wm.collada_import`.
- **Regra:**
  - `a/0/1/3`: entradas `0000–0535` = arquivos `ZO` por zona; `0536.bin` = tabela-mestre `ZoneData` (536 registros × `0x38` bytes, layout igual ao `sec0` de cada ZO — referência: `ZoneData` do pk3DS); `0537.bin` = pacote de encontros (`EN`).
  - `ZoneData`: `MapMatrix` `@0x04` → matriz em `a/0/4/0` cujo grid de `u16` (`EntryList`) indexa direto `a/0/3/9`; `TextFile` `@0x06` → `a/0/8/1`; `ParentMap` `@0x1C & 0x3FF` → metlist `a_0_7_3/0090` (índice 170 = `Littleroot Town`).
  - `scripts/build_zone_catalog.py` gera `src/data/zones.json` com zona → {nome, mapArea, mapMatrix, grIds, textFile}. Interiores são zonas próprias (ex.: zona 223 = casa do jogador → `GR 506`, confirmando a identificação anterior).
  - Ferramentas no Mac: `.NET 8` em `~/.dotnet` (`dotnet-install.sh`, sem sudo — casks exigem `sudo`), Blender **3.4.1** em `~/Applications/Blender3.4.app` (wrapper `_tools/bin/blender`), `SpicaExport` via wrapper `_tools/bin/SpicaExport` (apphost exige `DOTNET_ROOT`), `assimp`/`7z`/`vgmstream` via Homebrew. Scripts aceitam `SPICA_EXPORT` por env var.
  - `ffmpeg` do Homebrew não tem `libvorbis`: usar `libmp3lame` para `.mp3` (ou `aac`). `vgmstream-cli` decodifica `.bcstm` direto.

## A-009 Conteúdo interno do ZO e formato de encontros ORAS (`BBH`, não `HBB`)

- **Data:** 2026-11-17
- **Contexto:** Extração de warps/entidades/encontros por zona ([scripts/extract_zones.py](../scripts/extract_zones.py) → `src/data/zones/*.json`), seguindo `OWSEStructs.cs` do pk3DS.
- **Erro potencial:** Ler entradas de encontro como `<HBB` (specform, lvlMin, lvlMax — layout XY/pk3DS) gera espécies absurdas (ex.: 514 na Route 101).
- **Regra:**
  - `ZO sec1` = `ZoneEntities`: header `u32 length` + `u8` counts (furniture, npcs, warps, triggers1) + `u32` triggers2; depois `EntityFurniture` (0x14), `EntityNPC` (0x30), `EntityWarp` (0x18), `EntityTrigger` (0x18 ×2 grupos) e um blob de script ao final. `EntityWarp.destinationMap` indexa o `ZO`/zona de destino (ex.: zona 6 → interiores 223/225/227).
  - `ZO sec3` = tabela de encontros da zona, **idêntica** ao blob correspondente em `a/0/1/3/0537.bin` (`EN` + 536 ponteiros `u32`).
  - Entrada de encontro ORAS = `<BBH`: `levelMin u8`, `levelMax u8`, `specForm u16` (espécie `&0x7FF`, forma `>>11`). Slots zerados (`species=0`) separam sub-tabelas (grama, surf, pesca etc.) — o particionamento exato por tipo segue a refinar no uso.
  - NPC: `model` = índice em `a/0/2/1`, `script` = índice de script da zona, `sightRange`/`faceDirection`/`degrees` (÷18) permitem linha de visão estilo ORAS.
