import nextPlugin from 'eslint-config-next/core-web-vitals'

/**
 * ESLint flat config (ESLint 9 / Next.js 16)
 *
 * Enforces the rules requested by Sonar:
 *  - no-console          → prevents leftover debug/log statements
 *  - no-implicit-globals → prevents script-style top-level var declarations
 *  - no-var              → enforce const/let over var
 *  - no-unused-vars      → catches dead variables (via @typescript-eslint)
 */
const config = [
  // Next.js core-web-vitals ruleset (includes React, React Hooks, accessibility)
  ...nextPlugin,

  // General rule overrides (all files)
  {
    rules: {
      'no-console': 'error',
      'no-implicit-globals': 'error',
      'no-var': 'error',
    },
  },

  // TypeScript-specific rule overrides (must be scoped to TS files where the plugin is registered)
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Allow console.* in startup files that run before the logger is available
  {
    files: ['src/lib/env.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Allow console.* in test files (e.g. muting React error boundaries)
  {
    files: ['__tests__/**', 'playwright-tests/**'],
    rules: {
      'no-console': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
