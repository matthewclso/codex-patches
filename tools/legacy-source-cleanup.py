"""Inspect only source checkouts declared by recognized historical manifests."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat


def no_links(path):
    path = Path(path)
    for part in [*reversed(path.parents), path]:
        try:
            info = part.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("Historical source paths cannot contain links")


def in_use(root):
    proc = Path("/proc")
    if not proc.is_dir():
        return False
    prefix = str(root) + "/"
    for process in proc.iterdir():
        if not process.name.isdigit() or int(process.name) == os.getpid():
            continue
        try:
            arguments = (process / "cmdline").read_bytes().split(b"\0")
            paths = [x.decode(errors="replace") for x in arguments]
            paths += [os.readlink(process / "exe"), os.readlink(process / "cwd")]
            if any(x == str(root) or x.startswith(prefix) for x in paths):
                return True
        except (PermissionError, FileNotFoundError, ProcessLookupError):
            continue
    return False


def inspect(home, references):
    home = Path(home)
    if not home.is_absolute():
        raise ValueError("Linux home must be absolute")
    root = home / ".local/share/codex-wsl-patch-src"
    no_links(root)
    records = []
    seen = set()
    for reference in references:
        version = reference.get("version", "")
        if not re.fullmatch(r"\d+\.\d+\.\d+(?:[-.][A-Za-z0-9]+)*", version):
            raise ValueError("Unrecognized historical source version")
        directory = root / version
        if reference.get("repository") != "https://github.com/openai/codex.git" or \
                reference.get("localPath") != str(directory / "codex") or \
                reference.get("buildScript") != str(directory / "build.sh"):
            raise ValueError("Historical source declaration is outside the recognized layout")
        if version in seen:
            raise ValueError("Duplicate historical source declaration")
        seen.add(version)
        no_links(directory)
        record = {"version": version, "path": str(directory), "status": "absent"}
        if directory.exists():
            if not directory.is_dir():
                raise ValueError("Historical source version is not a directory")
            markers = [directory / "build.sh", directory / "codex/codex-rs/Cargo.toml"]
            if not all(p.is_file() for p in markers):
                raise ValueError("Historical source checkout markers are absent")
            entries = []
            pending = [directory]
            while pending:
                current = pending.pop()
                for path in current.iterdir():
                    info = path.lstat()
                    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                        raise ValueError("Historical source checkout contains links")
                    if hasattr(os, "getuid") and info.st_uid != os.getuid():
                        raise ValueError("Historical source checkout ownership changed")
                    if stat.S_ISDIR(info.st_mode):
                        pending.append(path)
                    elif not stat.S_ISREG(info.st_mode):
                        raise ValueError("Historical source checkout contains special files")
                    entries.append([str(path.relative_to(directory)), info.st_size, info.st_mtime_ns])
            if hasattr(os, "getuid") and directory.stat().st_uid != os.getuid():
                raise ValueError("Historical source checkout ownership changed")
            if in_use(directory):
                raise ValueError("Historical source checkout is still in use")
            encoded = json.dumps(sorted(entries), separators=(",", ":")).encode()
            record.update(status="removable", entryCount=len(entries),
                          inventorySha256=hashlib.sha256(encoded).hexdigest())
        records.append(record)
    return records


def remove(home, references, expected, archive):
    current = inspect(home, references)
    if current != expected:
        raise ValueError("Historical source inventory changed; no removal performed")
    archive = Path(archive)
    if not archive.is_absolute():
        raise ValueError("Source audit archive must be absolute")
    no_links(archive)
    if not archive.is_dir():
        raise ValueError("Private audit archive must already exist")
    # The enclosing Windows cleanup creates this directory with private ACLs.
    record_path = archive / "source-cleanup.json"
    with record_path.open("x", encoding="utf8") as saved:
        json.dump({"references": references, "inventory": current}, saved, indent=2)
        saved.write("\n")
    os.chmod(record_path, 0o600)
    for record in current:
        if record["status"] == "removable":
            shutil.rmtree(record["path"])
    root = Path(home) / ".local/share/codex-wsl-patch-src"
    if current and root.is_dir():
        try:
            root.rmdir()
        except OSError:
            pass  # Unreferenced siblings stay in place.
    return {"removedCount": sum(r["status"] == "removable" for r in current),
            "absentCount": sum(r["status"] == "absent" for r in current)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["plan", "remove"])
    parser.add_argument("--home", required=True)
    parser.add_argument("--references", required=True)
    parser.add_argument("--expected")
    parser.add_argument("--archive")
    args = parser.parse_args()
    references = json.loads(args.references)
    if args.mode == "plan":
        result = inspect(args.home, references)
    else:
        if args.expected is None or args.archive is None:
            parser.error("remove requires --expected and --archive")
        result = remove(args.home, references, json.loads(args.expected), args.archive)
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error))
