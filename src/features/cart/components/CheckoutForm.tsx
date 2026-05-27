'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'
import { selectCart } from '@/features/cart/store/cartSlice'
import { StructuredAddressSchema } from '@/features/orders/validations'
import { GradientButton } from '@/components/ui/GradientButton'
import { buildCheckoutSummaryLineItems } from '@/features/orders/services/order-summary'
import { formatStructuredAddress } from '@/lib/address-utils'
import { AddressFormField } from './AddressFormField'
import { PincodeField } from './PincodeField'
import toast from 'react-hot-toast'

const PENDING_CHECKOUT_KEY = 'pending_checkout'
const PINCODE_REGEX = /^\d{6}$/
const PENDING_CUSTOMIZATION_KEY = 'pending_customization_notes'

interface PincodeLookupResponse {
  success: boolean
  data?: { city: string; state: string }
}

type PincodeLookupResult =
  | { status: 'found'; city: string; state: string }
  | { status: 'not_found' }
  | { status: 'error' }

const lookupPincode = async (code: string): Promise<PincodeLookupResult> => {
  try {
    const res = await fetch(`/api/pincode/${code}`)
    if (res.status === 404) return { status: 'not_found' }
    if (!res.ok) return { status: 'error' }
    const json: PincodeLookupResponse = await res.json()
    return json.success && json.data
      ? { status: 'found', city: json.data.city, state: json.data.state }
      : { status: 'not_found' }
  } catch {
    return { status: 'error' }
  }
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
  addressLine2?: string
  addressLine3?: string
  pinCode?: string
  city?: string
  state?: string
}

interface SavedAddress extends AddressFields {
  id: string
  label: string
  isDefault: boolean
}

interface CheckoutFormProps {
  readonly customizationNotes?: Record<string, string>
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-[var(--border-warm)] rounded-xl text-sm text-[var(--foreground)] bg-[var(--surface)]/50 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] transition-colors'

const READONLY_CLASS =
  'w-full px-3 py-2 border border-[var(--border-warm)] rounded-xl text-sm text-[var(--foreground)] bg-[var(--surface-muted)]/60 cursor-not-allowed transition-colors'

const getValidationErrors = (address: AddressFields): AddressErrors => {
  const result = StructuredAddressSchema.safeParse(address)
  if (result.success) return {}

  return result.error.issues.reduce((acc, issue) => {
    const key = issue.path[0]
    if (typeof key === 'string' && key in address) {
      acc[key as keyof AddressErrors] = issue.message
    }
    return acc
  }, {} as AddressErrors)
}

const trimAddress = (address: AddressFields): AddressFields => ({
  addressLine1: address.addressLine1.trim(),
  addressLine2: address.addressLine2.trim(),
  addressLine3: address.addressLine3.trim(),
  pinCode: address.pinCode.trim(),
  city: address.city.trim(),
  state: address.state.trim(),
})

const readCachedCustomizationNotes = (): Record<string, string> => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(PENDING_CUSTOMIZATION_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export const CheckoutForm = ({
  customizationNotes = {},
}: CheckoutFormProps) => {
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
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [saveAddress, setSaveAddress] = useState(true)
  const [errors, setErrors] = useState<AddressErrors>({})
  const [pincodeAutoFilled, setPincodeAutoFilled] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeNotice, setPincodeNotice] = useState<string | null>(null)

  const cartItems = useMemo(() => cart?.items ?? [], [cart?.items])
  const mergedCustomizationNotes = useMemo(
    () => ({
      ...readCachedCustomizationNotes(),
      ...customizationNotes,
    }),
    [customizationNotes]
  )
  const checkoutItems = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        customizationNote: mergedCustomizationNotes[item.id] ?? null,
      })),
    [cartItems, mergedCustomizationNotes]
  )
  const lineItems = useMemo(
    () => buildCheckoutSummaryLineItems(checkoutItems),
    [checkoutItems]
  )

  useEffect(() => {
    if (!session?.user?.id) return

    const run = async () => {
      try {
        const res = await fetch('/api/account/addresses')
        if (!res.ok) return
        const payload = (await res.json()) as {
          success?: boolean
          data?: { addresses?: SavedAddress[] }
        }
        const records = payload.data?.addresses ?? []
        setSavedAddresses(records)
        const defaultAddress = records.find((record) => record.isDefault)
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id)
          setAddress({
            addressLine1: defaultAddress.addressLine1,
            addressLine2: defaultAddress.addressLine2 ?? '',
            addressLine3: defaultAddress.addressLine3 ?? '',
            pinCode: defaultAddress.pinCode,
            city: defaultAddress.city,
            state: defaultAddress.state,
          })
          setSaveAddress(false)
        }
      } catch {
        // No-op: checkout should still work without saved addresses.
      }
    }

    void run()
  }, [session?.user?.id])

  useEffect(() => {
    if (customizationNotes && Object.keys(customizationNotes).length > 0) {
      sessionStorage.setItem(
        PENDING_CUSTOMIZATION_KEY,
        JSON.stringify(customizationNotes)
      )
    }
  }, [customizationNotes])

  const updateField = useCallback(
    (field: keyof AddressFields, value: string) => {
      setAddress((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    },
    []
  )

  const applyPincodeResult = useCallback((city: string, state: string) => {
    setAddress((prev) => ({ ...prev, city, state }))
    setPincodeAutoFilled(true)
    setErrors((prev) => ({ ...prev, city: undefined, state: undefined }))
  }, [])

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
        const result = await lookupPincode(value)

        if (latestPincodeRef.current !== value) return

        if (result.status === 'found') {
          applyPincodeResult(result.city, result.state)
        } else if (result.status === 'not_found') {
          setPincodeNotice(
            'Could not find location for this pin code. Please enter city and state manually.'
          )
          setPincodeAutoFilled(false)
        } else {
          setPincodeNotice(
            'Auto-fill unavailable. Please enter city and state manually.'
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
    [pincodeAutoFilled, updateField, applyPincodeResult]
  )

  const applySavedAddress = (addressId: string) => {
    setSelectedAddressId(addressId)
    setSaveAddress(false)
    const selected = savedAddresses.find((item) => item.id === addressId)
    if (!selected) return
    setAddress({
      addressLine1: selected.addressLine1,
      addressLine2: selected.addressLine2 ?? '',
      addressLine3: selected.addressLine3 ?? '',
      pinCode: selected.pinCode,
      city: selected.city,
      state: selected.state,
    })
    setErrors({})
  }

  const handleSubmit: NonNullable<React.ComponentProps<'form'>['onSubmit']> = (
    e
  ) => {
    e.preventDefault()

    if (!session?.user?.id || !session.user.email) {
      router.push('/auth/signin?callbackUrl=/checkout/shipping')
      return
    }

    const trimmed = trimAddress(address)
    const validationErrors = getValidationErrors(trimmed)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      return
    }

    if (!cartItems.length) {
      toast.error('Your cart is empty.')
      return
    }

    const persistPendingCheckout = async () => {
      try {
        if (!selectedAddressId && saveAddress) {
          await fetch('/api/account/addresses', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              label: `${trimmed.addressLine1.slice(0, 40)}${trimmed.city ? ` · ${trimmed.city}` : ''}`,
              ...trimmed,
              isDefault: savedAddresses.length === 0,
            }),
          })
        }

        sessionStorage.setItem(
          PENDING_CHECKOUT_KEY,
          JSON.stringify({
            ...trimmed,
            customizationNotes: mergedCustomizationNotes,
          })
        )
      } catch {
        toast.error('Unable to proceed. Please try again.')
        return
      }

      router.push('/checkout/review')
    }

    void persistPendingCheckout()
  }

  const addressPreview = address.addressLine1.trim()
    ? formatStructuredAddress({
        customerAddress: '',
        ...address,
      })
    : null

  const cityStateClass = pincodeAutoFilled ? READONLY_CLASS : INPUT_CLASS

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {savedAddresses.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-[var(--foreground)]">
            Saved Addresses
          </legend>
          <div className="space-y-2">
            {savedAddresses.map((record) => (
              <label
                key={record.id}
                className="block cursor-pointer rounded-xl border border-[var(--border-warm)] bg-[var(--surface)]/40 px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name="saved-address"
                  value={record.id}
                  checked={selectedAddressId === record.id}
                  onChange={() => applySavedAddress(record.id)}
                  className="mr-2"
                />
                <span className="font-medium text-[var(--foreground)]">
                  {record.label}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedAddressId('')
              setSaveAddress(true)
              setAddress({
                addressLine1: '',
                addressLine2: '',
                addressLine3: '',
                pinCode: '',
                city: '',
                state: '',
              })
            }}
            className="text-xs font-medium text-[var(--accent-rose)] hover:underline"
          >
            + Add a new address
          </button>
        </fieldset>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--foreground)] mb-1.5">
          Shipping Address
        </legend>

        <AddressFormField
          id="checkout-address-line1"
          label="Address Line 1"
          value={address.addressLine1}
          onChange={(v) => updateField('addressLine1', v)}
          placeholder="Street address, house number"
          maxLength={200}
          required
          error={errors.addressLine1}
          errorId="address-line1-error"
          inputClassName={INPUT_CLASS}
        />

        <AddressFormField
          id="checkout-address-line2"
          label="Address Line 2"
          value={address.addressLine2}
          onChange={(v) => updateField('addressLine2', v)}
          placeholder="Apartment, suite, floor (optional)"
          maxLength={200}
          error={errors.addressLine2}
          errorId="address-line2-error"
          inputClassName={INPUT_CLASS}
        />

        <AddressFormField
          id="checkout-address-line3"
          label="Address Line 3"
          value={address.addressLine3}
          onChange={(v) => updateField('addressLine3', v)}
          placeholder="Landmark, area (optional)"
          maxLength={200}
          error={errors.addressLine3}
          errorId="address-line3-error"
          inputClassName={INPUT_CLASS}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PincodeField
            value={address.pinCode}
            onChange={handlePincodeChange}
            loading={pincodeLoading}
            error={errors.pinCode}
            inputClassName={INPUT_CLASS}
          />

          <AddressFormField
            id="checkout-city"
            label="City"
            value={address.city}
            onChange={(v) => updateField('city', v)}
            placeholder="City / District"
            maxLength={100}
            required
            readOnly={pincodeAutoFilled}
            error={errors.city}
            errorId="city-error"
            inputClassName={cityStateClass}
          />

          <AddressFormField
            id="checkout-state"
            label="State"
            value={address.state}
            onChange={(v) => updateField('state', v)}
            placeholder="State"
            maxLength={100}
            required
            readOnly={pincodeAutoFilled}
            error={errors.state}
            errorId="state-error"
            inputClassName={cityStateClass}
          />
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

      {!selectedAddressId ? (
        <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={saveAddress}
            onChange={(event) => setSaveAddress(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[var(--border-warm)] accent-[var(--accent-rose)]"
          />
          Save this address for future checkouts
        </label>
      ) : null}

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
        Continue to Review
      </GradientButton>
    </form>
  )
}
