# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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

[Unreleased]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Mason10198/sondehub-custom-locations/releases/tag/v1.0.0
