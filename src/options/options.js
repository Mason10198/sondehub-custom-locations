(() => {
  "use strict";
  const repository = SondeHubLocationRepository.createRepository(browser.storage.local);
  const form = document.getElementById("location-form");
  const fields = { id: document.getElementById("location-id"), name: document.getElementById("name"), icon: document.getElementById("icon"), lat: document.getElementById("lat"), long: document.getElementById("long") };
  const list = document.getElementById("locations");
  const message = document.getElementById("form-message");
  const report = document.getElementById("import-report");

  function setMessage(target, text, kind) { target.textContent = text; target.className = `message ${kind || ""}`; }
  function storageError(target, operation) { setMessage(target, `Unable to ${operation}. Please try again.`, "error"); }
  function resetForm() { form.reset(); fields.id.value = ""; fields.icon.value = SondeHubLocations.DEFAULT_ICON; document.getElementById("cancel-edit").hidden = true; }
  function locationFromForm() { return { id: fields.id.value, name: fields.name.value, icon: fields.icon.value, lat: fields.lat.value, long: fields.long.value }; }
  async function render() {
    try {
      const locations = await repository.getAll();
      document.getElementById("count").textContent = `${locations.length} saved location${locations.length === 1 ? "" : "s"}`;
      list.replaceChildren();
      for (const location of locations) {
        const item = document.createElement("li");
        const details = document.createElement("div");
        const name = document.createElement("strong"); name.textContent = `${location.icon}: ${location.name}`;
        const coords = document.createElement("p"); coords.textContent = `${location.lat}, ${location.long}`;
        details.append(name, coords);
        const actions = document.createElement("div"); actions.className = "row-actions";
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
        edit.addEventListener("click", () => { Object.entries(location).forEach(([key, value]) => { fields[key].value = value; }); document.getElementById("cancel-edit").hidden = false; fields.name.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); });
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

  SondeHubLocations.ICONS.forEach((icon) => { const option = document.createElement("option"); option.value = icon; option.textContent = icon; fields.icon.append(option); });
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
