(() => {
  "use strict";
  const repository = SondeHubLocationRepository.createRepository(browser.storage.local);
  const form = document.getElementById("location-form");
  const fields = { id: document.getElementById("location-id"), name: document.getElementById("name"), icon: document.getElementById("icon"), iconColor: document.getElementById("icon-color"), backgroundColor: document.getElementById("background-color"), lat: document.getElementById("lat"), long: document.getElementById("long") };
  const list = document.getElementById("locations");
  const message = document.getElementById("form-message");
  const report = document.getElementById("import-report");
  const iconSearch = document.getElementById("icon-search");
  const iconResults = document.getElementById("icon-results");
  const iconResultsPanel = document.getElementById("icon-results-panel");
  const iconResultsStatus = document.getElementById("icon-results-status");
  const iconEmpty = document.getElementById("icon-empty");
  const MAX_VISIBLE_ICON_RESULTS = 100;

  function setMessage(target, text, kind) { target.textContent = text; target.className = `message ${kind || ""}`; }
  function storageError(target, operation) { setMessage(target, `Unable to ${operation}. Please try again.`, "error"); }
  function svgNode(icon) {
    const parsedSvg = new DOMParser().parseFromString(SondeHubIcons.svgFor(icon.key), "image/svg+xml").documentElement;
    return document.importNode(parsedSvg, true);
  }
  function renderIconPreview() {
    const icon = SondeHubIcons.iconFor(fields.icon.value);
    const preview = document.getElementById("icon-preview-image");
    preview.style.setProperty("--marker-icon-color", fields.iconColor.value);
    preview.style.setProperty("--marker-background-color", fields.backgroundColor.value);
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
    fields.iconColor.value = SondeHubLocations.DEFAULT_ICON_COLOR;
    fields.backgroundColor.value = SondeHubLocations.DEFAULT_BACKGROUND_COLOR;
    clearIconSearch();
    selectIcon(SondeHubLocations.DEFAULT_ICON);
    iconResultsPanel.open = false;
    document.getElementById("cancel-edit").hidden = true;
  }
  function locationFromForm() { return { id: fields.id.value, name: fields.name.value, icon: SondeHubIcons.normalizeIcon(fields.icon.value), iconColor: fields.iconColor.value, backgroundColor: fields.backgroundColor.value, lat: fields.lat.value, long: fields.long.value }; }
  async function render() {
    try {
      const locations = await repository.getAll();
      document.getElementById("count").textContent = `${locations.length} saved location${locations.length === 1 ? "" : "s"}`;
      list.replaceChildren();
      for (const location of locations) {
        const item = document.createElement("li");
        const details = document.createElement("div");
        const icon = SondeHubIcons.iconFor(location.icon);
        const name = document.createElement("strong"); name.textContent = `${icon.label}: ${location.name}`;
        const colors = document.createElement("span"); colors.className = "location-colors"; colors.title = `Icon ${location.iconColor}; background ${location.backgroundColor}`; colors.style.setProperty("--marker-icon-color", location.iconColor); colors.style.setProperty("--marker-background-color", location.backgroundColor);
        const coords = document.createElement("p"); coords.textContent = `${location.lat}, ${location.long}`;
        details.append(name, colors, coords);
        const actions = document.createElement("div"); actions.className = "row-actions";
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
        edit.addEventListener("click", () => {
          Object.entries(location).forEach(([key, value]) => { fields[key].value = value; });
          clearIconSearch();
          selectIcon(fields.icon.value);
          document.getElementById("cancel-edit").hidden = false;
          fields.name.focus();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete"; remove.className = "danger";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Delete “${location.name}”?`)) return;
          try { await repository.remove(location.id); await render(); }
          catch (_) { storageError(message, "delete this location"); }
        });
        actions.append(edit, remove); item.append(details, actions); list.append(item);
      }
    } catch (_) {
      storageError(message, "load saved locations");
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
  document.getElementById("reset-colors").addEventListener("click", () => { fields.iconColor.value = SondeHubLocations.DEFAULT_ICON_COLOR; fields.backgroundColor.value = SondeHubLocations.DEFAULT_BACKGROUND_COLOR; renderIconPreview(); });
  resetForm();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const checked = SondeHubLocations.validateLocation(locationFromForm());
    if (!checked.ok) { setMessage(message, checked.errors.join("; "), "error"); return; }
    try {
      await repository.save(checked.value);
      resetForm();
      setMessage(message, "Location saved.", "success");
      await render();
    } catch (_) {
      storageError(message, "save this location");
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
        await repository.replaceAll(parsed.locations);
        await render();
      } else if (parsed.locations.length) {
        await repository.addMany(parsed.locations);
        await render();
      }
      const skipped = parsed.skipped.length ? ` Skipped ${parsed.skipped.length}: ${parsed.skipped.map((item) => `row ${item.row} (${item.reason})`).join("; ")}` : "";
      setMessage(report, `Imported ${parsed.locations.length} location${parsed.locations.length === 1 ? "" : "s"}.${skipped}`, parsed.skipped.length ? "error" : "success");
    } catch (_) {
      storageError(report, "import locations");
    }
  });
  document.getElementById("delete-all").addEventListener("click", async () => {
    if (!window.confirm("Delete all saved locations? This cannot be undone.")) return;
    try { await repository.clear(); resetForm(); await render(); }
    catch (_) { storageError(message, "delete all locations"); }
  });
  browser.storage.onChanged.addListener((changes, area) => { if (area === "local" && Object.hasOwn(changes, "locations")) void render(); });
  void render();
})();
