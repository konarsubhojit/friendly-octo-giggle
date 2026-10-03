import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'deploy/backup/octo-backup.sh')

describe('octo-backup configuration', () => {
  it('fails when BACKUP_ENV_FILE is unset', () => {
    const env: NodeJS.ProcessEnv = { ...process.env }
    delete env.BACKUP_ENV_FILE

    const result = spawnSync('bash', [scriptPath], { env, encoding: 'utf8' })

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('BACKUP_ENV_FILE must be set')
  })

  it('fails when BACKUP_PREFIX is unset', () => {
    const directory = mkdtempSync(join(tmpdir(), 'octo-backup-test-'))

    try {
      const envFile = join(directory, 'backup.env')
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        BACKUP_ENV_FILE: envFile,
      }
      delete env.BACKUP_PREFIX
      writeFileSync(envFile, '')

      const result = spawnSync('bash', [scriptPath], { env, encoding: 'utf8' })

      expect(result.error).toBeUndefined()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('BACKUP_PREFIX must be set')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
