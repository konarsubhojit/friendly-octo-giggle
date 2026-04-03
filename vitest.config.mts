import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
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
      include: [
        'src/lib/**',
        'src/contexts/**',
        'src/components/**',
        'src/app/**',
        'src/features/**',
        'src/hooks/**',
      ],
      exclude: [
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/lib/schema.ts',
        'src/lib/db.ts',
        'src/lib/env.ts',
        'src/lib/redis.ts',
        'src/lib/logger.ts',
        'src/lib/qstash.ts',
        'src/lib/qstash-events.ts',
        'src/lib/queue.ts',
        'src/lib/email/providers.ts',
        'src/lib/constants/categories.ts',
        'src/lib/constants/checkout-policies.ts',
        'src/lib/search/**',
        'src/lib/ai/**',
        'src/proxy.ts',
        'src/types/**',
      ],
    },
  },
})
