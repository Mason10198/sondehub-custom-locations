"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("../src/shared/locations.js");
const protocol = require("../src/shared/protocol.js");
const storageRepository = require("../src/shared/storage.js");

function area(initial) {
  let data = structuredClone(initial);
  return {
    async get(key) { return key == null ? structuredClone(data) : (Object.hasOwn(data, key) ? { [key]: structuredClone(data[key]) } : {}); },
    async set(value) { data = { ...data, ...structuredClone(value) }; },
    async remove(key) { for (const item of Array.isArray(key) ? key : [key]) delete data[item]; }
  };
}

test("storage bridge pushes minimal sync snapshots and ignores page request events", async () => {
  const listeners = new Map();
  const events = [];
  const document = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatchEvent(event) { events.push(event); }
  };
  const onChanged = { addListener(listener) { this.listener = listener; } };
  const browser = {
    storage: {
      sync: area({
        settings: { icon: "16-solid/home", iconColor: "#112233", backgroundColor: "#abcdef" },
        "location:private": { schema: 2, order: 0, location: { id: "private", name: "Home", icon: "pin", iconColor: null, backgroundColor: null, lat: 1, long: 2 } },
        "location:override": { schema: 2, order: 1, location: { id: "override", name: "Override", icon: "star", iconColor: "#ffffff", backgroundColor: "#2563eb", lat: 3, long: 4 } }
      }),
      local: area({}),
      onChanged
    }
  };
  const context = { browser, document, SondeHubLocationProtocol: protocol, SondeHubLocationRepository: storageRepository, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, Object, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/content/storage-bridge.js"), "utf8"), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(listeners.has("sondehub-custom-locations:request"), false);
  assert.equal(typeof events[0].detail, "string");
  const locations = protocol.message(events[0].detail);
  assert.deepEqual(locations, [
    { name: "Home", icon: "16-solid/home", iconColor: "#112233", backgroundColor: "#abcdef", lat: 1, long: 2 },
    { name: "Override", icon: "16-solid/star", iconColor: "#ffffff", backgroundColor: "#2563eb", lat: 3, long: 4 }
  ]);
  assert.equal(Object.hasOwn(locations[0], "id"), false);
  assert.equal(listeners.get("sondehub-custom-locations:request"), undefined);
  onChanged.listener({ "location:private": { newValue: {} } }, "sync");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 2);
  onChanged.listener({ settings: { newValue: {} } }, "sync");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 3);
});
