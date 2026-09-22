# Third-party notices

## Heroicons

This extension includes the complete original SVG catalog from [Heroicons](https://github.com/tailwindlabs/heroicons), maintained by Tailwind Labs, Inc. The catalog contains 1,288 icons from the pinned revision.

- Upstream revision: [`v2.2.0`](https://github.com/tailwindlabs/heroicons/tree/v2.2.0), commit [`0435d4ca364a608cc75e2f8683d374e55abbae26`](https://github.com/tailwindlabs/heroicons/commit/0435d4ca364a608cc75e2f8683d374e55abbae26)
- Copied variants: complete `optimized/24/outline/*.svg` (324), `optimized/24/solid/*.svg` (324), `optimized/20/solid/*.svg` (324), and `optimized/16/solid/*.svg` (316) trees
- Deterministic variant-tree SHA-256 values (`filename + NUL + contents`, filename-sorted):
  - `24/outline`: `9bba1e68e2f19f1af39ee142236d07fa14a3e1bfb538c0bbe6c7aea1a98da3f2`
  - `24/solid`: `03b0bfb73e191b16f7232f48f1ba2db6793443fd438ef22a9f39e3145a93e664`
  - `20/solid`: `1c4674bdee3ea198005c92c74bf20e67f7dde71109d77fc4119e26c29bbb4d3b`
  - `16/solid`: `b22641de8ebeb2f1c11dce61027f00c23b80346325294b1d7b8b56304725cb84`
- License SHA-256: `60e0b68c0f35c078eef3a5d29419d0b03ff84ec1df9c3f9d6e39a519a5ae7985`
- Vendored source and license: `third_party/heroicons/`
- License: MIT; see [`third_party/heroicons/LICENSE`](third_party/heroicons/LICENSE)

The Heroicons artwork is not authored by this project. `src/shared/icons.js` is generated mechanically from every vendored SVG variant for safe runtime rendering; it is checked against the complete source trees by `npm run lint`.
