"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../src/shared/locations.js");

test("normalizes supported icons and defaults invalid values", () => {
  assert.equal(api.normalizeIcon(" HOME "), "16-solid/home");
  assert.equal(api.normalizeIcon("unknown"), "16-solid/map-pin");
  assert.equal(api.normalizeIcon(""), "16-solid/map-pin");
});
test("accepts every catalog icon in forms and CSV while defaulting bad icon values", () => {
  assert.ok(api.ICONS.length >= 20);
  for (const icon of api.ICONS) {
    assert.equal(api.validateLocation({ name: icon.key, icon: icon.key, lat: 1, long: 2 }).value.icon, icon.key);
    assert.equal(api.importCsv(`name,icon,lat,long\n${icon.key},${icon.key},1,2`).locations[0].icon, icon.key);
  }
  assert.equal(api.validateLocation({ name: "Fallback", icon: "", lat: 1, long: 2 }).value.icon, "16-solid/map-pin");
});
test("validates coordinate bounds and name", () => {
  assert.equal(api.validateLocation({ name: "A", lat: "90", long: "-180", icon: "star" }).ok, true);
  assert.deepEqual(api.validateLocation({ name: "", lat: 91, long: "x" }).errors, ["name is required", "latitude must be a number from -90 to 90", "longitude must be a number from -180 to 180"]);
});
test("parses standard quoted CSV fields and escaped quotes", () => {
  assert.deepEqual(api.parseCsv('name,icon,lat,long\r\n"A, B",star,1,2\r\n"A ""quote""",pin,3,4'), [["name", "icon", "lat", "long"], ["A, B", "star", "1", "2"], ['A "quote"', "pin", "3", "4"]]);
});
test("rejects characters following a closing CSV quote", () => {
  assert.throws(() => api.parseCsv('name,icon,lat,long\n"A"oops,pin,1,2'), /Invalid character after closing quote/);
});
test("imports valid rows and reports physical invalid row numbers", () => {
  const result = api.importCsv("name,icon,lat,long\nGood,bad,1,2\nBad,pin,99,2\n,home,1,2");
  assert.equal(result.locations.length, 1);
  assert.equal(result.locations[0].icon, "16-solid/map-pin");
  assert.deepEqual(result.skipped, [{ row: 3, reason: "latitude must be a number from -90 to 90" }, { row: 4, reason: "name is required" }]);
});
test("accepts a CSV with leading blank lines while retaining physical row numbers", () => {
  const result = api.importCsv("\n\nname,icon,lat,long\nA,pin,1,2\nB,pin,999,2");
  assert.equal(result.locations.length, 1);
  assert.deepEqual(result.skipped, [{ row: 5, reason: "latitude must be a number from -90 to 90" }]);
});
test("reports source line for invalid records after multiline quoted fields", () => {
  const result = api.importCsv('name,icon,lat,long\n"First\nline",pin,1,2\nBad,pin,999,2');
  assert.equal(result.locations.length, 1);
  assert.deepEqual(result.skipped, [{ row: 4, reason: "latitude must be a number from -90 to 90" }]);
});
test("rejects headers missing required columns", () => {
  const result = api.importCsv("name,lat,long\nA,1,2");
  assert.equal(result.fatal, "Invalid CSV header");
  assert.match(result.skipped[0].reason, /icon/);
});
