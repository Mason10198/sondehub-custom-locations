/* Shared, dependency-free location validation and CSV parsing. */
(function exposeLocations(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SondeHubLocations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function locationsFactory() {
  "use strict";

  const iconCatalog = typeof module === "object" && module.exports ? require("./icons.js") : globalThis.SondeHubIcons;
  if (!iconCatalog) throw new Error("SondeHubIcons must load before SondeHubLocations");
  const { DEFAULT_ICON, ICONS, normalizeIcon } = iconCatalog;
  const DEFAULT_ICON_COLOR = "#000000";
  const DEFAULT_BACKGROUND_COLOR = "#facc15";
  const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

  function normalizeColor(value, fallback) {
    const color = String(value == null ? "" : value).trim();
    return COLOR_PATTERN.test(color) ? color.toLowerCase() : fallback;
  }

  function validateSettings(input) {
    const iconInput = String(input && input.icon != null ? input.icon : "").trim();
    const iconColorInput = String(input && input.iconColor != null ? input.iconColor : "").trim();
    const backgroundColorInput = String(input && input.backgroundColor != null ? input.backgroundColor : "").trim();
    const errors = [];
    if (iconColorInput && !COLOR_PATTERN.test(iconColorInput)) errors.push("default icon color must be a six-digit hex color such as #000000");
    if (backgroundColorInput && !COLOR_PATTERN.test(backgroundColorInput)) errors.push("default background color must be a six-digit hex color such as #facc15");
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: Object.freeze({
      icon: normalizeIcon(iconInput),
      iconColor: normalizeColor(iconColorInput, DEFAULT_ICON_COLOR),
      backgroundColor: normalizeColor(backgroundColorInput, DEFAULT_BACKGROUND_COLOR)
    }) };
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    const random = globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function"
      ? globalThis.crypto.getRandomValues(new Uint32Array(4))
      : new Uint32Array([Math.random() * 2 ** 32, Math.random() * 2 ** 32, Math.random() * 2 ** 32, Math.random() * 2 ** 32]);
    return `loc-${Date.now().toString(36)}-${Array.from(random, (part) => part.toString(36)).join("")}`;
  }

  function numberFrom(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string" || value.trim() === "") return Number.NaN;
    return Number(value.trim());
  }

  function validateLocation(input, options) {
    const allowGeneratedId = !options || options.allowGeneratedId !== false;
    const inheritMissingIcon = Boolean(options && options.inheritMissingIcon);
    const inheritMissingColors = Boolean(options && options.inheritMissingColors);
    const name = String(input && input.name != null ? input.name : "").trim();
    const latitude = numberFrom(input && (input.lat ?? input.latitude));
    const longitude = numberFrom(input && (input.long ?? input.lng ?? input.longitude));
    const iconInput = String(input && input.icon != null ? input.icon : "").trim();
    const iconColorInput = String(input && (input.iconColor ?? input.icon_color) != null ? (input.iconColor ?? input.icon_color) : "").trim();
    const backgroundColorInput = String(input && (input.backgroundColor ?? input.background_color) != null ? (input.backgroundColor ?? input.background_color) : "").trim();
    const errors = [];
    if (!name) errors.push("name is required");
    if (name.length > 120) errors.push("name must be 120 characters or fewer");
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push("latitude must be a number from -90 to 90");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push("longitude must be a number from -180 to 180");
    if (iconColorInput && !COLOR_PATTERN.test(iconColorInput)) errors.push("icon color must be a six-digit hex color such as #000000");
    if (backgroundColorInput && !COLOR_PATTERN.test(backgroundColorInput)) errors.push("background color must be a six-digit hex color such as #facc15");
    if (errors.length) return { ok: false, errors };
    const requestedId = String(input && input.id != null ? input.id : "").trim();
    return { ok: true, value: Object.freeze({
      id: requestedId || (allowGeneratedId ? createId() : ""),
      name,
      icon: iconInput ? normalizeIcon(iconInput) : (inheritMissingIcon ? null : DEFAULT_ICON),
      iconColor: iconColorInput ? normalizeColor(iconColorInput, DEFAULT_ICON_COLOR) : (inheritMissingColors ? null : DEFAULT_ICON_COLOR),
      backgroundColor: backgroundColorInput ? normalizeColor(backgroundColorInput, DEFAULT_BACKGROUND_COLOR) : (inheritMissingColors ? null : DEFAULT_BACKGROUND_COLOR),
      lat: latitude,
      long: longitude
    }) };
  }

  function resolveLocationColors(input, settings) {
    const checked = validateLocation(input, { allowGeneratedId: false, inheritMissingIcon: true, inheritMissingColors: true });
    if (!checked.ok) return checked;
    const defaults = validateSettings(settings).value;
    return { ok: true, value: Object.freeze({
      ...checked.value,
      icon: checked.value.icon || defaults.icon,
      iconColor: checked.value.iconColor || defaults.iconColor,
      backgroundColor: checked.value.backgroundColor || defaults.backgroundColor
    }) };
  }

  // RFC 4180-style fields: quoted commas, escaped quotes, CRLF, and embedded newlines are supported.
  function parseCsvRecords(text) {
    const source = String(text == null ? "" : text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], field = "", quoted = false, quoteClosed = false, physicalRow = 1, rowStart = 1;
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (quoted) {
        if (char === '"') {
          if (source[index + 1] === '"') { field += '"'; index += 1; }
          else { quoted = false; quoteClosed = true; }
        } else if (char === "\r" && source[index + 1] === "\n") {
          field += "\r\n"; index += 1; physicalRow += 1;
        } else {
          field += char;
          if (char === "\n" || char === "\r") physicalRow += 1;
        }
      } else if (char === '"') {
        if (field !== "") throw new Error(`Invalid quote at character ${index + 1}`);
        quoted = true;
      } else if (quoteClosed && char !== "," && char !== "\n" && char !== "\r") {
        throw new Error(`Invalid character after closing quote at character ${index + 1}`);
      } else if (char === ",") {
        row.push(field); field = ""; quoteClosed = false;
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field); rows.push({ values: row, row: rowStart }); row = []; field = ""; quoteClosed = false; physicalRow += 1; rowStart = physicalRow;
      } else field += char;
    }
    if (quoted) throw new Error("Unterminated quoted field");
    if (field !== "" || row.length) { row.push(field); rows.push({ values: row, row: rowStart }); }
    return rows;
  }

  function parseCsv(text) {
    return parseCsvRecords(text).map((record) => record.values);
  }

  function importCsv(text) {
    let rows;
    try { rows = parseCsvRecords(text); }
    catch (error) { return { locations: [], skipped: [{ row: 1, reason: error.message }], fatal: error.message }; }
    const headerIndex = rows.findIndex((record) => record.values.some((field) => field.trim() !== ""));
    if (headerIndex === -1) return { locations: [], skipped: [{ row: 1, reason: "CSV is empty" }] };
    const header = rows[headerIndex].values.map((field) => field.trim().toLowerCase());
    const required = ["name", "lat", "long"];
    const columns = required.concat(["icon", "icon_color", "background_color", "default_icon", "default_icon_color", "default_background_color", "sondehub_csv_version"]);
    const indices = Object.fromEntries(columns.map((column) => [column, header.indexOf(column)]));
    const missing = required.filter((column) => indices[column] === -1);
    if (missing.length) return { locations: [], skipped: [{ row: 1, reason: `Missing required column(s): ${missing.join(", ")}` }], fatal: "Invalid CSV header" };
    const locations = [], skipped = [];
    let importedSettings = null;
    for (let physicalIndex = headerIndex + 1; physicalIndex < rows.length; physicalIndex += 1) {
      const record = rows[physicalIndex];
      const row = record.values;
      if (!row.some((field) => field.trim() !== "")) continue;
      const exportVersion = indices.sondehub_csv_version === -1 ? "" : row[indices.sondehub_csv_version];
      const rawName = row[indices.name];
      const exportedName = (exportVersion === "1" || exportVersion === "2" || exportVersion === "3") && rawName.startsWith("'") ? rawName.slice(1) : rawName;
      if (!importedSettings && (exportVersion === "2" || exportVersion === "3") && indices.default_icon_color !== -1 && indices.default_background_color !== -1) {
        const checkedSettings = validateSettings({
          icon: exportVersion === "3" && indices.default_icon !== -1 ? row[indices.default_icon] : DEFAULT_ICON,
          iconColor: row[indices.default_icon_color],
          backgroundColor: row[indices.default_background_color]
        });
        if (!checkedSettings.ok) return { locations: [], skipped: [{ row: record.row, reason: checkedSettings.errors.join("; ") }], fatal: "Invalid CSV defaults" };
        importedSettings = checkedSettings.value;
      }
      if (required.every((column) => row[indices[column]].trim() === "")) continue;
      const result = validateLocation({
        name: exportedName,
        icon: indices.icon === -1 ? "" : row[indices.icon],
        iconColor: indices.icon_color === -1 ? "" : row[indices.icon_color],
        backgroundColor: indices.background_color === -1 ? "" : row[indices.background_color],
        lat: row[indices.lat],
        long: row[indices.long]
      }, { inheritMissingIcon: true, inheritMissingColors: true });
      if (result.ok) locations.push(result.value);
      else skipped.push({ row: record.row, reason: result.errors.join("; ") });
    }
    return { locations, skipped, settings: importedSettings };
  }

  function csvField(value) {
    const text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCsv(value, settings) {
    const defaults = validateSettings(settings).value;
    const header = ["name", "icon", "icon_color", "background_color", "lat", "long", "default_icon", "default_icon_color", "default_background_color", "sondehub_csv_version"];
    const rows = Array.isArray(value) ? value.reduce((all, item) => {
      const result = validateLocation(item, { allowGeneratedId: false, inheritMissingIcon: true, inheritMissingColors: true });
      if (result.ok) {
        const safeName = /^[=+\-@']/.test(result.value.name) ? `'${result.value.name}` : result.value.name;
        all.push([safeName, result.value.icon || "", result.value.iconColor || "", result.value.backgroundColor || "", result.value.lat, result.value.long, defaults.icon, defaults.iconColor, defaults.backgroundColor, "3"]);
      }
      return all;
    }, []) : [];
    if (!rows.length) rows.push(["", "", "", "", "", "", defaults.icon, defaults.iconColor, defaults.backgroundColor, "3"]);
    return [header].concat(rows).map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
  }

  return { DEFAULT_ICON, DEFAULT_ICON_COLOR, DEFAULT_BACKGROUND_COLOR, ICONS, normalizeIcon, normalizeColor, validateSettings, createId, validateLocation, resolveLocationColors, parseCsv, importCsv, exportCsv };
});