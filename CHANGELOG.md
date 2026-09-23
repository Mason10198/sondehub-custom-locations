# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [1.6.4] - 2026-09-23

- Added a deterministic Mozilla reviewer source archive with byte-for-byte XPI reproduction checks.
- Added prepared AMO listing/reviewer text, public screenshots, a code of conduct, and a pull-request template.
- Added public-repository badges and reviewer-source verification to CI.
- Replaced the page-world Leaflet bridge with an isolated closed-shadow marker layer so saved marker values are no longer exposed to SondeHub page scripts.
- Mounted the private marker host in Leaflet's map pane and mirrored the active tile container's zoom transform, eliminating sampled viewport tracking so markers share the map's compositor-driven pan and zoom motion.
- Hid marker names by default, restored hover/tap/keyboard name reveal, and added a synchronized **Always show names** setting with CSV backup support.
- Added version 5 CSV backup metadata for the global label-visibility setting while retaining compatibility with versions 1–4.
- Declared Firefox Sync coordinate transport as required `locationInfo` in Firefox's built-in data consent metadata.

## [1.6.3] - 2026-09-23

- Reduced the default marker circle diameter from 26 to 22 pixels while retaining the 16-pixel icon glyph.
- Updated release, privacy, security-boundary, and Mozilla publishing documentation.

## [1.6.2] - 2026-09-23

- Moved marker defaults to the top of the options page.

## [1.6.1] - 2026-09-23

- Reduced the default marker circle from 28 to 26 pixels while retaining a 16-pixel icon glyph.
- Increased the icon-to-circle ratio for larger markers to reduce excess inner padding.

## [1.6.0] - 2026-09-23

- Reworked the options page for small screens with touch-sized controls, compact copy, clearer saved-location rows, and collapsed backup/import tools.
- Replaced the large native icon list with a reusable searchable icon dialog for default and per-location icon selection.
- Hid icon, color, and diameter controls until their per-location overrides are enabled.
- Added synchronized default and per-location override support for marker circle diameter.
- Added version 4 CSV backup fields for default and overridden marker diameters while retaining `name`, `lat`, and `long` as the only required import columns.

## [1.5.0] - 2026-09-23

- Made CSV imports require only `name`, `lat`, and `long`; icon and color columns are optional overrides.
- Added a synchronized global default icon alongside the existing default colors.
- Made locations without icon overrides follow later default-icon changes, including bulk imports.
- Preserved default-icon and per-location override intent through migration and CSV backup/restore.

## [1.4.0] - 2026-09-23

- Added synchronized global default icon and background colors.
- Made locations without explicit colors inherit live defaults, including CSV rows with omitted or blank color fields.
- Added independent per-location override controls for icon and background colors.
- Preserved default settings and override intent in CSV export/import, and migrated legacy black-on-yellow records to inheritance while retaining nondefault custom colors.

## [1.3.0] - 2026-09-22

- Added browser-managed Firefox Sync for desktop locations with automatic migration from the previous local storage layout.
- Added portable CSV export and retained CSV add/replace import for desktop and Android backup and transfer.
- Stored each synchronized location in a separate bounded record, enforced Firefox Sync's per-item and total byte quotas, and capped the collection at 250 locations.
- Limited routine Sync writes to records that actually changed so edits on one desktop do not republish stale copies of unrelated markers.
- Made CSV exports safe to open in spreadsheets while preserving exact names when re-imported.
- Documented that Firefox for Android does not synchronize WebExtension storage and requires CSV transfer.

## [1.2.1] - 2026-09-22

- Removed the redundant `host_permissions` declaration, leaving `storage` as the only extension API permission and exact static content-script matches as the only page access.
- Added a local-only extension-page content security policy with all network connections disabled.
- Removed the options-page external link and added automated checks that prohibit runtime network APIs and remote resources.
- Reduced the deterministic XPI from 330 files to 14 by excluding redundant source SVG copies while retaining the complete generated local icon catalog and license.

## [1.2.0] - 2026-09-22

- Added per-location icon and background color pickers with black-on-yellow defaults.
- Added optional `icon_color` and `background_color` CSV columns with strict six-digit hex validation and default fallback when omitted or blank.
- Added automatic migration of existing saved locations to the new default colors.

## [1.1.0] - 2026-09-22

- Added the complete 316-icon Heroicons v2.2.0 Micro catalog.
- Added a searchable, keyboard-accessible Micro icon picker with live previews.
- Added migration from legacy names and previously stored larger Heroicons variants to matching Micro icons.
- Preserved compatibility with the original location icon names and previously stored Heroicons variant keys.
- Added automatic support for SondeHub Amateur.
- Added deterministic icon generation, provenance checks, expanded tests, and versioned packaging.

## [1.0.0] - 2026-09-22

- Initial Firefox WebExtension for persistent browser-local custom SondeHub markers.
- Added location CRUD, CSV add/replace import, validation reports, and immediate map updates.
- Added bounded one-way Firefox isolated-world to page-world transport.
- Added deterministic unsigned XPI packaging and desktop Firefox verification.

[Unreleased]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.6.4...HEAD
[1.6.4]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.6.3...v1.6.4
[1.6.3]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Mason10198/sondehub-custom-locations/tree/v1.0.0
