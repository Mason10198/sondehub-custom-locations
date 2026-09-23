## Summary

Describe the user-visible or maintenance change.

## Privacy and permissions

- [ ] No privacy, permission, host, network, or data-flow change.
- [ ] This change affects privacy, permissions, hosts, networking, or data flow; details are below.

Explain any checked impact. The project intentionally has no backend, analytics, telemetry, remote assets, or direct extension networking.

## Verification

List the checks actually performed:

- [ ] `npm run verify:vendor`
- [ ] `npm run generate:icons`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run verify:package`
- [ ] Current `web-ext lint`
- [ ] Temporary packaged Firefox test
- [ ] Narrow mobile-width inspection
- [ ] Physical Firefox for Android test, when applicable

## Data hygiene

- [ ] Test data, screenshots, and diagnostics use synthetic locations and contain no credentials, browser profiles, AMO secrets, or personal coordinates.

## Remaining manual checks

List anything not tested, especially signed installation, browser-restart persistence, or physical Android behavior.
