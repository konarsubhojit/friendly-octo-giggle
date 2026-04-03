import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    pool: 'threads',
    maxConcurrency: 128,
    globals: true,
    maxWorkers: 8,
    fileParallelism: true,
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['__tests__/lib/**/*.test.ts', 'node'],
      ['__tests__/app/api/**/*.test.ts', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/lib/**',
        'src/contexts/**',
        'src/components/**',
        'src/app/**',
        'src/features/**',
      ],
      exclude: [
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/lib/schema.ts',
        'src/lib/db.ts',
        'src/lib/email/providers.ts',
        'src/lib/constants/categories.ts',
        'src/lib/search-service.ts',
      ],
    },
  },
})
