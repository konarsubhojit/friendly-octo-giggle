# Implementation Plan: Authentication and Account Security

**Branch**: `006-authentication-and-account-security` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/006-authentication-and-account-security/spec.md`

## Summary

Document and preserve the shipped authentication system: credentials plus Google/Microsoft provider sign-in, verified registration, password reset/change with password history, JWT session enrichment and revalidation, account lockout, rate limiting, and ADMIN/CUSTOMER role gates. The implementation uses existing Next.js App Router routes, NextAuth v5 split configuration, Drizzle-backed auth tables, bcrypt password services, Zod validation, and queued email delivery.

## Technical Context

**Language/Version**: TypeScript 6.x (`strict: true`)  
**Primary Dependencies**: Next.js App Router, NextAuth v5 beta, Auth.js Drizzle adapter, Drizzle ORM, Zod, bcryptjs, Upstash Redis/Ratelimit, Upstash QStash  
**Storage**: PostgreSQL via Drizzle (`User`, `Account`, `Session`, `VerificationToken`, `PasswordHistory`) plus Redis-backed rate limits  
**Testing**: Vitest + React Testing Library + route/service tests in `__tests__/`  
**Target Platform**: Next.js web application with serverless route handlers and edge proxy protection  
**Project Type**: Single Next.js application  
**Performance Goals**: Keep sign-in, registration, reset, and session checks responsive while limiting database token revalidation to periodic checks  
**Constraints**: No plaintext passwords or tokens; no account enumeration in recovery; OAuth config must remain edge-safe; admin routes require role enforcement  
**Scale/Scope**: Authentication pages, API routes, auth services, schema entities, proxy rate limits/security headers, and account/admin authorization surfaces

## Constitution Check

_GATE: Must pass before implementation._

- **Server-First Rendering**: Keep auth pages as App Router pages; isolate interactive forms in client components only where browser state/submission handling is required.
- **Type Safety End-to-End**: Use Zod schemas and NextAuth type augmentation for role/session fields.
- **Security by Default**: Hash passwords/tokens, enforce email verification, rate-limit sensitive paths, use secure cookies, and protect admin routes by role.
- **Testing Discipline**: Cover password services, NextAuth callbacks, auth route handlers, registration/sign-in UI, and admin authorization behavior.
- **Observability**: Log authentication events and publish email jobs asynchronously without exposing secrets or sensitive token values.

## Project Structure

### Documentation (this feature)

```text
specs/006-authentication-and-account-security/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [locale]/(public)/auth/
│   │   ├── signin/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   └── error/
│   ├── [locale]/admin/
│   └── api/auth/
│       ├── [...nextauth]/
│       ├── register/
│       ├── change-password/
│       ├── forgot-password/
│       ├── reset-password/
│       └── verify-email/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── services/
│   │   └── validations.ts
│   └── admin/services/admin-auth.ts
├── lib/
│   ├── auth.ts
│   ├── auth.config.ts
│   ├── schema.ts
│   └── logger.ts
└── types/next-auth.d.ts

__tests__/
├── features/auth/services/
├── features/admin/services/
├── lib/auth.test.ts
└── app/api/auth/

proxy.ts
```

**Structure Decision**: Keep authentication as a feature slice under `src/features/auth/`, compose provider/session behavior through `src/lib/auth*.ts`, and expose user flows through App Router pages plus `src/app/api/auth/*` route handlers. Edge-only cross-cutting controls remain in root `proxy.ts` to avoid pulling database and logger dependencies into the edge runtime.

## Delivery Phases

1. **Schema & auth foundation**: Define NextAuth-compatible user/account/session/token tables, password history, role enum, and NextAuth type augmentation.
2. **Provider and session configuration**: Add edge-safe OAuth config, Node-side credentials provider, Drizzle adapter, session callbacks, JWT database revalidation, and auth logging.
3. **Registration and verification**: Build registration validation, password hashing/history, duplicate checks, email verification token generation, queue publishing, and verification consumption.
4. **Password security flows**: Build forgot-password, reset-password, and change-password APIs/pages with generic recovery responses, rate limits, token consumption, and history enforcement.
5. **Authorization and abuse controls**: Add account lockout, sensitive endpoint rate limits, secure cookies/CSP, and ADMIN route/API gates.
6. **Validation**: Complete unit/route/component tests and run lint, typecheck, test, and production build validation.
