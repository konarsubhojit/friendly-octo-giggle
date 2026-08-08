# Contributing

Thanks for your interest in improving this project! This guide covers the
essentials — see the [Development Guide](./docs/development.md) for the full
architecture and workflow details.

## Getting started

1. Fork and clone the repository.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in the required values (see
   [Getting Started](./docs/getting-started.md)).
4. Apply the database schema: `npm run db:migrate`
5. Start the dev server: `npm run dev`

## Branching and commits

- Branch off `develop` using a short, descriptive name (e.g. `fix/webhook-idempotency`).
- Keep commits focused; write imperative commit subjects ("Add webhook dedupe table").

## Before opening a pull request

Run the full validation suite locally and make sure every command passes:

```bash
npm run lint        # ESLint
npx tsc --noEmit    # TypeScript type-check
npm test            # Vitest unit tests
npm run build       # Next.js production build
npm run format      # Prettier
```

Pull requests should:

- Include tests for new behaviour or bug fixes.
- Update documentation under `docs/` when behaviour changes.
- Describe the change and link the related issue.

## Database changes

Never edit an applied migration. Modify `src/lib/schema.ts`, then run
`npm run db:generate`, review the generated SQL in `drizzle/`, and apply it with
`npm run db:migrate`. Keep backfills idempotent so they can be replayed safely.

## Code style

- TypeScript everywhere, `strict` mode, no `any`.
- Validate all external input with Zod.
- Server Components by default; add `'use client'` only when interactivity is needed.
- Money is stored as exact decimals — use the helpers in `src/lib/money.ts`
  instead of raw floating point arithmetic.

## Reporting issues

Open a [GitHub issue](https://github.com/konarsubhojit/friendly-octo-giggle/issues)
with reproduction steps, expected vs. actual behaviour, and environment details.

## License

By contributing you agree that your contributions are licensed under the
[ISC License](./LICENSE).
