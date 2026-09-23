"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const host = require("../src/content/map-overlay-host.js");

function node(transform, parentElement = null, extra = {}) {
  return { style: { transform, width: extra.width || "" }, parentElement, ...extra };
}

test("infers the Leaflet viewport from page-visible XYZ tile geometry", () => {
  const map = { clientWidth: 700, clientHeight: 759, querySelectorAll() { return [tile]; } };
  const mapPane = node("translate3d(210px, 257px, 0px)", map);
  const tilePane = node("", mapPane);
  const layer = node("", tilePane);
  const tileContainer = node("translate3d(0px, 0px, 0px) scale(1)", layer);
  const tile = node("translate3d(-65px, -224px, 0px)", tileContainer, { src: "https://tile.openstreetmap.org/5/15/9.png", width: 256 });
  tile.style.width = "256px";
  const viewport = host.inferViewport(map, { getComputedStyle: () => ({ transform: "none" }) });
  assert.equal(viewport.type, host.MESSAGE_TYPE);
  assert.equal(viewport.zoom, 5);
  assert.equal(viewport.width, 700);
  assert.equal(viewport.height, 759);
  assert.ok(Math.abs(viewport.centerLat - 53.45) < 0.1, viewport.centerLat);
  assert.ok(Math.abs(viewport.centerLong - (-2.24)) < 0.1, viewport.centerLong);
});

test("tracks zoom-animation scale and rejects malformed tile URLs", () => {
  const map = { clientWidth: 700, clientHeight: 759, querySelectorAll() { return [scaled, malformed]; } };
  const mapPane = node("translate3d(0px, 0px, 0px)", map);
  const scaledParent = node("scale(1.5)", mapPane);
  const scaled = node("translate3d(0px, 0px, 0px)", scaledParent, { src: "https://tile.openstreetmap.org/5/15/9.png", width: 256 });
  scaled.style.width = "256px";
  const malformed = node("translate3d(0px, 0px, 0px)", mapPane, { src: "https://example.invalid/no-tile.png", width: 256 });
  malformed.style.width = "256px";
  const viewport = host.inferViewport(map, { getComputedStyle: () => ({ transform: "none" }) });
  assert.ok(Math.abs(viewport.zoom - (5 + Math.log2(1.5))) < 1e-9);
  map.querySelectorAll = () => [malformed];
  assert.equal(host.inferViewport(map, { getComputedStyle: () => ({ transform: "none" }) }), null);
});

test("isolated host never reads or dispatches stored location data", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/content/map-overlay-host.js"), "utf8");
  assert.doesNotMatch(source, /browser\.storage|createRepository|getResolved|CustomEvent|dispatchEvent/);
  assert.match(source, /src\/overlay\/overlay\.html/);
  assert.match(source, /"pointer-events": "none"/);
});
