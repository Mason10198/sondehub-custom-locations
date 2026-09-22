"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("../src/shared/locations.js");
const protocol = require("../src/shared/protocol.js");

test("storage bridge pushes minimal snapshots and ignores page request events", async () => {
  const listeners = new Map();
  const events = [];
  let reads = 0;
  const document = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatchEvent(event) { events.push(event); }
  };
  const browser = {
    storage: {
      local: { async get() { reads += 1; return { locations: [{ id: "private", name: "Home", icon: "pin", lat: 1, long: 2 }] }; } },
      onChanged: { addListener(listener) { this.listener = listener; } }
    }
  };
  const context = { browser, document, SondeHubLocationProtocol: protocol, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, Object, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/content/storage-bridge.js"), "utf8"), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 1);
  assert.equal(listeners.has("sondehub-custom-locations:request"), false);
  assert.equal(typeof events[0].detail, "string");
  const locations = protocol.message(events[0].detail);
  assert.deepEqual(locations, [{ name: "Home", icon: "24-outline/map-pin", lat: 1, long: 2 }]);
  assert.equal(Object.hasOwn(locations[0], "id"), false);
  // A page can dispatch this name, but the bridge deliberately has no listener.
  assert.equal(listeners.get("sondehub-custom-locations:request"), undefined);
});
