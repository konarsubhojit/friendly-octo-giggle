import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDrizzleDbQuery = vi.hoisted(() => ({
  addresses: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}))
const mockPrimaryUpdate = vi.hoisted(() => vi.fn())
const mockPrimaryInsert = vi.hoisted(() => vi.fn())
const mockPrimaryDelete = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  drizzleDb: { query: mockDrizzleDbQuery },
  primaryDrizzleDb: {
    update: mockPrimaryUpdate,
    insert: mockPrimaryInsert,
    delete: mockPrimaryDelete,
  },
}))
vi.mock('@/lib/schema', () => ({
  addresses: { __table: 'addresses', id: 'id', userId: 'userId' },
}))
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ __and: args }),
  asc: (col: unknown) => ({ __asc: col }),
  desc: (col: unknown) => ({ __desc: col }),
  eq: (col: unknown, val: unknown) => ({ __eq: [col, val] }),
}))

import {
  listUserAddresses,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
} from '@/features/account/services/address-service'

const baseRow = {
  id: 'addr-1',
  userId: 'user-1',
  label: 'Home',
  addressLine1: '42 MG Road',
  addressLine2: null,
  addressLine3: null,
  pinCode: '560001',
  city: 'Bengaluru',
  state: 'Karnataka',
  isDefault: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listUserAddresses', () => {
  it('returns mapped addresses', async () => {
    mockDrizzleDbQuery.addresses.findMany.mockResolvedValue([
      { ...baseRow, addressLine2: 'Floor 2', addressLine3: null },
    ])

    const result = await listUserAddresses('user-1')

    expect(result).toEqual([
      {
        id: 'addr-1',
        label: 'Home',
        addressLine1: '42 MG Road',
        addressLine2: 'Floor 2',
        addressLine3: '', // null normalized to ''
        pinCode: '560001',
        city: 'Bengaluru',
        state: 'Karnataka',
        isDefault: false,
      },
    ])
    expect(mockDrizzleDbQuery.addresses.findMany).toHaveBeenCalledTimes(1)
  })
})

describe('createUserAddress', () => {
  it('clears existing defaults when isDefault is true and trims inputs', async () => {
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
    mockPrimaryUpdate.mockReturnValue({ set: setMock })
    const returningMock = vi
      .fn()
      .mockResolvedValue([{ ...baseRow, isDefault: true }])
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
    mockPrimaryInsert.mockReturnValue({ values: valuesMock })

    const result = await createUserAddress('user-1', {
      label: '  Home  ',
      addressLine1: '  42 MG Road  ',
      addressLine2: '  ',
      addressLine3: '  Apt 1 ',
      pinCode: ' 560001 ',
      city: ' Bengaluru ',
      state: ' Karnataka ',
      isDefault: true,
    })

    expect(mockPrimaryUpdate).toHaveBeenCalledTimes(1)
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        label: 'Home',
        addressLine1: '42 MG Road',
        addressLine2: null, // whitespace -> null
        addressLine3: 'Apt 1',
        pinCode: '560001',
        city: 'Bengaluru',
        state: 'Karnataka',
        isDefault: true,
      })
    )
    expect(result.isDefault).toBe(true)
  })

  it('does not clear defaults when isDefault is false', async () => {
    const returningMock = vi.fn().mockResolvedValue([baseRow])
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock })
    mockPrimaryInsert.mockReturnValue({ values: valuesMock })

    await createUserAddress('user-1', {
      label: 'Home',
      addressLine1: '42 MG Road',
      addressLine2: undefined,
      addressLine3: undefined,
      pinCode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
      isDefault: false,
    })

    expect(mockPrimaryUpdate).not.toHaveBeenCalled()
  })
})

describe('updateUserAddress', () => {
  it('returns null when the address does not exist', async () => {
    mockDrizzleDbQuery.addresses.findFirst.mockResolvedValue(undefined)
    const result = await updateUserAddress({
      userId: 'user-1',
      addressId: 'missing',
      input: { label: 'X' },
    })
    expect(result).toBeNull()
    expect(mockPrimaryUpdate).not.toHaveBeenCalled()
  })

  it('only patches provided fields and clears defaults when promoting', async () => {
    mockDrizzleDbQuery.addresses.findFirst.mockResolvedValue(baseRow)

    // clearDefaultAddress chain
    const clearWhereMock = vi.fn().mockResolvedValue(undefined)
    const clearSetMock = vi.fn().mockReturnValue({ where: clearWhereMock })
    // patch chain
    const patchReturningMock = vi
      .fn()
      .mockResolvedValue([{ ...baseRow, label: 'Office', isDefault: true }])
    const patchWhereMock = vi
      .fn()
      .mockReturnValue({ returning: patchReturningMock })
    const patchSetMock = vi.fn().mockReturnValue({ where: patchWhereMock })

    mockPrimaryUpdate
      .mockReturnValueOnce({ set: clearSetMock }) // clearDefaultAddress
      .mockReturnValueOnce({ set: patchSetMock }) // the actual patch

    const result = await updateUserAddress({
      userId: 'user-1',
      addressId: 'addr-1',
      input: { label: '  Office  ', isDefault: true },
    })

    expect(clearSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: false })
    )
    expect(patchSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Office',
        isDefault: true,
      })
    )
    // Only provided fields should appear (besides updatedAt)
    const patchArgs = patchSetMock.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(patchArgs).sort()).toEqual(
      ['isDefault', 'label', 'updatedAt'].sort()
    )
    expect(result?.label).toBe('Office')
  })

  it('returns null when the patch returns no rows', async () => {
    mockDrizzleDbQuery.addresses.findFirst.mockResolvedValue(baseRow)
    const patchReturningMock = vi.fn().mockResolvedValue([])
    const patchWhereMock = vi
      .fn()
      .mockReturnValue({ returning: patchReturningMock })
    const patchSetMock = vi.fn().mockReturnValue({ where: patchWhereMock })
    mockPrimaryUpdate.mockReturnValue({ set: patchSetMock })

    const result = await updateUserAddress({
      userId: 'user-1',
      addressId: 'addr-1',
      input: { label: 'Office' },
    })
    expect(result).toBeNull()
  })
})

describe('deleteUserAddress', () => {
  const buildDeleteChain = (deletedRows: { id: string }[]) => {
    const returningMock = vi.fn().mockResolvedValue(deletedRows)
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    mockPrimaryDelete.mockReturnValue({ where: whereMock })
  }

  it('returns true when a row was deleted', async () => {
    buildDeleteChain([{ id: 'addr-1' }])
    await expect(
      deleteUserAddress({ userId: 'user-1', addressId: 'addr-1' })
    ).resolves.toBe(true)
  })

  it('returns false when nothing matched', async () => {
    buildDeleteChain([])
    await expect(
      deleteUserAddress({ userId: 'user-1', addressId: 'missing' })
    ).resolves.toBe(false)
  })
})
