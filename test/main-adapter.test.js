"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("../src/shared/locations.js");
const protocol = require("../src/shared/protocol.js");

function runAdapter() {
  const listeners = new Map();
  const intervals = [];
  const observers = [];
  const mapElement = {};
  const group = {
    clearCount: 0,
    markers: [],
    addTo(receivedMap) { this.map = receivedMap; return this; },
    clearLayers() { this.clearCount += 1; this.markers = []; },
    addLayer(marker) { this.markers.push(marker); }
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() { this.observing = true; }
    disconnect() { this.disconnected = true; }
  }
  const document = {
    documentElement: {},
    getElementById(id) { return id === "map" ? mapElement : null; },
    createElement() { return { append() {} }; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    dispatchEvent() {}
  };
  const window = {
    L: {
      layerGroup: () => group,
      divIcon: (value) => value,
      marker: (coordinates, options) => ({ coordinates, options, bindPopup(popup) { this.popup = popup; } })
    },
    map: { _container: mapElement, addLayer() {} },
    SondeHubLocationProtocol: protocol,
    addEventListener() {},
    setInterval(callback) { intervals.push(callback); return intervals.length - 1; },
    clearInterval(index) { intervals[index] = null; }
  };
  const context = { window, document, MutationObserver, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, Object, Array, Set };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/content/main-adapter.js"), "utf8"), context);
  return { group, intervals, listeners, observers, window };
}

test("registers a late Leaflet layer control once without retrying marker rendering", () => {
  const adapter = runAdapter();
  assert.equal(adapter.group.map, adapter.window.map);
  assert.equal(adapter.intervals.length, 1);

  const message = protocol.serialize([{ id: "home", name: "Home", icon: "pin", lat: 1, long: 2 }]);
  adapter.listeners.get("sondehub-custom-locations:update")({ detail: message });
  assert.equal(adapter.group.markers.length, 1);
  const rendersBeforeControl = adapter.group.clearCount;
  adapter.intervals[0]();
  assert.equal(adapter.group.clearCount, rendersBeforeControl);

  let registrations = 0;
  adapter.window.layers = { addOverlay(receivedGroup, label) { registrations += 1; assert.equal(receivedGroup, adapter.group); assert.equal(label, "Custom locations"); } };
  adapter.intervals[0]();
  assert.equal(registrations, 1);
  assert.equal(adapter.observers[0].disconnected, true);

  adapter.listeners.get("sondehub-custom-locations:update")({ detail: message });
  assert.equal(registrations, 1);
  assert.equal(adapter.group.markers.length, 1);
});

test("ignores malformed text transport without changing existing markers", () => {
  const adapter = runAdapter();
  const listener = adapter.listeners.get("sondehub-custom-locations:update");
  listener({ detail: protocol.serialize([{ name: "Home", icon: "pin", lat: 1, long: 2 }]) });
  const renders = adapter.group.clearCount;
  listener({ detail: "{not valid JSON" });
  listener({ detail: "x".repeat(protocol.MAX_TRANSPORT_CHARS + 1) });
  assert.equal(adapter.group.clearCount, renders);
  assert.equal(adapter.group.markers.length, 1);
  assert.equal(adapter.group.markers[0].coordinates[0], 1);
  assert.equal(adapter.group.markers[0].coordinates[1], 2);
});
