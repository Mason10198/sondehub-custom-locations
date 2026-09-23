/* Isolated world: renders private markers inside Leaflet's own transform layer. */
(function exposePrivateLeafletLayer(root, factory) {
  const api = factory(root.SondeHubIcons, root.SondeHubLocationRepository);
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.start();
})(typeof globalThis !== "undefined" ? globalThis : this, function privateLeafletLayerFactory(iconCatalog, repositoryApi) {
  "use strict";
  const HOST_ID = "sondehub-custom-locations-private-layer";
  const TOGGLE_ID = "sondehub-custom-locations-toggle";
  const MAX_LOCATIONS = 250;
  const CUSTOM_MARKER_Z_INDEX = 550;

  const MOUNT_POLL_MS = 500;

  function transformParts(value) {
    if (!value || value === "none") return { x: 0, y: 0, scale: 1 };
    let match = value.match(/^matrix\(([-+\d.e]+),\s*[-+\d.e]+,\s*[-+\d.e]+,\s*([-+\d.e]+),\s*([-+\d.e]+),\s*([-+\d.e]+)\)$/i);
    if (match) return { x: Number(match[3]), y: Number(match[4]), scale: Number(match[1]) === Number(match[2]) ? Number(match[1]) : NaN };
    match = value.match(/^matrix3d\((.+)\)$/i);
    if (match) {
      const values = match[1].split(",").map(Number);
      return values.length === 16 ? { x: values[12], y: values[13], scale: values[0] === values[5] ? values[0] : NaN } : { x: 0, y: 0, scale: NaN };
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
        const match = segments[index + 2].match(/^(\d+)/);
        const y = match ? Number(match[1]) : NaN;
        if (Number.isInteger(z) && z >= 0 && z <= 24 && Number.isInteger(x) && Number.isInteger(y)) return { z, x, y };
      }
    } catch (_) {
      // Ignore malformed page tile URLs.
    }
    return null;
  }

  function localPosition(node, ancestor, view) {
    const chain = [];
    let current = node;
    while (current && current !== ancestor) {
      chain.push(current);
      current = current.parentElement;
    }
    if (current !== ancestor) return null;
    let x = 0;
    let y = 0;
    let scale = 1;
    for (const element of chain) {
      const inline = element.style ? element.style.transform : "";
      const computed = !inline && view && typeof view.getComputedStyle === "function" ? view.getComputedStyle(element).transform : "";
      const part = transformParts(inline || computed);
      if (!Number.isFinite(part.scale) || part.scale <= 0) return null;
      x = part.x + part.scale * x;
      y = part.y + part.scale * y;
      scale *= part.scale;
    }
    return { x, y, scale };
  }

  function chooseAnchor(mapElement, view) {
    if (!mapElement || typeof mapElement.querySelectorAll !== "function") return null;
    const containers = [...mapElement.querySelectorAll(".leaflet-tile-container")].sort((left, right) => {
      const leftZ = Number.parseInt(left.style?.zIndex || view.getComputedStyle(left).zIndex, 10) || 0;
      const rightZ = Number.parseInt(right.style?.zIndex || view.getComputedStyle(right).zIndex, 10) || 0;
      return rightZ - leftZ;
    });
    for (const container of containers) {
      const allTiles = [...container.querySelectorAll("img.leaflet-tile")];
      const visible = allTiles.filter((tile) => {
        const style = view.getComputedStyle(tile);
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
      });
      for (const tile of visible.length ? visible : allTiles) {
        const coordinates = tileCoordinates(tile.src || tile.getAttribute?.("src") || "");
        const position = coordinates ? localPosition(tile, container, view) : null;
        const tileSize = Number.parseFloat(tile.style?.width || "") || Number(tile.width) || 256;
        if (!coordinates || !position || !(tileSize > 0)) continue;
        return Object.freeze({ container, zoom: coordinates.z, tileSize, originX: position.x - coordinates.x * tileSize, originY: position.y - coordinates.y * tileSize });
      }
    }
    return null;
  }

  function worldPixel(lat, long, zoom, tileSize = 256) {
    const size = tileSize * (2 ** zoom);
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    const sine = Math.sin((safeLat * Math.PI) / 180);
    return { x: ((long + 180) / 360) * size, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size };
  }

  function projectToAnchor(lat, long, anchor) {
    const point = worldPixel(lat, long, anchor.zoom, anchor.tileSize);
    return Object.freeze({ x: anchor.originX + point.x, y: anchor.originY + point.y });
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
    if (!view || !doc || !extension || !icons || !repositories || view.__sondeHubCustomLocationsPrivateLayer) return null;
    view.__sondeHubCustomLocationsPrivateLayer = true;

    const repository = repositories.createRepository(extension.storage.sync, extension.storage.local);
    let mapElement = null;
    let host = null;
    let shadow = null;
    let markerRoot = null;
    let toggle = null;
    let toggleControl = null;
    let anchor = null;
    let locations = [];
    let settings = { showLabels: false };
    let visible = true;
    let mountTimer = null;
    let observer = null;
    let pendingFrame = null;

    function createShadow() {
      shadow = host.attachShadow({ mode: "closed" });
      const style = doc.createElement("style");
      style.textContent = `:host{all:initial;position:absolute!important;left:0!important;top:0!important;width:0!important;height:0!important;overflow:visible!important;pointer-events:none!important;z-index:${CUSTOM_MARKER_Z_INDEX}!important}.markers{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none}.marker{position:absolute;left:0;top:0;display:grid;place-items:center;box-sizing:border-box;border:2px solid var(--marker-color);border-radius:50%;background:var(--marker-background);color:var(--marker-color);box-shadow:0 1px 3px #0008;cursor:grab;pointer-events:auto;will-change:transform;contain:layout style}.marker:active{cursor:grabbing}.marker svg{display:block;width:var(--glyph-size);height:var(--glyph-size)}.label{position:absolute;left:50%;top:calc(100% + 4px);max-width:180px;padding:2px 5px;overflow:hidden;border-radius:3px;background:rgb(17 24 39 / 88%);color:#fff;font:600 11px/1.25 system-ui,sans-serif;text-overflow:ellipsis;text-shadow:0 1px 1px #000;white-space:nowrap;transform:translateX(-50%);opacity:0;visibility:hidden;pointer-events:none}.labels-always .label,.marker:hover .label{opacity:1;visibility:visible}`;
      markerRoot = doc.createElement("div");
      markerRoot.className = "markers";
      shadow.append(style, markerRoot);
    }

    function syncAnchorTransform() {
      if (!anchor || !host) return;
      host.style.setProperty("transform", anchor.container.style.transform || "translate3d(0px, 0px, 0px)", "important");
      host.style.setProperty("transform-origin", "0 0", "important");
    }

    function positionMarkers() {
      if (!anchor || !markerRoot) return;
      markerRoot.classList.toggle("labels-always", settings.showLabels);
      const markers = markerRoot.children;
      for (let index = 0; index < markers.length; index += 1) {
        const location = locations[index];
        if (location) markers[index].style.transform = markerTransform(projectToAnchor(location.lat, location.long, anchor));
      }
    }

    function rebuildMarkers() {
      if (!markerRoot) return;
      const fragment = doc.createDocumentFragment();
      for (const location of locations.slice(0, MAX_LOCATIONS)) {
        const marker = doc.createElement("div");
        marker.className = "marker";
        marker.style.width = `${location.markerDiameter}px`;
        marker.style.height = `${location.markerDiameter}px`;
        marker.style.setProperty("--marker-color", location.iconColor);
        marker.style.setProperty("--marker-background", location.backgroundColor);
        marker.style.setProperty("--glyph-size", `${glyphSize(location.markerDiameter)}px`);
        const icon = doc.createElement("span");
        const parsed = new view.DOMParser().parseFromString(icons.svgFor(icons.normalizeIcon(location.icon)), "image/svg+xml").documentElement;
        if (parsed.localName === "svg" && parsed.namespaceURI === "http://www.w3.org/2000/svg") icon.append(doc.importNode(parsed, true));
        const label = doc.createElement("span");
        label.className = "label";
        label.textContent = location.name;
        marker.append(icon, label);
        fragment.append(marker);
      }
      markerRoot.replaceChildren(fragment);
      positionMarkers();
    }

    function reanchor() {
      pendingFrame = null;
      if (!mapElement || mapElement.querySelector(".leaflet-map-pane.leaflet-zoom-anim")) return;
      const next = chooseAnchor(mapElement, view);
      if (!next) return;
      anchor = next;
      const mapPane = anchor.container.closest(".leaflet-map-pane");
      if (!mapPane) return;
      if (host.parentElement !== mapPane) mapPane.append(host);
      syncAnchorTransform();
      positionMarkers();
    }

    function scheduleReanchor() {
      if (pendingFrame === null) pendingFrame = view.requestAnimationFrame(reanchor);
    }

    async function loadLocations() {
      try {
        [locations, settings] = await Promise.all([repository.getResolved(), repository.getSettings()]);
        rebuildMarkers();
      } catch (error) {
        console.warn("SondeHub Custom Locations: unable to read saved locations", error);
      }
    }

    function paintToggle(hovered = false) {
      if (!toggle) return;
      const background = visible ? (hovered ? "#008dab" : "#00a6ca") : (hovered ? "#f4f4f4" : "#ffffff");
      toggle.style.setProperty("background", background, "important");
      toggle.style.setProperty("border-color", visible ? "#008dab" : "#cccccc", "important");
      toggle.style.setProperty("color", visible ? "#ffffff" : "#888888", "important");
      toggle.title = visible ? "Hide custom markers" : "Show custom markers";
    }

    function placeToggle() {
      if (!mapElement || !toggleControl || !toggle) return;
      const timeSelector = doc.getElementById("timeperiod");
      const timeControl = timeSelector?.closest(".leaflet-control");
      const controlCorner = timeControl?.parentElement || mapElement.querySelector(".leaflet-top.leaflet-left");
      if (timeControl && toggleControl.previousElementSibling !== timeControl) timeControl.insertAdjacentElement("afterend", toggleControl);
      else if (controlCorner && toggleControl.parentElement !== controlCorner) controlCorner.append(toggleControl);
      const selectorWidth = timeSelector?.getBoundingClientRect().width;
      if (selectorWidth) toggle.style.setProperty("width", `${Math.ceil(selectorWidth)}px`, "important");
    }

    function mount() {
      const candidate = doc.getElementById("map");
      if (!candidate) return false;
      mapElement = candidate;
      if (!host) {
        host = doc.createElement("div");
        host.id = HOST_ID;
        host.className = "leaflet-zoom-animated";

        for (const [name, value] of Object.entries({ position: "absolute", left: "0", top: "0", width: "0", height: "0", overflow: "visible", "pointer-events": "none", "z-index": String(CUSTOM_MARKER_Z_INDEX) })) host.style.setProperty(name, value, "important");
        createShadow();
        toggleControl = doc.createElement("div");
        toggleControl.className = "leaflet-control sondehub-custom-locations-control";
        toggleControl.style.setProperty("clear", "both", "important");
        toggleControl.style.setProperty("pointer-events", "auto", "important");
        toggle = doc.createElement("button");
        toggle.id = TOGGLE_ID;
        toggle.type = "button";
        toggle.textContent = "Markers";
        toggle.setAttribute("aria-pressed", "true");
        toggle.setAttribute("aria-label", "Show or hide custom markers");
        for (const [name, value] of Object.entries({ display: "block", height: "30px", margin: "0", padding: "0 9px", border: "1px solid #008dab", "border-radius": "4px", "box-sizing": "border-box", font: '13px "HelveticaNeue", "Helvetica Neue", Helvetica, Arial, sans-serif', cursor: "pointer", "box-shadow": "none", "white-space": "nowrap" })) toggle.style.setProperty(name, value, "important");
        toggle.addEventListener("mouseenter", () => paintToggle(true));
        toggle.addEventListener("mouseleave", () => paintToggle(false));
        toggle.addEventListener("pointerdown", (event) => event.stopPropagation());
        toggle.addEventListener("click", () => {
          visible = !visible;
          host.style.setProperty("visibility", visible ? "visible" : "hidden", "important");
          toggle.setAttribute("aria-pressed", String(visible));
          paintToggle(false);
        });
        toggleControl.append(toggle);
        paintToggle(false);
        placeToggle();
        loadLocations();
      }
      placeToggle();
      observer?.disconnect();
      observer = new view.MutationObserver((records) => {
        if (anchor && records.some((record) => record.target === anchor.container && record.type === "attributes" && record.attributeName === "style")) syncAnchorTransform();
        scheduleReanchor();
      });
      observer.observe(mapElement, { attributes: true, attributeFilter: ["class", "style", "src"], childList: true, subtree: true });
      scheduleReanchor();
      return true;
    }

    extension.storage.onChanged.addListener((changes, areaName) => {
      if ((areaName === "sync" || areaName === "local") && repositories.isLocationChange(changes)) loadLocations();
    });
    mountTimer = view.setInterval(() => {
      if (!mapElement?.isConnected || !host?.isConnected || !toggleControl?.isConnected) mount();
      else placeToggle();
    }, MOUNT_POLL_MS);
    mount();
    return Object.freeze({
      stop() {
        if (mountTimer !== null) view.clearInterval(mountTimer);
        if (pendingFrame !== null) view.cancelAnimationFrame(pendingFrame);
        observer?.disconnect();
        host?.remove();
        toggleControl?.remove();
        view.__sondeHubCustomLocationsPrivateLayer = false;
      },
      reanchor,
      loadLocations,
      get host() { return host; },
      get toggle() { return toggle; }
    });
  }

  return Object.freeze({ HOST_ID, TOGGLE_ID, MAX_LOCATIONS, CUSTOM_MARKER_Z_INDEX, transformParts, tileCoordinates, localPosition, chooseAnchor, worldPixel, projectToAnchor, glyphSize, markerTransform, start });
});
