/* Narrow, copied data protocol for the tracker map adapter. */
(function exposeProtocol(root, factory) {
  const api = factory(root.SondeHubLocations);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SondeHubLocationProtocol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function protocolFactory(locationsApi) {
  "use strict";
  const VERSION = 1;
  // Bound text before JSON.parse and the rendered marker count afterward.
  // This keeps page-originated events from consuming unbounded parser or map work.
  const MAX_TRANSPORT_CHARS = 65536;
  const MAX_LOCATIONS = 250;

  function displayLocation(input) {
    try {
      const result = locationsApi.validateLocation(input);
      if (!result.ok) return null;
      const value = result.value;
      return Object.freeze({ name: value.name, icon: value.icon, lat: value.lat, long: value.long });
    } catch (_) {
      return null;
    }
  }

  function snapshot(rawLocations) {
    if (!Array.isArray(rawLocations)) return Object.freeze([]);
    const locations = rawLocations.slice(0, MAX_LOCATIONS).map(displayLocation).filter(Boolean);
    return Object.freeze(locations);
  }

  function serialize(rawLocations) {
    try {
      const text = JSON.stringify({ version: VERSION, locations: snapshot(rawLocations) });
      return text.length <= MAX_TRANSPORT_CHARS ? text : null;
    } catch (_) {
      return null;
    }
  }

  function hasExactKeys(value, keys) {
    const actual = Object.keys(value);
    return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  }

  function parsedLocation(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !hasExactKeys(value, ["name", "icon", "lat", "long"])) return null;
    if (typeof value.name !== "string" || typeof value.icon !== "string" || typeof value.lat !== "number" || typeof value.long !== "number") return null;
    if (!locationsApi.ICONS.includes(value.icon)) return null;
    return displayLocation(value);
  }

  // CustomEvent crosses an isolated-world/page-world boundary as JSON text.
  // Invalid transport returns null so callers preserve existing markers.
  function message(text) {
    try {
      if (typeof text !== "string" || text.length === 0 || text.length > MAX_TRANSPORT_CHARS) return null;
      const raw = JSON.parse(text);
      if (!raw || typeof raw !== "object" || Array.isArray(raw) || !hasExactKeys(raw, ["version", "locations"]) || raw.version !== VERSION || !Array.isArray(raw.locations) || raw.locations.length > MAX_LOCATIONS) return null;
      const locations = raw.locations.map(parsedLocation);
      return locations.every(Boolean) ? Object.freeze(locations) : null;
    } catch (_) {
      return null;
    }
  }

  return { VERSION, MAX_TRANSPORT_CHARS, MAX_LOCATIONS, snapshot, serialize, message };
});
