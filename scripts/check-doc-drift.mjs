/* eslint-disable no-console */

/**
 * Documentation drift check.
 *
 * Two rules, no dependencies, no configuration file:
 *
 *   1. script   — every `npm run <name>` in Markdown must name a key in
 *                 `package.json` `scripts`.
 *   2. workflow — every `.github/workflows/<name>.yml` reference must resolve
 *                 to a file on disk.
 *
 * A `<!-- doc-drift-ignore-next-block -->` comment exempts the block that
 * immediately follows it, for illustrative or third-party commands. Nothing
 * else is exempt. A marker line may carry a trailing HTML comment, and every
 * use must, so that the reason for the exemption is recorded beside it.
 *
 * Deliberately not implemented: general source-path validation. Historical
 * specifications correctly describe past layouts and must stay readable as
 * history, so path checking is done by hand for the two operating contracts
 * (the constitution and `.github/copilot-instructions.md`) instead.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const IGNORE_MARKER = '<!-- doc-drift-ignore-next-block -->'

const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
])

const NPM_RUN_PATTERN = /npm run ([A-Za-z0-9][A-Za-z0-9:_-]*)/g
const WORKFLOW_PATTERN = /\.github\/workflows\/([A-Za-z0-9._-]+\.ya?ml)/g

/**
 * Line numbers (1-based) covered by an ignore marker.
 *
 * A marker exempts the block that follows it. A block is the next contiguous
 * run of non-blank lines; if that run opens a fenced code block, the exemption
 * extends through the closing fence. This covers both fenced examples and
 * prose or table rows that must name something that does not exist — such as
 * this feature's own specification, which has to name the drift it removed.
 */
export function ignoredLines(lines) {
  const ignored = new Set()

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith(IGNORE_MARKER)) continue

    let cursor = index + 1
    while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1
    if (cursor >= lines.length) break

    const fence = /^\s*(```|~~~)/.exec(lines[cursor])
    if (fence) {
      const closing = fence[1]
      ignored.add(cursor + 1)
      cursor += 1
      while (cursor < lines.length) {
        ignored.add(cursor + 1)
        if (lines[cursor].trim().startsWith(closing)) break
        cursor += 1
      }
      continue
    }

    while (cursor < lines.length && lines[cursor].trim() !== '') {
      ignored.add(cursor + 1)
      cursor += 1
    }
  }

  return ignored
}

function collect(pattern, lines, ignored, buildViolation) {
  const violations = []

  lines.forEach((line, offset) => {
    const lineNumber = offset + 1
    if (ignored.has(lineNumber)) return

    pattern.lastIndex = 0
    let match = pattern.exec(line)
    while (match !== null) {
      const violation = buildViolation(match[1], lineNumber)
      if (violation) violations.push(violation)
      match = pattern.exec(line)
    }
  })

  return violations
}

/** Violations of rule 1 for a single Markdown document. */
export function findScriptViolations(content, definedScripts) {
  const lines = content.split('\n')
  const ignored = ignoredLines(lines)
  const defined = new Set(definedScripts)

  return collect(NPM_RUN_PATTERN, lines, ignored, (name, line) =>
    defined.has(name)
      ? null
      : { line, rule: 'script', target: `npm run ${name}` }
  )
}

/** Violations of rule 2 for a single Markdown document. */
export function findWorkflowViolations(content, existingWorkflows) {
  const lines = content.split('\n')
  const ignored = ignoredLines(lines)
  const existing = new Set(existingWorkflows)

  return collect(WORKFLOW_PATTERN, lines, ignored, (name, line) =>
    existing.has(name)
      ? null
      : { line, rule: 'workflow', target: `.github/workflows/${name}` }
  )
}

/** Both rules, ordered by line number. */
export function checkMarkdown(content, { definedScripts, existingWorkflows }) {
  return [
    ...findScriptViolations(content, definedScripts),
    ...findWorkflowViolations(content, existingWorkflows),
  ].sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule))
}

/** Every Markdown file under `root`, excluding generated and vendored trees. */
export function findMarkdownFiles(root) {
  const found = []

  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRECTORIES.has(entry.name)) continue
        walk(path.join(directory, entry.name))
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        found.push(path.join(directory, entry.name))
      }
    }
  }

  walk(root)
  return found.sort()
}

function readDefinedScripts(root) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8')
  )
  return Object.keys(manifest.scripts ?? {})
}

function readExistingWorkflows(root) {
  const directory = path.join(root, '.github', 'workflows')
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))
}

export function run(root) {
  const context = {
    definedScripts: readDefinedScripts(root),
    existingWorkflows: readExistingWorkflows(root),
  }

  const files = findMarkdownFiles(root)
  const failures = []

  for (const file of files) {
    const relative = path.relative(root, file)
    const content = fs.readFileSync(file, 'utf8')
    for (const violation of checkMarkdown(content, context)) {
      failures.push(
        `${relative}:${violation.line}: ${violation.rule} — ${violation.target}`
      )
    }
  }

  return { fileCount: files.length, failures }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]).endsWith('check-doc-drift.mjs')

if (invokedDirectly) {
  const root = process.cwd()
  const { fileCount, failures } = run(root)

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure)
    console.error(
      `\n${failures.length} documentation drift violation(s) across ${fileCount} Markdown file(s).`
    )
    console.error(
      'Every `npm run <script>` must exist in package.json, and every ' +
        '.github/workflows/<name>.yml must exist on disk.'
    )
    process.exitCode = 1
  } else {
    console.log(
      `Documentation drift check passed: ${fileCount} Markdown file(s) scanned.`
    )
  }
}
