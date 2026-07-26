import { drizzleDb } from '@/lib/db'
import { failedEmails } from '@/lib/schema'
import { inArray, count } from 'drizzle-orm'
import { AdminNavLinksClient } from './AdminNavLinksClient'
import { getRolePermissions, type UserRole } from '@/lib/constants/roles'

const fetchFailedEmailCount = async (): Promise<number> => {
  try {
    const rows = await drizzleDb
      .select({ value: count() })
      .from(failedEmails)
      .where(inArray(failedEmails.status, ['pending', 'failed']))
    return rows[0]?.value ?? 0
  } catch {
    return 0
  }
}

interface AdminNavLinksProps {
  readonly role: UserRole
}

export async function AdminNavLinks({ role }: AdminNavLinksProps) {
  const failedCount = await fetchFailedEmailCount()

  return (
    <AdminNavLinksClient
      failedEmailCount={failedCount}
      permissions={getRolePermissions(role)}
    />
  )
}
