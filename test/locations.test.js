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
test("inherited marker appearance resolves through configurable defaults", () => {
  const inherited = api.validateLocation({ name: "Inherited", lat: 1, long: 2 }, { inheritMissingIcon: true, inheritMissingColors: true, inheritMissingDiameter: true }).value;
  assert.deepEqual({ icon: inherited.icon, iconColor: inherited.iconColor, backgroundColor: inherited.backgroundColor, markerDiameter: inherited.markerDiameter }, { icon: null, iconColor: null, backgroundColor: null, markerDiameter: null });
  const resolved = api.resolveLocationAppearance(inherited, { icon: "radio", iconColor: "#112233", backgroundColor: "#abcdef", markerDiameter: 42 }).value;
  assert.deepEqual({ icon: resolved.icon, iconColor: resolved.iconColor, backgroundColor: resolved.backgroundColor, markerDiameter: resolved.markerDiameter }, { icon: "16-solid/radio", iconColor: "#112233", backgroundColor: "#abcdef", markerDiameter: 42 });
  assert.deepEqual(api.validateSettings({ icon: "home", iconColor: "#AABBCC", backgroundColor: "#123456", markerDiameter: "36" }).value, { icon: "16-solid/home", iconColor: "#aabbcc", backgroundColor: "#123456", markerDiameter: 36 });
});

test("validates global and per-location marker diameters", () => {
  assert.equal(api.validateSettings({}).value.markerDiameter, 26);
  assert.equal(api.validateSettings({ markerDiameter: 20 }).value.markerDiameter, 20);
  assert.equal(api.validateSettings({ markerDiameter: 64 }).value.markerDiameter, 64);
  assert.match(api.validateSettings({ markerDiameter: 19 }).errors[0], /20 to 64/);
  assert.match(api.validateLocation({ name: "Bad", lat: 1, long: 2, markerDiameter: 32.5 }).errors[0], /whole number/);
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
test("imports explicit marker colors as overrides and blank or omitted colors as inherited", () => {
  const custom = api.importCsv("name,icon,lat,long,icon_color,background_color\nCustom,radio,1,2,#ffffff,#2563eb");
  assert.deepEqual({ iconColor: custom.locations[0].iconColor, backgroundColor: custom.locations[0].backgroundColor }, { iconColor: "#ffffff", backgroundColor: "#2563eb" });
  const blank = api.importCsv("name,icon,lat,long,icon_color,background_color\nBlank,radio,1,2,,");
  assert.deepEqual({ iconColor: blank.locations[0].iconColor, backgroundColor: blank.locations[0].backgroundColor }, { iconColor: null, backgroundColor: null });
  const omitted = api.importCsv("name,icon,lat,long\nOmitted,radio,1,2");
  assert.deepEqual({ iconColor: omitted.locations[0].iconColor, backgroundColor: omitted.locations[0].backgroundColor }, { iconColor: null, backgroundColor: null });
  const invalid = api.importCsv("name,icon,lat,long,icon_color,background_color\nBad,radio,1,2,red,#123");
  assert.equal(invalid.locations.length, 0);
  assert.match(invalid.skipped[0].reason, /icon color.*background color/);
});
test("imports require only name, latitude, and longitude while optional icons override the default", () => {
  const inherited = api.importCsv("name,lat,long\nInherited,1,2");
  assert.equal(inherited.fatal, undefined);
  assert.equal(inherited.locations[0].icon, null);
  assert.equal(api.importCsv("name,lat,long,icon\nBlank,1,2,").locations[0].icon, null);
  assert.equal(api.importCsv("name,lat,long,icon\nOverride,1,2,radio").locations[0].icon, "16-solid/radio");
  assert.equal(api.importCsv("name,lat,long\nInherited,1,2").locations[0].markerDiameter, null);
  assert.equal(api.importCsv("name,lat,long,marker_diameter\nOverride,1,2,44").locations[0].markerDiameter, 44);
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
  const result = api.importCsv("name,lat\nA,1");
  assert.equal(result.fatal, "Invalid CSV header");
  assert.match(result.skipped[0].reason, /long/);
});
test("exports portable CSV backups that round-trip overrides and default settings", () => {
  const csv = api.exportCsv([
    { id: "one", name: 'Launch, "North"', icon: "radio", iconColor: "#ffffff", backgroundColor: "#2563eb", markerDiameter: 40, lat: 35.5, long: -97.5 },
    { id: "two", name: "Second\nLine", icon: "home", lat: 1, long: 2 }
  ], { icon: "radio", iconColor: "#112233", backgroundColor: "#abcdef", markerDiameter: 34 });
  assert.equal(csv.startsWith("name,icon,icon_color,background_color,marker_diameter,lat,long,default_icon,default_icon_color,default_background_color,default_marker_diameter,sondehub_csv_version\r\n"), true);
  const imported = api.importCsv(csv);
  assert.equal(imported.skipped.length, 0);
  assert.deepEqual(imported.settings, { icon: "16-solid/radio", iconColor: "#112233", backgroundColor: "#abcdef", markerDiameter: 34 });
  assert.deepEqual(imported.locations.map(({ id, ...location }) => location), [
    { name: 'Launch, "North"', icon: "16-solid/radio", iconColor: "#ffffff", backgroundColor: "#2563eb", markerDiameter: 40, lat: 35.5, long: -97.5 },
    { name: "Second\nLine", icon: "16-solid/home", iconColor: null, backgroundColor: null, markerDiameter: null, lat: 1, long: 2 }
  ]);
});

test("empty CSV backups still round-trip default settings", () => {
  const csv = api.exportCsv([], { icon: "home", iconColor: "#112233", backgroundColor: "#abcdef", markerDiameter: 48 });
  const imported = api.importCsv(csv);
  assert.deepEqual(imported.locations, []);
  assert.deepEqual(imported.skipped, []);
  assert.deepEqual(imported.settings, { icon: "16-solid/home", iconColor: "#112233", backgroundColor: "#abcdef", markerDiameter: 48 });
});

test("imports version 2 and 3 backups with the legacy marker diameter", () => {
  const v2 = api.importCsv("name,icon,icon_color,background_color,lat,long,default_icon_color,default_background_color,sondehub_csv_version\nA,,,,1,2,#112233,#abcdef,2");
  assert.equal(v2.settings.markerDiameter, 26);
  assert.equal(v2.locations[0].markerDiameter, null);
  const v3 = api.importCsv("name,icon,icon_color,background_color,lat,long,default_icon,default_icon_color,default_background_color,sondehub_csv_version\nA,,,,1,2,home,#112233,#abcdef,3");
  assert.equal(v3.settings.markerDiameter, 26);
});

test("imports version 1 minimal CSV and version 4 diameter metadata", () => {
  const v1 = api.importCsv("name,lat,long\nMinimal,1,2");
  assert.equal(v1.skipped.length, 0);
  assert.deepEqual(v1.locations.map(({ id, ...location }) => location), [
    { name: "Minimal", icon: null, iconColor: null, backgroundColor: null, markerDiameter: null, lat: 1, long: 2 }
  ]);
  assert.equal(v1.settings, null);

  const v4 = api.importCsv("name,lat,long,marker_diameter,default_icon,default_icon_color,default_background_color,default_marker_diameter,sondehub_csv_version\nSized,3,4,42,map-pin,#000000,#facc15,36,4");
  assert.equal(v4.skipped.length, 0);
  assert.equal(v4.locations[0].markerDiameter, 42);
  assert.deepEqual(v4.settings, { icon: "16-solid/map-pin", iconColor: "#000000", backgroundColor: "#facc15", markerDiameter: 36 });
});

test("exports spreadsheet-safe names without changing names on re-import", () => {
  const names = ["=1+1", "+SUM(1,2)", "-2+3", "@command", "'literal"];
  const csv = api.exportCsv(names.map((name, index) => ({ id: String(index), name, lat: 1, long: 2 })));
  const rows = api.parseCsv(csv);
  assert.deepEqual(rows.slice(1).map((row) => row[0]), names.map((name) => `'${name}`));
  assert.deepEqual(api.importCsv(csv).locations.map((location) => location.name), names);
});
