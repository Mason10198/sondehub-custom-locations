#!/usr/bin/env python3
"""Build twice and independently verify the exact XPI allowlist."""

from hashlib import sha256
from pathlib import Path
from subprocess import run
from zipfile import ZIP_DEFLATED, ZipFile
import json
import stat
import sys

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "dist" / f"sondehub-custom-locations-{MANIFEST['version']}.xpi"
PACKAGE_SCRIPT = ROOT / "scripts" / "package.py"
VENDOR_SCRIPT = ROOT / "scripts" / "verify-vendored-assets.js"
FIXED_NAMES = {
    "manifest.json",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "icons/icon.svg",
    "src/content/map-overlay-host.js",
    "src/options/options.css",
    "src/options/options.html",
    "src/options/options.js",
    "src/shared/icons.js",
    "src/shared/locations.js",
    "src/shared/storage.js",
    "third_party/heroicons/LICENSE",
}
EXPECTED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
EXPECTED_MODE = stat.S_IFREG | 0o644


def build_digest():
    run([sys.executable, str(PACKAGE_SCRIPT)], cwd=ROOT, check=True)
    return sha256(OUTPUT.read_bytes()).hexdigest()


run(["node", str(VENDOR_SCRIPT)], cwd=ROOT, check=True)
approved = FIXED_NAMES
OUTPUT.unlink(missing_ok=True)
first = build_digest()
second = build_digest()
if first != second:
    raise RuntimeError(f"Package is not reproducible in this environment: {first} != {second}")

with ZipFile(OUTPUT) as archive:
    infos = archive.infolist()
    names = [info.filename for info in infos]
    if archive.testzip() is not None:
        raise RuntimeError("XPI ZIP integrity check failed")
    if len(names) != len(set(names)):
        raise RuntimeError("XPI contains duplicate archive paths")
    actual = set(names)
    missing = sorted(approved - actual)
    unexpected = sorted(actual - approved)
    if missing or unexpected:
        details = []
        if missing:
            details.append(f"missing allowlisted paths: {', '.join(missing[:10])}")
        if unexpected:
            details.append(f"unexpected paths: {', '.join(unexpected[:10])}")
        raise RuntimeError("XPI does not match the exact runtime allowlist: " + "; ".join(details))
    for info in infos:
        if info.date_time != EXPECTED_TIMESTAMP:
            raise RuntimeError(f"Non-deterministic timestamp for {info.filename}: {info.date_time}")
        if info.compress_type != ZIP_DEFLATED:
            raise RuntimeError(f"Unexpected compression method for {info.filename}")
        if (info.external_attr >> 16) != EXPECTED_MODE:
            raise RuntimeError(f"Unexpected file mode for {info.filename}: {(info.external_attr >> 16):o}")
        source = ROOT / info.filename
        if archive.read(info) != source.read_bytes():
            raise RuntimeError(f"Packaged bytes differ from source: {info.filename}")

print(f"Verified exact {len(approved)}-file runtime allowlist and reproducible XPI: {OUTPUT.relative_to(ROOT)}")
print(f"SHA-256: {second}")
