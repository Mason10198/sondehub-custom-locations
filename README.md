# SondeHub Custom Locations

A local-only, dependency-free Firefox WebExtension that adds personal markers to the public [SondeHub Tracker](https://tracker.sondehub.org/). It works on desktop Firefox 140+ and Firefox for Android 142+. Displayed marker data is inspectable by the tracker site while its tab is open; see [Privacy and permissions](#privacy-and-permissions).

## Features

- Runs only on `tracker.sondehub.org` and `sondehub.org`.
- Adds markers in an independent Leaflet layer named **Custom locations**.
- Saves locations indefinitely in `browser.storage.local`; the extension makes no network requests.
- Add, edit, delete, or confirm deletion of all locations from a responsive settings page.
- Import standard CSV with `name,icon,lat,long`; choose **add** or **replace all**.
- Reports each skipped CSV row with its row number and reason. Valid rows are still imported.
- Built-in icons: `pin`, `home`, `tower`, `launch`, `landing`, `star`, `warning`, and `vehicle`. Missing or invalid icons become `pin`.
- Open Tracker tabs update immediately when storage changes, without reloading or re-importing.

Try [`examples/locations.csv`](examples/locations.csv). CSV uses standard quoted fields: commas and escaped quotes in names are supported.

## Architecture

Firefox content scripts run in an isolated world and cannot see SondeHub's `window.map` or `window.L`. The extension therefore deliberately has two small pieces:

1. `src/content/storage-bridge.js` runs in the isolated world, reads only `browser.storage.local`, and performs a one-way initial/update push of validated display fields (`name`, `icon`, latitude, longitude) as a JSON-string `CustomEvent` detail. Text transport avoids Firefox's cross-world object-detail restriction. It does not handle page-controlled request or lifecycle events.
2. `src/content/main-adapter.js` runs in Firefox's MAIN content-script world, is injected before the bridge, waits for `#map`, `window.L`, and SondeHub's Leaflet map, then creates and owns one `L.LayerGroup`. It accepts only bounded, versioned JSON snapshots with the exact display-field schema, and never reads or modifies tracker vehicle/launch data.

The pure CSV/validation and storage modules are under `src/shared/` so their behavior is tested outside Firefox. Popups use DOM `textContent`, not user-provided HTML. Marker icon markup is static, packaged CSS-free Leaflet `divIcon` markup.

## Development and testing

Requirements: Node.js 20+ and Python 3 for packaging. No runtime npm dependencies are used.

```sh
npm install          # creates package-lock.json; no packages are downloaded
npm run lint         # manifest checks plus JavaScript syntax checks
npm test             # CSV/validation/storage tests
npm run package      # writes dist/sondehub-custom-locations-1.0.0.xpi
```

### Temporary installation — desktop Firefox

1. Run `npm run lint` and open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and select `manifest.json` in this repository.
3. Open `https://tracker.sondehub.org/`, then use the extension's **Preferences** from `about:addons` to add or import locations.
4. Temporary add-ons disappear when Firefox restarts. Check the Leaflet layer selector for **Custom locations** where Tracker exposes one.

### Firefox for Android — temporary development with ADB

Use this path for an edit/test loop. It is a **temporary** installation: Firefox removes the add-on when the Android browser restarts.

1. Install Node.js 20+, Android Platform Tools (`adb` on `PATH`), and current [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) (Mozilla recommends web-ext 7.12 or newer for Android). Connect a physical Android device or start an emulator, enable Android USB debugging, and accept the computer's debugging key.
2. Install the Firefox Android channel to test. Mozilla recommends matching the desktop and device channel/version where possible. The APK identifiers are `org.mozilla.fenix` (Nightly), `org.mozilla.firefox_beta` (Beta), and `org.mozilla.firefox` (Release). In that Firefox's settings, enable **Remote debugging via USB**.
3. Confirm the device is visible, then run from this repository (replace `DEVICE_SERIAL` and the APK if needed):

   ```sh
   adb devices
   npx web-ext@latest lint --source-dir .
   npx web-ext@latest run --source-dir . --target firefox-android \
     --android-device DEVICE_SERIAL --firefox-apk org.mozilla.fenix
   ```

   `web-ext run` loads the unpacked extension into Firefox's main profile and reloads it as sources change. On desktop Firefox, open `about:debugging`, enable USB devices, select the device, and click **Connect** to inspect the extension and page contexts. See Mozilla's [Firefox for Android development guide](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android) and [`web-ext run` reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference) for current channel and remote-debugging details.
4. On the phone, add a location in the add-on's options, open `https://tracker.sondehub.org/`, and confirm the **Custom locations** overlay and marker. Change or delete it and confirm the open Tracker tab updates.
5. **Temporary-install restart check:** force-close or restart Firefox. Confirm this temporary add-on is gone, then rerun `web-ext run`; do not use this route to test persistence across browser restarts.

### Firefox for Android — persistent signed installation

For a restart-persistence test, use a Mozilla-signed build distributed by a channel Firefox for Android supports; do not try to sideload this repository's unsigned `dist/*.xpi` into Release or Beta.

1. Run `npm run package`, then submit the XPI through the [AMO Developer Hub](https://addons.mozilla.org/developers/) as a listed Android-compatible add-on, or use AMO's supported signing/self-distribution workflow. Mozilla signing is required for Release and Beta installations.
2. Install the resulting AMO-distributed add-on through Firefox for Android's Add-ons flow. Availability depends on the Firefox Android channel, version, and AMO's current Android compatibility/review status; verify the listing is offered on the target device instead of assuming every AMO add-on is installable there.
3. For developer-controlled persistent testing on Firefox Android **Nightly or Beta**, Mozilla documents a custom add-on collection path. Follow its [expanded Android extension support instructions](https://blog.mozilla.org/addons/2020/09/29/expanded-extension-support-in-firefox-for-android-nightly/) exactly (enable the Debug menu, then configure the custom collection). Use only an AMO-hosted, signed add-on in that collection.
4. Add a location, fully restart Firefox, reopen the add-on and Tracker, and verify both the saved location and its **Custom locations** marker remain. Removing the add-on or clearing its extension data is expected to remove `browser.storage.local` data.

## Packaging and signing

`npm run package` produces an unsigned XPI (a ZIP with an `.xpi` extension) in `dist/`. It includes only the extension runtime files, manifest, and license, sorted by filename with ZIP extra fields omitted.

Mozilla's [signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) describes the supported AMO channels and review requirements. The committed Gecko ID is stable and must not be changed after signing. The manifest declares `browser_specific_settings.gecko.data_collection_permissions.required: ["none"]`, as required for new AMO submissions. Firefox 140 (desktop) and 142 (Android) are the minimum versions because those releases added support for this signing declaration and built-in consent. Do not upload development builds containing user data.

## Privacy and permissions

- **Permission:** `storage` stores your locations locally in Firefox.
- **Host access:** exact SondeHub Tracker hosts only, to render those markers.
- No backend, account, analytics, telemetry, tracking, cloud database, or network requests are added by this extension.
- The AMO data-collection declaration is `none`: the extension does not collect or transmit data outside the add-on or local browser.
- Deleting all locations removes the extension's `locations` storage key. Browser profile sync/backup behavior is controlled by Firefox, not this extension.
- **Tracker-tab boundary:** when a supported tracker tab is open, the displayed marker names and coordinates are deliberately passed to that tab's page realm and are inspectable by the site because Leaflet must render them on the site's existing map. They are not secret from that tracker page. The one-way bridge exports only rendering fields and never accepts page-triggered requests for fresh storage reads.

## Limitations

- SondeHub is a third-party web application. Its map globals or layer-control behavior may change; the adapter fails quietly rather than modifying unrelated Tracker data.
- Marker updates need an already-open SondeHub page and its Leaflet map to be initialized. Saved data remains available for later tabs.
- This extension does not geocode addresses; imports and edits require decimal latitude/longitude.
- `browser.storage.local` persists with the Firefox profile. Clearing extension/site data or removing the extension may remove it.
- `browser.storage.local` does not provide a compare-and-swap operation. The repository serializes mutations within one extension context, preventing same-page save/delete/import races; simultaneous mutations from separate extension contexts can still conflict at the browser storage API boundary.

## License

[MIT](LICENSE).
