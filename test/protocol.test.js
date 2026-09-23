"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/shared/locations.js");
const protocol = require("../src/shared/protocol.js");

test("protocol serializes minimal display snapshots for cross-world transport", () => {
  const text = protocol.serialize([
    { id: "secret-id", name: " Home ", icon: "STAR", iconColor: "#FFFFFF", backgroundColor: "#2563EB", markerDiameter: "40", lat: "1.5", long: "2.5", extra: "nope" },
    { name: "Bad", lat: 99, long: 1 },
    null
  ]);
  assert.equal(typeof text, "string");
  const locations = protocol.message(text);
  assert.deepEqual(locations, [{ name: "Home", icon: "16-solid/star", iconColor: "#ffffff", backgroundColor: "#2563eb", markerDiameter: 40, lat: 1.5, long: 2.5 }]);
  assert.equal(Object.isFrozen(locations), true);
  assert.equal(Object.isFrozen(locations[0]), true);
  assert.equal(Object.hasOwn(locations[0], "id"), false);
});

test("protocol rejects malformed, oversized, and out-of-schema text transport", () => {
  const validLocation = { name: "A", icon: "16-solid/map-pin", iconColor: "#000000", backgroundColor: "#facc15", markerDiameter: 28, lat: 1, long: 2 };
  assert.equal(protocol.message("not JSON"), null);
  assert.equal(protocol.message("x".repeat(protocol.MAX_TRANSPORT_CHARS + 1)), null);
  assert.equal(protocol.message(JSON.stringify({ version: 2, locations: [validLocation] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: [{ ...validLocation, id: "private" }] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: [{ ...validLocation, lat: "1" }] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: [{ ...validLocation, icon: "unknown" }] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: [{ ...validLocation, iconColor: "black" }] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: [{ ...validLocation, markerDiameter: 19 }] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: [{ ...validLocation, name: "x".repeat(121) }] })), null);
  assert.equal(protocol.message(JSON.stringify({ version: 3, locations: Array.from({ length: protocol.MAX_LOCATIONS + 1 }, () => validLocation) })), null);
  assert.equal(protocol.message({ version: 3, locations: [validLocation] }), null);
});

test("protocol bounds outgoing snapshots before serializing", () => {
  const text = protocol.serialize(Array.from({ length: protocol.MAX_LOCATIONS + 1 }, (_, index) => ({ name: `A${index}`, icon: "pin", lat: 1, long: 2 })));
  assert.equal(protocol.message(text).length, protocol.MAX_LOCATIONS);
});

test("protocol carries the maximum valid collection within its transport bound", () => {
  const text = protocol.serialize(Array.from({ length: protocol.MAX_LOCATIONS }, (_, index) => ({
    name: `${index}-${"W".repeat(116)}`,
    icon: "16-solid/arrow-up-right",
    iconColor: "#ffffff",
    backgroundColor: "#000000",
    markerDiameter: 64,
    lat: -90,
    long: -180
  })));
  assert.equal(typeof text, "string");
  assert.ok(text.length <= protocol.MAX_TRANSPORT_CHARS);
  assert.equal(protocol.message(text).length, protocol.MAX_LOCATIONS);
});
