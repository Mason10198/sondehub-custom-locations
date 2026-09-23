# Security policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch. Older versions may not receive separate patches.

## Reporting a vulnerability

Do not report a vulnerability in a public issue. Use GitHub's private vulnerability reporting or security-advisory flow for this repository when available. If that option is unavailable, contact the maintainer through the GitHub profile before sharing technical details publicly.

Include the affected version, Firefox platform, reproduction steps, and the security or privacy impact. Do not include real personal coordinates, browser profile data, credentials, or AMO signing secrets.

## Security boundaries

Saved marker names, icon keys, colors, circle diameters, and coordinates remain inside Firefox's isolated content-script world. Markers are rendered in a closed shadow root mounted in Leaflet's map pane, where they inherit panning and mirror the active tile-container zoom transform without exposing their private DOM to SondeHub page scripts.

Expected invariants include:

- No project backend, analytics, telemetry, or direct extension network requests. Desktop synchronization is performed only by Firefox Sync under the user's Firefox account.
- Only the documented `storage` API permission and static content-script matches for the three exact SondeHub hosts; no separate `host_permissions` declaration.
- No MAIN-world script, page-DOM event, page-readable marker node, or storage-to-page data bridge.
- No cross-realm message bridge; the isolated layer reads storage and renders directly into its retained closed shadow root.
- User text rendered with DOM text APIs rather than HTML.
- SVG markup selected only from the pinned, generated Heroicons allowlist.
