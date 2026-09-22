# SondeHub Custom Locations

A local-only Firefox WebExtension that adds persistent personal markers to the public [SondeHub Tracker](https://tracker.sondehub.org/) and [SondeHub Amateur](https://amateur.sondehub.org/) maps.

This is an independent community project. It is not affiliated with, sponsored by, or endorsed by SondeHub.

- **Firefox desktop:** 140 or newer
- **Firefox for Android:** 142 or newer
- **Current release:** 1.1.0
- **License:** MIT
- **Status:** source and unsigned builds are available; persistent installation requires Mozilla signing

The extension has no backend, account, analytics, telemetry, or extension-originated network requests. Locations are stored in Firefox with `browser.storage.local`.

## Contents

- [Features](#features)
- [Install for development](#install-for-development)
- [Use the extension](#use-the-extension)
- [CSV import](#csv-import)
- [Build and verify](#build-and-verify)
- [Create a persistent signed release](#create-a-persistent-signed-release)
- [Firefox for Android](#firefox-for-android)
- [Troubleshooting](#troubleshooting)
- [Privacy and permissions](#privacy-and-permissions)
- [Architecture and repository layout](#architecture-and-repository-layout)
- [Limitations](#limitations)
- [Contributing and security](#contributing-and-security)
- [Licensing and provenance](#licensing-and-provenance)

## Features

- Runs only on `tracker.sondehub.org`, `sondehub.org`, and `amateur.sondehub.org`.
- Adds markers in a separate Leaflet overlay named **Custom locations**.
- Adds, edits, and deletes browser-local locations from a responsive options page.
- Imports CSV files with `name,icon,lat,long` columns in **add** or **replace all** mode.
- Reports skipped CSV rows with their source row number and validation error.
- Updates open SondeHub tabs immediately when locations change.
- Includes all 316 optimized Heroicons v2.2.0 Micro SVGs.
- Provides a searchable, keyboard-accessible Micro icon picker with live preview.
- Preserves legacy icon names and migrates previously stored larger Heroicons variants to the matching Micro icon.

## Install for development

There is not yet a Mozilla-signed public release. Use this temporary installation path to test the source on desktop Firefox.

### 1. Get and verify the source

Requirements: Git, Node.js 20 or newer, Python 3, and Firefox 140 or newer.

```sh
git clone https://github.com/Mason10198/sondehub-custom-locations.git
cd sondehub-custom-locations
npm ci
npm test
npm run lint
```

The project has no runtime npm dependencies. `npm ci` validates the committed lockfile.

### 2. Load it temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on…**.
3. Select this repository's `manifest.json`.
4. Open `about:addons`, find **SondeHub Custom Locations**, and select **Preferences**.

Temporary add-ons are removed when Firefox restarts. Saved extension storage may remain in the development profile, but temporary loading is not a persistent deployment method.

For an optional automatic desktop development loop, install current `web-ext` and run:

```sh
npx --yes web-ext@latest run --source-dir .
```

This launches a disposable Firefox development profile and is also temporary.

## Use the extension

1. Open the extension's **Preferences** page from `about:addons`.
2. Enter a location name, choose an icon, and enter decimal latitude and longitude.
3. Select **Save location**.
4. Open or return to a supported SondeHub map.
5. Enable **Custom locations** in the map's layer control if it is not already visible.
6. Select a marker to view its name and coordinates.

Editing or deleting a location updates supported SondeHub tabs without a reload. **Delete all** requires confirmation.

## CSV import

CSV files must have this header:

```csv
name,icon,lat,long
```

Example:

```csv
name,icon,lat,long
Home,home,40.7128,-74.0060
Launch site,24-solid/rocket-launch,34.0522,-118.2437
"Field, west",landing,51.5074,-0.1278
```

A complete sample is available at [`examples/locations.csv`](examples/locations.csv).

Import behavior:

- **Add:** appends valid imported locations to the saved list.
- **Replace all:** replaces the saved list with valid imported locations.
- Header names are case-insensitive. The required columns are `name`, `icon`, `lat`, and `long`; extra columns are ignored.
- Invalid rows are skipped and reported; valid rows in the same file still import.
- Latitude must be from `-90` to `90`; longitude must be from `-180` to `180`.
- Names are trimmed, required, and limited to 120 characters.
- UTF-8 files with an optional byte-order mark are supported.
- Standard quoted CSV fields, commas inside quoted names, escaped quotes, CRLF, and quoted multiline fields are supported.
- Canonical icon keys use `16-solid/name`, such as `16-solid/map-pin` or `16-solid/home`.
- Legacy keys such as `pin`, `home`, `launch`, `landing`, and `radio` remain supported.
- Missing or unknown icon values use the default Map pin.
- There is currently no CSV export function. Keep the source CSV separately if it is your backup.

## Build and verify

### Requirements

- Node.js 20 or newer
- Python 3

### Complete local verification

```sh
npm ci
npm run verify:vendor
npm run generate:icons
npm test
npm run lint
npm run package
npm run verify:package
python3 -m zipfile -t dist/sondehub-custom-locations-1.1.0.xpi
npx --yes web-ext@latest lint --source-dir . \
  --ignore-files scripts/package.py scripts/verify-package.py
```

What these commands do:

- `npm run verify:vendor` verifies the pinned Heroicons revision hashes, license hash, file types, and safe SVG boundary.
- `npm run generate:icons` deterministically regenerates `src/shared/icons.js` from the vendored SVG files.
- `npm test` runs the catalog, CSV, validation, protocol, storage, and map-adapter tests.
- `npm run lint` checks the manifest, generated catalog, third-party provenance, required packaged assets, and JavaScript syntax.
- `npm run package` creates `dist/sondehub-custom-locations-<version>.xpi`.
- `npm run verify:package` builds the XPI twice, compares SHA-256 hashes, checks ZIP integrity and duplicate paths, and verifies the runtime-only allowlist and required licenses.
- `web-ext lint` applies Mozilla's current add-on validation rules.

`src/shared/icons.js` is generated. Do not edit it manually.

### Packaging properties

The packaging script:

- Reads the version from `manifest.json`.
- Includes only the manifest, runtime icons and source, project license, third-party notices, and vendored Heroicons.
- Refuses symlinks and special files.
- Sorts archive paths and uses fixed ZIP timestamps for deterministic output.
- Produces an **unsigned** XPI. Renaming or building an XPI does not sign it.

The package is byte-identical across two builds in the same verified environment. Cross-platform byte identity can depend on the Python and zlib implementations, so release receipts should record the exact environment and published SHA-256 rather than assuming every toolchain produces identical compressed bytes.

## Create a persistent signed release

Firefox Release and Beta require Mozilla-signed add-ons. Choose one of Mozilla's supported distribution paths:

- **Listed on AMO:** submit the XPI through the [AMO Developer Hub](https://addons.mozilla.org/developers/) for a public listing and Mozilla distribution.
- **Self-distributed:** use Mozilla's unlisted signing workflow, then distribute the returned signed XPI yourself where the target Firefox platform permits it.

Recommended release procedure:

1. Update `manifest.json`, `package.json`, `package-lock.json`, and [`CHANGELOG.md`](CHANGELOG.md) to the same version.
2. Run every command in [Complete local verification](#complete-local-verification).
3. Record the SHA-256 printed by `npm run verify:package` and inspect the exact XPI that will be submitted.
4. Submit that XPI to AMO and complete the required listing, privacy, and compatibility information.
5. Test the Mozilla-signed artifact in a clean Firefox profile.
6. Tag the exact source commit and attach only the verified signed or unsigned artifact with an unambiguous filename.

For a Mozilla-signed self-distributed desktop build, open `about:addons`, use the gear menu, choose **Install Add-on From File…**, and select the signed XPI. Standard Firefox Release and Beta do not normally install an unsigned XPI persistently.

The committed Gecko ID is stable and should not change after publishing. The manifest declares `browser_specific_settings.gecko.data_collection_permissions.required: ["none"]` because the extension does not collect or transmit user data.

Never commit AMO API credentials, signing keys, browser profiles, or real personal-location exports.

## Firefox for Android

### Temporary development installation

Requirements: Android Platform Tools (`adb`), a connected Android device or emulator, Firefox for Android with remote debugging enabled, and current `web-ext`.

```sh
adb devices
npx --yes web-ext@latest lint --source-dir . \
  --ignore-files scripts/package.py scripts/verify-package.py
npx --yes web-ext@latest run \
  --source-dir . \
  --target firefox-android \
  --android-device DEVICE_SERIAL \
  --firefox-apk FIREFOX_PACKAGE_ID
```

Replace `DEVICE_SERIAL` with the value from `adb devices`. Replace `FIREFOX_PACKAGE_ID` with the installed Firefox package being tested. `web-ext` can also prompt for a connected device when `--android-device` is omitted.

Temporary Android installation is for an edit/test loop. The extension is removed when the browser restarts, so this path does not prove persistent installation or storage across a full restart.

### Persistent Android installation

Use a Mozilla-signed build. For normal users, publish a compatible listed add-on through AMO and install it through Firefox for Android's Add-ons Manager.

Mozilla also documents installing a **signed** self-distributed XPI from a file on Android after enabling Firefox's hidden **Install Extension from File** option. Follow Mozilla's current [self-distributed installation documentation](https://extensionworkshop.com/documentation/publish/install-self-distributed/) and do not use this route with the unsigned `dist/*.xpi` produced by this repository.

Firefox for Android Nightly also supports AMO custom collections for development and testing. Follow Mozilla's current [custom extension collections documentation](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/#testing-extension-collection) rather than assuming the same flow is available in Release or Beta.

On a real device, verify:

1. Options-page add, edit, import, and delete behavior.
2. Marker rendering and the **Custom locations** layer on each supported SondeHub host.
3. Live updates without reloading the map.
4. Full Firefox restart and storage persistence using the signed persistent installation.

## Troubleshooting

### A saved marker does not appear

- Confirm the tab is on `tracker.sondehub.org`, `sondehub.org`, or `amateur.sondehub.org`.
- Wait for the SondeHub Leaflet map to finish loading.
- Check the map's layer control for **Custom locations**. If the site does not expose a layer selector, the extension still attempts to add its layer directly.
- Open the options page and confirm the location has valid decimal coordinates.
- Reload the temporary add-on in `about:debugging`, then reload the map tab.
- Only the first 250 saved locations render in a map tab; all records remain editable in the options page.

### Changes do not update an open map

- Confirm the map tab was already open on a supported URL and finished initializing.
- Reload the map tab once to recover from a SondeHub page update or failed initialization.
- Check that the extension is enabled in `about:addons`. Temporary add-ons disappear after Firefox restarts.

### CSV import fails or skips rows

- Confirm the file includes `name,icon,lat,long` headers.
- Check latitude and longitude ranges and the 120-character name limit.
- Review the options-page skipped-row report; valid rows still import unless the CSV header or quoting is fatally invalid.
- Remember that **Replace all** intentionally replaces the existing saved list with the valid imported rows.

### Firefox refuses to install the XPI

- `npm run package` creates an unsigned development artifact.
- Use temporary loading for development or submit the artifact to Mozilla for signing before persistent installation.
- Make sure the Firefox version meets the desktop or Android minimum in `manifest.json`.

### Android device is not detected

- Run `adb devices`, unlock the device, and accept the USB-debugging prompt.
- Enable Firefox's remote USB debugging setting.
- Verify the `--android-device` serial and `--firefox-apk` package identify the connected device and installed Firefox channel.

## Privacy and permissions

- **Permission:** `storage`, used only for browser-local locations.
- **Host access:** exactly `tracker.sondehub.org`, `sondehub.org`, and `amateur.sondehub.org`.
- No backend, account, analytics, telemetry, tracking, cloud database, CDN, or extension-originated network requests.
- The AMO data-collection declaration is `none`.
- Deleting all locations removes the extension's `locations` storage key.
- Firefox profile backup, sync, clearing, and removal behavior remains controlled by Firefox.

### Supported-page boundary

To render a marker with the site's existing Leaflet map, the extension passes the marker name, icon key, latitude, and longitude into the supported page realm. The page can inspect that displayed data while its tab is open. Do not store a location that must remain secret from the supported SondeHub page.

The bridge is one-way: it sends bounded, validated display snapshots and does not accept page-triggered requests for storage reads.

## Architecture and repository layout

Firefox isolates normal content scripts from page globals such as `window.map` and `window.L`. The extension uses two narrow components:

1. `src/content/storage-bridge.js` runs in the isolated extension world, reads `browser.storage.local`, and sends only validated display fields through a JSON-string `CustomEvent`.
2. `src/content/main-adapter.js` runs in Firefox's MAIN content-script world, waits for SondeHub's Leaflet map, and owns one independent `L.LayerGroup`.

User-facing popup text is created with DOM text APIs. SVG is selected only from the generated, fixed Heroicons allowlist; CSV, storage, and page input cannot supply SVG markup.

```text
.github/workflows/     Public CI checks
examples/              Example CSV input
icons/                 Extension application icon
scripts/               Catalog generation, provenance, lint, and packaging
src/content/           SondeHub page integration
src/options/           Location management interface
src/shared/            Icons, validation, transport, and storage logic
test/                  Node.js test suite
third_party/heroicons/ Pinned Heroicons source and upstream license
```

`icons/icon.svg` is original project artwork and is distributed under the project's MIT license.

## Limitations

- SondeHub Tracker and Amateur are third-party applications. A change to their Leaflet globals or layer control may require an adapter update.
- Address geocoding is not included; enter decimal coordinates directly.
- `browser.storage.local` persists with the Firefox profile. Removing the extension or clearing its data may remove saved locations.
- Storage mutations are serialized within one extension context. Simultaneous writes from separate extension contexts can still conflict because `storage.local` has no compare-and-swap operation.
- A supported map tab renders at most 250 saved locations to bound page-world parsing and Leaflet work. All saved locations remain manageable in the options page.
- Firefox for iOS does not run Firefox WebExtensions. Supporting iPhone or iPad would require a separate Safari Web Extension and Xcode application.

## Contributing and security

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development and pull-request requirements.

See [`SUPPORT.md`](SUPPORT.md) before opening a usage, compatibility, or feature issue.

Report vulnerabilities according to [`SECURITY.md`](SECURITY.md), not through a public issue.

Release history is recorded in [`CHANGELOG.md`](CHANGELOG.md).

## Licensing and provenance

Project code is licensed under the [MIT License](LICENSE).

Heroicons are separately MIT-licensed by Tailwind Labs, Inc. The complete upstream license, pinned tag and commit, imported Heroicons Micro tree count, and deterministic hash are documented in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). `npm run verify:vendor` checks the vendored files and the written provenance record together.
