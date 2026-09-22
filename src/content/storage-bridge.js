/* Isolated world: one-way, minimal storage-to-map event bridge. */
(() => {
  "use strict";
  const EVENT = "sondehub-custom-locations:update";
  const KEY = "locations";

  async function sendSnapshot() {
    try {
      const result = await browser.storage.local.get(KEY);
      // The MAIN-world adapter must receive display data to render Leaflet markers.
      // Never export IDs or accept page-originated requests for a fresh read.
      const detail = SondeHubLocationProtocol.serialize(result[KEY]);
      if (detail !== null) document.dispatchEvent(new CustomEvent(EVENT, { detail }));
    } catch (error) {
      // Tracker functionality must continue if extension storage is unavailable.
      console.warn("SondeHub Custom Locations: unable to read saved locations", error);
    }
  }
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && Object.hasOwn(changes, KEY)) sendSnapshot();
  });
  // The adapter is injected first by manifest order and is ready for this push.
  // Do not listen for pageshow: page code could synthesize it to request an export.
  sendSnapshot();
})();
