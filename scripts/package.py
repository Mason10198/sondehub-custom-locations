#!/usr/bin/env python3
"""Create a reproducible unsigned WebExtension XPI without dependencies."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "dist" / "sondehub-custom-locations-1.0.0.xpi"
INCLUDE = (ROOT / "manifest.json", ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md", ROOT / "icons", ROOT / "src", ROOT / "third_party")

files = []
for entry in INCLUDE:
    files.extend([entry] if entry.is_file() else entry.rglob("*"))
files = sorted((file for file in files if file.is_file()), key=lambda file: file.relative_to(ROOT).as_posix())
OUTPUT.parent.mkdir(exist_ok=True)
with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as archive:
    for file in files:
        archive_name = file.relative_to(ROOT).as_posix()
        info = ZipInfo(archive_name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
print(f"Created {OUTPUT.relative_to(ROOT)} ({len(files)} files).")
