/* Runs in the page's MAIN world. It owns only one Leaflet LayerGroup. */
(() => {
  "use strict";
  const EVENT = "sondehub-custom-locations:update";
  const SENTINEL = "__sondeHubCustomLocationsAdapter";
  const LABEL = "Custom locations";
  const MAX_CONTROL_WAIT_ATTEMPTS = 240;
  const iconCatalog = window.SondeHubIcons;
  if (!iconCatalog) return;

  if (window[SENTINEL]) return;
  window[SENTINEL] = true;
  let group = null;
  let lastLocations = [];
  let waitingForMap = false;
  let overlayRegistered = false;

  function readyMap() {
    const mapElement = document.getElementById("map");
    return window.L && window.map && typeof window.map.addLayer === "function" && window.map._container === mapElement ? window.map : null;
  }
  function iconFor(location) {
    const safeIcon = iconCatalog.normalizeIcon(location.icon);
    return window.L.divIcon({ className: "shcl-marker-shell", html: `<span style="display:grid;width:24px;height:24px;place-items:center;border:2px solid ${location.iconColor};border-radius:50%;background:${location.backgroundColor};color:${location.iconColor};box-shadow:0 1px 3px #0008" aria-hidden="true">${iconCatalog.svgFor(safeIcon)}</span>`, iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14] });
  }
  function popupFor(location) {
    const container = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = location.name;
    const coordinates = document.createElement("div");
    coordinates.textContent = `${location.lat.toFixed(6)}, ${location.long.toFixed(6)}`;
    container.append(title, coordinates);
    return container;
  }

  function render() {
    if (!group) return;
    group.clearLayers();
    for (const location of lastLocations) {
      const marker = window.L.marker([location.lat, location.long], { icon: iconFor(location), title: location.name, keyboard: true });
      marker.bindPopup(popupFor(location));
      group.addLayer(marker);
    }
  }
  function registerOverlay() {
    if (overlayRegistered || !group || !window.layers || typeof window.layers.addOverlay !== "function") return overlayRegistered;
    try {
      window.layers.addOverlay(group, LABEL);
      overlayRegistered = true;
    } catch (_) {
      // Some tracker builds publish the control before it is ready; retry briefly.
    }
    return overlayRegistered;
  }
  function initialize() {
    const map = readyMap();
    if (!map) return false;
    if (!group) {
      group = window.L.layerGroup();
      group.addTo(map);
      render();
    }
    return true;
  }
  function retryInitialize() {
    if (waitingForMap) return;
    if (initialize() && registerOverlay()) return;
    waitingForMap = true;
    let attempts = 0;
    const observer = new MutationObserver(check);
    const stop = () => { waitingForMap = false; observer.disconnect(); window.clearInterval(timer); };
    function check() {
      if (!initialize()) return;
      if (registerOverlay()) stop();
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = window.setInterval(() => {
      attempts += 1;
      check();
      if (waitingForMap && attempts >= MAX_CONTROL_WAIT_ATTEMPTS) stop();
    }, 500);
  }

  document.addEventListener(EVENT, (event) => {
    const locations = window.SondeHubLocationProtocol.message(event.detail);
    if (locations === null) return;
    lastLocations = locations;
    if (initialize()) render();
    retryInitialize();
  });
  window.addEventListener("pageshow", () => { if (initialize()) render(); retryInitialize(); });
  retryInitialize();
})();
