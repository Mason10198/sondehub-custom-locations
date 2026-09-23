/* Extension-origin renderer. Stored marker data never enters the SondeHub page realm. */
(function exposePrivateOverlay(root, factory) {
  const api = factory(root.SondeHubIcons, root.SondeHubLocationRepository);
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.start();
})(typeof globalThis !== "undefined" ? globalThis : this, function privateOverlayFactory(iconCatalog, repositoryApi) {
  "use strict";
  const MESSAGE_TYPE = "sondehub-custom-locations:viewport";
  const MIN_LABEL_ZOOM = 8;
  const MAX_LOCATIONS = 250;

  function validViewport(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const keys = ["type", "version", "width", "height", "zoom", "centerLat", "centerLong"];
    if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) return null;
    if (value.type !== MESSAGE_TYPE || value.version !== 1) return null;
    if (![value.width, value.height, value.zoom, value.centerLat, value.centerLong].every(Number.isFinite)) return null;
    if (value.width <= 0 || value.width > 10000 || value.height <= 0 || value.height > 10000) return null;
    if (value.zoom < 0 || value.zoom > 24) return null;
    if (value.centerLat < -90 || value.centerLat > 90 || value.centerLong < -540 || value.centerLong > 540) return null;
    return Object.freeze({ type: MESSAGE_TYPE, version: 1, width: value.width, height: value.height, zoom: value.zoom, centerLat: value.centerLat, centerLong: value.centerLong });
  }

  function worldPixel(lat, long, zoom) {
    const size = 256 * (2 ** zoom);
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const sine = Math.sin((safeLat * Math.PI) / 180);
    return { x: ((long + 180) / 360) * size, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size, size };
  }

  function project(lat, long, viewport) {
    const point = worldPixel(lat, long, viewport.zoom);
    const center = worldPixel(viewport.centerLat, viewport.centerLong, viewport.zoom);
    let deltaX = point.x - center.x;
    if (deltaX > point.size / 2) deltaX -= point.size;
    if (deltaX < -point.size / 2) deltaX += point.size;
    return Object.freeze({ x: viewport.width / 2 + deltaX, y: viewport.height / 2 + point.y - center.y });
  }

  function glyphSize(diameter) {
    return Math.min(diameter - 4, Math.max(16, Math.round(diameter * 0.62)));
  }

  function markerTransform(point) {
    return `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
  }

  function start(environment = {}) {
    const view = environment.window || (typeof window !== "undefined" ? window : null);
    const doc = environment.document || (typeof document !== "undefined" ? document : null);
    const extension = environment.browser || (typeof browser !== "undefined" ? browser : null);
    const icons = environment.iconCatalog || iconCatalog;
    const repositories = environment.repositoryApi || repositoryApi;
    if (!view || !doc || !extension || !icons || !repositories) return null;
    const rootElement = doc.getElementById("markers");
    if (!rootElement) return null;
    const repository = repositories.createRepository(extension.storage.sync, extension.storage.local);
    let viewport = null;
    let locations = [];
    const markers = new Map();

    function updatePositions() {
      if (!viewport) return;
      rootElement.classList.toggle("labels-hidden", viewport.zoom < MIN_LABEL_ZOOM);
      const margin = 80;
      for (const location of locations.slice(0, MAX_LOCATIONS)) {
        const marker = markers.get(location.id);
        if (!marker) continue;
        const point = project(location.lat, location.long, viewport);
        const hidden = point.x < -margin || point.y < -margin || point.x > viewport.width + margin || point.y > viewport.height + margin;
        marker.hidden = hidden;
        if (!hidden) marker.style.transform = markerTransform(point);
      }
    }

    function rebuildMarkers() {
      const fragment = doc.createDocumentFragment();
      markers.clear();
      for (const location of locations.slice(0, MAX_LOCATIONS)) {
        const marker = doc.createElement("div");
        marker.className = "marker";
        marker.style.width = `${location.markerDiameter}px`;
        marker.style.height = `${location.markerDiameter}px`;
        marker.style.setProperty("--marker-color", location.iconColor);
        marker.style.setProperty("--marker-background", location.backgroundColor);
        marker.style.setProperty("--glyph-size", `${glyphSize(location.markerDiameter)}px`);
        marker.setAttribute("data-marker", "true");
        const icon = doc.createElement("span");
        const parsedIcon = new view.DOMParser().parseFromString(icons.svgFor(icons.normalizeIcon(location.icon)), "image/svg+xml").documentElement;
        if (parsedIcon.localName === "svg" && parsedIcon.namespaceURI === "http://www.w3.org/2000/svg") icon.append(doc.importNode(parsedIcon, true));
        const label = doc.createElement("span");
        label.className = "marker-label";
        label.textContent = location.name;
        marker.append(icon, label);
        markers.set(location.id, marker);
        fragment.append(marker);
      }
      rootElement.replaceChildren(fragment);
      updatePositions();
    }

    async function loadLocations() {
      try {
        locations = await repository.getResolved();
        rebuildMarkers();
      } catch (error) {
        console.warn("SondeHub Custom Locations: unable to read saved locations", error);
      }
    }

    view.addEventListener("message", (event) => {
      if (event.source !== view.parent) return;
      const next = validViewport(event.data);
      if (!next) return;
      viewport = next;
      updatePositions();
    });
    extension.storage.onChanged.addListener((changes, areaName) => {
      if ((areaName === "sync" || areaName === "local") && repositories.isLocationChange(changes)) loadLocations();
    });
    loadLocations();
    return Object.freeze({ updatePositions, rebuildMarkers, loadLocations, get locations() { return locations; }, get viewport() { return viewport; } });
  }

  return Object.freeze({ MESSAGE_TYPE, MIN_LABEL_ZOOM, MAX_LOCATIONS, validViewport, worldPixel, project, glyphSize, markerTransform, start });
});
