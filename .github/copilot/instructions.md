# GitHub Copilot Instructions

**This file intentionally contains no architecture description.**

The single instruction surface for this repository is
[`.github/copilot-instructions.md`](../copilot-instructions.md). Read it for the
technology stack, directory layout, code style rules, rendering model, command
list, and quality gates.

This file exists only because `.github/copilot/copilot.json` names it as the
`instructions.file` entry point. It defers entirely to the file above.

## Why this file is a pointer

It previously restated the architecture independently and drifted further than
the file it duplicated — it named Prisma ORM v7 and ioredis, neither of which is
a dependency of this project (the tree uses Drizzle ORM and `@upstash/redis`),
and it documented a `db:seed` script that does not exist.

Two divergent copies of one operating contract is the drift mechanism itself,
which Constitution Principle VIII (DRY Shared Utilities) forbids. Do not
reintroduce architecture content here. Correct
`.github/copilot-instructions.md` instead.
