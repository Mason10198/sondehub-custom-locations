"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const layer = require("../src/content/map-overlay-host.js");

function node(transform, parentElement = null, extra = {}) {
  return { style: { transform, width: extra.width || "", zIndex: extra.zIndex || "" }, parentElement, ...extra };
}

const view = { getComputedStyle(element) { return { transform: element.style?.transform || "none", display: "block", visibility: "visible", opacity: "1", zIndex: element.style?.zIndex || "0" }; } };

test("derives a private-layer anchor from visible XYZ tile geometry", () => {
  const container = node("", null, { zIndex: "18" });
  const tile = node("translate3d(13px, 44px, 0px)", container, { src: "https://tile.openstreetmap.org/5/15/9.png", width: 256 });
  tile.style.width = "256px";
  container.querySelectorAll = () => [tile];
  const map = { querySelectorAll() { return [container]; } };
  const anchor = layer.chooseAnchor(map, view);
  assert.equal(anchor.container, container);
  assert.equal(anchor.zoom, 5);
  assert.equal(anchor.tileSize, 256);
  assert.equal(anchor.originX, 13 - 15 * 256);
  assert.equal(anchor.originY, 44 - 9 * 256);
});

test("projects saved coordinates into the tile container coordinate system", () => {
  const anchor = { zoom: 5, tileSize: 256, originX: 13 - 15 * 256, originY: 44 - 9 * 256 };
  const point = layer.projectToAnchor(53.47497, -2.35, anchor);
  assert.ok(Math.abs(point.x - 215.5244) < 0.01, point.x);
  assert.ok(Math.abs(point.y - 390.5) < 0.01, point.y);
});

test("supports tile URLs and transform formats used by Leaflet", () => {
  assert.deepEqual(layer.tileCoordinates("https://tile.openstreetmap.org/12/2021/1320.png"), { z: 12, x: 2021, y: 1320 });
  assert.equal(layer.tileCoordinates("https://example.invalid/no-tile.png"), null);
  assert.deepEqual(layer.transformParts("translate3d(12px, -8px, 0px) scale(1.5)"), { x: 12, y: -8, scale: 1.5 });
  assert.deepEqual(layer.transformParts("matrix(2, 0, 0, 2, 7, 9)"), { x: 7, y: 9, scale: 2 });
});

test("keeps marker rendering private while inheriting Leaflet transforms", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/content/map-overlay-host.js"), "utf8");
  assert.match(source, /attachShadow\(\{ mode: "closed" \}\)/);
  assert.match(source, /mapPane\.append\(host\)/);
  assert.match(source, /anchor\.container\.style\.transform/);
  assert.match(source, /repository\.getResolved\(\)/);
  assert.doesNotMatch(source, /postMessage|CustomEvent|dispatchEvent|world:\s*["']MAIN/);
});

test("uses compositor transforms and the compact default glyph", () => {
  assert.equal(layer.glyphSize(22), 16);
  assert.equal(layer.glyphSize(44), 27);
  assert.equal(layer.markerTransform({ x: 400.5, y: 300.25 }), "translate3d(400.5px, 300.25px, 0) translate(-50%, -50%)");
});

test("marker names are hover-only by default and can be always visible", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/content/map-overlay-host.js"), "utf8");
  assert.match(source, /labels-always/);
  assert.match(source, /\.marker:hover \.label/);
  assert.match(source, /pointer-events:none}.labels-always/);
  assert.doesNotMatch(source, /marker\.tabIndex|aria-expanded|marker\.addEventListener\("click"|marker\.addEventListener\("keydown"|\.marker\.revealed|\.marker:focus-visible/);
  assert.doesNotMatch(source, /marker\.addEventListener\("pointerdown"/);
});

test("custom markers stay below SondeHub markers and the toggle mounts below the time selector", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/content/map-overlay-host.js"), "utf8");
  assert.match(source, /CUSTOM_MARKER_Z_INDEX = 550/);
  assert.match(source, /getElementById\("timeperiod"\)/);
  assert.match(source, /insertAdjacentElement\("afterend", toggleControl\)/);
  assert.match(source, /leaflet-control sondehub-custom-locations-control/);
});
