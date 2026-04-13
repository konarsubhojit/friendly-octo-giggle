/**
 * Server-only helper that loads `india-pincode` via the CommonJS entry point.
 *
 * Background: the ESM build of `india-pincode` (`dist/index.mjs`) calls
 * `path.resolve(__dirname, …)` inside `loadData()`. `__dirname` is a CJS
 * module variable and is **not** defined in ES module scope. When Next.js /
 * Turbopack externalises the package and Node.js loads it at runtime as ESM
 * the reference throws `ReferenceError: __dirname is not defined`.
 *
 * Using `createRequire` produces a CJS-style `require()` call which triggers
 * the `"require"` condition in the package's `exports` map, resolving to
 * `dist/index.js` (CJS build). In that build `__dirname` is always defined.
 */
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

export const { getIndiaPincode, isValidPincode } = _require(
  'india-pincode'
) as typeof import('india-pincode')
