---
applyTo: "**/*"
---

# SonarQube for IDE - AI Instructions

Guidelines for using SonarQube IDE tools effectively.

## Available Tools

| Tool                                       | Purpose                                                |
| ------------------------------------------ | ------------------------------------------------------ |
| `sonarqube_analyze_file`                   | Analyze a single file for code quality/security issues |
| `sonarqube_list_potential_security_issues` | List Security Hotspots and Taint Vulnerabilities       |
| `sonarqube_exclude_from_analysis`          | Exclude files/folders via glob pattern                 |
| `sonarqube_setup_connected_mode`           | Connect IDE to SonarQube Server/Cloud                  |

## Mandatory Workflow

### After Code Generation/Modification

1. **Always analyze modified files** using `sonarqube_analyze_file` with the full file path
2. For security-sensitive code (auth, API, user input), also run `sonarqube_list_potential_security_issues`
3. Address any Critical/Blocker issues before completing the task

### File Analysis

```
# Single file
sonarqube_analyze_file(filePath: "/full/path/to/file.ts")

# Security check
sonarqube_list_potential_security_issues(filePath: "/full/path/to/file.ts")
```

### What to Analyze

- **Always analyze**: Files you created or modified
- **Prioritize security scans for**: Authentication, authorization, API routes, form handlers, file uploads, database queries
- **Skip**: Config files, markdown, JSON (unless they contain secrets)
- **Never analyze**: Jupyter notebooks with `sonarqube_analyze_file`

## Connected Mode Setup

When user wants to connect to SonarQube:

- **SonarQube Server**: Requires `serverUrl` (e.g., `https://sonarqube.company.com`)
- **SonarQube Cloud**: Requires `organizationKey` + set `isSonarQubeCloud: true`
- Both require `projectKey` for binding

## Exclusion Patterns

Use `sonarqube_exclude_from_analysis` for:

- Generated files: `**/generated/**`
- Test fixtures: `**/__fixtures__/**`
- Build outputs: `**/dist/**`, `**/.next/**`
- Dependencies: `**/node_modules/**`

## Issue Severity Priority

Handle issues in this order:

1. **BLOCKER** - Must fix immediately (security vulnerabilities, crashes)
2. **CRITICAL** - Fix before completing task (bugs, security risks)
3. **MAJOR** - Should fix (code smells, maintainability)
4. **MINOR/INFO** - Optional (style, minor improvements)

## Best Practices

- Use **absolute paths** for all file operations
- Run analysis **after** all edits are complete, not during
- For batch changes, analyze the most critical files first
- Issues appear in VS Code's **Problems** panel
- Security Hotspots require manual review (may be false positives)

## Troubleshooting

| Issue                | Solution                                      |
| -------------------- | --------------------------------------------- |
| "Not authorized"     | Use USER token, not project token             |
| No issues found      | Verify file path is correct and file exists   |
| Analysis slow        | Check file isn't excluded; consider file size |
| Connected Mode fails | Verify server URL accessible and token valid  |
