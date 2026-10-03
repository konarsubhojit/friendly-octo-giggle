import { defineConfig } from 'vitest/config'
import { parseCLI } from 'vitest/node'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'node:path'
import ts from 'typescript'
import { normalizePath } from 'vite'

const rootDirectory = import.meta.dirname
const configFile = ts.readConfigFile(
  resolve(rootDirectory, 'tsconfig.json'),
  ts.sys.readFile
)
const { options: compilerOptions } = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  rootDirectory
)

const hasDirective = (source: ts.SourceFile, directive: string): boolean => {
  for (const statement of source.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteral(statement.expression)
    ) {
      return false
    }
    if (statement.expression.text === directive) return true
  }
  return false
}

const getRuntimeImports = (source: ts.SourceFile): string[] =>
  ts
    .preProcessFile(
      ts.transpileModule(source.text, { compilerOptions }).outputText,
      true
    )
    .importedFiles.map((dependency) => dependency.fileName)

const getClientModules = (): string[] => {
  const sources = new Map(
    ts.sys
      .readDirectory(resolve(rootDirectory, 'src'), [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
      ])
      .map((fileName): [string, ts.SourceFile] => [
        normalizePath(fileName),
        ts.createSourceFile(
          fileName,
          ts.sys.readFile(fileName) ?? '',
          ts.ScriptTarget.Latest
        ),
      ])
  )
  const pending = [...sources]
    .filter(([, source]) => hasDirective(source, 'use client'))
    .map(([fileName]) => fileName)
  const clientModules = new Set<string>()
  const visited = new Set<string>()
  const resolutionCache = ts.createModuleResolutionCache(
    rootDirectory,
    normalizePath,
    compilerOptions
  )
  while (pending.length > 0) {
    const fileName = pending.pop()
    if (!fileName || visited.has(fileName)) continue
    visited.add(fileName)
    const source = sources.get(fileName)
    if (
      !source ||
      source.isDeclarationFile ||
      hasDirective(source, 'use server')
    ) {
      continue
    }
    const imports = getRuntimeImports(source)
    if (imports.includes('server-only')) continue
    clientModules.add(fileName)
    for (const moduleName of imports) {
      const dependency = ts.resolveModuleName(
        moduleName,
        fileName,
        compilerOptions,
        ts.sys,
        resolutionCache
      ).resolvedModule
      if (dependency) pending.push(normalizePath(dependency.resolvedFileName))
    }
  }
  return [...clientModules]
}

export const clientModuleFiles = getClientModules()
const coverageOptions = parseCLI(['vitest', ...process.argv.slice(2)], {
  allowUnknownOptions: true,
}).options.coverage
const reactCompilerEnabled = !coverageOptions?.enabled

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
    // Source coverage must not count generated memo-cache branches.
    reactCompilerEnabled &&
      babel({
        include: clientModuleFiles,
        plugins: [['babel-plugin-react-compiler', {}]],
      }),
  ],
  test: {
    environment: 'node',
    pool: 'threads',
    globals: true,
    provide: { reactCompilerEnabled },
    // Worker count and per-file concurrency are deliberately left to Vitest,
    // which sizes them from the host's available parallelism. The previous
    // fixed `maxWorkers: 16` / `maxConcurrency: 120` were tuned for a wide
    // self-hosted runner pool that no longer exists; on the 4-core
    // `ubuntu-latest` runner that now runs the `test` job that oversubscribed
    // the CPU badly enough that arbitrary tests blew the 5s default timeout,
    // so the suite failed on a different file each run.
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
