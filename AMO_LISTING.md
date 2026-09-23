# AMO listing copy

This file contains the prepared public listing and reviewer text for Mozilla Add-ons. Update the version and screenshots before each submission.

## Name

SondeHub Custom Locations

## Summary

Add persistent custom markers on supported SondeHub maps, with Firefox Sync, CSV backup, and customizable bundled icons.

## Description

SondeHub Custom Locations adds persistent private markers on the three supported SondeHub hosts.

Use the responsive options page to:

- Save named latitude and longitude markers.
- Choose from 316 bundled Heroicons.
- Set default icon, foreground color, background color, and marker diameter.
- Reveal names on hover or keep them visible with the **Always show names** preference.
- Override each appearance setting independently for individual locations.
- Synchronize locations between desktop Firefox profiles through Firefox-managed Sync.
- Export and import portable CSV backups on desktop and Android.

Only `name`, `lat`, and `long` are required when importing CSV files. Appearance columns are optional.

The extension has no project-operated server, analytics, telemetry, advertising, remotely loaded resources, or direct network requests. It requests the `storage` API permission and content-script access only on the three supported SondeHub hosts, without a separate `host_permissions` block. Saved marker data is rendered by an isolated content script inside a closed shadow root and is not passed to SondeHub page scripts.

This is an independent community project and is not affiliated with, sponsored by, or endorsed by SondeHub.

## Homepage and support

- Homepage: `https://github.com/Mason10198/sondehub-custom-locations`
- Support: `https://github.com/Mason10198/sondehub-custom-locations/issues`
- Privacy policy: `https://github.com/Mason10198/sondehub-custom-locations/blob/main/PRIVACY.md`

These URLs are publicly accessible from the project repository.

## License

MIT

## Suggested screenshots

1. Mobile options page showing the installed marker defaults.
2. Searchable icon chooser at a narrow viewport.
3. A synthetic custom marker and the **Markers** toggle on a supported SondeHub map.

Use synthetic marker names and coordinates. Do not upload real personal locations, browser profiles, credentials, or AMO secrets.

## Notes for reviewers

- Version 1.6.4 requests the `storage` API permission and content-script access only on `https://tracker.sondehub.org/*`, `https://sondehub.org/*`, and `https://amateur.sondehub.org/*`; it does not declare a separate `host_permissions` block. Required `locationInfo` declares that browser-managed Sync can transport saved coordinates.
- There is no project backend, developer account system, analytics, telemetry, advertising, remote code, remote assets, or direct extension networking.
- Extension pages use a local-only CSP containing `connect-src 'none'`.
- Desktop synchronization uses Firefox-managed `browser.storage.sync`. The developer does not operate the transport or receive synchronized data. Firefox for Android retains the same data locally, and CSV provides manual portability.
- An isolated content script privately reads extension storage and renders markers inside a closed shadow root. Its host is mounted in Leaflet's map pane, inherits native panning, and mirrors the active tile-container zoom transform, while SondeHub page scripts cannot inspect the marker tree. No marker-data message bridge exists.
- Custom markers render below SondeHub's sonde and chase-car marker pane. Names are hidden by default and shown only on hover unless the synchronized **Always show names** setting is enabled.
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
