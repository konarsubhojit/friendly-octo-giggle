'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'
import { selectCart } from '@/features/cart/store/cartSlice'
import { GradientButton } from '@/components/ui/GradientButton'
import { buildCheckoutSummaryLineItems } from '@/features/orders/services/order-summary'
import { formatStructuredAddress } from '@/lib/address-utils'
import toast from 'react-hot-toast'

const PENDING_CHECKOUT_KEY = 'pending_checkout'
const PINCODE_REGEX = /^\d{6}$/

type IndiaPincodeModule = typeof import('india-pincode/browser')
type IndiaPincodeInstance = Awaited<
  ReturnType<IndiaPincodeModule['getIndiaPincode']>
>

let cachedPincodeInstance: Promise<IndiaPincodeInstance> | null = null

const getPincodeInstance = (): Promise<IndiaPincodeInstance> => {
  if (!cachedPincodeInstance) {
    cachedPincodeInstance = import('india-pincode/browser').then((mod) =>
      mod.getIndiaPincode()
    )
  }
  return cachedPincodeInstance
}

interface AddressFields {
  addressLine1: string
  addressLine2: string
  addressLine3: string
  pinCode: string
  city: string
  state: string
}

interface AddressErrors {
  addressLine1?: string
  pinCode?: string
  city?: string
  state?: string
}

interface CheckoutFormProps {
  readonly customizationNotes: Record<string, string>
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-[var(--border-warm)] rounded-xl text-sm text-[var(--foreground)] bg-[var(--surface)]/50 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] transition-colors'

const READONLY_CLASS =
  'w-full px-3 py-2 border border-[var(--border-warm)] rounded-xl text-sm text-[var(--foreground)] bg-[var(--surface-muted)]/60 cursor-not-allowed transition-colors'

export const CheckoutForm = ({ customizationNotes }: CheckoutFormProps) => {
  const router = useRouter()
  const { data: session } = useSession()
  const cart = useSelector(selectCart)
  const latestPincodeRef = useRef('')

  const [address, setAddress] = useState<AddressFields>({
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    pinCode: '',
    city: '',
    state: '',
  })
  const [errors, setErrors] = useState<AddressErrors>({})
  const [pincodeAutoFilled, setPincodeAutoFilled] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeNotice, setPincodeNotice] = useState<string | null>(null)

  const cartItems = useMemo(() => cart?.items ?? [], [cart?.items])
  const checkoutItems = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        customizationNote: customizationNotes[item.id] ?? null,
      })),
    [cartItems, customizationNotes]
  )
  const lineItems = useMemo(
    () => buildCheckoutSummaryLineItems(checkoutItems),
    [checkoutItems]
  )

  const updateField = useCallback(
    (field: keyof AddressFields, value: string) => {
      setAddress((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    },
    []
  )

  const handlePincodeChange = useCallback(
    async (value: string) => {
      latestPincodeRef.current = value
      updateField('pinCode', value)
      setPincodeNotice(null)

      if (pincodeAutoFilled) {
        setAddress((prev) => ({ ...prev, city: '', state: '' }))
        setPincodeAutoFilled(false)
      }

      if (!PINCODE_REGEX.test(value)) {
        return
      }

      setPincodeLoading(true)
      try {
        const instance = await getPincodeInstance()

        if (latestPincodeRef.current !== value) return

        const result = instance.getPincodeSummary(value)

        if (latestPincodeRef.current !== value) return

        if (result.success && result.data) {
          const district = result.data.district
          const stateName = result.data.state
          setAddress((prev) => ({
            ...prev,
            city: district,
            state: stateName,
          }))
          setPincodeAutoFilled(true)
          setErrors((prev) => ({ ...prev, city: undefined, state: undefined }))
        } else {
          setPincodeNotice(
            'Could not find location for this pin code. Please enter city and state manually.'
          )
          setPincodeAutoFilled(false)
        }
      } catch {
        setPincodeNotice(
          'Auto-fill unavailable. Please enter city and state manually.'
        )
        setPincodeAutoFilled(false)
      } finally {
        setPincodeLoading(false)
      }
    },
    [pincodeAutoFilled, updateField]
  )

  const validateForm = useCallback((): boolean => {
    const newErrors: AddressErrors = {}

    if (!address.addressLine1.trim()) {
      newErrors.addressLine1 = 'Address Line 1 is required'
    }

    if (!PINCODE_REGEX.test(address.pinCode)) {
      newErrors.pinCode = 'Pin code must be exactly 6 digits'
    }

    if (!address.city.trim()) {
      newErrors.city = 'City is required'
    }

    if (!address.state.trim()) {
      newErrors.state = 'State is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [address])

  const handleSubmit: NonNullable<React.ComponentProps<'form'>['onSubmit']> = (
    e
  ) => {
    e.preventDefault()

    if (!session?.user?.id || !session.user.email) {
      router.push('/auth/signin?callbackUrl=/cart')
      return
    }

    if (!validateForm()) {
      return
    }

    if (!cartItems.length) {
      toast.error('Your cart is empty.')
      return
    }

    const trimmed = {
      addressLine1: address.addressLine1.trim(),
      addressLine2: address.addressLine2.trim(),
      addressLine3: address.addressLine3.trim(),
      pinCode: address.pinCode.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
    }

    try {
      sessionStorage.setItem(
        PENDING_CHECKOUT_KEY,
        JSON.stringify({ ...trimmed, customizationNotes })
      )
    } catch {
      toast.error('Unable to proceed. Please try again.')
      return
    }

    router.push('/checkout/review')
  }

  const addressPreview = address.addressLine1.trim()
    ? formatStructuredAddress({
        customerAddress: '',
        ...address,
      })
    : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--foreground)] mb-1.5">
          Shipping Address
        </legend>

        <div>
          <label
            htmlFor="checkout-address-line1"
            className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
          >
            Address Line 1 <span className="text-red-400">*</span>
          </label>
          <input
            id="checkout-address-line1"
            type="text"
            value={address.addressLine1}
            onChange={(e) => updateField('addressLine1', e.target.value)}
            placeholder="Street address, house number"
            maxLength={200}
            aria-describedby={
              errors.addressLine1 ? 'address-line1-error' : undefined
            }
            aria-invalid={!!errors.addressLine1}
            className={INPUT_CLASS}
          />
          {errors.addressLine1 && (
            <p
              id="address-line1-error"
              className="mt-1 text-xs text-red-500"
              role="alert"
            >
              {errors.addressLine1}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="checkout-address-line2"
            className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
          >
            Address Line 2
          </label>
          <input
            id="checkout-address-line2"
            type="text"
            value={address.addressLine2}
            onChange={(e) => updateField('addressLine2', e.target.value)}
            placeholder="Apartment, suite, floor (optional)"
            maxLength={200}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label
            htmlFor="checkout-address-line3"
            className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
          >
            Address Line 3
          </label>
          <input
            id="checkout-address-line3"
            type="text"
            value={address.addressLine3}
            onChange={(e) => updateField('addressLine3', e.target.value)}
            placeholder="Landmark, area (optional)"
            maxLength={200}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="checkout-pincode"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
            >
              Pin Code <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="checkout-pincode"
                type="text"
                inputMode="numeric"
                value={address.pinCode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                placeholder="6-digit pin code"
                maxLength={6}
                aria-describedby={errors.pinCode ? 'pincode-error' : undefined}
                aria-invalid={!!errors.pinCode}
                className={INPUT_CLASS}
              />
              {pincodeLoading && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent-warm)] border-t-transparent"
                  aria-label="Looking up pin code"
                />
              )}
            </div>
            {errors.pinCode && (
              <p
                id="pincode-error"
                className="mt-1 text-xs text-red-500"
                role="alert"
              >
                {errors.pinCode}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="checkout-city"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
            >
              City <span className="text-red-400">*</span>
            </label>
            <input
              id="checkout-city"
              type="text"
              value={address.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="City / District"
              maxLength={100}
              readOnly={pincodeAutoFilled}
              aria-describedby={errors.city ? 'city-error' : undefined}
              aria-invalid={!!errors.city}
              className={pincodeAutoFilled ? READONLY_CLASS : INPUT_CLASS}
            />
            {errors.city && (
              <p
                id="city-error"
                className="mt-1 text-xs text-red-500"
                role="alert"
              >
                {errors.city}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="checkout-state"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
            >
              State <span className="text-red-400">*</span>
            </label>
            <input
              id="checkout-state"
              type="text"
              value={address.state}
              onChange={(e) => updateField('state', e.target.value)}
              placeholder="State"
              maxLength={100}
              readOnly={pincodeAutoFilled}
              aria-describedby={errors.state ? 'state-error' : undefined}
              aria-invalid={!!errors.state}
              className={pincodeAutoFilled ? READONLY_CLASS : INPUT_CLASS}
            />
            {errors.state && (
              <p
                id="state-error"
                className="mt-1 text-xs text-red-500"
                role="alert"
              >
                {errors.state}
              </p>
            )}
          </div>
        </div>

        {pincodeNotice && (
          <p
            className="text-xs text-amber-600 dark:text-amber-400"
            role="status"
          >
            {pincodeNotice}
          </p>
        )}

        {pincodeAutoFilled && (
          <p
            className="text-xs text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            ✓ City and state auto-filled from pin code
          </p>
        )}
      </fieldset>

      {addressPreview && (
        <div className="rounded-xl border border-[var(--border-warm)] bg-[var(--surface)]/30 p-3">
          <p className="text-xs font-medium text-[var(--text-muted)] mb-1">
            Address preview
          </p>
          <p className="whitespace-pre-line text-sm text-[var(--text-secondary)]">
            {addressPreview}
          </p>
        </div>
      )}

      {lineItems.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          {lineItems.length} item{lineItems.length === 1 ? '' : 's'} · Review
          policies before placing order
        </p>
      )}

      <GradientButton
        type="submit"
        size="lg"
        fullWidth
        disabled={!cartItems.length}
      >
        Review & Place Order
      </GradientButton>
    </form>
  )
}
