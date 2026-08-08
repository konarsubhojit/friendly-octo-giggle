import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    // Run components through the React Compiler in unit tests too, so the code
    // the suite exercises is the code the production build ships
    // (`reactCompiler: true` in next.config.ts). Without this, Vitest would
    // test the uncompiled sources and a compiler-introduced regression could
    // pass 3 500+ green tests unnoticed.
    react({
      babel: { plugins: [['babel-plugin-react-compiler', {}]] },
    }),
  ],
  test: {
    environment: 'node',
    pool: 'threads',
    maxConcurrency: 8,
    globals: true,
    maxWorkers: 4,
    fileParallelism: true,
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NODE_ENV: 'test',
    },
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 74,
        functions: 80,
        statements: 80,
        // Keep this pattern aligned with feature service paths under src/features/**/services/**/*.ts.
        'src/features/**/services/**/*.ts': {
          lines: 85,
          // Branches remain lower because current service branch coverage baseline is below line/function coverage.
          branches: 76,
          functions: 85,
          statements: 85,
        },
      },
      include: [
        'src/lib/**',
        'src/contexts/**',
        'src/components/**',
        'src/app/**',
        'src/features/**',
        'src/hooks/**',
        // Security perimeter: rate limiting, HTTPS enforcement, CSP, admin gate.
        'src/proxy.ts',
      ],
      // Every exclusion below must be either a framework-owned entrypoint or a
      // config-like/generated module with no branching logic of its own.
      // Security-relevant code (e.g. `src/proxy.ts`, `src/lib/search/**`) is
      // never excluded — it must stay visible to coverage and SonarQube.
      exclude: [
        // Next.js route entrypoints — exercised by E2E, not unit tests.
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/global-error.tsx',
        // Static metadata generators (no runtime branching).
        'src/app/manifest.ts',
        'src/app/sitemap.ts',
        // Declarative Drizzle table definitions.
        'src/lib/schema.ts',
        // Connection/config bootstrap modules (external clients, env parsing).
        'src/lib/db.ts',
        'src/lib/env.ts',
        'src/lib/redis.ts',
        'src/lib/logger.ts',
        'src/lib/email/providers.ts',
        // Constant tables with no logic.
        'src/lib/constants/categories.ts',
        'src/lib/constants/checkout-policies.ts',
        // Type-only declarations (erased at runtime).
        'src/types/**',
      ],
    },
  },
})
