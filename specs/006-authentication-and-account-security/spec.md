# Feature Specification: Authentication and Account Security

**Feature Branch**: `006-authentication-and-account-security`  
**Created**: 2026-06-09  
**Status**: Draft  
**Input**: User description: "Document the shipped authentication and account security feature"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sign In with Secure Sessions (Priority: P1)

A returning user can sign in using credentials, Google, or Microsoft, receive a short-lived authenticated session, and access protected storefront/account areas according to their role.

**Why this priority**: Authentication is the entry point for account, cart, orders, wishlist, checkout, and admin access. Without reliable sign-in and session propagation, no other account security capability is useful.

**Independent Test**: Sign in with a verified credentials account using email or phone, then sign in with Google and Microsoft test accounts. Verify the session contains user id, role, and phone number when available, and protected pages/API routes recognize the user.

**Acceptance Scenarios**:

1. **Given** a verified credentials user enters a valid email or phone number and password, **When** they submit the sign-in form, **Then** they are redirected to the callback URL with an authenticated session.
2. **Given** a user chooses Google or Microsoft sign-in, **When** the provider callback succeeds, **Then** the system creates or links the account through the auth adapter and establishes a session.
3. **Given** a session token is rechecked and the user is locked or the stored session version no longer matches, **When** authentication is evaluated, **Then** the session is rejected.

---

### User Story 2 - Register and Verify an Email Account (Priority: P2)

A new customer can create a credentials account with name, email, optional phone number, and a strong password, then verify email ownership before credentials sign-in is allowed.

**Why this priority**: Registration grows the customer base while email verification prevents unverified credentials accounts from being used for protected purchases and account actions.

**Independent Test**: Register a new account, verify duplicate email/phone rejection, inspect that a hashed verification token is stored, complete verification through the link, and then sign in successfully with credentials.

**Acceptance Scenarios**:

1. **Given** a visitor submits valid registration details and matching strong passwords, **When** the account is created, **Then** the user record, password hash, password history entry, and email verification token are persisted.
2. **Given** the visitor follows a valid unexpired verification link, **When** verification is submitted, **Then** the token is consumed and the account email is marked verified.
3. **Given** a credentials account is not email verified, **When** the user attempts credentials sign-in, **Then** sign-in is denied.

---

### User Story 3 - Recover and Change Passwords Safely (Priority: P3)

A credentials user can request a password reset email, set a new strong password with a valid reset token, and change their password from an authenticated session after confirming the current password.

**Why this priority**: Account recovery and password rotation reduce support burden and let users recover secure access without exposing account existence.

**Independent Test**: Request a reset for existing and non-existing emails and verify the same generic response. Reset with a valid token, attempt token reuse, and change password while signed in while confirming last-two-password reuse is rejected.

**Acceptance Scenarios**:

1. **Given** any email is submitted to forgot-password, **When** the request completes, **Then** the user receives the same generic success message regardless of account existence.
2. **Given** a credentials user has a valid unexpired reset token, **When** they submit a compliant new password, **Then** the token is consumed and the password hash/history are updated.
3. **Given** an authenticated credentials user enters the correct current password and a new password not in recent history, **When** they submit change-password, **Then** the password changes and the operation is logged.

---

### User Story 4 - Enforce Roles and Abuse Protection (Priority: P3)

The system protects administrative surfaces and sensitive authentication endpoints using role checks, account lockout, request rate limits, secure cookies, and audit-style auth logging.

**Why this priority**: Role enforcement and abuse controls reduce unauthorized access risk after the core authentication flows are available.

**Independent Test**: Attempt admin page and API access as anonymous, customer, and admin users. Trigger repeated failed credential attempts and verify account lockout; exercise sensitive auth endpoints until rate limiting responds.

**Acceptance Scenarios**:

1. **Given** an anonymous user opens an admin route, **When** authorization runs, **Then** they are redirected to sign-in or receive a 401 API response.
2. **Given** a non-admin authenticated user opens an admin route, **When** authorization runs, **Then** they are denied or receive a 403 API response.
3. **Given** repeated failed credential attempts occur for a user, **When** the configured threshold is reached, **Then** the account is temporarily locked and further credentials sign-in is rejected.

---

### Edge Cases

- OAuth-only users without a password hash cannot use credentials password change or password reset flows.
- Forgot-password must not reveal whether an email exists, is invalid, or belongs to an OAuth-only account.
- Verification and reset tokens must be single-use and rejected after expiration or identifier mismatch.
- Duplicate email or phone number registration/update attempts must fail without creating partial accounts.
- Rate limiting must still protect strict auth endpoints when Redis-backed limits are unavailable.
- Locked users or users with mismatched session versions must lose session validity on the next database revalidation interval.
- Admin UI and API routes must deny non-admin users even if they have a valid customer session.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST support credentials sign-in using either email address or phone number plus password.
- **FR-002**: System MUST support Google OAuth and Microsoft Entra ID OAuth providers.
- **FR-003**: System MUST store authenticated sessions as JWT-backed sessions with user id, role, and optional phone number available to server and client session consumers.
- **FR-004**: System MUST revalidate JWT sessions against current user lock and session-version state at a bounded interval.
- **FR-005**: System MUST require email verification before credentials users can sign in.
- **FR-006**: System MUST validate registration, login, profile, forgot-password, reset-password, and change-password inputs before processing.
- **FR-007**: System MUST hash credentials passwords with bcrypt and never store plaintext passwords.
- **FR-008**: System MUST keep password history for the last two password hashes and reject reuse during reset/change flows.
- **FR-009**: System MUST issue hashed, expiring, single-use tokens for email verification and password reset.
- **FR-010**: System MUST send email verification and password reset email jobs through the configured asynchronous email queue.
- **FR-011**: System MUST return a generic forgot-password success message for valid, invalid, unknown, and OAuth-only emails.
- **FR-012**: System MUST limit repeated failed credentials attempts by user/IP and temporarily lock accounts that reach the failed-attempt threshold.
- **FR-013**: System MUST rate-limit sensitive authentication endpoints, including register, change-password, and credentials callback paths.
- **FR-014**: System MUST protect admin pages and admin API routes so only ADMIN-role sessions can access them.
- **FR-015**: System MUST expose account profile data only to the authenticated user and indicate whether the account has a credentials password.
- **FR-016**: System MUST log key authentication events including register, login, logout, failed login, account lock, and password change outcomes.
- **FR-017**: System MUST use secure, HTTP-only session cookies with production-only secure cookie naming and transport settings.

### Key Entities

- **User**: Account owner with email, optional phone number, optional password hash, email verification timestamp, role, lock timestamp, session version, and preferences.
- **Account**: OAuth account linkage for external providers, keyed by provider and provider account id.
- **Session/JWT Token**: Authenticated session state carrying user identity, role, phone number, session version, and last database check timestamp.
- **VerificationToken**: Expiring hashed token record used for both email verification and password reset identifiers.
- **PasswordHistory**: Recent password-hash records per user used to prevent reuse of the last two passwords.
- **UserRole**: Authorization classification with CUSTOMER and ADMIN values used by route and UI gates.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Verified credentials users can sign in with email or phone number, while unverified or locked credentials users are denied.
- **SC-002**: Google and Microsoft sign-in complete successfully when provider credentials are configured.
- **SC-003**: Registration rejects invalid input and duplicate email/phone values while creating exactly one user for valid input.
- **SC-004**: Email verification and password reset links expire after the configured window and cannot be reused after a successful submission.
- **SC-005**: Password reset and change flows reject passwords matching either of the user's two most recent stored password hashes.
- **SC-006**: Forgot-password responses do not disclose whether an account exists or has a password.
- **SC-007**: Repeated failed credential attempts lock the affected account for the configured lock duration.
- **SC-008**: Anonymous and CUSTOMER-role users cannot access admin-only pages or APIs; ADMIN-role users can.
- **SC-009**: Auth sessions expose only expected identity/role fields and are invalidated when lock or session-version checks fail.
- **SC-010**: Existing auth-related unit, route, and component tests pass with lint/type/build validation.
