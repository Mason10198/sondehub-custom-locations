/* Sync-backed storage repository with one bounded item per location. */
(function exposeRepository(root, factory) {
  const api = factory(root.SondeHubLocations);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SondeHubLocationRepository = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function repositoryFactory(locationsApi) {
  "use strict";
  const LEGACY_STORAGE_KEY = "locations";
  const SETTINGS_KEY = "settings";
  const RECORD_PREFIX = "location:";
  const RECORD_SCHEMA = 4;
  const MAX_LOCATIONS = 250;
  const SYNC_QUOTA_BYTES = 102400;
  const SYNC_QUOTA_BYTES_PER_ITEM = 8192;

  function normalizeCollection(value) {
    const seen = new Set();
    if (!Array.isArray(value)) return [];
    return value.reduce((all, item) => {
      const result = locationsApi.validateLocation(item, { inheritMissingIcon: true, inheritMissingColors: true, inheritMissingDiameter: true });
      if (!result.ok || seen.has(result.value.id)) return all;
      seen.add(result.value.id);
      all.push(result.value);
      return all;
    }, []);
  }

  function isLocationChange(changes) {
    return Object.keys(changes || {}).some((key) => key === LEGACY_STORAGE_KEY || key === SETTINGS_KEY || key.startsWith(RECORD_PREFIX));
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

    function legacyColor(value, fallback) {
      const normalized = locationsApi.normalizeColor(value, fallback);
      return normalized === fallback ? null : normalized;
    }

    function recordsFrom(items) {
      return Object.entries(items || {})
        .filter(([key]) => key.startsWith(RECORD_PREFIX))
        .map(([key, record]) => {
          const schema = record && Number.isInteger(record.schema) ? record.schema : 0;
          const currentSchema = schema === RECORD_SCHEMA;
          const source = record && record.location ? { ...record.location } : null;
          if (source && schema < 3) {
            const normalizedIcon = locationsApi.normalizeIcon(source.icon);
            source.icon = normalizedIcon === locationsApi.DEFAULT_ICON ? null : normalizedIcon;
            source.iconColor = legacyColor(source.iconColor, locationsApi.DEFAULT_ICON_COLOR);
            source.backgroundColor = legacyColor(source.backgroundColor, locationsApi.DEFAULT_BACKGROUND_COLOR);
          }
          if (source && schema < 4) {
            source.markerDiameter = null;
          }
          const checked = locationsApi.validateLocation(source, { allowGeneratedId: false, inheritMissingIcon: true, inheritMissingColors: true, inheritMissingDiameter: true });
          return checked.ok && checked.value.id && key === `${RECORD_PREFIX}${checked.value.id}`
            ? { key, location: checked.value, order: Number.isSafeInteger(record.order) && record.order >= 0 ? record.order : Number.MAX_SAFE_INTEGER, needsMigration: !currentSchema }
            : null;
        })
        .filter(Boolean)
        .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
    }

    function settingsFrom(items) {
      return locationsApi.validateSettings(items && items[SETTINGS_KEY]).value;
    }

    function recordValue(location, order) {
      return { schema: RECORD_SCHEMA, order, location };
    }

    function recordItems(records) {
      return Object.fromEntries(records.map((record) => [record.key, recordValue(record.location, record.order)]));
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

    function withSettings(items, locations) {
      const result = { ...locations };
      if (Object.hasOwn(items, SETTINGS_KEY)) result[SETTINGS_KEY] = settingsFrom(items);
      return result;
    }

    async function writeRecords(locations, nextSettings) {
      const normalized = normalizeCollection(locations);
      const checkedSettings = nextSettings == null ? null : locationsApi.validateSettings(nextSettings);
      if (checkedSettings && !checkedSettings.ok) throw new Error(checkedSettings.errors.join("; "));
      assertCapacity(normalized);
      const current = await readArea(storageArea);
      const desired = Object.fromEntries(normalized.map((location, order) => [`${RECORD_PREFIX}${location.id}`, recordValue(location, order)]));
      const finalItems = checkedSettings ? { ...desired, [SETTINGS_KEY]: checkedSettings.value } : withSettings(current, desired);
      assertSyncQuota(finalItems);
      const stale = Object.keys(current).filter((key) => key.startsWith(RECORD_PREFIX) && !Object.hasOwn(desired, key));
      const removable = stale.concat(Object.hasOwn(current, LEGACY_STORAGE_KEY) ? [LEGACY_STORAGE_KEY] : []);
      const changes = checkedSettings ? { ...desired, [SETTINGS_KEY]: checkedSettings.value } : desired;
      const projected = { ...current, ...changes };
      let removedFirst = false;
      if (storageBytes(projected) > SYNC_QUOTA_BYTES && removable.length) {
        await storageArea.remove(removable);
        removedFirst = true;
      }
      if (Object.keys(changes).length) await storageArea.set(changes);
      if (!removedFirst && removable.length) await storageArea.remove(removable);
      return normalized;
    }

    async function migrate() {
      const synced = await readArea(storageArea);
      const syncedRecords = recordsFrom(synced);
      const inheritedLegacyAppearance = (location) => Object.freeze({
        ...location,
        icon: locationsApi.normalizeIcon(location.icon) === locationsApi.DEFAULT_ICON ? null : locationsApi.normalizeIcon(location.icon),
        iconColor: legacyColor(location.iconColor, locationsApi.DEFAULT_ICON_COLOR),
        backgroundColor: legacyColor(location.backgroundColor, locationsApi.DEFAULT_BACKGROUND_COLOR),
        markerDiameter: null
      });
      const syncLegacy = normalizeCollection(synced[LEGACY_STORAGE_KEY]).map(inheritedLegacyAppearance);
      const local = legacyLocalArea && legacyLocalArea !== storageArea ? await readArea(legacyLocalArea) : {};
      const localLegacy = normalizeCollection(local[LEGACY_STORAGE_KEY]).map(inheritedLegacyAppearance);
      const needsRecordMigration = syncedRecords.some((record) => record.needsMigration);
      if (!syncLegacy.length && !localLegacy.length && !needsRecordMigration) return;
      const merged = normalizeCollection(syncedRecords.map((record) => record.location).concat(syncLegacy, localLegacy));
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

    async function getSettings() {
      await ensureMigrated();
      return settingsFrom(await readArea(storageArea));
    }

    async function getResolved() {
      await ensureMigrated();
      const items = await readArea(storageArea);
      const settings = settingsFrom(items);
      return recordsFrom(items).map((record) => locationsApi.resolveLocationAppearance(record.location, settings).value);
    }

    function saveSettings(input) {
      const checked = locationsApi.validateSettings(input);
      if (!checked.ok) throw new Error(checked.errors.join("; "));
      return serialize(async () => {
        await ensureMigrated();
        const current = await readArea(storageArea);
        const projected = { ...current, [SETTINGS_KEY]: checked.value };
        assertSyncQuota(projected);
        await storageArea.set({ [SETTINGS_KEY]: checked.value });
        return checked.value;
      });
    }

    function replaceAll(locations, settings) { return serialize(async () => { await ensureMigrated(); return writeRecords(locations, settings); }); }

    function addMany(locations, settings) {
      const additions = normalizeCollection(locations);
      const checkedSettings = settings == null ? null : locationsApi.validateSettings(settings);
      if (checkedSettings && !checkedSettings.ok) throw new Error(checkedSettings.errors.join("; "));
      return serialize(async () => {
        await ensureMigrated();
        const currentItems = await readArea(storageArea);
        const currentRecords = recordsFrom(currentItems);
        const existingIds = new Set(currentRecords.map((record) => record.location.id));
        const changes = {};
        let nextOrder = currentRecords.reduce((maximum, record) => Math.max(maximum, record.order), -1) + 1;
        for (const location of additions) {
          if (existingIds.has(location.id)) continue;
          changes[`${RECORD_PREFIX}${location.id}`] = recordValue(location, nextOrder);
          existingIds.add(location.id);
          nextOrder += 1;
        }
        if (checkedSettings) changes[SETTINGS_KEY] = checkedSettings.value;
        const projected = recordItems(currentRecords);
        Object.assign(projected, Object.fromEntries(Object.entries(changes).filter(([key]) => key.startsWith(RECORD_PREFIX))));
        assertCapacity(Object.values(projected));
        const projectedItems = checkedSettings ? { ...projected, [SETTINGS_KEY]: checkedSettings.value } : withSettings(currentItems, projected);
        assertSyncQuota(projectedItems);
        if (Object.keys(changes).length) await storageArea.set(changes);
        return getAll();
      });
    }

    function save(input) {
      const checked = locationsApi.validateLocation(input, { inheritMissingIcon: true, inheritMissingColors: true, inheritMissingDiameter: true });
      if (!checked.ok) throw new Error(checked.errors.join("; "));
      return serialize(async () => {
        await ensureMigrated();
        const currentItems = await readArea(storageArea);
        const currentRecords = recordsFrom(currentItems);
        const existing = currentRecords.find((record) => record.location.id === checked.value.id);
        const order = existing ? existing.order : currentRecords.reduce((maximum, record) => Math.max(maximum, record.order), -1) + 1;
        const key = `${RECORD_PREFIX}${checked.value.id}`;
        const record = recordValue(checked.value, order);
        const projected = recordItems(currentRecords);
        projected[key] = record;
        assertCapacity(Object.values(projected));
        assertSyncQuota(withSettings(currentItems, projected));
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

    return { getAll, getResolved, getSettings, saveSettings, replaceAll, addMany, save, remove, clear };
  }

  return { LEGACY_STORAGE_KEY, SETTINGS_KEY, RECORD_PREFIX, RECORD_SCHEMA, MAX_LOCATIONS, SYNC_QUOTA_BYTES, SYNC_QUOTA_BYTES_PER_ITEM, normalizeCollection, isLocationChange, createRepository };
});