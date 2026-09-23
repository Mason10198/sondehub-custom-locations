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
test("defaults, normalizes, and validates marker colors", () => {
  const defaults = api.validateLocation({ name: "Default", icon: "pin", lat: 1, long: 2 }).value;
  assert.equal(defaults.iconColor, "#000000");
  assert.equal(defaults.backgroundColor, "#facc15");
  const custom = api.validateLocation({ name: "Custom", icon: "pin", iconColor: " #FFFFFF ", background_color: "#2563EB", lat: 1, long: 2 }).value;
  assert.equal(custom.iconColor, "#ffffff");
  assert.equal(custom.backgroundColor, "#2563eb");
  assert.deepEqual(api.validateLocation({ name: "Bad", iconColor: "black", backgroundColor: "#123", lat: 1, long: 2 }).errors, ["icon color must be a six-digit hex color such as #000000", "background color must be a six-digit hex color such as #facc15"]);
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
test("imports optional marker colors and defaults blank or omitted color columns", () => {
  const custom = api.importCsv("name,icon,lat,long,icon_color,background_color\nCustom,radio,1,2,#ffffff,#2563eb");
  assert.deepEqual({ iconColor: custom.locations[0].iconColor, backgroundColor: custom.locations[0].backgroundColor }, { iconColor: "#ffffff", backgroundColor: "#2563eb" });
  const blank = api.importCsv("name,icon,lat,long,icon_color,background_color\nBlank,radio,1,2,,");
  assert.deepEqual({ iconColor: blank.locations[0].iconColor, backgroundColor: blank.locations[0].backgroundColor }, { iconColor: "#000000", backgroundColor: "#facc15" });
  const omitted = api.importCsv("name,icon,lat,long\nOmitted,radio,1,2");
  assert.deepEqual({ iconColor: omitted.locations[0].iconColor, backgroundColor: omitted.locations[0].backgroundColor }, { iconColor: "#000000", backgroundColor: "#facc15" });
  const invalid = api.importCsv("name,icon,lat,long,icon_color,background_color\nBad,radio,1,2,red,#123");
  assert.equal(invalid.locations.length, 0);
  assert.match(invalid.skipped[0].reason, /icon color.*background color/);
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
test("exports portable CSV backups that round-trip all display fields", () => {
  const csv = api.exportCsv([
    { id: "one", name: 'Launch, "North"', icon: "radio", iconColor: "#ffffff", backgroundColor: "#2563eb", lat: 35.5, long: -97.5 },
    { id: "two", name: "Second\nLine", icon: "home", lat: 1, long: 2 }
  ]);
  assert.equal(csv.startsWith("name,icon,icon_color,background_color,lat,long,sondehub_csv_version\r\n"), true);
  const imported = api.importCsv(csv);
  assert.equal(imported.skipped.length, 0);
  assert.deepEqual(imported.locations.map(({ id, ...location }) => location), [
    { name: 'Launch, "North"', icon: "16-solid/radio", iconColor: "#ffffff", backgroundColor: "#2563eb", lat: 35.5, long: -97.5 },
    { name: "Second\nLine", icon: "16-solid/home", iconColor: "#000000", backgroundColor: "#facc15", lat: 1, long: 2 }
  ]);
});

test("exports spreadsheet-safe names without changing names on re-import", () => {
  const names = ["=1+1", "+SUM(1,2)", "-2+3", "@command", "'literal"];
  const csv = api.exportCsv(names.map((name, index) => ({ id: String(index), name, lat: 1, long: 2 })));
  const rows = api.parseCsv(csv);
  assert.deepEqual(rows.slice(1).map((row) => row[0]), names.map((name) => `'${name}`));
  assert.deepEqual(api.importCsv(csv).locations.map((location) => location.name), names);
});
