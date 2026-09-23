(() => {
  "use strict";
  const repository = SondeHubLocationRepository.createRepository(browser.storage.sync, browser.storage.local);
  const form = document.getElementById("location-form");
  const defaultsForm = document.getElementById("defaults-form");
  const defaultFields = { iconColor: document.getElementById("default-icon-color"), backgroundColor: document.getElementById("default-background-color") };
  const fields = {
    id: document.getElementById("location-id"),
    name: document.getElementById("name"),
    icon: document.getElementById("icon"),
    iconColor: document.getElementById("icon-color"),
    backgroundColor: document.getElementById("background-color"),
    overrideIconColor: document.getElementById("override-icon-color"),
    overrideBackgroundColor: document.getElementById("override-background-color"),
    lat: document.getElementById("lat"),
    long: document.getElementById("long")
  };
  const list = document.getElementById("locations");
  const message = document.getElementById("form-message");
  const defaultsMessage = document.getElementById("defaults-message");
  const report = document.getElementById("import-report");
  const iconSearch = document.getElementById("icon-search");
  const iconResults = document.getElementById("icon-results");
  const iconResultsPanel = document.getElementById("icon-results-panel");
  const iconResultsStatus = document.getElementById("icon-results-status");
  const iconEmpty = document.getElementById("icon-empty");
  const MAX_VISIBLE_ICON_RESULTS = 100;
  let settings = { iconColor: SondeHubLocations.DEFAULT_ICON_COLOR, backgroundColor: SondeHubLocations.DEFAULT_BACKGROUND_COLOR };

  function setMessage(target, text, kind) { target.textContent = text; target.className = `message ${kind || ""}`; }
  function storageError(target, operation, error) {
    const known = error && typeof error.message === "string" && (error.message.startsWith("Firefox Sync") || error.message.startsWith("A location is too large for Firefox Sync"));
    setMessage(target, known ? error.message : `Unable to ${operation}. Please try again.`, "error");
  }
  function svgNode(icon) {
    const parsedSvg = new DOMParser().parseFromString(SondeHubIcons.svgFor(icon.key), "image/svg+xml").documentElement;
    return document.importNode(parsedSvg, true);
  }
  function effectiveColors() {
    return {
      iconColor: fields.overrideIconColor.checked ? fields.iconColor.value : settings.iconColor,
      backgroundColor: fields.overrideBackgroundColor.checked ? fields.backgroundColor.value : settings.backgroundColor
    };
  }
  function syncColorControls() {
    fields.iconColor.disabled = !fields.overrideIconColor.checked;
    fields.backgroundColor.disabled = !fields.overrideBackgroundColor.checked;
    if (!fields.overrideIconColor.checked) fields.iconColor.value = settings.iconColor;
    if (!fields.overrideBackgroundColor.checked) fields.backgroundColor.value = settings.backgroundColor;
    renderIconPreview();
  }
  function renderIconPreview() {
    const icon = SondeHubIcons.iconFor(fields.icon.value);
    const colors = effectiveColors();
    const preview = document.getElementById("icon-preview-image");
    preview.style.setProperty("--marker-icon-color", colors.iconColor);
    preview.style.setProperty("--marker-background-color", colors.backgroundColor);
    preview.replaceChildren(svgNode(icon));
    document.getElementById("icon-preview-label").textContent = `${icon.label} — ${icon.styleLabel}`;
  }
  function renderIconResults() {
    const selectedCanonicalKey = SondeHubIcons.canonicalIconKey(fields.icon.value);
    const matchingIcons = SondeHubIcons.filterIcons(iconSearch.value);
    const visibleIcons = matchingIcons.slice(0, MAX_VISIBLE_ICON_RESULTS);
    iconResults.replaceChildren();
    for (const icon of visibleIcons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-option";
      button.setAttribute("aria-pressed", String(icon.key === selectedCanonicalKey));
      button.setAttribute("aria-label", `Select ${icon.label}`);
      const image = document.createElement("span");
      image.className = "icon-option-image";
      image.setAttribute("aria-hidden", "true");
      image.append(svgNode(icon));
      const label = document.createElement("span");
      label.className = "icon-option-label";
      label.textContent = icon.label;
      const text = document.createElement("span");
      text.className = "icon-option-text";
      text.append(label);
      button.append(image, text);
      button.addEventListener("click", () => {
        selectIcon(icon.key);
        iconResultsPanel.open = false;
        iconResultsPanel.querySelector("summary").focus();
      });
      iconResults.append(button);
    }
    const shown = visibleIcons.length === matchingIcons.length ? `${matchingIcons.length}` : `${visibleIcons.length} of ${matchingIcons.length}`;
    iconResultsStatus.textContent = `Showing ${shown} matching icon${matchingIcons.length === 1 ? "" : "s"} from ${SondeHubIcons.ICONS.length} Heroicons Micro icons.${matchingIcons.length > MAX_VISIBLE_ICON_RESULTS ? " Refine the search to see more." : ""}`;
    iconEmpty.hidden = matchingIcons.length !== 0;
  }
  function selectIcon(icon) {
    fields.icon.value = SondeHubIcons.normalizeIcon(icon);
    renderIconPreview();
    renderIconResults();
  }
  function clearIconSearch() {
    iconSearch.value = "";
    renderIconResults();
  }
  function resetForm() {
    form.reset();
    fields.id.value = "";
    fields.overrideIconColor.checked = false;
    fields.overrideBackgroundColor.checked = false;
    fields.iconColor.value = settings.iconColor;
    fields.backgroundColor.value = settings.backgroundColor;
    syncColorControls();
    clearIconSearch();
    selectIcon(SondeHubLocations.DEFAULT_ICON);
    iconResultsPanel.open = false;
    document.getElementById("cancel-edit").hidden = true;
  }
  function locationFromForm() {
    return {
      id: fields.id.value,
      name: fields.name.value,
      icon: SondeHubIcons.normalizeIcon(fields.icon.value),
      iconColor: fields.overrideIconColor.checked ? fields.iconColor.value : null,
      backgroundColor: fields.overrideBackgroundColor.checked ? fields.backgroundColor.value : null,
      lat: fields.lat.value,
      long: fields.long.value
    };
  }
  function editLocation(location) {
    fields.id.value = location.id;
    fields.name.value = location.name;
    fields.icon.value = location.icon;
    fields.lat.value = location.lat;
    fields.long.value = location.long;
    fields.overrideIconColor.checked = location.iconColor !== null;
    fields.overrideBackgroundColor.checked = location.backgroundColor !== null;
    fields.iconColor.value = location.iconColor || settings.iconColor;
    fields.backgroundColor.value = location.backgroundColor || settings.backgroundColor;
    syncColorControls();
    clearIconSearch();
    selectIcon(fields.icon.value);
    document.getElementById("cancel-edit").hidden = false;
    fields.name.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function render() {
    try {
      const [nextSettings, locations] = await Promise.all([repository.getSettings(), repository.getAll()]);
      settings = nextSettings;
      defaultFields.iconColor.value = settings.iconColor;
      defaultFields.backgroundColor.value = settings.backgroundColor;
      syncColorControls();
      document.getElementById("count").textContent = `${locations.length} saved location${locations.length === 1 ? "" : "s"}`;
      list.replaceChildren();
      for (const location of locations) {
        const resolved = SondeHubLocations.resolveLocationColors(location, settings).value;
        const item = document.createElement("li");
        const details = document.createElement("div");
        const icon = SondeHubIcons.iconFor(location.icon);
        const name = document.createElement("strong"); name.textContent = `${icon.label}: ${location.name}`;
        const colors = document.createElement("span");
        colors.className = "location-colors";
        const iconSource = location.iconColor === null ? "default" : "override";
        const backgroundSource = location.backgroundColor === null ? "default" : "override";
        colors.title = `Icon ${resolved.iconColor} (${iconSource}); background ${resolved.backgroundColor} (${backgroundSource})`;
        colors.style.setProperty("--marker-icon-color", resolved.iconColor);
        colors.style.setProperty("--marker-background-color", resolved.backgroundColor);
        const coords = document.createElement("p"); coords.textContent = `${location.lat}, ${location.long}`;
        details.append(name, colors, coords);
        const actions = document.createElement("div"); actions.className = "row-actions";
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
        edit.addEventListener("click", () => editLocation(location));
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete"; remove.className = "danger";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Delete “${location.name}”?`)) return;
          try { await repository.remove(location.id); await render(); }
          catch (error) { storageError(message, "delete this location", error); }
        });
        actions.append(edit, remove); item.append(details, actions); list.append(item);
      }
    } catch (error) {
      storageError(message, "load saved locations", error);
    }
  }

  iconSearch.addEventListener("focus", () => { iconResultsPanel.open = true; });
  iconSearch.addEventListener("input", () => { iconResultsPanel.open = true; renderIconResults(); });
  iconSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    iconResults.querySelector("button")?.focus();
  });
  document.getElementById("clear-icon-search").addEventListener("click", () => { clearIconSearch(); iconSearch.focus(); });
  document.getElementById("reset-icon").addEventListener("click", () => selectIcon(SondeHubLocations.DEFAULT_ICON));
  for (const colorField of [fields.iconColor, fields.backgroundColor]) colorField.addEventListener("input", renderIconPreview);
  for (const overrideField of [fields.overrideIconColor, fields.overrideBackgroundColor]) overrideField.addEventListener("change", syncColorControls);
  document.getElementById("clear-color-overrides").addEventListener("click", () => {
    fields.overrideIconColor.checked = false;
    fields.overrideBackgroundColor.checked = false;
    syncColorControls();
  });

  defaultsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const checked = SondeHubLocations.validateSettings({ iconColor: defaultFields.iconColor.value, backgroundColor: defaultFields.backgroundColor.value });
    if (!checked.ok) { setMessage(defaultsMessage, checked.errors.join("; "), "error"); return; }
    try {
      settings = await repository.saveSettings(checked.value);
      syncColorControls();
      setMessage(defaultsMessage, "Default colors saved. Inherited markers updated.", "success");
      await render();
    } catch (error) {
      storageError(defaultsMessage, "save default colors", error);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const checked = SondeHubLocations.validateLocation(locationFromForm(), { inheritMissingColors: true });
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
      if (!file) { setMessage(report, "Choose a CSV file first.", "error"); return; }
      const parsed = SondeHubLocations.importCsv(await file.text());
      if (parsed.fatal) { setMessage(report, parsed.skipped[0].reason, "error"); return; }
      const mode = document.querySelector('input[name="import-mode"]:checked').value;
      if (mode === "replace") {
        if (!window.confirm("Replace all saved locations with valid imported rows?")) return;
        await repository.replaceAll(parsed.locations, parsed.settings);
      } else if (parsed.locations.length || parsed.settings) {
        await repository.addMany(parsed.locations, parsed.settings);
      }
      await render();
      const skipped = parsed.skipped.length ? ` Skipped ${parsed.skipped.length}: ${parsed.skipped.map((item) => `row ${item.row} (${item.reason})`).join("; ")}` : "";
      setMessage(report, `Imported ${parsed.locations.length} location${parsed.locations.length === 1 ? "" : "s"}.${skipped}`, parsed.skipped.length ? "error" : "success");
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
      setMessage(report, `Exported ${locations.length} location${locations.length === 1 ? "" : "s"}.`, "success");
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