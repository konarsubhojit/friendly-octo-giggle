import { and, asc, eq } from 'drizzle-orm'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import { addresses } from '@/lib/schema'
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from '@/features/account/validations'

export interface SavedAddress {
  id: string
  label: string
  addressLine1: string
  addressLine2: string
  addressLine3: string
  pinCode: string
  city: string
  state: string
  isDefault: boolean
}

const toSavedAddress = (
  row: typeof addresses.$inferSelect
): SavedAddress => ({
  id: row.id,
  label: row.label,
  addressLine1: row.addressLine1,
  addressLine2: row.addressLine2 ?? '',
  addressLine3: row.addressLine3 ?? '',
  pinCode: row.pinCode,
  city: row.city,
  state: row.state,
  isDefault: row.isDefault,
})

const clearDefaultAddress = async (userId: string) => {
  await primaryDrizzleDb
    .update(addresses)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)))
}

export const listUserAddresses = async (userId: string): Promise<SavedAddress[]> =>
  drizzleDb.query.addresses
    .findMany({
      where: eq(addresses.userId, userId),
      orderBy: [asc(addresses.isDefault), asc(addresses.createdAt)],
    })
    .then((rows) =>
      rows
        .map(toSavedAddress)
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    )

export const createUserAddress = async (
  userId: string,
  input: CreateAddressInput
): Promise<SavedAddress> => {
  if (input.isDefault) {
    await clearDefaultAddress(userId)
  }

  const [created] = await primaryDrizzleDb
    .insert(addresses)
    .values({
      userId,
      label: input.label.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2.trim() || null,
      addressLine3: input.addressLine3.trim() || null,
      pinCode: input.pinCode.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      isDefault: input.isDefault,
      updatedAt: new Date(),
    })
    .returning()

  return toSavedAddress(created)
}

export const updateUserAddress = async ({
  userId,
  addressId,
  input,
}: {
  userId: string
  addressId: string
  input: UpdateAddressInput
}): Promise<SavedAddress | null> => {
  const existing = await drizzleDb.query.addresses.findFirst({
    where: and(eq(addresses.id, addressId), eq(addresses.userId, userId)),
  })

  if (!existing) {
    return null
  }

  if (input.isDefault) {
    await clearDefaultAddress(userId)
  }

  const [updated] = await primaryDrizzleDb
    .update(addresses)
    .set({
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.addressLine1 !== undefined
        ? { addressLine1: input.addressLine1.trim() }
        : {}),
      ...(input.addressLine2 !== undefined
        ? { addressLine2: input.addressLine2.trim() || null }
        : {}),
      ...(input.addressLine3 !== undefined
        ? { addressLine3: input.addressLine3.trim() || null }
        : {}),
      ...(input.pinCode !== undefined ? { pinCode: input.pinCode.trim() } : {}),
      ...(input.city !== undefined ? { city: input.city.trim() } : {}),
      ...(input.state !== undefined ? { state: input.state.trim() } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
    .returning()

  return updated ? toSavedAddress(updated) : null
}

export const deleteUserAddress = async ({
  userId,
  addressId,
}: {
  userId: string
  addressId: string
}): Promise<boolean> => {
  const deleted = await primaryDrizzleDb
    .delete(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
    .returning({ id: addresses.id })

  return deleted.length > 0
}
