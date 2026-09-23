/* Sync-backed storage repository with one bounded item per location. */
(function exposeRepository(root, factory) {
  const api = factory(root.SondeHubLocations);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SondeHubLocationRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function repositoryFactory(locationsApi) {
  "use strict";
  const LEGACY_STORAGE_KEY = "locations";
  const RECORD_PREFIX = "location:";
  const MAX_LOCATIONS = 250;
  const SYNC_QUOTA_BYTES = 102400;
  const SYNC_QUOTA_BYTES_PER_ITEM = 8192;

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

  function isLocationChange(changes) {
    return Object.keys(changes || {}).some((key) => key === LEGACY_STORAGE_KEY || key.startsWith(RECORD_PREFIX));
  }

  function createRepository(storageArea, legacyLocalArea) {
    if (!storageArea || typeof storageArea.get !== "function" || typeof storageArea.set !== "function" || typeof storageArea.remove !== "function") throw new TypeError("A browser.storage-compatible area is required");
    let writeTail = Promise.resolve();
    let migration;

    function serialize(operation) {
      const task = writeTail.then(operation, operation);
      writeTail = task.catch(() => {});
      return task;
    }

    async function readArea(area) {
      return area && typeof area.get === "function" ? area.get(null) : {};
    }

    function recordsFrom(items) {
      return Object.entries(items || {})
        .filter(([key]) => key.startsWith(RECORD_PREFIX))
        .map(([key, record]) => {
          const checked = locationsApi.validateLocation(record && record.location, { allowGeneratedId: false });
          return checked.ok && checked.value.id && key === `${RECORD_PREFIX}${checked.value.id}`
            ? { key, location: checked.value, order: Number.isSafeInteger(record.order) && record.order >= 0 ? record.order : Number.MAX_SAFE_INTEGER }
            : null;
        })
        .filter(Boolean)
        .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
    }

    function assertCapacity(locations) {
      if (locations.length > MAX_LOCATIONS) throw new Error(`Firefox Sync supports at most ${MAX_LOCATIONS} saved locations in this extension`);
    }

    function storageBytes(items) {
      return Object.entries(items).reduce((total, [key, value]) => total + JSON.stringify(key).length + JSON.stringify(value).length, 0);
    }

    function assertSyncQuota(items) {
      if (Object.entries(items).some(([key, value]) => JSON.stringify(key).length + JSON.stringify(value).length > SYNC_QUOTA_BYTES_PER_ITEM)) throw new Error("A location is too large for Firefox Sync. Shorten its name before trying again");
      if (storageBytes(items) > SYNC_QUOTA_BYTES) throw new Error("Firefox Sync storage is full. Shorten location names or remove locations before trying again");
    }

    async function writeRecords(locations) {
      const normalized = normalizeCollection(locations);
      assertCapacity(normalized);
      const current = await readArea(storageArea);
      const desired = Object.fromEntries(normalized.map((location, order) => [`${RECORD_PREFIX}${location.id}`, { order, location }]));
      assertSyncQuota(desired);
      const stale = Object.keys(current).filter((key) => key.startsWith(RECORD_PREFIX) && !Object.hasOwn(desired, key));
      const removable = stale.concat(Object.hasOwn(current, LEGACY_STORAGE_KEY) ? [LEGACY_STORAGE_KEY] : []);
      const projected = { ...current, ...desired };
      let removedFirst = false;
      if (storageBytes(projected) > SYNC_QUOTA_BYTES && removable.length) {
        await storageArea.remove(removable);
        removedFirst = true;
      }
      if (Object.keys(desired).length) await storageArea.set(desired);
      if (!removedFirst && removable.length) await storageArea.remove(removable);
      return normalized;
    }

    async function migrate() {
      const synced = await readArea(storageArea);
      const records = recordsFrom(synced).map((record) => record.location);
      const syncLegacy = normalizeCollection(synced[LEGACY_STORAGE_KEY]);
      const local = legacyLocalArea && legacyLocalArea !== storageArea ? await readArea(legacyLocalArea) : {};
      const localLegacy = normalizeCollection(local[LEGACY_STORAGE_KEY]);
      if (!syncLegacy.length && !localLegacy.length) return;
      const merged = normalizeCollection(records.concat(syncLegacy, localLegacy));
      await writeRecords(merged);
      if (legacyLocalArea && legacyLocalArea !== storageArea && Object.hasOwn(local, LEGACY_STORAGE_KEY)) await legacyLocalArea.remove(LEGACY_STORAGE_KEY);
    }

    function ensureMigrated() {
      if (!migration) migration = migrate().catch((error) => { migration = undefined; throw error; });
      return migration;
    }

    async function getAll() {
      await ensureMigrated();
      return recordsFrom(await readArea(storageArea)).map((record) => record.location);
    }

    function replaceAll(locations) { return serialize(async () => { await ensureMigrated(); return writeRecords(locations); }); }

    function addMany(locations) {
      const additions = normalizeCollection(locations);
      return serialize(async () => {
        await ensureMigrated();
        const currentItems = await readArea(storageArea);
        const currentRecords = recordsFrom(currentItems);
        const existingIds = new Set(currentRecords.map((record) => record.location.id));
        const changes = {};
        let nextOrder = currentRecords.reduce((maximum, record) => Math.max(maximum, record.order), -1) + 1;
        for (const location of additions) {
          if (existingIds.has(location.id)) continue;
          changes[`${RECORD_PREFIX}${location.id}`] = { order: nextOrder, location };
          existingIds.add(location.id);
          nextOrder += 1;
        }
        const projected = Object.fromEntries(currentRecords.map((record) => [record.key, { order: record.order, location: record.location }]));
        Object.assign(projected, changes);
        assertCapacity(Object.values(projected));
        assertSyncQuota(projected);
        if (Object.keys(changes).length) await storageArea.set(changes);
        return getAll();
      });
    }

    function save(input) {
      const checked = locationsApi.validateLocation(input);
      if (!checked.ok) throw new Error(checked.errors.join("; "));
      return serialize(async () => {
        await ensureMigrated();
        const currentRecords = recordsFrom(await readArea(storageArea));
        const existing = currentRecords.find((record) => record.location.id === checked.value.id);
        const order = existing ? existing.order : currentRecords.reduce((maximum, record) => Math.max(maximum, record.order), -1) + 1;
        const key = `${RECORD_PREFIX}${checked.value.id}`;
        const record = { order, location: checked.value };
        const projected = Object.fromEntries(currentRecords.map((item) => [item.key, { order: item.order, location: item.location }]));
        projected[key] = record;
        assertCapacity(Object.values(projected));
        assertSyncQuota(projected);
        await storageArea.set({ [key]: record });
        return getAll();
      });
    }

    function remove(id) {
      return serialize(async () => {
        await ensureMigrated();
        await storageArea.remove(`${RECORD_PREFIX}${id}`);
        return getAll();
      });
    }

    function clear() {
      return serialize(async () => {
        await ensureMigrated();
        const keys = Object.keys(await readArea(storageArea)).filter((key) => key === LEGACY_STORAGE_KEY || key.startsWith(RECORD_PREFIX));
        if (keys.length) await storageArea.remove(keys);
        if (legacyLocalArea && legacyLocalArea !== storageArea) await legacyLocalArea.remove(LEGACY_STORAGE_KEY);
        return [];
      });
    }

    return { getAll, replaceAll, addMany, save, remove, clear };
  }

  return { LEGACY_STORAGE_KEY, RECORD_PREFIX, MAX_LOCATIONS, SYNC_QUOTA_BYTES, SYNC_QUOTA_BYTES_PER_ITEM, normalizeCollection, isLocationChange, createRepository };
});
