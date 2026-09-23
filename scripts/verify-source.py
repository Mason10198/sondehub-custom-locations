#!/usr/bin/env python3
"""Verify the deterministic AMO source archive and reproduce the unsigned XPI."""

from hashlib import sha256
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile
import json
import stat
import sys

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
VERSION = MANIFEST["version"]
OUTPUT = ROOT / "dist" / f"sondehub-custom-locations-{VERSION}-source.zip"
XPI = ROOT / "dist" / f"sondehub-custom-locations-{VERSION}.xpi"
PACKAGE_SCRIPT = ROOT / "scripts" / "package-source.py"
EXPECTED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
EXPECTED_MODE = stat.S_IFREG | 0o644
REQUIRED_NAMES = {
    "AMO_SOURCE_README.md",
    "LICENSE",
    "PRIVACY.md",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "manifest.json",
    "package-lock.json",
    "package.json",
    "scripts/generate-icon-catalog.js",
    "scripts/package.py",
    "scripts/package-source.py",
    "scripts/verify-package.py",
    "scripts/verify-source.py",
    "scripts/verify-vendored-assets.js",
    "src/shared/icons.js",
    "third_party/heroicons/LICENSE",
}
FORBIDDEN_PARTS = {".git", ".github", "dist", "node_modules", "__pycache__"}


def build_digest() -> str:
    run([sys.executable, str(PACKAGE_SCRIPT)], cwd=ROOT, check=True)
    return sha256(OUTPUT.read_bytes()).hexdigest()


OUTPUT.unlink(missing_ok=True)
first = build_digest()
second = build_digest()
if first != second:
    raise RuntimeError(f"Source archive is not reproducible: {first} != {second}")

with ZipFile(OUTPUT) as archive:
    infos = archive.infolist()
    names = [info.filename for info in infos]
    if archive.testzip() is not None:
        raise RuntimeError("Source ZIP integrity check failed")
    if len(names) != len(set(names)):
        raise RuntimeError("Source ZIP contains duplicate paths")
    missing = sorted(REQUIRED_NAMES - set(names))
    if missing:
        raise RuntimeError(f"Source ZIP is missing required paths: {', '.join(missing)}")
    for name in names:
        if Path(name).is_absolute() or ".." in Path(name).parts:
            raise RuntimeError(f"Unsafe source archive path: {name}")
        if FORBIDDEN_PARTS.intersection(Path(name).parts):
            raise RuntimeError(f"Forbidden source archive path: {name}")
    heroicons = [name for name in names if name.startswith("third_party/heroicons/optimized/16/solid/") and name.endswith(".svg")]
    if len(heroicons) != 316:
        raise RuntimeError(f"Expected 316 vendored Heroicons SVGs, found {len(heroicons)}")
    for info in infos:
        if info.date_time != EXPECTED_TIMESTAMP:
            raise RuntimeError(f"Non-deterministic timestamp for {info.filename}")
        if info.compress_type != ZIP_DEFLATED:
            raise RuntimeError(f"Unexpected compression for {info.filename}")
        if (info.external_attr >> 16) != EXPECTED_MODE:
            raise RuntimeError(f"Unexpected mode for {info.filename}")
        source = ROOT / info.filename
        if archive.read(info) != source.read_bytes():
            raise RuntimeError(f"Archived source differs from working tree: {info.filename}")

    with TemporaryDirectory(prefix="sondehub-amo-source-") as temporary:
        extracted = Path(temporary)
        archive.extractall(extracted)
        run(["npm", "ci", "--ignore-scripts"], cwd=extracted, check=True)
        run(["npm", "run", "verify:vendor"], cwd=extracted, check=True)
        run(["npm", "run", "generate:icons"], cwd=extracted, check=True)
        run(["npm", "test"], cwd=extracted, check=True)
        run(["npm", "run", "lint"], cwd=extracted, check=True)
        run(["npm", "run", "package"], cwd=extracted, check=True)
        rebuilt = extracted / "dist" / XPI.name
        if not XPI.exists():
            run([sys.executable, str(ROOT / "scripts" / "package.py")], cwd=ROOT, check=True)
        if rebuilt.read_bytes() != XPI.read_bytes():
            raise RuntimeError("XPI rebuilt from the AMO source archive differs from the release XPI")

print(f"Verified deterministic AMO source archive: {OUTPUT.relative_to(ROOT)}")
print(f"Source SHA-256: {second}")
print(f"Reproduced byte-identical unsigned XPI: {XPI.relative_to(ROOT)}")
