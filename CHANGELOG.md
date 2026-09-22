# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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

[Unreleased]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Mason10198/sondehub-custom-locations/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Mason10198/sondehub-custom-locations/releases/tag/v1.0.0
