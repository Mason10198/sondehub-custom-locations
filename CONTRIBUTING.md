# Contributing

Contributions are welcome. Keep changes focused, preserve the extension's no-backend privacy model and browser-managed sync boundary, and include tests for behavior changes.

By submitting a contribution, you confirm that the work is your own or that you have the right to submit it under the project's MIT license. Preserve copyright, license, and third-party attribution notices.

## Development setup

Requirements:

- Node.js 20 or newer
- Python 3
- Firefox 140 or newer for desktop runtime testing

```sh
git clone https://github.com/Mason10198/sondehub-custom-locations.git
cd sondehub-custom-locations
npm ci
npm test
npm run lint
npm run package
```

The project has no runtime npm dependencies. `npm ci` validates the committed lockfile and creates no dependency tree beyond the project metadata.

## Before opening a pull request

Run the complete local checks:

```sh
npm test
npm run lint
npm run package
python3 -m zipfile -t dist/sondehub-custom-locations-*.xpi
npx --yes web-ext@latest lint --source-dir . \
  --ignore-files scripts/package.py scripts/verify-package.py
git diff --check
```

Then temporarily load `manifest.json` through `about:debugging#/runtime/this-firefox` and verify the affected options-page and SondeHub map behavior.

## Generated and vendored files

- Do not edit `src/shared/icons.js` manually. Change the generator or vendored source, then run `npm run generate:icons`.
- Heroicons are pinned third-party assets. A version update must preserve the upstream license, update `THIRD_PARTY_NOTICES.md`, update the expected hashes in `scripts/verify-vendored-assets.js`, and pass `npm run verify:vendor`.
- Do not add remotely loaded scripts, fonts, icons, analytics, or telemetry.

## Pull requests

Describe:

- The user-visible change.
- Privacy or permission impact, including an explicit statement when there is none.
- Tests and real Firefox checks performed.
- Any remaining desktop or Android manual verification.

Do not include real personal locations, browser profiles, credentials, signed XPI secrets, or AMO API credentials in commits or test data.
