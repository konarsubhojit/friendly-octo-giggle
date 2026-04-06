# friendly-octo-giggle Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-05

## Active Technologies

- TypeScript 6.0.2 with `strict: true` + React 19.2, Next.js 16.2 (App Router), zenput@1.0.1, (004-zenput-admin-integration)
- N/A — no schema or data layer changes (004-zenput-admin-integration)

- TypeScript 5.9.3, React 19.2.4, Next.js 16.1.6 + Next.js App Router, Redux Toolkit, NextAuth v5 beta, Tailwind CSS v4, react-hot-toast, Zod, Drizzle ORM (003-order-policy-dialog)
- PostgreSQL via Neon/Drizzle and Redis/Upstash already exist; this feature adds no new persistence (003-order-policy-dialog)

- TypeScript 5.9 on Next.js 16.1.6 (App Router) + React 19.2.4, Tailwind CSS v4.1, next-auth v5, Redux Toolkit 2.11 (001-cozy-shop-ui)
- N/A (no backend changes) (001-cozy-shop-ui)
- TypeScript 5.9, Next.js 16.1.6 (App Router), React 19.2.4 + Tailwind CSS v4.1 (CSS-first config), next/font/google (Playfair Display + Nunito), Redux Toolkit 2.11, NextAuth v5 (001-cozy-shop-ui)
- N/A — no backend/DB changes (FR-035) (001-cozy-shop-ui)
- TypeScript 5.9, React 19.2, Next.js 16.1 + Drizzle ORM 0.45, Redux Toolkit 2.11, Zod 4.3, Tailwind CSS v4.1, NextAuth v5, Vercel Blob (002-admin-variation-management)
- PostgreSQL (Neon Serverless) + Redis (ioredis 5.9) (002-admin-variation-management)

- TypeScript 5.9 on Next.js 16.1.6 (App Router) + Tailwind CSS v4.1, React 19.2.4, `next/font/google`, Redux Toolkit 2.11 (001-cozy-shop-ui)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.9 on Next.js 16.1.6 (App Router): Follow standard conventions

## Recent Changes

- 004-zenput-admin-integration: Added TypeScript 6.0.2 with `strict: true` + React 19.2, Next.js 16.2 (App Router), zenput@1.0.1,

- 003-order-policy-dialog: Added TypeScript 5.9.3, React 19.2.4, Next.js 16.1.6 + Next.js App Router, Redux Toolkit, NextAuth v5 beta, Tailwind CSS v4, react-hot-toast, Zod, Drizzle ORM

- 002-admin-variation-management: Added TypeScript 5.9, React 19.2, Next.js 16.1 + Drizzle ORM 0.45, Redux Toolkit 2.11, Zod 4.3, Tailwind CSS v4.1, NextAuth v5, Vercel Blob

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
