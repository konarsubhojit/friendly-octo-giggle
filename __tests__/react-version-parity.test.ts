import { describe, expect, it } from 'vitest'
import reactPackage from 'react/package.json'
import reactDomPackage from 'react-dom/package.json'
import appPackage from '../package.json'

/**
 * `react-dom` refuses to initialise when its version differs from `react`'s by
 * even a patch release, throwing "Incompatible React versions" at import time.
 * That aborts every suite that renders a component rather than failing one
 * assertion, so a single-digit patch drift previously turned into 126 red
 * suites whose reported error pointed nowhere near the cause.
 *
 * These two assertions turn that into one failure that names the problem.
 */
describe('react and react-dom version parity', () => {
  it('resolves both packages to the same installed version', () => {
    expect(reactDomPackage.version).toBe(reactPackage.version)
  })

  it('declares both with the same exact specifier so installs cannot drift', () => {
    const react = appPackage.dependencies.react
    const reactDom = appPackage.dependencies['react-dom']

    expect(reactDom).toBe(react)
    // A range such as `^19.2.8` lets the two resolve independently, which is
    // precisely the drift that broke the suite; only an exact pin prevents it.
    expect(react).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
