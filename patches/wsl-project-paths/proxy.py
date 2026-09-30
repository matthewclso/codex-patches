#!/usr/bin/env python3
"""Narrow JSONL path adapter and stock-CLI supervisor for the WSL backend."""
from __future__ import annotations

import hashlib
import json
import os
import re
import signal
import stat
import subprocess
import sys
import threading
from pathlib import Path
from typing import BinaryIO, Sequence

PROJECT_ROOT_METHODS = frozenset({"project/create", "project/import", "project/update"})
APP_SERVER_SUBCOMMANDS = frozenset({"daemon", "generate-json-schema", "generate-ts", "help", "proxy"})
_DRIVE_ABSOLUTE = re.compile(r"^([A-Za-z]):[\\/](.*)$", re.DOTALL)
_WSL_UNC = re.compile(r"^[\\/]{2}(?:wsl\$|wsl\.localhost)[\\/]+([^\\/]+)(?:[\\/]+(.*))?$", re.IGNORECASE | re.DOTALL)


def normalize_project_path(value: str, distro: str | None, drive_mounts: dict[str, str] | None = None) -> str:
    unc = _WSL_UNC.fullmatch(value)
    if unc:
        name, suffix = unc.groups()
        if not distro or name.casefold() != distro.casefold():
            return value
        return "/" + re.sub(r"/+", "/", (suffix or "").replace("\\", "/")).lstrip("/")
    drive = _DRIVE_ABSOLUTE.fullmatch(value)
    if drive:
        letter, suffix = drive.groups()
        mount = (drive_mounts or {}).get(letter.lower())
        if mount:
            suffix = re.sub(r"/+", "/", suffix.replace("\\", "/")).lstrip("/")
            return mount.rstrip("/") + ("/" + suffix if suffix else "")
        # Ask WSL for its actual mount mapping; never assume /mnt or the C drive.
        try:
            return subprocess.run(["wslpath", "-u", value], check=True, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, timeout=5).stdout.strip()
        except (OSError, subprocess.SubprocessError):
            return value
    return value


def rewrite_request_line(raw_line: bytes, distro: str | None, drive_mounts: dict[str, str] | None = None) -> tuple[bytes, str | None, int]:
    body = raw_line.rstrip(b"\r\n")
    terminator = raw_line[len(body):]
    try:
        message = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return raw_line, None, 0
    if not isinstance(message, dict):
        return raw_line, None, 0
    method = message.get("method")
    if method not in PROJECT_ROOT_METHODS:
        return raw_line, method if isinstance(method, str) else None, 0
    params = message.get("params")
    if not isinstance(params, dict) or not isinstance(params.get("roots"), list):
        return raw_line, method, 0
    replacements = 0
    for root in params["roots"]:
        if isinstance(root, dict) and isinstance(root.get("path"), str):
            normalized = normalize_project_path(root["path"], distro, drive_mounts)
            if normalized != root["path"]:
                root["path"] = normalized
                replacements += 1
    if not replacements:
        return raw_line, method, 0
    return json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + terminator, method, replacements


def should_proxy_app_server(arguments: Sequence[str]) -> bool:
    try:
        index = arguments.index("app-server")
    except ValueError:
        return False
    tail = list(arguments[index + 1:])
    if any(arg in APP_SERVER_SUBCOMMANDS or arg in ("--help", "-h") for arg in tail):
        return False
    for index, argument in enumerate(tail):
        if argument.startswith("--listen="):
            return argument.split("=", 1)[1] == "stdio://"
        if argument == "--listen" and index + 1 < len(tail):
            return tail[index + 1] == "stdio://"
    return True


def read_config() -> tuple[Path, dict]:
    configured = os.environ.get("CODEX_PATCHES_RUNTIME_CONFIG", "")
    file = Path(configured)
    if not configured or not file.is_absolute():
        raise RuntimeError("an absolute runtime configuration is required")
    for target in (file.parent, file):
        info = target.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise RuntimeError("runtime configuration must be private to its owner")
    config = json.loads(file.read_text(encoding="utf-8"))
    if config.get("schemaVersion") != 1 or not re.fullmatch(r"[a-f0-9]{64}", config.get("cliSha256", "")):
        raise RuntimeError("unsupported runtime configuration")
    for field in ("realCli", "codexHome", "sqliteHome", "stateRoot", "node"):
        if not isinstance(config.get(field), str) or not Path(config[field]).is_absolute():
            raise RuntimeError(f"runtime {field} must be absolute")
    for field in ("relayEnabled", "rewriteProjectPaths"):
        if not isinstance(config.get(field), bool):
            raise RuntimeError(f"runtime {field} must be boolean")
    if not isinstance(config.get("distro"), str) or not config["distro"]:
        raise RuntimeError("runtime distribution is required")
    real = Path(config["realCli"]).resolve()
    override = os.environ.get("CODEX_PATCHES_REAL_CLI")
    if override and Path(override).resolve() != real:
        raise RuntimeError("stock CLI override differs from runtime configuration")
    if real == Path(__file__).resolve() or not os.access(real, os.X_OK):
        raise RuntimeError("stock CLI is not executable")
    with real.open("rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
    if digest != config["cliSha256"]:
        raise RuntimeError("stock CLI hash differs from the supported build")
    return file, config


def _copy_stream(source: BinaryIO, destination: BinaryIO) -> None:
    try:
        while chunk := os.read(source.fileno(), 65_536):
            destination.write(chunk)
            destination.flush()
    except (BrokenPipeError, OSError, ValueError):
        pass


def run_proxy(config_path: Path, config: dict, arguments: Sequence[str]) -> int:
    command = [config["realCli"], *arguments]
    if config["relayEnabled"]:
        runner = Path(__file__).resolve().parent.parent / "remote-fast-list" / "runner.cjs"
        command = [config["node"], str(runner), str(config_path), *arguments]
    env = dict(os.environ, CODEX_HOME=config["codexHome"], CODEX_SQLITE_HOME=config["sqliteHome"])
    child = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0, env=env)
    assert child.stdin and child.stdout and child.stderr
    stop_lock = threading.Lock()
    stopping = False
    timers: list[threading.Timer] = []

    def stop(signum: int) -> None:
        nonlocal stopping
        with stop_lock:
            if stopping or child.poll() is not None:
                return
            stopping = True
            child.send_signal(signum)
            timer = threading.Timer(10, lambda: child.kill() if child.poll() is None else None)
            timer.daemon = True
            timers.append(timer)
            timer.start()

    def input_worker() -> None:
        def forward(raw_line: bytes) -> None:
            if config["rewriteProjectPaths"]:
                raw_line, _, _ = rewrite_request_line(raw_line, config["distro"], config.get("driveMounts"))
            child.stdin.write(raw_line)
            child.stdin.flush()

        try:
            retained = b""
            # A daemon blocked in a BufferedReader holds its internal lock and
            # can abort Python during signal-driven interpreter shutdown. Read
            # the descriptor directly, preserving complete JSONL boundaries.
            while chunk := os.read(sys.stdin.fileno(), 65_536):
                retained += chunk
                while (newline := retained.find(b"\n")) >= 0:
                    forward(retained[:newline + 1])
                    retained = retained[newline + 1:]
            if retained:
                forward(retained)
        except (BrokenPipeError, OSError, ValueError):
            pass
        finally:
            try:
                child.stdin.close()
            except (BrokenPipeError, OSError, ValueError):
                pass
            timer = threading.Timer(10, lambda: stop(signal.SIGTERM))
            timer.daemon = True
            timers.append(timer)
            timer.start()

    workers = [threading.Thread(target=input_worker, daemon=True),
               threading.Thread(target=_copy_stream, args=(child.stdout, sys.stdout.buffer), daemon=True),
               threading.Thread(target=_copy_stream, args=(child.stderr, sys.stderr.buffer), daemon=True)]
    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, lambda signum, _: stop(signum))
    for worker in workers:
        worker.start()
    code = child.wait()
    for timer in timers:
        timer.cancel()
    workers[1].join(timeout=2)
    workers[2].join(timeout=2)
    return code if code >= 0 else 128 - code


def main(arguments: Sequence[str]) -> int:
    config_path, config = read_config()
    backend_env = dict(os.environ, CODEX_HOME=config["codexHome"], CODEX_SQLITE_HOME=config["sqliteHome"])
    if not should_proxy_app_server(arguments):
        os.execve(config["realCli"], [config["realCli"], *arguments], backend_env)
    version = subprocess.run([config["realCli"], "--version"], check=True, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, text=True, timeout=10, env=backend_env).stdout.strip()
    if version != config.get("cliVersion"):
        raise RuntimeError("stock CLI version differs from the supported build")
    if not config["relayEnabled"] and not config["rewriteProjectPaths"]:
        os.execve(config["realCli"], [config["realCli"], *arguments], backend_env)
    return run_proxy(config_path, config, arguments)


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except (OSError, RuntimeError, subprocess.SubprocessError, ValueError) as error:
        print(f"Codex patches runtime: {error}", file=sys.stderr)
        raise SystemExit(1)
