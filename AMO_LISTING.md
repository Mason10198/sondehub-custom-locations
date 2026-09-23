# AMO listing copy

This file contains the prepared public listing and reviewer text for Mozilla Add-ons. Update the version and screenshots before each submission.

## Name

SondeHub Custom Locations

## Summary

Add custom location markers to SondeHub maps with Firefox Sync, CSV backup, and customizable bundled icons.

## Description

SondeHub Custom Locations adds a separate **Custom locations** layer to the SondeHub Tracker and Amateur maps.

Use the responsive options page to:

- Save named latitude and longitude markers.
- Choose from 316 bundled Heroicons.
- Set default icon, foreground color, background color, and marker diameter.
- Override each appearance setting independently for individual locations.
- Synchronize locations between desktop Firefox profiles through Firefox-managed Sync.
- Export and import portable CSV backups on desktop and Android.

Only `name`, `lat`, and `long` are required when importing CSV files. Appearance columns are optional.

The extension has no project-operated server, analytics, telemetry, advertising, remotely loaded resources, or direct network requests. Its only extension API permission is `storage`. Saved marker data is rendered inside a same-origin-protected extension iframe and is not passed to SondeHub page scripts.

This is an independent community project and is not affiliated with, sponsored by, or endorsed by SondeHub.

## Homepage and support

- Homepage: `https://github.com/Mason10198/sondehub-custom-locations`
- Support: `https://github.com/Mason10198/sondehub-custom-locations/issues`
- Privacy policy: `https://github.com/Mason10198/sondehub-custom-locations/blob/main/PRIVACY.md`

These URLs become publicly accessible when the repository is made public.

## License

MIT

## Suggested screenshots

1. Mobile options page with **Marker defaults** first.
2. Searchable icon chooser at a narrow viewport.
3. Saved locations and per-location overrides.
4. A synthetic custom marker displayed on a supported SondeHub map.

Use synthetic marker names and coordinates. Do not upload real personal locations, browser profiles, credentials, or AMO secrets.

## Notes for reviewers

- Version 1.6.4 requests only the `storage` API permission and declares required `locationInfo` for Firefox's built-in consent because browser-managed Sync can transport saved coordinates.
- Static content scripts run only on `https://tracker.sondehub.org/*`, `https://sondehub.org/*`, and `https://amateur.sondehub.org/*`.
- There is no project backend, developer account system, analytics, telemetry, advertising, remote code, remote assets, or direct extension networking.
- Extension pages use a local-only CSP containing `connect-src 'none'`.
- Desktop synchronization uses Firefox-managed `browser.storage.sync`. The developer does not operate the transport or receive synchronized data. Firefox for Android retains the same data locally, and CSV provides manual portability.
- An isolated content script derives only map viewport geometry from page-visible Leaflet tiles. A transparent extension-origin iframe privately reads extension storage and renders markers; SondeHub page scripts cannot read its marker DOM. The iframe never posts marker data to its parent.
- The only bundled third-party assets are Heroicons v2.2.0 Micro icons from commit `0435d4ca364a608cc75e2f8683d374e55abbae26`, under the MIT license. Provenance and hashes are in `THIRD_PARTY_NOTICES.md`.
- `src/shared/icons.js` is generated deterministically from the vendored Heroicons source with `npm run generate:icons`. `npm run verify:vendor` verifies the pinned source tree.
- `python3 scripts/package.py` creates the exact-allowlisted unsigned XPI. `npm run verify:package` builds it twice and checks archive paths, bytes, metadata, integrity, and reproducibility.
- The separate AMO source archive includes the complete vendored icon source, tests, generation scripts, build scripts, and instructions. `npm run verify:source` extracts that archive and reproduces a byte-identical XPI.
- CSV import requires only `name`, `lat`, and `long`. `icon`, `icon_color`, `background_color`, and `marker_diameter` are optional overrides.
- The extension stores and renders at most 250 validated locations and enforces Firefox Sync item and total-byte limits before writes.

## Reviewer build commands

```sh
npm ci --ignore-scripts
npm run verify:vendor
npm run generate:icons
npm test
npm run lint
npm run package
npm run verify:package
```

Requirements: Node.js 20 or newer and Python 3. No runtime npm packages are used, and the lockfile contains no third-party npm dependencies.
