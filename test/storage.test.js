"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/shared/locations.js");
const { createRepository } = require("../src/shared/storage.js");
function memoryStorage() { let data = {}; return { async get(key) { return { [key]: data[key] }; }, async set(value) { data = { ...data, ...value }; }, async remove(key) { delete data[key]; }, snapshot() { return data; } }; }
test("repository saves normalized records and edits by stable ID", async () => {
  const area = memoryStorage(), repo = createRepository(area);
  await repo.save({ id: "one", name: " Home ", icon: "INVALID", lat: "1.25", long: "2.5" });
  await repo.save({ id: "one", name: "Updated", icon: "star", lat: 3, long: 4 });
  assert.deepEqual(await repo.getAll(), [{ id: "one", name: "Updated", icon: "star", lat: 3, long: 4 }]);
});
test("repository adds, removes, and clears locations", async () => {
  const repo = createRepository(memoryStorage());
  await repo.addMany([{ id: "a", name: "A", lat: 1, long: 2 }, { id: "b", name: "B", lat: 3, long: 4 }]);
  await repo.remove("a"); assert.equal((await repo.getAll())[0].id, "b");
  await repo.clear(); assert.deepEqual(await repo.getAll(), []);
});
test("repository serializes simultaneous saves without losing either location", async () => {
  const repo = createRepository(memoryStorage());
  await Promise.all([
    repo.save({ id: "first", name: "First", lat: 1, long: 2 }),
    repo.save({ id: "second", name: "Second", lat: 3, long: 4 })
  ]);
  assert.deepEqual((await repo.getAll()).map((location) => location.id), ["first", "second"]);
});
