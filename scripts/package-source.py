#!/usr/bin/env python3
"""Create a deterministic AMO source archive from an exact source allowlist."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import json
import stat

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "dist" / f"sondehub-custom-locations-{MANIFEST['version']}-source.zip"

ROOT_FILES = (
    "AMO_LISTING.md",
    "AMO_SOURCE_README.md",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "PRIVACY.md",
    "PUBLISHING.md",
    "README.md",
    "SECURITY.md",
    "SUPPORT.md",
    "THIRD_PARTY_NOTICES.md",
    "manifest.json",
    "package-lock.json",
    "package.json",
)
SOURCE_DIRS = (
    "icons",
    "scripts",
    "src",
    "test",
    "third_party",
)
EXCLUDED_NAMES = {"__pycache__", ".DS_Store"}


def assert_safe_regular_file(path: Path) -> None:
    current = path
    while current != ROOT:
        mode = current.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise RuntimeError(f"Refusing source path through symlink: {current.relative_to(ROOT)}")
        if current == path and not stat.S_ISREG(mode):
            raise RuntimeError(f"Source path is not a regular file: {path.relative_to(ROOT)}")
        if current != path and not stat.S_ISDIR(mode):
            raise RuntimeError(f"Source parent is not a directory: {current.relative_to(ROOT)}")
        current = current.parent


def collect_files() -> list[Path]:
    files: list[Path] = []
    for relative in ROOT_FILES:
        path = ROOT / relative
        if not path.exists():
            raise RuntimeError(f"Missing source archive file: {relative}")
        files.append(path)

    for relative in SOURCE_DIRS:
        directory = ROOT / relative
        if not directory.is_dir():
            raise RuntimeError(f"Missing source archive directory: {relative}")
        for path in directory.rglob("*"):
            if path.is_dir():
                continue
            if any(part in EXCLUDED_NAMES for part in path.relative_to(ROOT).parts):
                continue
            files.append(path)

    unique = sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())
    for path in unique:
        assert_safe_regular_file(path)
    return unique


files = collect_files()
OUTPUT.parent.mkdir(exist_ok=True)
with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
    for path in files:
        archive_name = path.relative_to(ROOT).as_posix()
        info = ZipInfo(archive_name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)

print(f"Created {OUTPUT.relative_to(ROOT)} ({len(files)} source files).")
