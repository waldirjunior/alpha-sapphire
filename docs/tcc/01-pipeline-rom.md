# Pipeline de Extração da ROM (3DS → Web)

## 1. Formato da ROM utilizada
- **Arquivo:** `Pokemon Alpha Sapphire (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2).3ds` (descriptografado, `2.0G` descompactado).
- **Por que Decrypted `.3ds`:** Permite extrair `ExeFS` e `RomFS` diretamente no Linux sem chaves de console físico (`aes_keys`) e usar a mesma ROM como oráculo no emulador (`Azahar`/`Citra`).

## 2. Passo a passo executado e reproduzível

1. **Extração de `ExeFS` e `RomFS`:**
   - `ctrtool` (`CTRTool v1.3.0`, compilado de `3dsguy/Project_CTR`) extrai `ExeFS` (`5.6M`: `banner.bin`, `code.bin`, `icon.bin`).
   - `scripts/extract_romfs.py` lê dinamicamente `NCSD → NCCH0 → IVFC → RomFS` e extrai todos os `655` arquivos (`40` diretórios, `1.872.201.296` bytes), contornando o bug do `ctrtool` em arquivos de 0 byte (`a/0/8/7`, ver `A-003`).
2. **Catalogação e desempacotamento de GARCs (`RomFS/a/`):**
   - `scripts/catalog_garcs.py` gera `docs/features/pipeline-rom/garc-catalog.json` (`299` GARCs).
   - `scripts/unpack_garc.py` desempacota containers `CRAG v4` com descompressão `LZ11`:
     - `a/0/3/9`: blocos `GR` (seção 0 = grid `40×40` de colisão/grama alta; seção 1 = `BCH` 3D).
     - `a/0/1/4`: pacotes `AD` com texturas compartilhadas de cenário (ex.: `0008.bin` para Littleroot/Route 101/Oldale).
     - `a/0/4/0`: matrizes `MM` (`0001.bin` conecta `GR 0006`, `0005`, `0004`).
     - `a/0/7/3` e `a/0/8/1`: textos em inglês (`GameText` e `StoryText`).
     - `a/0/2/1`: modelos 3D de personagens overworld (`MM\x01\x00` — ex.: `0315.bin` Brendan, `0314.bin` May).
     - `a/0/0/8`: modelos, texturas e animações 3D dos Pokémon (`8.067` entradas).
     - `a/0/1/3`: dados de zona — `0000–0535` arquivos `ZO` por zona, `0536.bin` tabela-mestre `ZoneData` (536 × `0x38`, layout `ZoneData` do pk3DS) e `0537.bin` pacote de encontros (`EN`).
3. **Tabela zona → mapa → modelo (`scripts/build_zone_catalog.py` → `src/data/zones.json`):**
   - `ZoneData.MapMatrix` (`@0x04`) → matriz `a/0/4/0`; o grid de `u16` da matriz (`EntryList`) indexa `a/0/3/9` (cada célula = um `GR` de 40×40).
   - `ZoneData.TextFile` (`@0x06`) → texto da zona em `a/0/8/1`.
   - `ZoneData.ParentMap` (`@0x1C & 0x3FF`) → nome da localização na metlist `a_0_7_3/0090`.
4. **Conversão para JSON e `.glb` (Web):**
   - `scripts/extract_gr_maps.py` gera `src/data/maps/*.json` (`collisions`, `terrain`, `warps`, `spawnPos`).
   - Continuação de 2026-11-17: [build_zone_maps.py](../../scripts/build_zone_maps.py) gera 536 mapas paralelos em `src/data/maps_v2/`, compondo GRs pelos zoneIds da MM (não por `mapArea` nem pelos retângulos sec1). Escala 18 unidades/tile, dez referências/16.000 tiles por camada sem diferenças; [maps-format.md](../features/pipeline-rom/maps-format.md), A-023/ADR-005 e P-017 distinguem layout físico, campos não comprovados e spawn derivado de spawn canônico.
   - `scripts/extract_texts.py` decodifica textos Gen 6 (`XOR 0x7C89`) para `src/data/texts/*.json`.
   - `scripts/convert_gr_to_glb.py` usa `SpicaExport` (`.NET 8` + `SPICA` sem `System.Drawing`) + `assimp` (`5.2`) para gerar `<mapa>.glb` + `.png`s em `public/assets/maps/<mapa>/` (escala ORAS `1 / 18` por tile).
   - O mesmo `SpicaExport` + `assimp` converte personagens (`a/0/2/1/0315.bin` → `public/assets/characters/brendan/brendan.glb`).
   - `scripts/extract_pokemon_glb.py` varre a tabela `FATB` de `a/0/0/8` (`PC\x02\x00` modelo + `+2` `PT\x01\x00` texturas) e gera `.glb` + `.png`s dos iniciais e Pokémon da Route 101 em `public/assets/pokemon/<especie>/`; `--all` extrai todas as espécies/formas detectando o tag `pmNNNN_NN` no blob.
   - `scripts/batch_convert_grs.py` e `scripts/batch_convert_chars.py` convertem em lote os `GR`s do catálogo e os `MM` de `a/0/2/1` para `rom/extracted/models/` (fora do Git), que depois são promovidos a `public/assets/` sob demanda.
   - GF1: `native_motions.py` e `attach_native_motions.py` anexam canais nativos
     preservando imagens, materiais, skin e o BIN-base. O catálogo do runtime usa
     a tabela do slot 0 para identificar espécie/variante, não o tag interno
     `pmNNNN_NN` (A-022). Personagens usados pelas zonas do slice e pelos MM já
     staged também recebem poses de índice 0, sem inventar novos clipes.
   - `promote_native_assets.py` publica cópias locais por SHA-256 sem sobrescrever
     os modelos anteriores; o catálogo versiona apenas URLs, fontes e metadados.
     A auditoria P-019 distingue canal inválido de escolha de expressão do atlas.
     A-042/A-043 ampliam a comparação ao BCH original: V invertido com RGBA
     inalterado explicava o rosto invertido. A promoção restaura a orientação
     inicialmente em cinco casos; A-050/A-051 ampliam para 79 GLBs/91 materiais
     comprovados entre 99 MM auditados, incluindo paletas curtas e faces estáticas.
     A prova compara RGBA/dimensões e BBox nativa por material; casos simétricos
     ficam intactos com razão por modelo. Clona UV compartilhado e não
     muda skin/clipes nem inventa pés. [CRO/paleta e A/B](../features/pipeline-rom/face-expressions.md)
     separam essa correção-base da seleção dinâmica por ator acrescentada em
     PRD-009/A-046–A-048: a promoção exporta os oito frames evidenciados sem
     mudar SHA/URLs dos GLBs; VM/projeção/engine aplicam o estado isolado por
     instância. A/B de NPC com AMX sintético confirmou0→10→0 e restauração
     idêntica por SHA; piscada automática depende de clock/condições ainda
     não comprovados, e isso não representa ramo natural ROM/emulador.
     [PRD-007](../features/engine-3d/prds/PRD-007-animacoes-nativas-no-runtime.md)
     registra comandos, falhas e limites; GLBs e screenshots continuam ignorados.
   - Áudio: `vgmstream-cli` decodifica `RomFS/sound/*.bcstm` para `.wav` e `ffmpeg` (`libmp3lame`) gera `.mp3` em `rom/extracted/audio/mp3/`.

## 3. Regra de Segurança no Repositório
Arquivos proprietários da ROM (`rom/`, `RomFS/`, `ExeFS/`, `public/assets/`, `*.3ds`, `*.cia`, `*.cxi`, `*.7z`) ficam **sempre no `.gitignore`** e nunca sobem para o GitHub. Apenas o motor, scripts de conversão, schemas, JSONs estruturais e documentação são versionados.
