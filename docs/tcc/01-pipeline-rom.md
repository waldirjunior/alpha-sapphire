# Pipeline de Extração da ROM (3DS -> Web)

## 1. Melhor formato da ROM para baixar/extrair
- **Melhor opção:** `.3ds` **descriptografado (Decrypted)** ou `.cci` descriptografado.
- **Segunda opção:** `.cia` descriptografado (precisa extrair o conteúdo com `ctrtool`).
- **Evitar se possível:** `.3ds` criptografado sem chaves (`aes_keys`), pois exige dump de chaves de um 3DS físico ou descriptografia prévia.

## 2. O que já existe pronto na comunidade (Open Source)
- **Modelos 3D, Texturas e Animações:**
  - `SPICA` ou `Ohana3DS Rebirth`: leem os arquivos `BCH`/`CGFX` de Pokémon 3DS e exportam para `.dae` (Collada) / `.smd` / `.png`.
  - `Blender` + `gltf-transform`: convertem `.dae` em `.glb` comprimido (Draco/WebP) para web.
- **Dados, Textos e Tabelas do Jogo:**
  - `pk3DS`: ferramenta open-source específica para X/Y e ORAS que lê a `RomFS` extraída e expõe textos da história, encontros selvagens, golpes, status, treinadores e mapas.
- **Extração de Container 3DS no Linux:**
  - `ctrtool` (ProjectCTR): extrai `RomFS` e `ExeFS` de arquivos `.3ds`/`.cia`/`.cxi` diretamente na VPS Linux.

## 3. Regra de Segurança no Repositório
Arquivos proprietários da ROM (`rom/`, `RomFS/`, `*.3ds`, `*.cia`, `*.cxi`) ficam **sempre no `.gitignore`** e nunca sobem para o GitHub. Apenas o motor, scripts de conversão e metadados estruturados do projeto são versionados.
