"""Inspect deployment users; explicit termination requires matching live ownership."""
from __future__ import annotations

import json
import os
import select
import signal
import sys
from pathlib import Path


def inside(value: str, root: str) -> bool:
    return value == root or value.startswith(root + "/")


def app_server(arguments: list[str]) -> bool:
    values = {"-c", "--config", "--enable", "--disable", "--remote", "--remote-auth-token-env",
              "-i", "--image", "-m", "--model", "--local-provider", "-p", "--profile",
              "-s", "--sandbox", "-C", "--cd", "--add-dir", "-a", "--ask-for-approval"}
    index = 0
    while index < len(arguments):
        argument = arguments[index]
        if argument in {"--", "--help", "-h", "--version", "-V"}:
            return False
        if argument in values:
            index += 2
            continue
        if argument.startswith("-"):
            index += 1
            continue
        return argument == "app-server" and not any(
            arg in {"--help", "-h", "generate-ts", "generate-json-schema", "help"}
            for arg in arguments[index + 1:])
    return False


def inspect(deployment: str) -> list[dict]:
    root = str(Path(deployment).resolve())
    proxy = root + "/toolkit/patches/wsl-project-paths/proxy.py"
    relay = root + "/toolkit/patches/remote-fast-list/runner.cjs"
    rows = []
    for process in Path("/proc").iterdir():
        if not process.name.isdigit() or int(process.name) == os.getpid():
            continue
        try:
            args = [os.fsdecode(arg) for arg in (process / "cmdline").read_bytes().split(b"\0") if arg]
            executable = os.readlink(process / "exe").removesuffix(" (deleted)")
            cwd = os.readlink(process / "cwd")
            # A Python/Node script may have been invoked through our stable symlink.
            scripts = {index: str(Path(arg).resolve()) for index, arg in enumerate(args[:2]) if arg.startswith("/")}
            used = inside(executable, root) or inside(cwd, root) or any(root in arg for arg in args) or any(inside(script, root) for script in scripts.values())
            if not used:
                continue
            backend = (
                (inside(executable, root) and Path(executable).name == "codex" and app_server(args[1:]))
                or any(script == proxy and app_server(args[index + 1:]) for index, script in scripts.items())
                or relay in scripts.values()
            )
            rows.append({"platform": "WSL", "pid": int(process.name),
                         "name": (process / "comm").read_text().strip(),
                         "activationBlocker": backend,
                         "startToken": (process / "stat").read_text().rsplit(") ", 1)[1].split()[19]})
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            # Processes can exit during the snapshot; other users may be unreadable.
            continue
    return rows


def terminate(deployment: str, expected: list[dict]) -> list[dict]:
    stopped = []
    for record in expected:
        pid = int(record["pid"])
        try:
            # A pidfd pins the process identity across exit/PID reuse. Recheck
            # both deployment role and start token after acquiring the handle.
            fd = os.pidfd_open(pid)
        except ProcessLookupError:
            continue
        try:
            current = next((p for p in inspect(deployment) if p["pid"] == pid), None)
            if not current or not current["activationBlocker"] or current["startToken"] != record["startToken"]:
                continue
            if (Path("/proc") / str(pid)).stat().st_uid != os.getuid():
                raise PermissionError("Refusing to stop another user's backend")
            signal.pidfd_send_signal(fd, signal.SIGTERM)
            if not select.select([fd], [], [], 3)[0]:
                signal.pidfd_send_signal(fd, signal.SIGKILL)
                if not select.select([fd], [], [], 2)[0]:
                    raise RuntimeError("Backend did not exit after termination")
            stopped.append(current)
        except (ProcessLookupError, FileNotFoundError):
            pass
        finally:
            os.close(fd)
    return stopped


if __name__ == "__main__":
    if len(sys.argv) == 2:
        result = inspect(sys.argv[1])
    elif len(sys.argv) == 4 and sys.argv[2] == "--terminate":
        result = terminate(sys.argv[1], json.loads(sys.argv[3]))
    else:
        raise SystemExit("Usage: deployment-processes.py <deployment> [--terminate <process-snapshot-json>]")
    print(json.dumps(result))
