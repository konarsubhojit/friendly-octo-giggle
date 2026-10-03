import { describe, expect, inject, it } from 'vitest'
import { resolve } from 'node:path'
import vitestPackage from 'vitest/package.json'
import coveragePackage from '@vitest/coverage-v8/package.json'
import appPackage from '../package.json'
import { Button } from '@/components/ui/Button'
import { clientModuleFiles } from '../vitest.config.mts'

declare module 'vitest' {
  interface ProvidedContext {
    reactCompilerEnabled: boolean
  }
}

describe('Vitest tooling compatibility', () => {
  it('compiles inherited client components except during source coverage', () => {
    expect(Button.toString().includes('const $ =')).toBe(
      inject('reactCompilerEnabled')
    )
  })

  it('includes directive-free components imported by a client boundary', () => {
    expect(clientModuleFiles).toContain(
      resolve(import.meta.dirname, '../src/components/ui/Button.tsx')
    )
  })

  it('does not compile asynchronous server components', () => {
    expect(clientModuleFiles).not.toContain(
      resolve(
        import.meta.dirname,
        '../src/features/admin/components/AdminNavLinks.tsx'
      )
    )
  })

  it('installs matching Vitest and coverage provider versions', () => {
    expect(coveragePackage.version).toBe(vitestPackage.version)
  })

  it('pins Vitest and its coverage provider together', () => {
    const vitest = appPackage.devDependencies.vitest

    expect(appPackage.devDependencies['@vitest/coverage-v8']).toBe(vitest)
    expect(vitest).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
