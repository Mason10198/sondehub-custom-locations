# Third-party notices

## Heroicons

This extension includes the complete original Heroicons Micro SVG catalog from [Heroicons](https://github.com/tailwindlabs/heroicons), maintained by Tailwind Labs, Inc. The catalog contains 316 icons from the pinned revision.

- Upstream revision: [`v2.2.0`](https://github.com/tailwindlabs/heroicons/tree/v2.2.0), commit [`0435d4ca364a608cc75e2f8683d374e55abbae26`](https://github.com/tailwindlabs/heroicons/commit/0435d4ca364a608cc75e2f8683d374e55abbae26)
- Copied variant: complete `optimized/16/solid/*.svg` Heroicons Micro tree (316)
- Deterministic variant-tree SHA-256 values (`filename + NUL + contents`, filename-sorted):
  - `16/solid`: `b22641de8ebeb2f1c11dce61027f00c23b80346325294b1d7b8b56304725cb84`
- License SHA-256: `60e0b68c0f35c078eef3a5d29419d0b03ff84ec1df9c3f9d6e39a519a5ae7985`
- Vendored source and license: `third_party/heroicons/`
- License: MIT; see [`third_party/heroicons/LICENSE`](third_party/heroicons/LICENSE)

The Heroicons artwork is not authored by this project. `src/shared/icons.js` is generated mechanically from every vendored Heroicons Micro SVG for safe runtime rendering; it is checked against the complete source tree by `npm run lint`.
