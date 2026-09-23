# Privacy policy

Effective September 23, 2026.

SondeHub Custom Locations does not collect, sell, share, or transmit user data to the developer. It has no project-operated server, account system, analytics, telemetry, advertising, or direct network requests.

## Data stored by the extension

The extension stores marker names, coordinates, appearance settings, and internal record identifiers through Firefox's `storage` API.

- On desktop Firefox, Firefox may synchronize extension storage through the user's Firefox account when extension syncing is enabled. That transport is operated by Mozilla; the extension developer does not receive the data.
- Firefox for Android keeps this extension data local because WebExtension Sync is unavailable there.
- CSV import and export are user-initiated local file operations. The extension does not upload CSV files.

## Supported SondeHub pages

To display a marker with the site's Leaflet map, the extension passes the marker name, coordinates, icon key, colors, and circle diameter to the supported SondeHub page while that tab is open. The page can inspect displayed marker data. Do not add a location that must remain secret from the SondeHub page displaying it.

## Permissions

The only extension API permission is `storage`. Content scripts run only on:

- `https://tracker.sondehub.org/*`
- `https://sondehub.org/*`
- `https://amateur.sondehub.org/*`

Extension pages use a content security policy that blocks network connections and remote resources.

## Deletion

Users can delete individual locations or all saved locations from the options page. Firefox controls synchronized copies, account retention, profile backups, and data removal when the extension or browser profile is removed.

## Changes and contact

Material privacy changes will be recorded in the repository and release notes. For privacy questions, use the repository's support process. Report security issues privately as described in [`SECURITY.md`](SECURITY.md).