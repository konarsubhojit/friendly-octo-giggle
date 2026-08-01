---
name: branch-diff-remediate
description: 'Consume a branch-diff-review report and fix every blocking finding (BLOCKER, CRITICAL, MAJOR) with surgical, minimal edits, then re-verify. Use after a review reports BLOCKED, or when asked to "fix the review findings", "fix the issues found", "remediate the report", "apply the review fixes", "fix B1/C2/M3", or "make the review pass".'
argument-hint: '[optional: specific finding IDs, e.g. B1 C2 M3]'
---

# Branch Diff Remediate

Turns a severity-classified review report into precise code changes. This skill fixes findings; it does not re-review. Correctness of the fix is verified by gates, not by re-reading the diff.

## When to Use

- Immediately after [`branch-diff-review`](../branch-diff-review/SKILL.md) emits a `BLOCKED` verdict
- When the user names specific finding IDs to fix
- When a review report exists but the fixes were never applied

## Prerequisites

Load the report, in this order of preference:

1. `.github/skills/branch-diff-review/.last-review.md`
2. The report text present in the conversation
3. If neither exists, run `branch-diff-review` first — do not guess at findings

Extract into a work queue: finding ID, severity, file path, line range, defect, prescribed fix. If arguments name specific IDs, restrict the queue to those IDs only.

## Ordering Rules

Fix in this order. Order matters because later fixes often depend on earlier ones and because failing gates mask other failures.

1. **BLOCKER** — build/test breakage, secrets, security, destructive migrations
2. **CRITICAL** — functional bugs, authz gaps, race conditions, breaking API changes
3. **MAJOR** — validation gaps, missing tests, complexity, missing error handling
4. **MINOR** — only if explicitly requested or trivially bundled into a fix already being made

Within a severity, fix in dependency order: schema/migration → server/lib → API routes → components → tests. Never write tests for behavior you are about to change.

## Precision Rules

These constrain _how_ the fix is applied. Violating them is what turns a remediation into a regression.

- **Fix the finding, nothing else.** Do not refactor adjacent code, rename symbols, reformat, or "improve" anything the report did not flag. Unrelated churn hides the real fix from the reviewer.
- **Apply the prescribed fix.** If the report's `Fix` is correct, implement it verbatim. Deviate only when it is wrong or incomplete — and when you deviate, state why in the log.
- **Root cause, not symptom.** Silencing a lint rule, casting to `any`, adding `eslint-disable`, loosening a Zod schema, deleting a failing assertion, or widening a type to make an error disappear are all forbidden. If a test now fails, decide whether the test or the code is wrong and fix that.
- **Smallest correct change.** Prefer an in-place edit over extraction; extract only when the report cites cognitive complexity or duplication.
- **Preserve behavior not under review.** Every existing public signature, response shape, and prop contract stays intact unless the finding is specifically about it.
- **Follow the checklist, not just the finding.** Consult [the review checklist](../branch-diff-review/references/review-checklist.md) for the repo-specific correct form (Zod at boundaries, `primaryDrizzleDb` for read-after-write, transaction row locks, `formatPrice()`, `lib/api-client.ts`, `handleApiError`, `lib/logger.ts`, stable React keys).
- **One finding, one coherent edit set.** Do not interleave edits for multiple findings in the same pass; it makes the failure attribution ambiguous when a gate breaks.

## Fix Patterns by Category

| Finding type                     | Correct remediation                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Missing input validation         | Add a Zod schema in `lib/validations.ts`; `safeParse` at the route boundary; return `handleValidationError`      |
| Missing authz                    | `auth()` for identity → 401; role/ownership check → 403. Never merge the two                                     |
| Race condition on a limit        | Move the count check inside the transaction; add `SELECT … FOR UPDATE` on the parent row                         |
| Stale read after write           | Swap the import to `primaryDrizzleDb as drizzleDb`                                                               |
| Missing cache invalidation       | Call `revalidateTag('<tag>')` — single string argument — on every write path                                     |
| Secret in source                 | Replace with `process.env.X`; add to `.env.example`; purge from history if committed                             |
| Missing test for a new branch    | Add a test that asserts the observable outcome of that branch, not that a mock was called                        |
| Cognitive complexity > 15        | Extract named predicate helpers and return early; do not just split arbitrarily                                  |
| Unstable React key               | Replace index with a stable identifier; if none exists, derive a composite key                                   |
| Hook dependency instability      | Hoist the literal, memoize the value, or serialize it into stable state                                          |
| Unhandled error path             | Add explicit handling with a user-facing message from `lib/constants/error-messages.ts`; log via `lib/logger.ts` |
| Layout-shifting image            | Add `width`/`height`; `priority` if above fold; remove `loading="lazy"`                                          |
| Non-semantic interactive element | Replace with `<button>`/`<a>`; drop the ARIA role that was compensating                                          |

## Procedure

For each finding in queue order:

1. Read the target file around the cited range, plus its direct callers if the fix changes a signature.
2. Apply the edit.
3. Log one line: `<ID> — <file> — <what changed> — <deviation from prescribed fix, if any>`.
4. Move to the next finding.

After the full queue is applied — not between findings — run the gates:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Then re-run `sonarqube_analyze_file` on every file touched during remediation, and `sonarqube_list_potential_security_issues` on any auth/API/upload/DB file touched.

## Gate Failure Handling

- A gate failure caused by a remediation is a **new BLOCKER**. Fix it before continuing.
- If a fix cannot be made without breaking a gate, revert that single fix, keep the rest, and escalate that finding with the specific conflict.
- Never suppress a gate to make it pass. No `--no-verify`, no skipped tests, no disabled rules.
- If more than two attempts fail on the same finding, stop iterating and escalate it with the attempts documented.

## Output

Emit a remediation log:

| ID  | Severity | File                 | Fix applied  | Status                       |
| --- | -------- | -------------------- | ------------ | ---------------------------- |
| B1  | BLOCKER  | [path](path#L10-L20) | `<one line>` | fixed / deferred / escalated |

Then the gate results table, then a closing line:

- `REMEDIATION COMPLETE` — every queued finding fixed, all gates green
- `REMEDIATION PARTIAL` — list the IDs that remain and why

## Handoff

Re-run [`branch-diff-review`](../branch-diff-review/SKILL.md) after `REMEDIATION COMPLETE`. The remediation itself introduces new diff lines that have not been reviewed. Only a fresh `READY TO COMMIT` verdict authorizes the final commit.

## Completion Criteria

- [ ] Report loaded and work queue built with explicit finding IDs
- [ ] Every BLOCKER, CRITICAL, and MAJOR in the queue addressed
- [ ] No suppressions, no widened types, no deleted assertions used as fixes
- [ ] No unrelated changes introduced
- [ ] `lint`, `tsc --noEmit`, `test`, `build` all green
- [ ] SonarQube re-run on all touched files
- [ ] Remediation log emitted
- [ ] `branch-diff-review` re-run and verdict confirmed
