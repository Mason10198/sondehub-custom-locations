# Security policy

## Supported versions

Security fixes are applied to the latest version on the `main` branch. Older versions may not receive separate patches.

## Reporting a vulnerability

Do not report a vulnerability in a public issue. Use GitHub's private vulnerability reporting or security-advisory flow for this repository when available. If that option is unavailable, contact the maintainer through the GitHub profile before sharing technical details publicly.

Include the affected version, Firefox platform, reproduction steps, and the security or privacy impact. Do not include real personal coordinates, browser profile data, credentials, or AMO signing secrets.

## Security boundaries

Saved marker names, icon keys, colors, circle diameters, and coordinates remain inside extension contexts. An isolated content script sends only page-visible viewport geometry into a transparent extension-origin iframe. Browser same-origin protections prevent SondeHub page scripts from reading the iframe's marker DOM.

Expected invariants include:

- No project backend, analytics, telemetry, or direct extension network requests. Desktop synchronization is performed only by Firefox Sync under the user's Firefox account.
- Only the documented `storage` API permission and static content-script matches for the three exact SondeHub hosts; no separate `host_permissions` declaration.
- No MAIN-world script, page-DOM event, page-readable marker node, or storage-to-page data bridge.
- A bounded viewport-only message into an extension-origin iframe that never posts marker data to its parent.
- User text rendered with DOM text APIs rather than HTML.
- SVG markup selected only from the pinned, generated Heroicons allowlist.
