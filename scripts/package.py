#!/usr/bin/env python3
"""Create a reproducible unsigned WebExtension XPI from an exact allowlist."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import json
import stat

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "dist" / f"sondehub-custom-locations-{MANIFEST['version']}.xpi"
FIXED_FILES = (
    "manifest.json",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "icons/icon.svg",
    "src/content/main-adapter.js",
    "src/content/storage-bridge.js",
    "src/options/options.css",
    "src/options/options.html",
    "src/options/options.js",
    "src/shared/icons.js",
    "src/shared/locations.js",
    "src/shared/protocol.js",
    "src/shared/storage.js",
    "third_party/heroicons/LICENSE",
)
def assert_regular_file(file: Path) -> None:
    if not file.exists():
        raise RuntimeError(f"Missing allowlisted package file: {file.relative_to(ROOT)}")
    current = file
    while current != ROOT:
        mode = current.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise RuntimeError(f"Refusing package path through symlink: {current.relative_to(ROOT)}")
        if current == file and not stat.S_ISREG(mode):
            raise RuntimeError(f"Allowlisted package path is not a regular file: {file.relative_to(ROOT)}")
        if current != file and not stat.S_ISDIR(mode):
            raise RuntimeError(f"Package parent is not a directory: {current.relative_to(ROOT)}")
        current = current.parent


files = sorted((ROOT / relative for relative in FIXED_FILES), key=lambda file: file.relative_to(ROOT).as_posix())
for file in files:
    assert_regular_file(file)

OUTPUT.parent.mkdir(exist_ok=True)
with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
    for file in files:
        archive_name = file.relative_to(ROOT).as_posix()
        info = ZipInfo(archive_name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
print(f"Created {OUTPUT.relative_to(ROOT)} ({len(files)} allowlisted files).")
