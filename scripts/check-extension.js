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
for (const host of ["https://tracker.sondehub.org/*", "https://sondehub.org/*"]) if (!manifest.host_permissions.includes(host)) failures.push(`missing host permission: ${host}`);
const files = ["src/shared/locations.js", "src/shared/protocol.js", "src/shared/storage.js", "src/content/main-adapter.js", "src/content/storage-bridge.js", "src/options/options.js"];
for (const file of files) {
  try { execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file}: ${error.stderr.toString().trim()}`); }
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Validated MV3 manifest and ${files.length} JavaScript files.`);
