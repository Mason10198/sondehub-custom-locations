(() => {
  "use strict";

  const repository = SondeHubLocationRepository.createRepository(browser.storage.sync, browser.storage.local);
  const form = document.getElementById("location-form");
  const defaultsForm = document.getElementById("defaults-form");
  const addTitle = document.getElementById("add-title");
  const list = document.getElementById("locations");
  const message = document.getElementById("form-message");
  const defaultsMessage = document.getElementById("defaults-message");
  const report = document.getElementById("import-report");
  const iconDialog = document.getElementById("icon-dialog");
  const iconSearch = document.getElementById("icon-search");
  const iconResults = document.getElementById("icon-results");
  const iconResultsStatus = document.getElementById("icon-results-status");
  const iconEmpty = document.getElementById("icon-empty");
  const clearIconSearchButton = document.getElementById("clear-icon-search");
  const MAX_VISIBLE_ICON_RESULTS = 120;
  const SUGGESTED_ICON_KEYS = Object.freeze([
    "16-solid/map-pin",
    "16-solid/home",
    "16-solid/map",
    "16-solid/building-office-2",
    "16-solid/flag",
    "16-solid/star",
    "16-solid/radio",
    "16-solid/signal",
    "16-solid/truck",
    "16-solid/camera",
    "16-solid/fire",
    "16-solid/globe-alt"
  ]);

  const defaultFields = {
    icon: document.getElementById("default-icon"),
    iconColor: document.getElementById("default-icon-color"),
    backgroundColor: document.getElementById("default-background-color"),
    markerDiameter: document.getElementById("default-marker-diameter")
  };
  const fields = {
    id: document.getElementById("location-id"),
    name: document.getElementById("name"),
    icon: document.getElementById("icon"),
    iconColor: document.getElementById("icon-color"),
    backgroundColor: document.getElementById("background-color"),
    markerDiameter: document.getElementById("marker-diameter"),
    overrideIcon: document.getElementById("override-icon"),
    overrideIconColor: document.getElementById("override-icon-color"),
    overrideBackgroundColor: document.getElementById("override-background-color"),
    overrideMarkerDiameter: document.getElementById("override-marker-diameter"),
    lat: document.getElementById("lat"),
    long: document.getElementById("long")
  };

  let settings = {
    icon: SondeHubLocations.DEFAULT_ICON,
    iconColor: SondeHubLocations.DEFAULT_ICON_COLOR,
    backgroundColor: SondeHubLocations.DEFAULT_BACKGROUND_COLOR,
    markerDiameter: SondeHubLocations.DEFAULT_MARKER_DIAMETER
  };
  let iconTarget = "location";
  let iconReturnFocus = null;

  function setMessage(target, text, kind) {
    target.textContent = text;
    target.className = `${target.id === "import-report" ? "report" : "message"} ${kind || ""}`;
  }

  function storageError(target, operation, error) {
    const known = error && typeof error.message === "string" && (error.message.startsWith("Firefox Sync") || error.message.startsWith("A location is too large for Firefox Sync"));
    setMessage(target, known ? error.message : `Could not ${operation}. Try again.`, "error");
  }

  function svgNode(icon) {
    const parsed = new DOMParser().parseFromString(SondeHubIcons.svgFor(icon.key), "image/svg+xml").documentElement;
    return document.importNode(parsed, true);
  }

  function effectiveAppearance() {
    return {
      icon: fields.overrideIcon.checked ? fields.icon.value : settings.icon,
      iconColor: fields.overrideIconColor.checked ? fields.iconColor.value : settings.iconColor,
      backgroundColor: fields.overrideBackgroundColor.checked ? fields.backgroundColor.value : settings.backgroundColor,
      markerDiameter: fields.overrideMarkerDiameter.checked ? Number(fields.markerDiameter.value) : settings.markerDiameter
    };
  }

  function paintPreview(element, appearance) {
    const icon = SondeHubIcons.iconFor(appearance.icon);
    element.style.setProperty("--marker-icon-color", appearance.iconColor);
    element.style.setProperty("--marker-background-color", appearance.backgroundColor);
    element.style.setProperty("--marker-diameter", `${appearance.markerDiameter}px`);
    element.replaceChildren(svgNode(icon));
    return icon;
  }

  function renderDefaultPreview() {
    const appearance = {
      icon: defaultFields.icon.value || settings.icon,
      iconColor: defaultFields.iconColor.value,
      backgroundColor: defaultFields.backgroundColor.value,
      markerDiameter: Number(defaultFields.markerDiameter.value) || settings.markerDiameter
    };
    const icon = paintPreview(document.getElementById("default-preview"), appearance);
    document.getElementById("default-icon-label").textContent = icon.label;
    document.getElementById("default-icon-color-value").textContent = appearance.iconColor;
    document.getElementById("default-background-color-value").textContent = appearance.backgroundColor;
  }

  function renderLocationPreview() {
    const appearance = effectiveAppearance();
    const icon = paintPreview(document.getElementById("location-preview"), appearance);
    document.getElementById("location-preview-label").textContent = icon.label;
    document.getElementById("location-icon-label").textContent = icon.label;
    document.getElementById("icon-color-value").textContent = appearance.iconColor;
    document.getElementById("background-color-value").textContent = appearance.backgroundColor;
    const overrideCount = [fields.overrideIcon, fields.overrideIconColor, fields.overrideBackgroundColor, fields.overrideMarkerDiameter].filter((field) => field.checked).length;
    document.getElementById("appearance-summary").textContent = overrideCount ? `${overrideCount} custom setting${overrideCount === 1 ? "" : "s"}` : "Using marker defaults";
    document.getElementById("clear-appearance-overrides").hidden = overrideCount === 0;
  }

  function syncOverrideControls() {
    const pairs = [
      [fields.overrideIcon, "icon-override-controls"],
      [fields.overrideIconColor, "icon-color-controls"],
      [fields.overrideBackgroundColor, "background-color-controls"],
      [fields.overrideMarkerDiameter, "marker-diameter-controls"]
    ];
    for (const [toggle, id] of pairs) document.getElementById(id).hidden = !toggle.checked;
    if (!fields.overrideIcon.checked) fields.icon.value = settings.icon;
    if (!fields.overrideIconColor.checked) fields.iconColor.value = settings.iconColor;
    if (!fields.overrideBackgroundColor.checked) fields.backgroundColor.value = settings.backgroundColor;
    if (!fields.overrideMarkerDiameter.checked) fields.markerDiameter.value = settings.markerDiameter;
    renderLocationPreview();
  }

  function selectedIconKey() {
    return SondeHubIcons.canonicalIconKey(iconTarget === "default" ? defaultFields.icon.value : fields.icon.value);
  }

  function renderIconResults() {
    const selected = selectedIconKey();
    const query = iconSearch.value.trim();
    const matches = query
      ? [...SondeHubIcons.filterIcons(query)]
      : [...new Set([selected, ...SUGGESTED_ICON_KEYS])].map((key) => SondeHubIcons.iconFor(key));
    matches.sort((left, right) => left.key === selected ? -1 : right.key === selected ? 1 : left.label.localeCompare(right.label));
    const visible = matches.slice(0, MAX_VISIBLE_ICON_RESULTS);
    iconResults.replaceChildren();
    for (const icon of visible) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-option";
      button.setAttribute("aria-pressed", String(icon.key === selected));
      button.title = icon.label;
      const image = document.createElement("span");
      image.className = "icon-option-image";
      image.setAttribute("aria-hidden", "true");
      image.append(svgNode(icon));
      const label = document.createElement("span");
      label.className = "icon-option-label";
      label.textContent = icon.label;
      button.append(image, label);
      button.addEventListener("click", () => selectIcon(icon.key));
      iconResults.append(button);
    }
    const shown = visible.length === matches.length ? `${matches.length}` : `${visible.length} of ${matches.length}`;
    iconResultsStatus.textContent = query
      ? `${shown} icon${matches.length === 1 ? "" : "s"}${matches.length > MAX_VISIBLE_ICON_RESULTS ? " — refine your search for more" : ""}`
      : `Suggested icons · Search all ${SondeHubIcons.ICONS.length}`;
    iconEmpty.hidden = matches.length !== 0;
    clearIconSearchButton.hidden = iconSearch.value === "";
  }

  function openIconChooser(target, returnFocus) {
    iconTarget = target;
    iconReturnFocus = returnFocus;
    iconSearch.value = "";
    const icon = SondeHubIcons.iconFor(selectedIconKey());
    document.getElementById("icon-dialog-selection").textContent = `Selected: ${icon.label}`;
    renderIconResults();
    iconDialog.showModal();
    iconSearch.focus();
  }

  function closeIconChooser() {
    iconDialog.close();
  }

  function selectIcon(key) {
    const normalized = SondeHubIcons.normalizeIcon(key);
    if (iconTarget === "default") {
      defaultFields.icon.value = normalized;
      renderDefaultPreview();
    } else {
      fields.icon.value = normalized;
      renderLocationPreview();
    }
    closeIconChooser();
  }

  function resetForm() {
    form.reset();
    fields.id.value = "";
    fields.icon.value = settings.icon;
    fields.iconColor.value = settings.iconColor;
    fields.backgroundColor.value = settings.backgroundColor;
    fields.markerDiameter.value = settings.markerDiameter;
    addTitle.textContent = "Add location";
    document.getElementById("cancel-edit").hidden = true;
    syncOverrideControls();
  }

  function locationFromForm() {
    return {
      id: fields.id.value,
      name: fields.name.value,
      icon: fields.overrideIcon.checked ? fields.icon.value : null,
      iconColor: fields.overrideIconColor.checked ? fields.iconColor.value : null,
      backgroundColor: fields.overrideBackgroundColor.checked ? fields.backgroundColor.value : null,
      markerDiameter: fields.overrideMarkerDiameter.checked ? fields.markerDiameter.value : null,
      lat: fields.lat.value,
      long: fields.long.value
    };
  }

  function editLocation(location) {
    fields.id.value = location.id;
    fields.name.value = location.name;
    fields.lat.value = location.lat;
    fields.long.value = location.long;
    fields.overrideIcon.checked = location.icon !== null;
    fields.overrideIconColor.checked = location.iconColor !== null;
    fields.overrideBackgroundColor.checked = location.backgroundColor !== null;
    fields.overrideMarkerDiameter.checked = location.markerDiameter !== null;
    fields.icon.value = location.icon || settings.icon;
    fields.iconColor.value = location.iconColor || settings.iconColor;
    fields.backgroundColor.value = location.backgroundColor || settings.backgroundColor;
    fields.markerDiameter.value = location.markerDiameter || settings.markerDiameter;
    addTitle.textContent = "Edit location";
    document.getElementById("cancel-edit").hidden = false;
    syncOverrideControls();
    document.getElementById("add-title").scrollIntoView({ block: "start" });
    fields.name.focus({ preventScroll: true });
  }

  function locationListItem(location) {
    const resolved = SondeHubLocations.resolveLocationAppearance(location, settings).value;
    const item = document.createElement("li");
    const preview = document.createElement("div");
    preview.className = "marker-preview location-marker";
    paintPreview(preview, resolved);
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.className = "location-name";
    name.textContent = location.name;
    const meta = document.createElement("p");
    meta.className = "section-note";
    const overrides = [location.icon, location.iconColor, location.backgroundColor, location.markerDiameter].filter((value) => value !== null).length;
    meta.textContent = `${resolved.lat}, ${resolved.long} · ${overrides ? `${overrides} override${overrides === 1 ? "" : "s"}` : "Defaults"}`;
    details.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary compact";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editLocation(location));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger compact";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!window.confirm(`Delete “${location.name}”?`)) return;
      try { await repository.remove(location.id); await render(); }
      catch (error) { storageError(message, "delete this location", error); }
    });
    actions.append(edit, remove);
    item.append(preview, details, actions);
    return item;
  }

  async function render() {
    try {
      const [nextSettings, locations] = await Promise.all([repository.getSettings(), repository.getAll()]);
      settings = nextSettings;
      defaultFields.icon.value = settings.icon;
      defaultFields.iconColor.value = settings.iconColor;
      defaultFields.backgroundColor.value = settings.backgroundColor;
      defaultFields.markerDiameter.value = settings.markerDiameter;
      renderDefaultPreview();
      syncOverrideControls();
      document.getElementById("count").textContent = `${locations.length} saved`;
      document.getElementById("empty-state").hidden = locations.length !== 0;
      document.getElementById("delete-all").hidden = locations.length === 0;
      list.replaceChildren(...locations.map(locationListItem));
    } catch (error) {
      storageError(message, "load saved locations", error);
    }
  }

  document.getElementById("choose-default-icon").addEventListener("click", (event) => openIconChooser("default", event.currentTarget));
  document.getElementById("choose-location-icon").addEventListener("click", (event) => openIconChooser("location", event.currentTarget));
  document.getElementById("close-icon-dialog").addEventListener("click", closeIconChooser);
  iconDialog.addEventListener("close", () => iconReturnFocus?.focus());
  iconDialog.addEventListener("click", (event) => { if (event.target === iconDialog) closeIconChooser(); });
  iconSearch.addEventListener("input", renderIconResults);
  clearIconSearchButton.addEventListener("click", () => { iconSearch.value = ""; renderIconResults(); iconSearch.focus(); });

  for (const field of [defaultFields.iconColor, defaultFields.backgroundColor, defaultFields.markerDiameter]) field.addEventListener("input", renderDefaultPreview);
  for (const field of [fields.iconColor, fields.backgroundColor, fields.markerDiameter]) field.addEventListener("input", renderLocationPreview);
  for (const toggle of [fields.overrideIcon, fields.overrideIconColor, fields.overrideBackgroundColor, fields.overrideMarkerDiameter]) toggle.addEventListener("change", syncOverrideControls);
  document.getElementById("clear-appearance-overrides").addEventListener("click", () => {
    for (const toggle of [fields.overrideIcon, fields.overrideIconColor, fields.overrideBackgroundColor, fields.overrideMarkerDiameter]) toggle.checked = false;
    syncOverrideControls();
  });

  defaultsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const checked = SondeHubLocations.validateSettings({
      icon: defaultFields.icon.value,
      iconColor: defaultFields.iconColor.value,
      backgroundColor: defaultFields.backgroundColor.value,
      markerDiameter: defaultFields.markerDiameter.value
    });
    if (!checked.ok) { setMessage(defaultsMessage, checked.errors.join("; "), "error"); return; }
    try {
      settings = await repository.saveSettings(checked.value);
      setMessage(defaultsMessage, "Defaults saved.", "success");
      await render();
    } catch (error) {
      storageError(defaultsMessage, "save defaults", error);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const checked = SondeHubLocations.validateLocation(locationFromForm(), { inheritMissingIcon: true, inheritMissingColors: true, inheritMissingDiameter: true });
    if (!checked.ok) { setMessage(message, checked.errors.join("; "), "error"); return; }
    try {
      await repository.save(checked.value);
      resetForm();
      setMessage(message, "Location saved.", "success");
      await render();
    } catch (error) {
      storageError(message, "save this location", error);
    }
  });
  document.getElementById("cancel-edit").addEventListener("click", () => { resetForm(); setMessage(message, "", ""); });

  document.getElementById("import-button").addEventListener("click", async () => {
    try {
      const file = document.getElementById("csv-file").files[0];
      if (!file) { setMessage(report, "Choose a CSV file.", "error"); return; }
      const parsed = SondeHubLocations.importCsv(await file.text());
      if (parsed.fatal) { setMessage(report, parsed.skipped[0].reason, "error"); return; }
      const mode = document.querySelector('input[name="import-mode"]:checked').value;
      if (mode === "replace") {
        if (!window.confirm("Replace all saved locations with this import?")) return;
        await repository.replaceAll(parsed.locations, parsed.settings);
      } else if (parsed.locations.length || parsed.settings) {
        await repository.addMany(parsed.locations, parsed.settings);
      }
      await render();
      const skipped = parsed.skipped.length ? ` Skipped ${parsed.skipped.length}: ${parsed.skipped.map((item) => `row ${item.row} (${item.reason})`).join("; ")}` : "";
      setMessage(report, `Imported ${parsed.locations.length}.${skipped}`, parsed.skipped.length ? "error" : "success");
    } catch (error) {
      storageError(report, "import locations", error);
    }
  });

  document.getElementById("export-button").addEventListener("click", async () => {
    try {
      const [locations, exportedSettings] = await Promise.all([repository.getAll(), repository.getSettings()]);
      const blob = new Blob([SondeHubLocations.exportCsv(locations, exportedSettings)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sondehub-custom-locations-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(report, `Exported ${locations.length}.`, "success");
    } catch (error) {
      storageError(report, "export locations", error);
    }
  });

  document.getElementById("delete-all").addEventListener("click", async () => {
    if (!window.confirm("Delete all saved locations? This cannot be undone.")) return;
    try { await repository.clear(); resetForm(); await render(); }
    catch (error) { storageError(message, "delete all locations", error); }
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if ((area === "sync" || area === "local") && SondeHubLocationRepository.isLocationChange(changes)) void render();
  });

  resetForm();
  void render();
})();
