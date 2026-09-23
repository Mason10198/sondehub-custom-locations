# Security policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch. Older versions may not receive separate patches.

## Reporting a vulnerability

Do not report a vulnerability in a public issue. Use GitHub's private vulnerability reporting or security-advisory flow for this repository when available. If that option is unavailable, contact the maintainer through the GitHub profile before sharing technical details publicly.

Include the affected version, Firefox platform, reproduction steps, and the security or privacy impact. Do not include real personal coordinates, browser profile data, credentials, or AMO signing secrets.

## Security boundaries

The extension intentionally passes only marker names, icon keys, colors, and coordinates into a supported SondeHub page so Leaflet can render them. That displayed data is inspectable by the page while the tab is open. The extension does not treat the supported page realm as a secret boundary.

Expected invariants include:

- No backend, analytics, telemetry, or extension-originated network requests.
- Only the documented `storage` API permission and static content-script matches for the three exact SondeHub hosts; no separate `host_permissions` declaration.
- A one-way, bounded, exact-schema storage-to-page bridge.
- User text rendered with DOM text APIs rather than HTML.
- SVG markup selected only from the pinned, generated Heroicons allowlist.
