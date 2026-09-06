from __future__ import annotations

import argparse
import stat
import zipfile
from pathlib import Path


def package(source: Path, destination: Path) -> None:
    source = source.resolve()
    if not (source / "index.html").is_file():
        raise SystemExit("source root must contain index.html")
    files = sorted(path for path in source.rglob("*") if path.is_file())
    for path in files:
        if path.is_symlink():
            raise SystemExit(f"symbolic links are not allowed: {path}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            info = zipfile.ZipInfo(path.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    with zipfile.ZipFile(destination) as archive:
        if "index.html" not in archive.namelist():
            raise SystemExit("zip root must contain index.html")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    package(args.source, args.destination)
