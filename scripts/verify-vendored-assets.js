#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const vendorRoot = path.join(root, "third_party", "heroicons");
const noticePath = path.join(root, "THIRD_PARTY_NOTICES.md");
const notice = fs.readFileSync(noticePath, "utf8");

const upstream = Object.freeze({
  tag: "v2.2.0",
  commit: "0435d4ca364a608cc75e2f8683d374e55abbae26",
  variants: Object.freeze({
    "16/solid": Object.freeze({ count: 316, sha256: "b22641de8ebeb2f1c11dce61027f00c23b80346325294b1d7b8b56304725cb84" })
  }),
  licenseSha256: "60e0b68c0f35c078eef3a5d29419d0b03ff84ec1df9c3f9d6e39a519a5ae7985"
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertRegularTree(directory) {
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    const currentStat = fs.lstatSync(current);
    if (currentStat.isSymbolicLink()) throw new Error(`Symlink is not allowed in vendored assets: ${path.relative(root, current)}`);
    if (!currentStat.isDirectory()) throw new Error(`Expected vendored directory: ${path.relative(root, current)}`);
    for (const name of fs.readdirSync(current)) {
      const child = path.join(current, name);
      const childStat = fs.lstatSync(child);
      if (childStat.isSymbolicLink()) throw new Error(`Symlink is not allowed in vendored assets: ${path.relative(root, child)}`);
      if (childStat.isDirectory()) stack.push(child);
      else if (!childStat.isFile()) throw new Error(`Special file is not allowed in vendored assets: ${path.relative(root, child)}`);
    }
  }
}

function documentedHash(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notice.match(new RegExp("- `" + escaped + "`: `([a-f0-9]{64})`"));
  if (!match) throw new Error(`Missing documented hash for ${label}`);
  return match[1];
}

function variantDigest(source) {
  const directory = path.join(vendorRoot, "optimized", source);
  const names = fs.readdirSync(directory).sort();
  const hash = crypto.createHash("sha256");
  for (const name of names) {
    const file = path.join(directory, name);
    const fileStat = fs.lstatSync(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || !name.endsWith(".svg")) throw new Error(`Unexpected entry in ${source}: ${name}`);
    const svg = fs.readFileSync(file);
    const text = svg.toString("utf8");
    if (/<(?:script|foreignObject|iframe|object|embed)\b/i.test(text) || /\son[a-z]+\s*=/i.test(text) || /(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(text)) {
      throw new Error(`Active or external SVG content is not allowed: ${path.relative(root, file)}`);
    }
    hash.update(name, "utf8");
    hash.update(Buffer.from([0]));
    hash.update(svg);
  }
  return { count: names.length, sha256: hash.digest("hex") };
}

assertRegularTree(vendorRoot);
if (!notice.includes(`revision: [\`${upstream.tag}\`]`) || !notice.includes(`commit [\`${upstream.commit}\`]`)) {
  throw new Error("THIRD_PARTY_NOTICES.md does not document the pinned Heroicons tag and commit");
}

for (const [source, expected] of Object.entries(upstream.variants)) {
  const actual = variantDigest(source);
  if (actual.count !== expected.count) throw new Error(`${source}: expected ${expected.count} SVGs, found ${actual.count}`);
  if (actual.sha256 !== expected.sha256) throw new Error(`${source}: vendored tree hash does not match pinned Heroicons ${upstream.tag}`);
  if (documentedHash(source) !== expected.sha256) throw new Error(`${source}: documented hash does not match the verified expected hash`);
}

const licensePath = path.join(vendorRoot, "LICENSE");
const licenseStat = fs.lstatSync(licensePath);
if (!licenseStat.isFile() || licenseStat.isSymbolicLink()) throw new Error("Vendored Heroicons license must be a regular file");
const actualLicenseHash = sha256(fs.readFileSync(licensePath));
if (actualLicenseHash !== upstream.licenseSha256) throw new Error(`Heroicons license hash does not match pinned ${upstream.tag}`);
const documentedLicense = notice.match(/License SHA-256: `([a-f0-9]{64})`/);
if (!documentedLicense || documentedLicense[1] !== upstream.licenseSha256) throw new Error("Documented Heroicons license hash does not match the verified expected hash");

const total = Object.values(upstream.variants).reduce((sum, variant) => sum + variant.count, 0);
console.log(`Verified ${total} Heroicons ${upstream.tag} Micro SVGs, provenance hashes, safe file types, and MIT license.`);
