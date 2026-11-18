"""Sobe o Azahar com um perfil isolado em rom/emulator/ e espera o servidor RPC responder."""

from __future__ import annotations

import os
import re
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

from scripts.azahar_rpc import PORT as RPC_PORT
from scripts.azahar_rpc import AzaharRpc, RpcError

ROOT = Path(__file__).resolve().parents[1]
ORAS_TITLE_ID = 0x000400000011C500

# Chave do qt-config.ini → valor que o oráculo exige. Relógio fixo torna boot e RNG reproduzíveis.
PROFILE_SETTINGS: dict[tuple[str, str], str] = {
    ("Debugging", "enable_rpc_server"): "true",
    ("Miscellaneous", "check_for_update_on_start"): "false",
    ("UI", "confirmClose"): "false",
    ("UI", "firstStart"): "false",
    ("UI", "pauseWhenInBackground"): "false",
    ("Audio", "volume"): "0",
    ("System", "init_clock"): "1",
    ("System", "init_time"): "1416528000",
    ("Renderer", "use_vsync"): "false",
}


def main_checkout() -> Path:
    """Worktrees compartilham o .git do checkout principal; é nele que ficam rom/ e as ferramentas."""
    common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                            cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()
    return Path(common).parent


def emulator_home() -> Path:
    return Path(os.environ.get("ALPHA_EMULATOR_HOME", main_checkout() / "rom" / "emulator"))


def azahar_app() -> Path:
    """Pacote Azahar.app no macOS; AppRun extraído ou AppImage nas demais plataformas."""
    tools = main_checkout().parent / "_tools" / "azahar"
    candidates = ([tools / "azahar-macos-arm64-2126.2" / "Azahar.app"] if sys.platform == "darwin"
                  else [tools / "squashfs-root" / "AppRun", tools / "azahar.AppImage"])
    env_app = os.environ.get("AZAHAR_APP")
    app = Path(env_app) if env_app else next((path for path in candidates if path.exists()), candidates[-1])
    if not app.exists():
        raise FileNotFoundError(f"Azahar não encontrado em {app}; instale-o ou aponte AZAHAR_APP (docs/features/validacao-emulador/setup-emulador.md)")
    return app


def cartridge_path() -> Path:
    folder = main_checkout() / "rom" / "cartridge"
    found = sorted(path for path in folder.glob("*") if path.suffix.lower() in (".3ds", ".cci"))
    if not found:
        raise FileNotFoundError(f"Imagem .3ds/.cci não encontrada em {folder}; extraia o arquivo local da ROM para lá")
    return found[0]


def apply_settings(ini: str, settings: dict[tuple[str, str], str]) -> str:
    """Define chaves de um qt-config.ini, marcando cada uma como não padrão para o Qt respeitá-la."""
    wanted = {section: {key: value for (owner, key), value in settings.items() if owner == section}
              for section, _key in settings}
    lines: list[str] = []
    section = ""
    for line in ini.splitlines():
        header = re.fullmatch(r"\[(.+)\]", line)
        if header:
            section = header.group(1)
            lines.append(line)
            # O Azahar só grava parte das chaves no primeiro boot; as do perfil entram logo após o cabeçalho.
            for key, value in wanted.pop(section, {}).items():
                lines += [f"{key}={value}", f"{key}\\default=false"]
            continue
        key = line.split("=", 1)[0].removesuffix("\\default")
        if (section, key) not in settings:
            lines.append(line)
    if wanted:
        raise KeyError(f"Seções ausentes no qt-config.ini: {sorted(wanted)}; gere o arquivo abrindo o Azahar uma vez")
    return "\n".join(lines) + "\n"


def profile_env(home: Path) -> dict[str, str]:
    # No macOS o Azahar só usa os diretórios XDG se eles já existirem; senão grava em ~/Library.
    for name in ("data", "config", "cache"):
        (home / name / "azahar-emu").mkdir(parents=True, exist_ok=True)
    return {"XDG_DATA_HOME": str(home / "data"), "XDG_CONFIG_HOME": str(home / "config"),
            "XDG_CACHE_HOME": str(home / "cache")}


def launch_command(app: Path, home: Path, args: list[str]) -> list[str]:
    """Executar o binário do pacote direto abre um aviso modal que trava o boot; pelo `open` ele sobe limpo."""
    env = [part for name, value in profile_env(home).items() for part in ("--env", f"{name}={value}")]
    log = str(home / "session.log")
    return ["open", "-n", "-g", "-a", str(app), *env, "--stdout", log, "--stderr", log, "--args", *args]


class EmulatorProcess:
    """Emulador lançado por esta sessão, com o jeito certo de encerrá-lo em cada plataforma."""

    def __init__(self, child: subprocess.Popen[bytes] | None):
        # No macOS o processo nasce do `open`, sem filho direto; nas demais plataformas é líder de um grupo próprio.
        self._child = child

    def _signal(self, signum: int) -> None:
        if self._child is None:
            subprocess.run(["pkill", f"-{signum}", "-x", "azahar"], check=False)
        elif self._child.poll() is None:
            os.killpg(self._child.pid, signum)

    def _alive(self) -> bool:
        if self._child is None:
            return subprocess.run(["pgrep", "-x", "azahar"], capture_output=True).returncode == 0
        return self._child.poll() is None

    def stop(self, grace_seconds: float = 10.0) -> None:
        self._signal(signal.SIGTERM)
        deadline = time.monotonic() + grace_seconds
        while self._alive() and time.monotonic() < deadline:
            time.sleep(0.2)
        if self._alive():
            self._signal(signal.SIGKILL)


def launch(app: Path, home: Path, args: list[str]) -> EmulatorProcess:
    if sys.platform == "darwin":
        subprocess.run(launch_command(app, home, args), check=True)
        return EmulatorProcess(None)
    with open(home / "session.log", "w") as log:
        child = subprocess.Popen([str(app), *args], cwd=home, env={**os.environ, **profile_env(home)},
                                 stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    return EmulatorProcess(child)


def rpc_port_in_use() -> bool:
    """O RPC usa porta fixa: se ela está ocupada, já existe um jogo rodando em outro Azahar."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.bind(("0.0.0.0", RPC_PORT))
        return False
    except OSError:
        return True
    finally:
        probe.close()


def config_path(home: Path) -> Path:
    return home / "config" / "azahar-emu" / "qt-config.ini"


def generate_profile(home: Path, timeout: float = 60.0) -> Path:
    """Abre o Azahar sem jogo só para ele gravar o qt-config.ini padrão dentro do perfil isolado."""
    config = config_path(home)
    if not config.is_file():
        emulator = launch(azahar_app(), home, [])
        deadline = time.monotonic() + timeout
        while not config.is_file() and time.monotonic() < deadline:
            time.sleep(0.5)
        time.sleep(2)
        emulator.stop()
    if not config.is_file():
        raise RuntimeError(f"Azahar não gravou {config} em {timeout:.0f}s; veja {home / 'session.log'}")
    return config


def configure_profile(home: Path, extra: dict[tuple[str, str], str] | None = None) -> None:
    config = config_path(home)
    if not config.is_file():
        raise FileNotFoundError(f"{config} não existe; rode `python3 -m scripts.azahar_oracle init`")
    config.write_text(apply_settings(config.read_text(), {**PROFILE_SETTINGS, **(extra or {})}))


def save_path(home: Path) -> Path:
    zeros = "0" * 32
    return (home / "data" / "azahar-emu" / "sdmc" / "Nintendo 3DS" / zeros / zeros / "title" / "00040000" / "0011c500"
            / "data" / "00000001" / "main")


class AzaharSession:
    """Processo do emulador rodando o cartucho, com RPC já apontado para o processo do jogo."""

    def __init__(self, movie: bytes | None = None, speed_percent: int = 100, boot_timeout: float | None = None):
        self.home = emulator_home()
        if rpc_port_in_use():
            raise RuntimeError(f"Porta RPC {RPC_PORT} ocupada: já existe um Azahar com jogo rodando; encerre-o antes")
        profile_env(self.home)
        configure_profile(self.home, {("Renderer", "frame_limit"): str(speed_percent)})
        self._emulator = launch(azahar_app(), self.home, [*self._movie_args(movie), str(cartridge_path())])
        self.rpc = AzaharRpc()
        # Renderização por software em servidor sem GPU demora bem mais para chegar ao primeiro frame.
        self._attach(boot_timeout or float(os.environ.get("ALPHA_EMULATOR_BOOT_TIMEOUT", "90")))

    def _movie_args(self, movie: bytes | None) -> list[str]:
        if movie is None:
            return []
        path = self.home / "session.ctm"
        path.write_bytes(movie)
        # A forma longa `--movie-play` é capturada por engano pelo getopt da CLI de compressão do Azahar 2126.2.
        return ["-p", str(path)]

    def _attach(self, timeout: float) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                game = [pid for pid, (title, _name) in self.rpc.processes().items() if title == ORAS_TITLE_ID]
            except RpcError:
                game = []
            if game:
                self.rpc.select_process(game[0])
                return
            time.sleep(0.5)
        self.close()
        raise TimeoutError(f"Jogo não apareceu no RPC do Azahar em {timeout:.0f}s; veja {self.home / 'session.log'}")

    def close(self) -> None:
        self.rpc.close()
        self._emulator.stop()

    def __enter__(self) -> "AzaharSession":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()
