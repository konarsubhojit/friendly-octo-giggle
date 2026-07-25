# Implementation Plan: Current Platform Capabilities

## Goal

Maintain one verified product capability catalog and trace it to feature specifications, route-level documentation, and browser acceptance coverage.

## Scope

1. Inventory current customer, admin, platform, and operational routes and services.
2. Document localization, PWA, AI, search, checkout queue, account, admin, and observability behavior.
3. Add implementation snapshots to owning historical specifications.
4. Cover stable cross-feature contracts in Playwright without duplicating unit/API suites.
5. Run repository release gates and targeted browser tests.

## Constraints

- Implemented behavior is the source of truth; future ideas remain explicitly marked.
- Tests use user-visible roles, labels, URLs, and response contracts rather than implementation-only selectors.
- Optional infrastructure and live credentials cannot be mandatory for deterministic smoke coverage.
