import { describe, expect, it } from 'vitest'

import {
  checkMarkdown,
  findMarkdownFiles,
  findScriptViolations,
  findWorkflowViolations,
  ignoredLines,
  IGNORE_MARKER,
  run,
} from '../../scripts/check-doc-drift.mjs'

const context = {
  definedScripts: ['dev', 'build', 'db:migrate', 'docs:check'],
  existingWorkflows: ['build.yml'],
}

describe('findScriptViolations', () => {
  it('accepts an npm script that exists in package.json', () => {
    expect(
      findScriptViolations(
        'Run `npm run db:migrate` first.',
        context.definedScripts
      )
    ).toEqual([])
  })

  it('reports an npm script that does not exist', () => {
    expect(
      findScriptViolations('Then `npm run db:seed`.', context.definedScripts)
    ).toEqual([{ line: 1, rule: 'script', target: 'npm run db:seed' }])
  })

  it('reports every occurrence on a line with its own line number', () => {
    const content = [
      '# Title',
      '',
      '`npm run db:seed` and `npm run dev:https`.',
    ].join('\n')

    expect(findScriptViolations(content, context.definedScripts)).toEqual([
      { line: 3, rule: 'script', target: 'npm run db:seed' },
      { line: 3, rule: 'script', target: 'npm run dev:https' },
    ])
  })
})

describe('findWorkflowViolations', () => {
  it('accepts a workflow file that exists on disk', () => {
    expect(
      findWorkflowViolations(
        'See `.github/workflows/build.yml`.',
        context.existingWorkflows
      )
    ).toEqual([])
  })

  it('reports a workflow file that does not exist', () => {
    expect(
      findWorkflowViolations(
        'See `.github/workflows/synthetic-uptests.yml`.',
        context.existingWorkflows
      )
    ).toEqual([
      {
        line: 1,
        rule: 'workflow',
        target: '.github/workflows/synthetic-uptests.yml',
      },
    ])
  })
})

describe('ignore markers', () => {
  it('exempts a fenced block that follows the marker', () => {
    const content = [
      IGNORE_MARKER,
      '',
      '```bash',
      'npm run db:seed',
      '```',
    ].join('\n')

    expect(checkMarkdown(content, context)).toEqual([])
  })

  it('exempts an unfenced paragraph that follows the marker', () => {
    const content = [
      IGNORE_MARKER,
      'The removed `npm run db:seed` command.',
    ].join('\n')

    expect(checkMarkdown(content, context)).toEqual([])
  })

  it('honours a marker that carries a trailing justification comment', () => {
    const content = [
      `${IGNORE_MARKER} <!-- Inventory of removed commands. -->`,
      '',
      'The removed `npm run db:seed` command.',
    ].join('\n')

    expect(checkMarkdown(content, context)).toEqual([])
  })

  it('does not leak the exemption into the next block', () => {
    const content = [
      IGNORE_MARKER,
      '',
      '```bash',
      'npm run db:seed',
      '```',
      '',
      'But `npm run dev:https` here is still checked.',
    ].join('\n')

    expect(checkMarkdown(content, context)).toEqual([
      { line: 7, rule: 'script', target: 'npm run dev:https' },
    ])
  })

  it('marks only the exempted line range', () => {
    const content = [
      IGNORE_MARKER,
      '',
      '```bash',
      'npm run db:seed',
      '```',
    ].join('\n')

    expect(
      [...ignoredLines(content.split('\n'))].sort((a, b) => a - b)
    ).toEqual([3, 4, 5])
  })
})

describe('checkMarkdown', () => {
  it('returns both rules ordered by line number', () => {
    const content = [
      'See `.github/workflows/missing.yml`.',
      '',
      'Run `npm run db:seed`.',
    ].join('\n')

    expect(checkMarkdown(content, context)).toEqual([
      { line: 1, rule: 'workflow', target: '.github/workflows/missing.yml' },
      { line: 3, rule: 'script', target: 'npm run db:seed' },
    ])
  })
})

describe('findMarkdownFiles', () => {
  it('excludes generated and vendored trees', () => {
    const files = findMarkdownFiles(process.cwd())

    expect(files.length).toBeGreaterThan(0)
    expect(files.every((file: string) => file.endsWith('.md'))).toBe(true)
    expect(
      files.some((file: string) => file.includes(`${'node_modules'}/`))
    ).toBe(false)
  })
})

describe('run', () => {
  it('reports no drift for the repository itself', () => {
    const { fileCount, failures } = run(process.cwd())

    expect(fileCount).toBeGreaterThan(0)
    expect(failures).toEqual([])
  })
})
