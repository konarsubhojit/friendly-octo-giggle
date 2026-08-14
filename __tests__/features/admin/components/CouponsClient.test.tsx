// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CouponsClient from '@/features/admin/components/CouponsClient'
import { ApiError } from '@/lib/api-client'
import type {
  AdminCouponRecord,
  AdminCouponRedemptionSummary,
} from '@/features/admin/services/coupon-admin'

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: ({
    isOpen,
    title,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean
    title: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm delete</button>
        <button onClick={onCancel}>Cancel delete</button>
      </div>
    ) : null,
}))

const post = vi.fn()
const patch = vi.fn()
const del = vi.fn()

vi.mock('@/lib/api-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/api-client')>(
      '@/lib/api-client'
    )
  return {
    ...actual,
    apiClient: {
      post: (...args: unknown[]) => post(...args),
      patch: (...args: unknown[]) => patch(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  }
})

const coupon = (overrides: Partial<AdminCouponRecord> = {}) =>
  ({
    id: 'cpn1',
    code: 'WELCOME10',
    description: 'Welcome offer',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscountAmount: null,
    minCartValue: 0,
    scopedCategories: [],
    scopedProductIds: [],
    usageLimit: 100,
    perUserLimit: 1,
    usageCount: 4,
    stackable: false,
    isActive: true,
    startsAt: null,
    endsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) satisfies AdminCouponRecord

const redemption: AdminCouponRedemptionSummary = {
  couponId: 'cpn1',
  code: 'WELCOME10',
  discountType: 'PERCENTAGE',
  isActive: true,
  usageLimit: 100,
  usageCount: 4,
  redemptionCount: 4,
  totalDiscount: 250,
  lastRedeemedAt: '2026-02-01T00:00:00.000Z',
}

describe('CouponsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty states when there are no coupons or redemptions', () => {
    render(<CouponsClient initialCoupons={[]} initialRedemptions={[]} />)

    expect(screen.getByText('No coupons yet.')).toBeInTheDocument()
    expect(screen.getByText('No redemptions recorded yet.')).toBeInTheDocument()
  })

  it('renders a coupon row and its redemption summary', () => {
    render(
      <CouponsClient
        initialCoupons={[coupon()]}
        initialRedemptions={[redemption]}
      />
    )

    expect(screen.getAllByText('WELCOME10')).toHaveLength(2)
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('Entire cart')).toBeInTheDocument()
    expect(screen.getByText('4/100 total · 1 per user')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Active' })).toBeInTheDocument()
    // Remaining redemptions: usageLimit - usageCount
    expect(screen.getByText('96')).toBeInTheDocument()
  })

  it('creates a coupon from the overlay form and prepends it to the table', async () => {
    const created = coupon({ id: 'cpn2', code: 'SPRING20', discountValue: 20 })
    post.mockResolvedValue({ data: { coupon: created } })

    render(<CouponsClient initialCoupons={[]} initialRedemptions={[]} />)

    fireEvent.click(screen.getByRole('button', { name: '+ Add coupon' }))

    fireEvent.change(screen.getByLabelText('Code'), {
      target: { value: 'SPRING20' },
    })
    fireEvent.change(screen.getByLabelText('Value (percent or amount)'), {
      target: { value: '20' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }))

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledWith(
      '/api/admin/coupons',
      expect.objectContaining({
        code: 'SPRING20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
      })
    )
    expect(await screen.findByText('SPRING20')).toBeInTheDocument()
    // The overlay closes after a successful create.
    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument()
  })

  it('edits an existing coupon from the overlay form', async () => {
    const updated = coupon({ code: 'WELCOME15', discountValue: 15 })
    patch.mockResolvedValue({ data: { coupon: updated } })

    render(
      <CouponsClient initialCoupons={[coupon()]} initialRedemptions={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Code')).toHaveValue('WELCOME10')

    fireEvent.change(screen.getByLabelText('Value (percent or amount)'), {
      target: { value: '15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/admin/coupons/cpn1',
        expect.objectContaining({ discountValue: 15 })
      )
    )
    expect(await screen.findByText('WELCOME15')).toBeInTheDocument()
  })

  it('shows a stale-record message when the edit conflicts', async () => {
    const conflictError = new ApiError('Conflict', 409)
    patch.mockRejectedValue(conflictError)

    render(
      <CouponsClient initialCoupons={[coupon()]} initialRedemptions={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText(/changed by someone else/i)
    ).toBeInTheDocument()
  })

  it('toggles a coupon between active and inactive', async () => {
    patch.mockResolvedValue({
      data: { coupon: coupon({ isActive: false }) },
    })

    render(
      <CouponsClient initialCoupons={[coupon()]} initialRedemptions={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/admin/coupons/cpn1', {
        isActive: false,
      })
    )
    expect(
      await screen.findByRole('cell', { name: 'Inactive' })
    ).toBeInTheDocument()
  })

  it('deletes a coupon only after the confirmation dialog is confirmed', async () => {
    del.mockResolvedValue(undefined)

    render(
      <CouponsClient initialCoupons={[coupon()]} initialRedemptions={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(del).not.toHaveBeenCalled()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm delete' })
    )

    await waitFor(() =>
      expect(del).toHaveBeenCalledWith('/api/admin/coupons/cpn1')
    )
    expect(await screen.findByText('No coupons yet.')).toBeInTheDocument()
  })
})
