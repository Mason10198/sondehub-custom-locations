#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];
if (manifest.manifest_version !== 3) failures.push("manifest_version must be 3");
if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes("storage")) failures.push("storage permission is required");
if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko || !Array.isArray(manifest.browser_specific_settings.gecko.data_collection_permissions?.required) || manifest.browser_specific_settings.gecko.data_collection_permissions.required.length !== 1 || manifest.browser_specific_settings.gecko.data_collection_permissions.required[0] !== "none") failures.push("gecko data_collection_permissions.required must be [\"none\"]");
const supportedHosts = ["https://tracker.sondehub.org/*", "https://sondehub.org/*", "https://amateur.sondehub.org/*"];
if (!Array.isArray(manifest.host_permissions) || manifest.host_permissions.length !== supportedHosts.length || supportedHosts.some((host) => !manifest.host_permissions.includes(host))) failures.push("host_permissions must contain exactly the three supported SondeHub hosts");
if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 2) failures.push("exactly two content-script registrations are required");
for (const script of manifest.content_scripts || []) {
  if (!Array.isArray(script.matches) || script.matches.length !== supportedHosts.length || supportedHosts.some((host) => !script.matches.includes(host))) failures.push("each content script must match exactly the three supported SondeHub hosts");
  if (!Array.isArray(script.js) || !script.js.includes("src/shared/icons.js")) failures.push("each content script must load the shared icon catalog");
}
const files = ["src/shared/icons.js", "src/shared/locations.js", "src/shared/protocol.js", "src/shared/storage.js", "src/content/main-adapter.js", "src/content/storage-bridge.js", "src/options/options.js"];
for (const file of files) {
  try { execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file}: ${error.stderr.toString().trim()}`); }
}
for (const asset of ["THIRD_PARTY_NOTICES.md", "third_party/heroicons/LICENSE", "third_party/heroicons/optimized/24/outline/map-pin.svg"]) {
  if (!fs.existsSync(path.join(root, asset))) failures.push(`missing packaged third-party asset: ${asset}`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Validated MV3 manifest and ${files.length} JavaScript files.`);
