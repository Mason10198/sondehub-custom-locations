"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const overlay = require("../src/overlay/overlay.js");

const viewport = Object.freeze({ type: overlay.MESSAGE_TYPE, version: 1, width: 800, height: 600, zoom: 10, centerLat: 35, centerLong: -97 });

test("validates exact bounded viewport messages", () => {
  assert.deepEqual(overlay.validViewport(viewport), viewport);
  assert.equal(overlay.validViewport({ ...viewport, zoom: 10.5 }).zoom, 10.5);
  assert.equal(overlay.validViewport({ ...viewport, extra: true }), null);
  assert.equal(overlay.validViewport({ ...viewport, zoom: 25 }), null);
  assert.equal(overlay.validViewport({ ...viewport, centerLat: 91 }), null);
  assert.equal(overlay.validViewport("not an object"), null);
});

test("projects the viewport center to the overlay center", () => {
  const point = overlay.project(viewport.centerLat, viewport.centerLong, viewport);
  assert.ok(Math.abs(point.x - 400) < 1e-9);
  assert.ok(Math.abs(point.y - 300) < 1e-9);
});

test("wraps longitude to the nearest world copy", () => {
  const dateLine = { ...viewport, centerLong: 179, zoom: 3 };
  const point = overlay.project(0, -179, dateLine);
  assert.ok(point.x > dateLine.width / 2);
  assert.ok(point.x - dateLine.width / 2 < 20);
});

test("keeps the compact default glyph at 16px", () => {
  assert.equal(overlay.glyphSize(22), 16);
  assert.equal(overlay.glyphSize(44), 27);
});

test("moves persistent marker nodes with compositor transforms", () => {
  assert.equal(overlay.markerTransform({ x: 400.5, y: 300.25 }), "translate3d(400.5px, 300.25px, 0) translate(-50%, -50%)");
});
