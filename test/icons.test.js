"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const icons = require("../src/shared/icons.js");

const heroiconsRoot = path.join(__dirname, "..", "third_party", "heroicons", "optimized");
const thirdPartyNotice = fs.readFileSync(path.join(__dirname, "..", "THIRD_PARTY_NOTICES.md"), "utf8");
const expectedLicenseHash = "60e0b68c0f35c078eef3a5d29419d0b03ff84ec1df9c3f9d6e39a519a5ae7985";
const expectedVariants = [
  { key: "24-outline", source: "24/outline", count: 324, hash: "9bba1e68e2f19f1af39ee142236d07fa14a3e1bfb538c0bbe6c7aea1a98da3f2" },
  { key: "24-solid", source: "24/solid", count: 324, hash: "03b0bfb73e191b16f7232f48f1ba2db6793443fd438ef22a9f39e3145a93e664" },
  { key: "20-solid", source: "20/solid", count: 324, hash: "1c4674bdee3ea198005c92c74bf20e67f7dde71109d77fc4119e26c29bbb4d3b" },
  { key: "16-solid", source: "16/solid", count: 316, hash: "b22641de8ebeb2f1c11dce61027f00c23b80346325294b1d7b8b56304725cb84" }
];

function vendoredNames(variant) {
  return fs.readdirSync(path.join(heroiconsRoot, variant.source))
    .filter((file) => file.endsWith(".svg"))
    .sort()
    .map((file) => file.slice(0, -4));
}

function treeHash(variant, names) {
  const hash = crypto.createHash("sha256");
  for (const name of names) {
    const sourcePath = path.join(heroiconsRoot, variant.source, `${name}.svg`);
    assert.ok(fs.lstatSync(sourcePath).isFile(), `${variant.source}/${name}.svg must be a regular file`);
    hash.update(`${name}.svg\0`);
    hash.update(fs.readFileSync(sourcePath));
  }
  return hash.digest("hex");
}

test("generated catalog contains every vendored Heroicons v2.2.0 SVG variant", () => {
  const licenseHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname, "..", "third_party", "heroicons", "LICENSE"))).digest("hex");
  assert.equal(licenseHash, expectedLicenseHash);
  assert.match(thirdPartyNotice, new RegExp(expectedLicenseHash));
  assert.deepEqual(icons.STYLES.map((style) => style.key), expectedVariants.map((variant) => variant.key));

  const expectedCatalogKeys = [];
  for (const variant of expectedVariants) {
    const names = vendoredNames(variant);
    assert.equal(names.length, variant.count, `${variant.source} icon count`);
    assert.equal(treeHash(variant, names), variant.hash, `${variant.source} source-tree hash`);
    assert.match(thirdPartyNotice, new RegExp(variant.hash));
    expectedCatalogKeys.push(...names.map((name) => `${variant.key}/${name}`));
  }
  const catalogKeys = icons.ICONS.map((icon) => icon.key);
  assert.equal(catalogKeys.length, 1288);
  assert.equal(new Set(catalogKeys).size, 1288);
  assert.deepEqual(catalogKeys, expectedCatalogKeys);
  for (const key of expectedCatalogKeys) {
    assert.equal(icons.iconFor(key).key, key);
    assert.match(icons.svgFor(key), /^<svg /);
  }
});

test("catalog search spans every style and can filter a selected style", () => {
  assert.deepEqual(icons.filterIcons("map pin").map((icon) => icon.key), [
    "24-outline/map-pin", "24-solid/map-pin", "20-solid/map-pin", "16-solid/map-pin"
  ]);
  assert.deepEqual(icons.filterIcons("map pin", "24-solid").map((icon) => icon.key), ["24-solid/map-pin"]);
  assert.deepEqual(icons.filterIcons("academic cap", "16-solid").map((icon) => icon.key), ["16-solid/academic-cap"]);
  assert.deepEqual(icons.filterIcons("does not exist"), []);
  assert.equal(icons.filterIcons("", "24-outline").length, 324);
  assert.equal(icons.filterIcons("").length, 1288);
});

test("legacy and bare outline icon names remain compatible", () => {
  const expectedCanonicalKeys = {
    pin: "24-outline/map-pin", home: "24-outline/home", tower: "24-outline/building-office-2", launch: "24-outline/rocket-launch", landing: "24-outline/arrow-down-on-square",
    star: "24-outline/star", warning: "24-outline/exclamation-triangle", vehicle: "24-outline/truck", flag: "24-outline/flag", signal: "24-outline/signal", airplane: "24-outline/paper-airplane",
    camera: "24-outline/camera", fire: "24-outline/fire", tools: "24-outline/wrench-screwdriver", recovery: "24-outline/lifebuoy", person: "24-outline/user", cloud: "24-outline/cloud",
    info: "24-outline/information-circle", lightning: "24-outline/bolt", science: "24-outline/beaker", globe: "24-outline/globe-alt", search: "24-outline/magnifying-glass", map: "24-outline/map", radio: "24-outline/radio"
  };
  for (const [legacyKey, canonicalKey] of Object.entries(expectedCanonicalKeys)) {
    assert.equal(icons.normalizeIcon(` ${legacyKey.toUpperCase()} `), canonicalKey);
    assert.equal(icons.canonicalIconKey(legacyKey), canonicalKey);
    assert.equal(icons.iconFor(legacyKey).key, canonicalKey);
  }
  assert.equal(icons.normalizeIcon("map-pin"), "24-outline/map-pin");
  assert.equal(icons.normalizeIcon("not-an-icon"), icons.DEFAULT_ICON);
});
