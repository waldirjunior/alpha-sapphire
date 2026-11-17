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
     - `a/0/2/1`: modelos 3D de personagens overworld (`MM\x01\x00` — ex.: `0314.bin` Brendan, `0315.bin` May).
     - `a/0/0/8`: modelos, texturas e animações 3D dos Pokémon (`8.067` entradas).
3. **Conversão para JSON e `.glb` (Web):**
   - `scripts/extract_gr_maps.py` gera `src/data/maps/*.json` (`collisions`, `terrain`, `warps`, `spawnPos`).
   - `scripts/extract_texts.py` decodifica textos Gen 6 (`XOR 0x7C89`) para `src/data/texts/*.json`.
   - `scripts/convert_gr_to_glb.py` usa `SpicaExport` (`.NET 8` + `SPICA` sem `System.Drawing`) + `assimp` (`5.2`) para gerar `<mapa>.glb` + `.png`s em `public/assets/maps/<mapa>/` (escala ORAS `1 / 18` por tile).
   - O mesmo `SpicaExport` + `assimp` converte personagens (`a/0/2/1/0314.bin` → `public/assets/characters/brendan/brendan.glb`).
   - `scripts/extract_pokemon_glb.py` varre a tabela `FATB` de `a/0/0/8` (`PC\x02\x00` modelo + `+2` `PT\x01\x00` texturas) e gera `.glb` + `.png`s dos iniciais e Pokémon da Route 101 em `public/assets/pokemon/<especie>/`.

## 3. Regra de Segurança no Repositório
Arquivos proprietários da ROM (`rom/`, `RomFS/`, `ExeFS/`, `public/assets/`, `*.3ds`, `*.cia`, `*.cxi`, `*.7z`) ficam **sempre no `.gitignore`** e nunca sobem para o GitHub. Apenas o motor, scripts de conversão, schemas, JSONs estruturais e documentação são versionados.
