---
name: branch-diff-review
description: 'Self-review all changes on the current branch (committed + uncommitted) against the base branch (default: develop), classify every finding by severity (BLOCKER/CRITICAL/MAJOR/MINOR/INFO), and produce a comprehensive issue report explaining why each finding is a problem. Use before the final commit, before opening or updating a PR, when asked to "review my changes", "review this branch", "review the diff", "pre-PR review", "self code review", "what did I break", or "find issues in my changes".'
argument-hint: '[base branch, defaults to develop]'
---

# Branch Diff Review

Systematic self-review of everything this branch changes relative to its base branch. Produces a severity-classified issue report, not a summary of the work.

## When to Use

- Immediately before the final commit of a task
- Before opening or updating a pull request
- After a large refactor, to catch regressions the tests do not cover
- When the user asks to review changes, the branch, the diff, or uncommitted work

## Scope Rules

Review **only** lines that this branch adds or modifies relative to the base branch, plus code those lines directly affect (callers, tests, types, migrations). Do not report pre-existing issues in untouched code — note them separately as `INFO / pre-existing` at most.

Include **both** committed changes and uncommitted working-tree changes. Uncommitted changes are the most common source of missed issues.

## Procedure

### 1. Establish the diff

```bash
BASE=${1:-develop}
git fetch origin "$BASE" --quiet
git --no-pager diff --stat "origin/$BASE"...HEAD          # committed changes
git --no-pager status --porcelain                          # uncommitted changes
git --no-pager diff "origin/$BASE"...HEAD                  # committed content
git --no-pager diff HEAD                                   # unstaged content
git --no-pager diff --cached                               # staged content
```

If `origin/$BASE` does not exist, fall back to the local `$BASE` ref. If the branch **is** the base branch, review only uncommitted changes.

Build an explicit file inventory before reading anything: added, modified, deleted, renamed. Read every changed file in full (not just the hunks) when the file is under ~400 lines; for larger files read the hunks plus their enclosing function/class.

### 2. Run the objective gates

Run these first — machine-verifiable failures are always BLOCKER or CRITICAL and must not be missed by manual reading:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

`npm run build` is mandatory. Next.js route-type errors and ISR/manifest failures only surface in `next build`, never in `tsc --noEmit`.

Then run SonarQube analysis on each changed source file:

- `sonarqube_analyze_file` for every added/modified file under `src/`, `__tests__/`, `scripts/`
- `sonarqube_list_potential_security_issues` for any file touching auth, API routes, form handlers, uploads, or DB queries

Map SonarQube severities directly onto the report severities below.

### 3. Manual review passes

Run each pass over the diff. Consult [the review checklist](./references/review-checklist.md) for the full item-by-item list.

| Pass          | Focus                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Correctness   | Logic errors, off-by-one, wrong operators, unhandled branches, dead code |
| Security      | Input validation, authz checks, secrets, injection, SSRF, data exposure  |
| Data & DB     | Migration safety, transactions, race conditions, index coverage, N+1     |
| API contract  | Status codes, response shape, breaking changes, cache headers            |
| React & state | Server/Client boundaries, hooks deps, keys, re-render cost, hydration    |
| Performance   | Core Web Vitals regressions, bundle growth, blocking work                |
| Accessibility | Roles, labels, keyboard paths, focus management                          |
| Tests         | Missing coverage for new branches, assertion quality, flakiness          |
| Consistency   | Repo conventions, naming, error handling, logging, i18n/currency         |
| Cleanup       | Debug logs, TODOs, commented code, temp mocks, unused exports            |

Also check the repo memory files at `/memories/repo/pr-review-lessons.md` and `/memories/repo/project-standards.md` and verify none of the previously-learned mistakes have reappeared.

### 4. Classify every finding

| Severity     | Definition                                                                                                                                                                     | Action                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **BLOCKER**  | Breaks the build/tests, data loss, security vulnerability, secret leak, destructive migration                                                                                  | Blocks commit. Non-negotiable.                                                                                       |
| **CRITICAL** | Functional bug on a real user path, missing authz, race condition, Core Web Vital pushed past "poor", breaking API change                                                      | Blocks commit.                                                                                                       |
| **MAJOR**    | Maintainability or correctness risk that will bite later: missing validation, missing test for new branch, cognitive complexity > 15, duplicated logic, missing error handling | **Blocks commit.** May only be deferred if the user explicitly approves the deferral and a tracked issue is created. |
| **MINOR**    | Style, naming, redundant code, small inefficiency, non-blocking a11y nit                                                                                                       | Non-blocking. Fix if cheap; otherwise note.                                                                          |
| **INFO**     | Observation, pre-existing issue, follow-up suggestion                                                                                                                          | Record only.                                                                                                         |

Rules:

- Every finding gets exactly one severity. No "CRITICAL/MAJOR".
- Any failing gate from step 2 is at minimum CRITICAL.
- A missing test for newly added conditional logic is MAJOR, and therefore blocking.
- Security findings never go below CRITICAL unless proven unreachable — and then state the proof.
- SonarQube severities map straight through: its MAJOR is a blocking MAJOR here.

### 5. Emit the report

Use [the report template](./assets/report-template.md). Every finding must include:

1. Severity tag
2. File link with line range
3. **What** — the concrete defect, quoted from the diff
4. **Why it is an issue** — the actual consequence (which user, which request, which failure mode). "Bad practice" is not a reason.
5. **Fix** — the specific change, with a code snippet when non-obvious

Group by severity, BLOCKER first. Assign every finding a stable ID (`B1`, `C1`, `M1`, `N1`, `I1`) — the remediation skill consumes these IDs. Close with a verdict line:

- `READY TO COMMIT` — zero BLOCKER, zero CRITICAL, zero MAJOR
- `BLOCKED` — one or more BLOCKER/CRITICAL/MAJOR findings, listed by ID

Write the finished report to `.github/skills/branch-diff-review/.last-review.md` (gitignored scratch) so the remediation skill can read it without re-deriving the diff.

### 6. Hand off to remediation

If the verdict is `BLOCKED`, invoke the [`branch-diff-remediate`](../branch-diff-remediate/SKILL.md) skill to fix the findings, then re-run this skill from step 1 to confirm the verdict flips to `READY TO COMMIT`. Only then proceed to the final commit.

## Completion Criteria

- [ ] Full file inventory of the branch diff enumerated
- [ ] `lint`, `tsc --noEmit`, `test`, `build` all executed and results recorded
- [ ] SonarQube analysis run on every changed source file
- [ ] All ten manual review passes performed
- [ ] Every finding severity-classified with a concrete "why" and a stable ID
- [ ] Report written to `.last-review.md`
- [ ] All BLOCKER, CRITICAL, and MAJOR findings fixed and re-verified
- [ ] Verdict line emitted
