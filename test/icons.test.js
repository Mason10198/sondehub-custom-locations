"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const icons = require("../src/shared/icons.js");

const microRoot = path.join(__dirname, "..", "third_party", "heroicons", "optimized", "16", "solid");
const thirdPartyNotice = fs.readFileSync(path.join(__dirname, "..", "THIRD_PARTY_NOTICES.md"), "utf8");
const expectedLicenseHash = "60e0b68c0f35c078eef3a5d29419d0b03ff84ec1df9c3f9d6e39a519a5ae7985";
const expectedMicroHash = "b22641de8ebeb2f1c11dce61027f00c23b80346325294b1d7b8b56304725cb84";

function vendoredNames() {
  return fs.readdirSync(microRoot)
    .filter((file) => file.endsWith(".svg"))
    .sort()
    .map((file) => file.slice(0, -4));
}

function treeHash(names) {
  const hash = crypto.createHash("sha256");
  for (const name of names) {
    const sourcePath = path.join(microRoot, `${name}.svg`);
    assert.ok(fs.lstatSync(sourcePath).isFile(), `16/solid/${name}.svg must be a regular file`);
    hash.update(`${name}.svg\0`);
    hash.update(fs.readFileSync(sourcePath));
  }
  return hash.digest("hex");
}

test("generated catalog contains every vendored Heroicons v2.2.0 Micro icon", () => {
  const licenseHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "..", "third_party", "heroicons", "LICENSE"))).digest("hex");
  assert.equal(licenseHash, expectedLicenseHash);
  assert.match(thirdPartyNotice, new RegExp(expectedLicenseHash));
  assert.deepEqual(icons.STYLES, [{ key: "16-solid", label: "16px Micro" }]);

  const names = vendoredNames();
  assert.equal(names.length, 316);
  assert.equal(treeHash(names), expectedMicroHash);
  assert.match(thirdPartyNotice, new RegExp(expectedMicroHash));
  const expectedCatalogKeys = names.map((name) => `16-solid/${name}`);
  const catalogKeys = icons.ICONS.map((icon) => icon.key);
  assert.equal(catalogKeys.length, 316);
  assert.equal(new Set(catalogKeys).size, 316);
  assert.deepEqual(catalogKeys, expectedCatalogKeys);
  for (const key of expectedCatalogKeys) {
    assert.equal(icons.iconFor(key).key, key);
    assert.match(icons.svgFor(key), /^<svg style="width:16px;height:16px;display:block" /);
  }
});

test("catalog search covers the Heroicons Micro set", () => {
  assert.deepEqual(icons.filterIcons("map pin").map((icon) => icon.key), ["16-solid/map-pin"]);
  assert.deepEqual(icons.filterIcons("academic cap").map((icon) => icon.key), ["16-solid/academic-cap"]);
  assert.deepEqual(icons.filterIcons("does not exist"), []);
  assert.equal(icons.filterIcons("").length, 316);
});

test("legacy, bare, and previous larger-variant keys migrate to Micro icons", () => {
  const expectedCanonicalKeys = {
    pin: "16-solid/map-pin", home: "16-solid/home", tower: "16-solid/building-office-2", launch: "16-solid/rocket-launch", landing: "16-solid/arrow-down-on-square",
    star: "16-solid/star", warning: "16-solid/exclamation-triangle", vehicle: "16-solid/truck", flag: "16-solid/flag", signal: "16-solid/signal", airplane: "16-solid/paper-airplane",
    camera: "16-solid/camera", fire: "16-solid/fire", tools: "16-solid/wrench-screwdriver", recovery: "16-solid/lifebuoy", person: "16-solid/user", cloud: "16-solid/cloud",
    info: "16-solid/information-circle", lightning: "16-solid/bolt", science: "16-solid/beaker", globe: "16-solid/globe-alt", search: "16-solid/magnifying-glass", map: "16-solid/map", radio: "16-solid/radio"
  };
  for (const [legacyKey, canonicalKey] of Object.entries(expectedCanonicalKeys)) {
    assert.equal(icons.normalizeIcon(` ${legacyKey.toUpperCase()} `), canonicalKey);
    assert.equal(icons.canonicalIconKey(legacyKey), canonicalKey);
    assert.equal(icons.iconFor(legacyKey).key, canonicalKey);
  }
  assert.equal(icons.normalizeIcon("map-pin"), "16-solid/map-pin");
  assert.equal(icons.normalizeIcon("24-outline/map-pin"), "16-solid/map-pin");
  assert.equal(icons.normalizeIcon("24-solid/home"), "16-solid/home");
  assert.equal(icons.normalizeIcon("20-solid/radio"), "16-solid/radio");
  assert.equal(icons.normalizeIcon("not-an-icon"), icons.DEFAULT_ICON);
});
