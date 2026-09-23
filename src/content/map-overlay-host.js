/* Isolated world: hosts a private extension-origin marker overlay above the Leaflet map. */
(function exposeMapOverlayHost(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.start();
})(typeof globalThis !== "undefined" ? globalThis : this, function mapOverlayHostFactory() {
  "use strict";
  const OVERLAY_ID = "sondehub-custom-locations-private-overlay";
  const TOGGLE_ID = "sondehub-custom-locations-toggle";
  const MESSAGE_TYPE = "sondehub-custom-locations:viewport";
  const MOUNT_POLL_MS = 500;
  const ACTIVE_TRACKING_MS = 350;

  function transformParts(value) {
    if (!value || value === "none") return { x: 0, y: 0, scale: 1 };
    let match = value.match(/^matrix\(([-+\d.e]+),\s*[-+\d.e]+,\s*[-+\d.e]+,\s*([-+\d.e]+),\s*([-+\d.e]+),\s*([-+\d.e]+)\)$/i);
    if (match) return { x: Number(match[3]), y: Number(match[4]), scale: Number(match[1]) === Number(match[2]) ? Number(match[1]) : NaN };
    match = value.match(/^matrix3d\((.+)\)$/i);
    if (match) {
      const numbers = match[1].split(",").map(Number);
      return numbers.length === 16 ? { x: numbers[12], y: numbers[13], scale: numbers[0] === numbers[5] ? numbers[0] : NaN } : { x: 0, y: 0, scale: NaN };
    }
    match = value.match(/translate3d\(\s*([-+\d.e]+)px,\s*([-+\d.e]+)px,\s*[-+\d.e]+px\s*\)/i) || value.match(/translate\(\s*([-+\d.e]+)px,\s*([-+\d.e]+)px\s*\)/i);
    const scaleMatch = value.match(/scale\(\s*([-+\d.e]+)\s*\)/i);
    return { x: match ? Number(match[1]) : 0, y: match ? Number(match[2]) : 0, scale: scaleMatch ? Number(scaleMatch[1]) : 1 };
  }

  function tileCoordinates(source) {
    try {
      const segments = new URL(source).pathname.split("/").filter(Boolean);
      for (let index = 0; index <= segments.length - 3; index += 1) {
        const z = Number(segments[index]);
        const x = Number(segments[index + 1]);
        const yMatch = segments[index + 2].match(/^(\d+)/);
        const y = yMatch ? Number(yMatch[1]) : NaN;
        if (Number.isInteger(z) && z >= 0 && z <= 24 && Number.isInteger(x) && Number.isInteger(y)) return { z, x, y };
      }
    } catch (_) {
      // Ignore malformed page tile URLs.
    }
    return null;
  }

  function nodeTransform(node, view) {
    const inline = node && node.style ? node.style.transform : "";
    const computed = !inline && view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(node).transform : "";
    return transformParts(inline || computed);
  }

  function localTilePosition(tile, mapElement, view) {
    const chain = [];
    let current = tile;
    while (current && current !== mapElement) {
      chain.push(current);
      current = current.parentElement;
    }
    if (current !== mapElement) return null;
    let x = 0;
    let y = 0;
    let scale = 1;
    for (const node of chain) {
      const part = nodeTransform(node, view);
      if (!Number.isFinite(part.scale) || part.scale <= 0) return null;
      x = part.x + part.scale * x;
      y = part.y + part.scale * y;
      scale *= part.scale;
    }
    return { x, y, scale };
  }

  function pixelToLongitude(pixel, scale) {
    return (pixel / scale) * 360 - 180;
  }

  function pixelToLatitude(pixel, scale) {
    const mercator = Math.PI - (2 * Math.PI * pixel) / scale;
    return (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  }

  function inferViewport(mapElement, view) {
    if (!mapElement || typeof mapElement.querySelectorAll !== "function") return null;
    const width = Number(mapElement.clientWidth);
    const height = Number(mapElement.clientHeight);
    if (!(width > 0 && height > 0)) return null;
    const tiles = mapElement.querySelectorAll("img.leaflet-tile");
    for (const tile of tiles) {
      const coordinates = tileCoordinates(tile.src || tile.getAttribute?.("src") || "");
      if (!coordinates) continue;
      const local = localTilePosition(tile, mapElement, view);
      if (!local) continue;
      const tileSize = Number.parseFloat(tile.style?.width || "") || Number(tile.width) || 256;
      if (!(tileSize > 0)) continue;
      const worldSize = tileSize * (2 ** coordinates.z) * local.scale;
      const centerPixelX = coordinates.x * tileSize * local.scale - local.x + width / 2;
      const centerPixelY = coordinates.y * tileSize * local.scale - local.y + height / 2;
      const centerLat = pixelToLatitude(centerPixelY, worldSize);
      const centerLong = pixelToLongitude(centerPixelX, worldSize);
      if (![centerLat, centerLong].every(Number.isFinite) || centerLat < -90 || centerLat > 90) continue;
      return Object.freeze({ type: MESSAGE_TYPE, version: 1, width, height, zoom: coordinates.z + Math.log2(local.scale), centerLat, centerLong });
    }
    return null;
  }

  function sameViewport(left, right) {
    if (!left || !right) return false;
    return left.width === right.width && left.height === right.height && Math.abs(left.zoom - right.zoom) < 1e-9 && Math.abs(left.centerLat - right.centerLat) < 1e-9 && Math.abs(left.centerLong - right.centerLong) < 1e-9;
  }

  function styleHost(element, styles) {
    for (const [name, value] of Object.entries(styles)) element.style.setProperty(name, value, "important");
  }

  function start(environment = {}) {
    const doc = environment.document || (typeof document !== "undefined" ? document : null);
    const view = environment.window || (typeof window !== "undefined" ? window : null);
    const extension = environment.browser || (typeof browser !== "undefined" ? browser : null);
    if (!doc || !view || !extension || view.__sondeHubCustomLocationsPrivateOverlay) return null;
    view.__sondeHubCustomLocationsPrivateOverlay = true;
    let overlay = null;
    let toggle = null;
    let mapElement = null;
    let loaded = false;
    let visible = true;
    let lastViewport = null;
    let mountTimer = null;
    let frame = null;
    let activeUntil = 0;
    let mapObserver = null;
    let resizeObserver = null;

    function now() {
      return view.performance && typeof view.performance.now === "function" ? view.performance.now() : Date.now();
    }

    function sendViewport(force = false) {
      if (!loaded || !overlay || !visible || !mapElement) return;
      const viewport = inferViewport(mapElement, view);
      if (!viewport || (!force && sameViewport(viewport, lastViewport))) return;
      lastViewport = viewport;
      // Only public map viewport geometry crosses this boundary. Extension-private marker data never does.
      overlay.contentWindow.postMessage(viewport, "*");
    }

    function trackFrame() {
      frame = null;
      sendViewport();
      if (now() < activeUntil) frame = view.requestAnimationFrame(trackFrame);
    }

    function activateTracking(duration = ACTIVE_TRACKING_MS) {
      activeUntil = Math.max(activeUntil, now() + duration);
      if (frame === null) frame = view.requestAnimationFrame(trackFrame);
    }

    function observeMap() {
      mapObserver?.disconnect();
      resizeObserver?.disconnect();
      mapObserver = new view.MutationObserver((records) => {
        const relevant = records.some((record) => {
          const element = record.target;
          if (!element || !element.classList) return false;
          return element === mapElement || element.classList.contains("leaflet-map-pane") || element.classList.contains("leaflet-tile-pane") || element.classList.contains("leaflet-tile-container") || element.classList.contains("leaflet-tile");
        });
        if (relevant) activateTracking();
      });
      mapObserver.observe(mapElement, { attributes: true, attributeFilter: ["class", "src", "style"], childList: true, subtree: true });
      if (typeof view.ResizeObserver === "function") {
        resizeObserver = new view.ResizeObserver(() => activateTracking());
        resizeObserver.observe(mapElement);
      }
      const trackingDurations = { pointerup: 800, pointercancel: 800, wheel: 800, transitionrun: 1200, transitionend: 150 };
      for (const eventName of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel", "transitionrun", "transitionend"]) {
        mapElement.addEventListener(eventName, (event) => {
          if (eventName === "pointermove" && event.buttons === 0) return;
          activateTracking(trackingDurations[eventName] || ACTIVE_TRACKING_MS);
        }, { passive: true });
      }
    }

    function mount() {
      const candidate = doc.getElementById("map");
      if (!candidate) return false;
      if (mapElement === candidate && overlay && overlay.isConnected) return true;
      mapElement = candidate;
      overlay = doc.createElement("iframe");
      overlay.id = OVERLAY_ID;
      overlay.title = "Private custom marker overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.tabIndex = -1;
      overlay.src = extension.runtime.getURL("src/overlay/overlay.html");
      styleHost(overlay, { position: "absolute", inset: "0", width: "100%", height: "100%", border: "0", background: "transparent", "pointer-events": "none", "z-index": "625" });
      overlay.addEventListener("load", () => { loaded = true; sendViewport(true); activateTracking(); }, { once: true });

      toggle = doc.createElement("button");
      toggle.id = TOGGLE_ID;
      toggle.type = "button";
      toggle.textContent = "Custom markers";
      toggle.title = "Show or hide custom markers";
      toggle.setAttribute("aria-pressed", "true");
      styleHost(toggle, { position: "absolute", top: "76px", right: "10px", margin: "0", padding: "7px 10px", border: "2px solid rgba(0,0,0,.25)", "border-radius": "4px", background: "#fff", color: "#111", "font": "600 12px/1.2 system-ui,sans-serif", cursor: "pointer", "z-index": "1001" });
      toggle.addEventListener("click", () => {
        visible = !visible;
        overlay.style.setProperty("visibility", visible ? "visible" : "hidden", "important");
        toggle.setAttribute("aria-pressed", String(visible));
        if (visible) sendViewport(true);
      });
      mapElement.append(overlay, toggle);
      observeMap();
      activateTracking();
      return true;
    }

    function tick() {
      if (!overlay || !overlay.isConnected || !mapElement || !mapElement.isConnected) mount();
    }

    mountTimer = view.setInterval(tick, MOUNT_POLL_MS);
    tick();
    return Object.freeze({
      stop() {
        if (mountTimer !== null) view.clearInterval(mountTimer);
        if (frame !== null) view.cancelAnimationFrame(frame);
        mapObserver?.disconnect();
        resizeObserver?.disconnect();
        overlay?.remove();
        toggle?.remove();
        view.__sondeHubCustomLocationsPrivateOverlay = false;
      },
      tick,
      activateTracking,
      get overlay() { return overlay; },
      get toggle() { return toggle; }
    });
  }

  return Object.freeze({ MESSAGE_TYPE, OVERLAY_ID, TOGGLE_ID, transformParts, tileCoordinates, inferViewport, sameViewport, start });
});
