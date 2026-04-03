import bcrypt from 'bcryptjs'
import { primaryDrizzleDb } from '@/lib/db'
import { passwordHistory } from '@/lib/schema'
import { eq, desc, inArray } from 'drizzle-orm'

const SALT_ROUNDS = 12
const MAX_HISTORY_ENTRIES = 2

export const hashPassword = async (plainText: string): Promise<string> =>
  bcrypt.hash(plainText, SALT_ROUNDS)

export const verifyPassword = async (
  plainText: string,
  hash: string
): Promise<boolean> => bcrypt.compare(plainText, hash)

export const checkPasswordHistory = async (
  userId: string,
  newPlainText: string
): Promise<boolean> => {
  const recentEntries = await primaryDrizzleDb
    .select({ passwordHash: passwordHistory.passwordHash })
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))
    .limit(MAX_HISTORY_ENTRIES)

  for (const entry of recentEntries) {
    const matches = await bcrypt.compare(newPlainText, entry.passwordHash)
    if (matches) return true
  }

  return false
}

export const savePasswordToHistory = async (
  userId: string,
  hash: string
): Promise<void> => {
  await primaryDrizzleDb.insert(passwordHistory).values({
    userId,
    passwordHash: hash,
  })

  // Get all entries ordered by newest first, then delete any beyond the limit
  const allEntries = await primaryDrizzleDb
    .select({ id: passwordHistory.id })
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))

  const toDelete = allEntries.slice(MAX_HISTORY_ENTRIES)
  if (toDelete.length > 0) {
    await primaryDrizzleDb.delete(passwordHistory).where(
      inArray(
        passwordHistory.id,
        toDelete.map((entry) => entry.id)
      )
    )
  }
}
