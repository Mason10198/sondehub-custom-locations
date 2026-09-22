/* Storage repository. Values are normalized before every write/read. */
(function exposeRepository(root, factory) {
  const api = factory(root.SondeHubLocations);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SondeHubLocationRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function repositoryFactory(locationsApi) {
  "use strict";
  const STORAGE_KEY = "locations";

  function normalizeCollection(value) {
    const seen = new Set();
    if (!Array.isArray(value)) return [];
    return value.reduce((all, item) => {
      const result = locationsApi.validateLocation(item);
      if (!result.ok || seen.has(result.value.id)) return all;
      seen.add(result.value.id);
      all.push(result.value);
      return all;
    }, []);
  }

  function createRepository(storageArea) {
    if (!storageArea || typeof storageArea.get !== "function" || typeof storageArea.set !== "function") throw new TypeError("A browser.storage.local-compatible area is required");
    // storage.local has no compare-and-swap. Serialize each instance's
    // read-modify-write operations so concurrent option-page actions do not
    // overwrite one another's fresh values.
    let writeTail = Promise.resolve();
    function serialize(operation) {
      const task = writeTail.then(operation, operation);
      writeTail = task.catch(() => {});
      return task;
    }
    async function getAll() {
      const result = await storageArea.get(STORAGE_KEY);
      return normalizeCollection(result[STORAGE_KEY]);
    }
    async function writeAll(locations) {
      const normalized = normalizeCollection(locations);
      await storageArea.set({ [STORAGE_KEY]: normalized });
      return normalized;
    }
    function replaceAll(locations) { return serialize(() => writeAll(locations)); }
    async function addMany(locations) {
      const additions = normalizeCollection(locations);
      return serialize(async () => writeAll((await getAll()).concat(additions)));
    }
    function save(input) {
      const checked = locationsApi.validateLocation(input);
      if (!checked.ok) throw new Error(checked.errors.join("; "));
      return serialize(async () => {
        const current = await getAll();
        const position = current.findIndex((location) => location.id === checked.value.id);
        if (position === -1) current.push(checked.value);
        else current[position] = checked.value;
        return writeAll(current);
      });
    }
    function remove(id) {
      return serialize(async () => writeAll((await getAll()).filter((location) => location.id !== id)));
    }
    function clear() { return serialize(async () => { await storageArea.remove(STORAGE_KEY); return []; }); }
    return { getAll, replaceAll, addMany, save, remove, clear };
  }
  return { STORAGE_KEY, normalizeCollection, createRepository };
});
