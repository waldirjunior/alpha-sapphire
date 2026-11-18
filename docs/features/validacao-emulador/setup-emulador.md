# Setup do emulador como oráculo

O Azahar roda a ROM original e responde a três perguntas que o port precisa: **como a tela fica** (captura de frame), **o que está na memória** (posição, flags) e **o que acontece com uma sequência de botões** (filme de entrada). Tudo é dirigido por script, sem teclado nem mouse.

Verificado em macOS 26 (Apple Silicon) e em Linux Ubuntu 24.04 (`x86_64`, headless via `xvfb-run` e Mesa OpenGL por software `llvmpipe`) com Azahar 2126.2.

## 1. Instalar o Azahar 2126.2

Use exatamente a 2126.2: os filmes gravam a revisão do emulador e o protocolo RPC é o dessa versão.

macOS (Apple Silicon):

```bash
mkdir -p ../_tools/azahar && cd ../_tools/azahar
curl -LO https://github.com/azahar-emu/azahar/releases/download/2126.2/azahar-macos-arm64-2126.2.zip
shasum -a 256 azahar-macos-arm64-2126.2.zip   # c24dec2bd5111b7d79513d686c5aece6612cdbf9737b2e6ea99cfc426f1d4aef
unzip -q azahar-macos-arm64-2126.2.zip && cd -
```

Linux (`x86_64`):

```bash
mkdir -p ../_tools/azahar && cd ../_tools/azahar
curl -LO https://github.com/azahar-emu/azahar/releases/download/2126.2/azahar.AppImage
sha256sum azahar.AppImage                     # af037f8b775198f636b14bcfe63fb401b02246ebfefe1025bb905ce042556960
chmod +x azahar.AppImage
```

Em Ubuntu 24.04 mínimo/headless (servidor ou container sem tela nem FUSE), instale as dependências gráficas, XCB e SquashFS:

```bash
sudo apt update && sudo apt install -y xvfb xauth mesa-vulkan-drivers libgl1-mesa-dri libegl1 libopengl0 libgl1 \
  libharfbuzz0b libfreetype6 libglib2.0-0t64 libfontconfig1 libdbus-1-3 libasound2t64 \
  libxkbcommon-x11-0 libx11-xcb1 libxcb-cursor0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
  libxcb-randr0 libxcb-render-util0 libxcb-shape0 libxcb-shm0 libxcb-sync1 libxcb-xfixes0 \
  libxcb-xinerama0 libxcb-xkb1 libsm6 libice6 squashfs-tools
```

Se não houver `/dev/fuse` (onde `./azahar.AppImage --appimage-extract` falha com código 126), extraia o sistema de arquivos diretamente do offset de fim do ELF (`944632`) dentro de `../_tools/azahar`:

```bash
unsquashfs -q -o 944632 -d squashfs-root azahar.AppImage
cd -
```

O launcher `scripts/azahar_session.py` procura automaticamente `../_tools/azahar/squashfs-root/AppRun` antes de `azahar.AppImage` (ou use `AZAHAR_APP` para apontar outro caminho, como `Azahar.app` no macOS ou o executável no Linux).

Em servidor sem tela, rode os comandos abaixo com `xvfb-run -a` e defina `ALPHA_EMULATOR_BOOT_TIMEOUT=300` para acomodar a renderização por software (`llvmpipe`):

```bash
ALPHA_EMULATOR_BOOT_TIMEOUT=300 xvfb-run -a python3 -m scripts.azahar_oracle init
ALPHA_EMULATOR_BOOT_TIMEOUT=300 xvfb-run -a python3 -m scripts.azahar_oracle check
```

## 2. Colocar o cartucho

A imagem `.3ds` (ou `.cci`) sem criptografia vai em `rom/cartridge/` do checkout principal. O diretório é ignorado pelo Git.

```bash
7z x -orom/cartridge "rom/<arquivo>.7z"     # se a imagem estiver compactada
git check-ignore -v rom/cartridge/x.3ds      # precisa mostrar a regra rom/
```

## 3. Criar o perfil isolado

```bash
python3 -m scripts.azahar_oracle init
```

Cria `rom/emulator/` com configuração, saves e logs próprios (o Azahar não toca em `~/Library` nem em `~/.config`) e liga o que o oráculo precisa: servidor RPC, relógio fixo, áudio mudo, sem busca de atualização.

## 4. Conferir

```bash
python3 -m scripts.azahar_oracle check
```

Esperado em cerca de 35 s: `Oráculo OK: jogo iniciou, memória lida e frame salvo em rom/emulator/check.png`. Abra o PNG: é um frame do vídeo de abertura (400×480, tela de cima e tela de baixo empilhadas). Uma janela do Azahar aparece e some sozinha.

## 5. Reproduzir um roteiro e capturar frames

```bash
python3 -m scripts.azahar_oracle play mash_to_name_entry --at 60,120,200 --speed 400
```

Grava `rom/emulator/frames/mash_to_name_entry-00.png` e seguintes nos instantes emulados pedidos. A 400% este Mac sustenta a velocidade (293 s emulados em 73 s). Roteiros ficam em `scripts/azahar_movies.py`.

## Como as peças funcionam

| Arquivo | Papel |
| --- | --- |
| `scripts/azahar_session.py` | Sobe o Azahar com o perfil isolado e o cartucho, espera o jogo aparecer no RPC, encerra ao sair. Uma sessão por vez. |
| `scripts/azahar_rpc.py` | Cliente UDP (porta 45987): `read`, `write`, `processes`, `screenshot_png`. |
| `scripts/azahar_movie.py` | Monta um `.ctm` a partir de passos (`press`, `hold`, `wait`, `tap`). O filme é reproduzido desde o boot. |
| `scripts/azahar_movies.py` | Roteiros conhecidos. |
| `scripts/azahar_oracle.py` | Linha de comando: `init`, `check`, `play`. |

Uso em Python:

```python
from scripts.azahar_movie import build_movie, press, wait
from scripts.azahar_session import AzaharSession, ORAS_TITLE_ID

movie = build_movie([wait(720), *press("a"), wait(36000)], ORAS_TITLE_ID, init_time=1416528000)
with AzaharSession(movie=movie, speed_percent=400) as session:
    code = session.rpc.read(0x00100000, 8)
    png = session.rpc.screenshot_png()
```

## Armadilhas já pagas (A-097, A-098)

- **Abrir o binário do pacote direto no macOS** mostra um aviso modal e o jogo nunca inicia. O launcher usa `open -n -g -a Azahar.app --args …`.
- **AppImage sem FUSE e nome de processo no Linux**: em container sem `/dev/fuse`, `--appimage-extract` falha com código 126; extraia com `unsquashfs -q -o 944632 -d squashfs-root azahar.AppImage`. O processo sobe como `AppRun.wrapped` em vez de `azahar`, então `EmulatorProcess` encerra pelo process group (`os.killpg`) e `rpc_port_in_use()` verifica conflito pela porta UDP 45987.
- **`--movie-play` não funciona na 2126.2**: o getopt da CLI de compressão captura a opção longa. Use `-p`.
- **Os diretórios XDG precisam existir antes do primeiro boot no macOS**, senão o Azahar grava em `~/Library/Application Support/Azahar`. O launcher os cria.
- **O RPC só existe com um jogo rodando** e precisa de `enable_rpc_server=true` no perfil.
- **Caminho do cartucho tem de ser absoluto.**
- **O log** (`rom/emulator/data/azahar-emu/log/azahar_log.txt`) só é gravado por inteiro quando o processo termina; a saída padrão vai para `rom/emulator/session.log`.
- **O filme acaba e o emulador volta a ler o teclado real**; por isso os roteiros terminam com uma espera longa.
- **Tempo emulado é estimado** por tempo de parede × velocidade. Entradas são exatas (estão no filme); só o instante da captura é aproximado.
- O teclado de nome é o do próprio jogo, dentro da tela de baixo: não abre diálogo do emulador.

## O que falta

A fila está em [PRD-002](prds/PRD-002-infraestrutura-do-oraculo.md): save controlável, teleporte por edição de save, as 25 capturas de referência e o teste diferencial de movimento.
