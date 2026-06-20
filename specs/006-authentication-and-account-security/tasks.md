# Tasks: Authentication and Account Security

**Input**: Design documents from `/specs/006-authentication-and-account-security/`  
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Foundation (Schema + Auth Configuration)

- [ ] T001 Add NextAuth-compatible auth tables, user role enum, lock/session fields, and password history in `src/lib/schema.ts`.
- [ ] T002 Add NextAuth session/JWT type augmentation for user id, role, phone number, session version, and DB check timestamp in `src/types/next-auth.d.ts`.
- [ ] T003 Configure edge-safe Google and Microsoft Entra providers, session cookie settings, auth pages, and session callback in `src/lib/auth.config.ts`.
- [ ] T004 Compose Node-side NextAuth configuration with Drizzle adapter, credentials provider, JWT revalidation, and auth event logging in `src/lib/auth.ts`.

## Phase 2: User Story 1 (Secure Sign-In + Sessions) — P1

- [ ] T005 [US1] Implement credentials login validation in `src/features/auth/validations.ts`.
- [ ] T006 [US1] Implement email/phone credentials lookup, password verification, email-verified check, lockout check, and failed-login recording in `src/lib/auth.ts`.
- [ ] T007 [US1] Build sign-in page and credentials client form in `src/app/[locale]/(public)/auth/signin/`.
- [ ] T008 [US1] Add reusable login modal and OAuth buttons in `src/features/auth/components/`.
- [ ] T009 [US1] Expose NextAuth handlers through `src/app/api/auth/[...nextauth]/route.ts`.
- [ ] T010 [US1] Add/extend tests for auth callbacks, credentials errors, and sign-in UI behavior.

## Phase 3: User Story 2 (Registration + Email Verification) — P2

- [ ] T011 [US2] Add registration schema with name, email, optional phone, strong password, and confirmation validation in `src/features/auth/validations.ts`.
- [ ] T012 [US2] Implement bcrypt hashing and password history save helpers in `src/features/auth/services/password.ts`.
- [ ] T013 [US2] Implement email verification token generation, hashing, identifier parsing, and expiry helpers in `src/features/auth/services/email-verification.ts`.
- [ ] T014 [US2] Implement `POST /api/auth/register` with duplicate checks, user creation, history persistence, verification token storage, and QStash email job publishing.
- [ ] T015 [US2] Implement `POST /api/auth/verify-email` with hashed token lookup, expiry check, token consumption, and emailVerified update.
- [ ] T016 [US2] Build registration and verify-email pages in `src/app/[locale]/(public)/auth/`.
- [ ] T017 [US2] Add/extend tests for registration validation, duplicate handling, verification token consumption, and unverified login denial.

## Phase 4: User Story 3 (Password Recovery + Change) — P3

- [ ] T018 [US3] Add forgot-password, reset-password, and change-password schemas in `src/features/auth/validations.ts`.
- [ ] T019 [US3] Implement password reset token helpers and Redis-backed forgot/reset rate limit consumers in `src/features/auth/services/password-reset.ts`.
- [ ] T020 [US3] Implement `POST /api/auth/forgot-password` with normalized email lookup, generic response behavior, reset token storage, and QStash email job publishing.
- [ ] T021 [US3] Implement `POST /api/auth/reset-password` with rate limits, token consumption, history rejection, bcrypt hashing, and auth logging.
- [ ] T022 [US3] Implement `POST /api/auth/change-password` with session requirement, current-password verification, history rejection, and history save.
- [ ] T023 [US3] Build forgot-password and reset-password pages in `src/app/[locale]/(public)/auth/`.
- [ ] T024 [US3] Add/extend tests for generic forgot responses, reset token reuse/expiry, OAuth-only account handling, and last-two-password reuse rejection.

## Phase 5: User Story 4 (Roles + Abuse Protection) — P3

- [ ] T025 [US4] Implement failed-login user/IP rate limit helpers and account lock duration logic in `src/features/auth/services/login-protection.ts`.
- [ ] T026 [US4] Add sensitive auth endpoint rate limiting, secure CSP/cookie handling, and auth path exemptions in `proxy.ts`.
- [ ] T027 [US4] Add edge admin route/API token checks in `proxy.ts` for anonymous, CUSTOMER, and ADMIN outcomes.
- [ ] T028 [US4] Add server-side admin authorization helper in `src/features/admin/services/admin-auth.ts` and enforce role checks in admin layouts/routes.
- [ ] T029 [US4] Add protected-route/user-menu role-aware UI behavior in `src/components/ui/` and related layout components.
- [ ] T030 [US4] Add/extend tests for lockout threshold, proxy admin decisions, server admin auth helper, and role-aware rendering.

## Phase 6: Final Validation

- [ ] T031 Run `npm run lint` and fix auth-related lint issues.
- [ ] T032 Run `npx tsc --noEmit` and fix auth/session type issues.
- [ ] T033 Run `npm test` and fix auth service, route, and component regressions.
- [ ] T034 Run `npm run build` and verify Next.js route/auth configuration builds successfully.
- [ ] T035 Verify authentication pages and admin denial states with Playwright/accessibility checks.

## Dependencies & Execution Order

- **Foundation (Phase 1)** blocks all user stories because schema, session types, and provider configuration are shared.
- **US1 (Phase 2)** is the MVP and can be validated independently after Foundation.
- **US2 (Phase 3)** depends on password helpers from Foundation/US1 but is independently testable through registration and verification.
- **US3 (Phase 4)** depends on password history and token infrastructure from US2.
- **US4 (Phase 5)** depends on session role fields from US1 and hardens all shipped flows.
- **Final Validation (Phase 6)** depends on all selected user stories being complete.
