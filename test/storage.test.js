"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/shared/locations.js");
const { MAX_LOCATIONS, SYNC_QUOTA_BYTES, SYNC_QUOTA_BYTES_PER_ITEM, createRepository, isLocationChange } = require("../src/shared/storage.js");

function memoryStorage(initial = {}) {
  let data = structuredClone(initial);
  const sets = [];
  return {
    async get(key) {
      if (key == null) return structuredClone(data);
      if (Array.isArray(key)) return Object.fromEntries(key.filter((item) => Object.hasOwn(data, item)).map((item) => [item, structuredClone(data[item])]));
      return Object.hasOwn(data, key) ? { [key]: structuredClone(data[key]) } : {};
    },
    async set(value) { sets.push(structuredClone(value)); data = { ...data, ...structuredClone(value) }; },
    async remove(key) { for (const item of Array.isArray(key) ? key : [key]) delete data[item]; },
    snapshot() { return structuredClone(data); },
    setCalls() { return structuredClone(sets); }
  };
}

test("repository saves normalized sync records and edits by stable ID", async () => {
  const sync = memoryStorage(), repo = createRepository(sync);
  await repo.save({ id: "one", name: " Home ", icon: "INVALID", lat: "1.25", long: "2.5" });
  await repo.save({ id: "one", name: "Updated", icon: "star", lat: 3, long: 4 });
  assert.deepEqual(await repo.getAll(), [{ id: "one", name: "Updated", icon: "16-solid/star", iconColor: "#000000", backgroundColor: "#facc15", lat: 3, long: 4 }]);
  assert.deepEqual(Object.keys(sync.snapshot()), ["location:one"]);
  assert.equal(sync.snapshot()["location:one"].order, 0);
});

test("repository migrates legacy local locations into sync without losing synced records", async () => {
  const sync = memoryStorage({ "location:remote": { order: 0, location: { id: "remote", name: "Remote", lat: 5, long: 6 } } });
  const local = memoryStorage({ locations: [{ id: "local", name: "Local", lat: 1, long: 2 }] });
  const repo = createRepository(sync, local);
  assert.deepEqual((await repo.getAll()).map((location) => location.id), ["remote", "local"]);
  assert.equal(Object.hasOwn(local.snapshot(), "locations"), false);
  assert.deepEqual(Object.keys(sync.snapshot()).sort(), ["location:local", "location:remote"]);
});

test("repository migrates the legacy single-array sync layout", async () => {
  const sync = memoryStorage({ locations: [{ id: "legacy", name: "Legacy", lat: 1, long: 2 }] });
  const repo = createRepository(sync);
  assert.deepEqual((await repo.getAll()).map((location) => location.id), ["legacy"]);
  assert.deepEqual(Object.keys(sync.snapshot()), ["location:legacy"]);
});

test("repositories sharing a sync area observe each other's completed changes", async () => {
  const sync = memoryStorage();
  const firstDevice = createRepository(sync);
  const secondDevice = createRepository(sync);
  await firstDevice.save({ id: "shared", name: "First", lat: 1, long: 2 });
  assert.equal((await secondDevice.getAll())[0].name, "First");
  await secondDevice.save({ id: "shared", name: "Updated", lat: 3, long: 4 });
  assert.deepEqual(await firstDevice.getAll(), [{ id: "shared", name: "Updated", icon: "16-solid/map-pin", iconColor: "#000000", backgroundColor: "#facc15", lat: 3, long: 4 }]);
  await secondDevice.remove("shared");
  assert.deepEqual(await firstDevice.getAll(), []);
});

test("single-location saves publish only the changed sync record", async () => {
  const sync = memoryStorage({
    "location:a": { order: 0, location: { id: "a", name: "A", lat: 1, long: 2 } },
    "location:b": { order: 1, location: { id: "b", name: "B", lat: 3, long: 4 } }
  });
  const repo = createRepository(sync);
  await repo.save({ id: "a", name: "Updated A", lat: 5, long: 6 });
  assert.deepEqual(Object.keys(sync.setCalls().at(-1)), ["location:a"]);
  assert.equal(sync.snapshot()["location:b"].location.name, "B");
});

test("adding locations publishes only new sync records", async () => {
  const sync = memoryStorage({ "location:a": { order: 0, location: { id: "a", name: "A", lat: 1, long: 2 } } });
  const repo = createRepository(sync);
  await repo.addMany([{ id: "b", name: "B", lat: 3, long: 4 }, { id: "c", name: "C", lat: 5, long: 6 }]);
  assert.deepEqual(Object.keys(sync.setCalls().at(-1)).sort(), ["location:b", "location:c"]);
});

test("repository adds, removes, and clears locations", async () => {
  const sync = memoryStorage(), repo = createRepository(sync);
  await repo.addMany([{ id: "a", name: "A", lat: 1, long: 2 }, { id: "b", name: "B", lat: 3, long: 4 }]);
  await repo.remove("a");
  assert.equal((await repo.getAll())[0].id, "b");
  await repo.clear();
  assert.deepEqual(await repo.getAll(), []);
  assert.deepEqual(sync.snapshot(), {});
});

test("repository serializes simultaneous saves without losing either location", async () => {
  const repo = createRepository(memoryStorage());
  await Promise.all([
    repo.save({ id: "first", name: "First", lat: 1, long: 2 }),
    repo.save({ id: "second", name: "Second", lat: 3, long: 4 })
  ]);
  assert.deepEqual((await repo.getAll()).map((location) => location.id), ["first", "second"]);
});

test("repository enforces the bounded Firefox Sync record limit", async () => {
  const repo = createRepository(memoryStorage());
  const locations = Array.from({ length: MAX_LOCATIONS + 1 }, (_, index) => ({ id: `id-${index}`, name: `Location ${index}`, lat: 1, long: 2 }));
  await assert.rejects(repo.replaceAll(locations), new RegExp(`at most ${MAX_LOCATIONS}`));
});

test("maximum ordinary collection remains below Firefox Sync quotas", async () => {
  const sync = memoryStorage();
  const repo = createRepository(sync);
  const locations = Array.from({ length: MAX_LOCATIONS }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: "W".repeat(120),
    icon: "16-solid/arrow-up-right",
    iconColor: "#ffffff",
    backgroundColor: "#000000",
    lat: -90,
    long: -180
  }));
  await repo.replaceAll(locations);
  const entries = Object.entries(sync.snapshot());
  const sizes = entries.map(([key, value]) => JSON.stringify(key).length + JSON.stringify(value).length);
  assert.equal(entries.length, MAX_LOCATIONS);
  assert.ok(Math.max(...sizes) < 8192);
  assert.ok(sizes.reduce((total, size) => total + size, 0) < SYNC_QUOTA_BYTES);
});

test("repository rejects valid records that would exceed the Firefox Sync byte quota", async () => {
  const repo = createRepository(memoryStorage());
  const locations = Array.from({ length: MAX_LOCATIONS }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    name: '"'.repeat(120),
    icon: "16-solid/map-pin",
    lat: 1,
    long: 2
  }));
  await assert.rejects(repo.replaceAll(locations), /Firefox Sync storage is full/);
});

test("repository rejects a record that exceeds the Firefox Sync per-item quota", async () => {
  const repo = createRepository(memoryStorage());
  await assert.rejects(repo.save({ id: "x".repeat(SYNC_QUOTA_BYTES_PER_ITEM), name: "Large", lat: 1, long: 2 }), /too large for Firefox Sync/);
});

test("storage change detection covers sync records and legacy migration only", () => {
  assert.equal(isLocationChange({ "location:one": { newValue: {} } }), true);
  assert.equal(isLocationChange({ locations: { newValue: [] } }), true);
  assert.equal(isLocationChange({ unrelated: { newValue: true } }), false);
});
