import bcrypt from "bcryptjs";
import { drizzleDb } from "@/lib/db";
import { passwordHistory } from "@/lib/schema";
import { eq, desc, inArray } from "drizzle-orm";

const SALT_ROUNDS = 12;
const MAX_HISTORY_ENTRIES = 2;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(
  plainText: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Check if a new password matches any of the user's last 2 passwords.
 * Returns true if the password was recently used (i.e., should be rejected).
 */
export async function checkPasswordHistory(
  userId: string,
  newPlainText: string,
): Promise<boolean> {
  const recentEntries = await drizzleDb
    .select({ passwordHash: passwordHistory.passwordHash })
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt))
    .limit(MAX_HISTORY_ENTRIES);

  for (const entry of recentEntries) {
    const matches = await bcrypt.compare(newPlainText, entry.passwordHash);
    if (matches) return true;
  }

  return false;
}

/**
 * Save a password hash to the history table and prune old entries beyond the limit of 2.
 */
export async function savePasswordToHistory(
  userId: string,
  hash: string,
): Promise<void> {
  await drizzleDb.insert(passwordHistory).values({
    userId,
    passwordHash: hash,
  });

  // Get all entries ordered by newest first, then delete any beyond the limit
  const allEntries = await drizzleDb
    .select({ id: passwordHistory.id })
    .from(passwordHistory)
    .where(eq(passwordHistory.userId, userId))
    .orderBy(desc(passwordHistory.createdAt));

  const toDelete = allEntries.slice(MAX_HISTORY_ENTRIES);
  if (toDelete.length > 0) {
    await drizzleDb
      .delete(passwordHistory)
      .where(
        inArray(
          passwordHistory.id,
          toDelete.map((entry) => entry.id),
        ),
      );
  }
}
