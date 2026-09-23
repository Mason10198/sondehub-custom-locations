# Publishing checklist

This checklist prepares a source commit and unsigned XPI for Mozilla review. Mozilla signing and the final store listing are external release steps.

## Before submission

1. Confirm `manifest.json`, `package.json`, and `package-lock.json` use the same version.
2. Update `CHANGELOG.md` and user-facing version references.
3. Run:

   ```sh
   npm ci
   npm run verify:vendor
   npm run generate:icons
   npm test
   npm run lint
   npm run verify:package
   npm run verify:source
   python3 -m zipfile -t dist/sondehub-custom-locations-1.6.4.xpi
   npx --yes web-ext@latest lint --source-dir . \
     --ignore-files scripts/package.py scripts/verify-package.py scripts/package-source.py scripts/verify-source.py
   git diff --check
   ```

4. Record the XPI and source-archive SHA-256 values. Confirm the XPI contains only the 12 allowlisted runtime and license files.
5. Test the packaged extension in a clean desktop Firefox profile, including the options page at a narrow viewport and marker rendering on each supported host.
6. Test the packaged extension on a physical Firefox for Android device, including options-page CRUD, CSV import/export, marker rendering, narrow layouts, and a full browser restart after signed installation.
7. Confirm the repository contains no credentials, browser profiles, personal coordinates, exported user data, or signed artifacts.
8. Commit all runtime, build, documentation, privacy, and reviewer-source files. Create the annotated version tag on that exact commit and verify the peeled remote tag target before submitting to AMO.

## Before making the repository public

- Review the complete reachable Git history, not only the current working tree, for credentials and personal data.
- Confirm public issue templates, the pull-request template, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `SUPPORT.md` render correctly.
- Confirm README badges, screenshots, privacy links, changelog comparison links, and release tags resolve publicly.
- Enable GitHub private vulnerability reporting after public visibility is active.
- Keep `package.json` marked `private` to prevent accidental npm publication; that flag is unrelated to GitHub repository visibility.
- Do not commit unsigned or Mozilla-signed XPI files, AMO credentials, signing material, reviewer uploads, or personal CSV exports.
- Do not create a GitHub Release that presents the unsigned development XPI as a normal installable Firefox release.

## AMO submission

- Upload the verified unsigned XPI from `dist/`.
- Use the stable Gecko ID already committed in `manifest.json`.
- Declare required `locationInfo` for Firefox's built-in consent because saved coordinates can be transported by browser-managed Sync. State that the developer does not receive synchronized data.
- Link to the public [`PRIVACY.md`](PRIVACY.md) URL after the repository is public.
- State that the API permission is `storage`, explain that it stores and synchronizes marker settings, and disclose content-script access on the three supported SondeHub hosts.
- Provide clear desktop and mobile screenshots of the options page and a supported SondeHub map.
- Select the supported desktop and Android Firefox versions declared in the manifest.
- Use the prepared public listing and reviewer text in [`AMO_LISTING.md`](AMO_LISTING.md).
- Upload `dist/sondehub-custom-locations-1.6.4-source.zip` with the initial submission and every update because the runtime icon catalog is generated from vendored source.

### Notes for reviewers

- The extension has no runtime npm dependencies, project backend, analytics, telemetry, remote code, remote assets, or direct network requests.
- Extension-page CSP includes `connect-src 'none'`.
- Marker data is read only in Firefox's isolated content-script world and rendered in a closed shadow root. The host inherits Leaflet's tile transforms without exposing marker values through page events, page-readable nodes, or messages.
- Content scripts are limited to the three exact SondeHub hosts in `manifest.json`.
- The only bundled third-party library/assets are Heroicons v2.2.0 Micro icons. Their pinned commit, license, hashes, and verification procedure are documented in `THIRD_PARTY_NOTICES.md`.
- `src/shared/icons.js` is deterministically generated from the vendored Heroicons tree. Run `npm run verify:vendor` and `npm run generate:icons` to verify or reproduce it.
- The build is deterministic and exact-allowlisted through `scripts/package.py` and `scripts/verify-package.py`.
- `npm run verify:source` extracts the reviewer source archive and reproduces a byte-identical unsigned XPI.
- Only `name`, `lat`, and `long` are required for CSV import. Appearance columns are optional local overrides.

## After Mozilla signing

1. Download the Mozilla-signed artifact and keep it distinct from the unsigned build.
2. Test persistent installation, restart persistence, options-page CRUD/import/export, live marker updates, and all three supported hosts in a clean desktop profile.
3. Test the signed build on a physical Firefox for Android device, including 320–430 px layouts, file import/export, marker rendering, and a full browser restart.
4. Publish release notes and attach artifacts with filenames that clearly identify whether they are signed, unsigned, or reviewer source.