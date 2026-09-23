#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const failures = [];
const optionsHtml = fs.readFileSync(path.join(root, "src/options/options.html"), "utf8");
const requiredOptionsScripts = ["../shared/icons.js", "../shared/locations.js", "../shared/storage.js", "options.js"];
let previousScriptOffset = -1;
for (const script of requiredOptionsScripts) {
  const offset = optionsHtml.indexOf(`src=\"${script}\"`);
  if (offset <= previousScriptOffset) failures.push(`options scripts must load ${requiredOptionsScripts.join(", ")} in order`);
  previousScriptOffset = offset;
}
if (!optionsHtml.includes('id="icon-dialog"') || !optionsHtml.includes('id="icon-search"') || !optionsHtml.includes('id="icon-results"') || !optionsHtml.includes('id="choose-default-icon"') || !optionsHtml.includes('id="choose-location-icon"') || optionsHtml.includes('id="icon-style"') || /<select[^>]+id=["'](?:default-)?icon["']/i.test(optionsHtml)) failures.push("options must provide one searchable icon dialog for default and per-location selection without native icon selects");
if (!optionsHtml.includes('id="export-button"')) failures.push("options must provide portable CSV export");
if (!optionsHtml.includes('id="defaults-form"') || !optionsHtml.includes('id="default-icon"') || !optionsHtml.includes('id="default-marker-diameter"') || !optionsHtml.includes('id="override-icon"') || !optionsHtml.includes('id="override-icon-color"') || !optionsHtml.includes('id="override-background-color"') || !optionsHtml.includes('id="override-marker-diameter"')) failures.push("options must distinguish synchronized appearance defaults from independent per-location overrides");
for (const unwantedCopy of ["Firefox Sync keeps desktop locations aligned", "Search the complete vendored Heroicons", "Every icon is bundled with the extension"]) {
  if (optionsHtml.includes(unwantedCopy)) failures.push(`options contains unwanted explanatory copy: ${unwantedCopy}`);
}
if (/\b(?:href|src)=["']https?:\/\//i.test(optionsHtml)) failures.push("options must not contain external links or remotely loaded resources");
if (manifest.manifest_version !== 3) failures.push("manifest_version must be 3");
if (manifest.version !== packageJson.version || manifest.version !== packageLock.version || manifest.version !== packageLock.packages?.[""]?.version) failures.push("manifest, package, and lockfile versions must match");
if (packageJson.private !== true) failures.push("package.json must remain private to prevent accidental npm publication");
for (const script of ["package:source", "verify:source"]) {
  if (!packageJson.scripts?.[script]) failures.push(`package.json must define ${script}`);
}
if (!Array.isArray(manifest.permissions) || manifest.permissions.length !== 1 || manifest.permissions[0] !== "storage") failures.push("storage must be the only extension API permission");
if (Object.hasOwn(manifest, "host_permissions")) failures.push("host_permissions must be omitted; static content-script matches provide the required site access");
const expectedCsp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
if (manifest.content_security_policy?.extension_pages !== expectedCsp) failures.push("extension pages must use the locked-down local-only CSP");
if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko || !Array.isArray(manifest.browser_specific_settings.gecko.data_collection_permissions?.required) || manifest.browser_specific_settings.gecko.data_collection_permissions.required.length !== 1 || manifest.browser_specific_settings.gecko.data_collection_permissions.required[0] !== "locationInfo") failures.push("gecko data_collection_permissions.required must accurately declare browser-managed location synchronization");
const supportedHosts = ["https://tracker.sondehub.org/*", "https://sondehub.org/*", "https://amateur.sondehub.org/*"];
if (!Array.isArray(manifest.content_scripts) || manifest.content_scripts.length !== 1) failures.push("exactly one isolated content-script registration is required");
for (const script of manifest.content_scripts || []) {
  if (!Array.isArray(script.matches) || script.matches.length !== supportedHosts.length || supportedHosts.some((host) => !script.matches.includes(host))) failures.push("each content script must match exactly the three supported SondeHub hosts");
  if (script.world === "MAIN") failures.push("stored marker data must never enter a MAIN-world content script");
  if (!Array.isArray(script.js) || script.js.length !== 1 || script.js[0] !== "src/content/map-overlay-host.js") failures.push("the isolated content script must load only the private overlay host");
}
const accessible = manifest.web_accessible_resources;
if (!Array.isArray(accessible) || accessible.length !== 1 || !Array.isArray(accessible[0].resources) || accessible[0].resources.length !== 1 || accessible[0].resources[0] !== "src/overlay/overlay.html" || !Array.isArray(accessible[0].matches) || supportedHosts.some((host) => !accessible[0].matches.includes(host))) failures.push("only the private overlay entry page may be web-accessible on the supported hosts");
try { execFileSync(process.execPath, [path.join(root, "scripts/generate-icon-catalog.js"), "--check"], { stdio: "pipe" }); }
catch (error) { failures.push(`generated icon catalog: ${error.stderr.toString().trim() || error.message}`); }
try { execFileSync(process.execPath, [path.join(root, "scripts/verify-vendored-assets.js")], { stdio: "pipe" }); }
catch (error) { failures.push(`vendored asset provenance: ${error.stderr.toString().trim() || error.message}`); }
const files = ["src/shared/icons.js", "src/shared/locations.js", "src/shared/storage.js", "src/content/map-overlay-host.js", "src/overlay/overlay.js", "src/options/options.js", "scripts/generate-icon-catalog.js", "scripts/verify-vendored-assets.js"];
for (const file of files) {
  try { execFileSync(process.execPath, ["--check", path.join(root, file)], { stdio: "pipe" }); }
  catch (error) { failures.push(`${file}: ${error.stderr.toString().trim()}`); }
}
const networkApiPattern = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/;
for (const file of files.filter((file) => file.startsWith("src/"))) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (networkApiPattern.test(source)) failures.push(`${file}: runtime code must not use network APIs`);
}
const optionsSource = fs.readFileSync(path.join(root, "src/options/options.js"), "utf8");
if (!optionsSource.includes("browser.storage.sync") || !optionsSource.includes("SondeHubLocations.exportCsv")) failures.push("options must use Firefox Sync and local CSV export");
const hostSource = fs.readFileSync(path.join(root, "src/content/map-overlay-host.js"), "utf8");
if (/browser\.storage|createRepository|getResolved|CustomEvent|dispatchEvent/.test(hostSource)) failures.push("page-side overlay host must never read or dispatch stored marker data");
const overlaySource = fs.readFileSync(path.join(root, "src/overlay/overlay.js"), "utf8");
if (!overlaySource.includes("repository.getResolved()") || /parent\.postMessage/.test(overlaySource)) failures.push("extension-origin overlay must read marker storage privately and never post marker data to the parent page");
for (const asset of ["THIRD_PARTY_NOTICES.md", "third_party/heroicons/LICENSE", "third_party/heroicons/optimized/16/solid/map-pin.svg"]) {
  if (!fs.existsSync(path.join(root, asset))) failures.push(`missing required third-party asset: ${asset}`);
}
for (const document of ["AMO_LISTING.md", "AMO_SOURCE_README.md", "CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "PRIVACY.md", "PUBLISHING.md", "SECURITY.md", "SUPPORT.md"]) {
  if (!fs.existsSync(path.join(root, document))) failures.push(`missing public-release document: ${document}`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Validated MV3 manifest and ${files.length} JavaScript files.`);
