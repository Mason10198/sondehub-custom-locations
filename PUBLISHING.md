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
   python3 -m zipfile -t dist/sondehub-custom-locations-1.6.3.xpi
   npx --yes web-ext@latest lint --source-dir . \
     --ignore-files scripts/package.py scripts/verify-package.py
   git diff --check
   ```

4. Record the XPI SHA-256 and confirm the archive contains only the 14 allowlisted runtime and license files.
5. Test the packaged extension in a clean desktop Firefox profile, including the options page at a narrow viewport and marker rendering on each supported host.
6. Confirm the repository contains no credentials, browser profiles, personal coordinates, exported user data, or signed artifacts.

## AMO submission

- Upload the verified unsigned XPI from `dist/`.
- Use the stable Gecko ID already committed in `manifest.json`.
- Declare no developer data collection. Firefox Sync is browser-managed and the developer does not receive synchronized data.
- Link to [`PRIVACY.md`](PRIVACY.md).
- State that the only API permission is `storage` and explain that it stores and synchronizes marker settings.
- Provide clear desktop and mobile screenshots of the options page and a supported SondeHub map.
- Select the supported desktop and Android Firefox versions declared in the manifest.

### Notes for reviewers

- The extension has no runtime npm dependencies, project backend, analytics, telemetry, remote code, remote assets, or direct network requests.
- Extension-page CSP includes `connect-src 'none'`.
- Content scripts are limited to the three exact SondeHub hosts in `manifest.json`.
- The only bundled third-party library/assets are Heroicons v2.2.0 Micro icons. Their pinned commit, license, hashes, and verification procedure are documented in `THIRD_PARTY_NOTICES.md`.
- `src/shared/icons.js` is deterministically generated from the vendored Heroicons tree. Run `npm run verify:vendor` and `npm run generate:icons` to verify or reproduce it.
- The build is deterministic and exact-allowlisted through `scripts/package.py` and `scripts/verify-package.py`.
- Only `name`, `lat`, and `long` are required for CSV import. Appearance columns are optional local overrides.

## After Mozilla signing

1. Download the Mozilla-signed artifact and keep it distinct from the unsigned build.
2. Test persistent installation, restart persistence, options-page CRUD/import/export, live marker updates, and all three supported hosts in a clean desktop profile.
3. Test the signed build on a physical Firefox for Android device, including 320–430 px layouts, file import/export, marker rendering, and a full browser restart.
4. Tag the exact source commit, publish release notes, and attach artifacts with filenames that clearly identify whether they are signed or unsigned.