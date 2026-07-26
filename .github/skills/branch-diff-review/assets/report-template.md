# Branch Diff Review — `<branch>` vs `<base>`

## Scope

- Commits reviewed: `<n>` (`<base>...HEAD`)
- Files changed: `<n>` added, `<n>` modified, `<n>` deleted
- Uncommitted changes included: yes / no

## Gate Results

| Gate               | Result       | Notes                                                   |
| ------------------ | ------------ | ------------------------------------------------------- |
| `npm run lint`     | PASS / FAIL  |                                                         |
| `npx tsc --noEmit` | PASS / FAIL  |                                                         |
| `npm test`         | PASS / FAIL  | `<n>` passed, `<n>` failed                              |
| `npm run build`    | PASS / FAIL  |                                                         |
| SonarQube          | `<n>` issues | `<n>` blocker, `<n>` critical, `<n>` major, `<n>` minor |

## Findings

### BLOCKER

#### B1 — `<short title>`

- **Where**: [path/to/file.ts](path/to/file.ts#L42-L58)
- **What**: `<the concrete defect, quoting the changed lines>`
- **Why it is an issue**: `<the real consequence — which user, which request, which failure mode, what data is at risk>`
- **Fix**:

```ts
// corrected code
```

### CRITICAL

#### C1 — `<short title>`

- **Where**:
- **What**:
- **Why it is an issue**:
- **Fix**:

### MAJOR

#### M1 — `<short title>`

- **Where**:
- **What**:
- **Why it is an issue**:
- **Fix**:

### MINOR

#### N1 — `<short title>`

- **Where**:
- **What**:
- **Why it is an issue**:
- **Fix**:

### INFO

#### I1 — `<short title>`

- **Where**:
- **Observation**:

## Summary

| Severity | Count | Blocking |
| -------- | ----- | -------- |
| BLOCKER  |       | yes      |
| CRITICAL |       | yes      |
| MAJOR    |       | yes      |
| MINOR    |       | no       |
| INFO     |       | no       |

## Verdict

`READY TO COMMIT` — zero BLOCKER, zero CRITICAL, zero MAJOR.

or

`BLOCKED` — must fix: B1, C1, M1, M2 before commit. Hand off to `branch-diff-remediate`.
