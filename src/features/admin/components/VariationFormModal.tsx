'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProductVariation } from '@/lib/types'
import toast from 'react-hot-toast'
import {
  CURRENCIES,
  type CurrencyCode,
  useCurrency,
} from '@/contexts/CurrencyContext'
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { TextInput, NumberInput, SelectInput, FileInput } from 'zenput'

const MAX_ADDITIONAL_IMAGES = 10

interface VariationFormModalProps {
  readonly productId: string
  readonly variation?: ProductVariation
  readonly styles?: ProductVariation[]
  readonly onClose: () => void
  readonly onSuccess: (variation: ProductVariation) => void
}

interface FormData {
  name: string
  designName: string
  variationType: 'styling' | 'colour'
  styleId: string
  price: string
  stock: string
}

interface VariationPayload {
  name: string
  designName: string
  variationType: 'styling' | 'colour'
  styleId?: string | null
  price: number
  stock: number
  productId?: string
  image?: string | null
  images?: string[]
}

const convertCurrency = (
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>
): number => {
  const amountInBase = amount / rates[from]
  return Number((amountInBase * rates[to]).toFixed(2))
}

const uploadImage = async (file: File): Promise<string> => {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to upload image')
  }
  const data = await res.json()
  return data.data.url
}

const resolveAdditionalImageUrls = async (
  existingUrls: string[],
  pendingFiles: (File | null)[]
): Promise<string[]> => {
  const resolvedUrls: string[] = []

  for (const [index, existingUrl] of existingUrls.entries()) {
    const pendingFile = pendingFiles[index]
    if (pendingFile) {
      resolvedUrls.push(await uploadImage(pendingFile))
      continue
    }

    if (existingUrl) {
      resolvedUrls.push(existingUrl)
    }
  }

  return resolvedUrls
}

const getVariationMutationConfig = (
  isEditing: boolean,
  variationId: string | undefined
) => ({
  method: isEditing ? 'PUT' : 'POST',
  url:
    isEditing && variationId
      ? `/api/admin/variations/${variationId}`
      : '/api/admin/variations',
  fallbackError: isEditing
    ? 'Failed to update variation'
    : 'Failed to create variation',
  successMessage: isEditing ? 'Variation updated' : 'Variation created',
})

const parseVariationMutationResponse = async (
  response: Response,
  fallbackError: string
): Promise<ProductVariation> => {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String(data.error)
        : fallbackError
    throw new Error(message)
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !('data' in data) ||
    !data.data ||
    typeof data.data !== 'object' ||
    !('variation' in data.data)
  ) {
    throw new Error('Unexpected variation response from server')
  }

  return data.data.variation as ProductVariation
}

const validateImageFile = (file: File): string | null => {
  if (!isValidImageType(file.type)) {
    return `Invalid type. Allowed: ${VALID_IMAGE_TYPES_DISPLAY}`
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`
  }
  return null
}

const validateFormData = (
  formData: FormData,
  isStyle: boolean
): Record<string, string> => {
  const errs: Record<string, string> = {}
  if (!formData.name.trim()) errs.name = 'Name is required'
  else if (formData.name.length > 100)
    errs.name = 'Name must be under 100 characters'
  if (!formData.designName.trim()) errs.designName = 'Design name is required'
  else if (formData.designName.length > 100)
    errs.designName = 'Design name must be under 100 characters'
  if (!isStyle) {
    if (formData.price === '') errs.price = 'Price is required'
    else if (Number.isNaN(Number.parseFloat(formData.price)))
      errs.price = 'Must be a number'
    else if (Number.parseFloat(formData.price) <= 0)
      errs.price = 'Price must be greater than zero'
    if (formData.stock === '') errs.stock = 'Stock is required'
    else if (
      !Number.isInteger(Number(formData.stock)) ||
      Number(formData.stock) < 0
    ) {
      errs.stock = 'Stock must be a non-negative integer'
    }
  }
  return errs
}

const getSubmitButtonLabel = (submitting: boolean, isEditing: boolean): string => {
  if (submitting) return 'Saving...'
  return isEditing ? 'Update' : 'Create'
}

const VariationFormModal = ({
  productId,
  variation,
  styles = [],
  onClose,
  onSuccess,
}: VariationFormModalProps) => {
  const isEditing = !!variation
  const { availableCurrencies, currency, rates } = useCurrency()
  const [priceCurrency, setPriceCurrency] = useState<CurrencyCode>(currency)
  const [additionalImageSlotIds, setAdditionalImageSlotIds] = useState<
    string[]
  >(() => (variation?.images ?? []).map(() => crypto.randomUUID()))

  const [formData, setFormData] = useState<FormData>({
    name: variation?.name ?? '',
    designName: variation?.designName ?? '',
    variationType: variation?.variationType ?? 'styling',
    styleId: variation?.styleId ?? '',
    price: variation
      ? convertCurrency(variation.price, 'INR', currency, rates).toString()
      : '',
    stock: variation?.stock?.toString() ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Image state
  const primaryImageUrl = variation?.image ?? null
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null)
  const [additionalImageUrls, setAdditionalImageUrls] = useState<string[]>(
    variation?.images ?? []
  )
  const [additionalImageFiles, setAdditionalImageFiles] = useState<
    (File | null)[]
  >((variation?.images ?? []).map(() => null))

  const isStyle = formData.variationType === 'styling'
  const priceNum = isStyle ? 0 : Number.parseFloat(formData.price) || 0
  const priceInInr = isStyle
    ? 0
    : convertCurrency(priceNum, priceCurrency, 'INR', rates)
  const priceWarning = !isStyle && formData.price !== '' && priceInInr <= 0
  const currentPrimaryImagePreview = primaryImageFile
    ? URL.createObjectURL(primaryImageFile)
    : primaryImageUrl

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handlePriceCurrencyChange = (newCurrency: CurrencyCode) => {
    const currentPrice = Number.parseFloat(formData.price) || 0
    const convertedPrice = convertCurrency(
      currentPrice,
      priceCurrency,
      newCurrency,
      rates
    )

    setPriceCurrency(newCurrency)
    setFormData((prev) => ({
      ...prev,
      price: convertedPrice.toString(),
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.price
      return next
    })
  }

  const handlePrimaryImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) {
      toast.error(err)
      return
    }
    setPrimaryImageFile(file)
  }

  const handleAdditionalImageChange = (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateImageFile(file)
    if (err) {
      toast.error(err)
      return
    }
    const newFiles = [...additionalImageFiles]
    newFiles[idx] = file
    setAdditionalImageFiles(newFiles)
  }

  const addImageSlot = () => {
    if (additionalImageUrls.length >= MAX_ADDITIONAL_IMAGES) {
      toast.error(`Maximum ${MAX_ADDITIONAL_IMAGES} additional images`)
      return
    }
    setAdditionalImageUrls((prev) => [...prev, ''])
    setAdditionalImageFiles((prev) => [...prev, null])
    setAdditionalImageSlotIds((prev) => [...prev, crypto.randomUUID()])
  }

  const removeAdditionalImage = (idx: number) => {
    setAdditionalImageUrls((prev) => prev.filter((_, i) => i !== idx))
    setAdditionalImageFiles((prev) => prev.filter((_, i) => i !== idx))
    setAdditionalImageSlotIds((prev) => prev.filter((_, i) => i !== idx))
  }

  const buildPayload = (
    imageUrl: string | null | undefined,
    finalAdditionalUrls: string[]
  ): VariationPayload => {
    const payload: VariationPayload = {
      name: formData.name.trim(),
      designName: formData.designName.trim(),
      variationType: formData.variationType,
      price: isStyle ? 0 : priceInInr,
      stock: isStyle ? 0 : Number.parseInt(formData.stock, 10),
    }

    // Include styleId for colours
    if (formData.variationType === 'colour') {
      payload.styleId = formData.styleId || null
    }

    if (!isEditing) {
      payload.productId = productId
    }

    if (imageUrl !== undefined) {
      payload.image = imageUrl
    }

    if (
      finalAdditionalUrls.length > 0 ||
      (variation && variation.images.length > 0)
    ) {
      payload.images = finalAdditionalUrls
    }

    return payload
  }

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault()
    const validationErrors = validateFormData(formData, isStyle)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      let imageUrl: string | null | undefined = primaryImageUrl
      if (primaryImageFile) {
        imageUrl = await uploadImage(primaryImageFile)
      }

      const finalAdditionalUrls = await resolveAdditionalImageUrls(
        additionalImageUrls,
        additionalImageFiles
      )
      const payload = buildPayload(imageUrl, finalAdditionalUrls)
      const { url, method, fallbackError, successMessage } =
        getVariationMutationConfig(isEditing, variation?.id)

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const savedVariation = await parseVariationMutationResponse(
        res,
        fallbackError
      )

      toast.success(successMessage)
      onSuccess(savedVariation)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const submitButtonLabel = getSubmitButtonLabel(submitting, isEditing)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm dark:bg-slate-950/78">
      <dialog
        open
        aria-labelledby="variation-modal-title"
        className="fixed left-1/2 top-1/2 m-0 flex max-h-[92vh] w-[min(calc(100vw-2rem),56rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-0 shadow-[0_36px_100px_-42px_rgba(15,23,42,0.72)] dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.96)_100%)] dark:shadow-[0_36px_100px_-42px_rgba(2,6,23,0.95)]"
      >
        <div className="border-b border-slate-200/80 px-6 py-5 sm:px-8 dark:border-slate-700/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-amber-700">
                Variation editor
              </p>
              <h3
                id="variation-modal-title"
                className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50"
              >
                {isEditing ? 'Edit Variation' : 'Add Variation'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Update naming, pricing, stock, and media for this variation.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-50"
              aria-label="Close variation editor"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_320px]">
            <div className="space-y-6">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900/88 dark:shadow-[0_18px_44px_-34px_rgba(2,6,23,0.92)]">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                    Core details
                  </h4>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Enter a name and design label for this variation.
                  </p>
                </div>

                <div className="space-y-4">
                  <TextInput
                    label="Name"
                    fullWidth
                    required
                    name="name"
                    maxLength={100}
                    value={formData.name}
                    onChange={handleChange}
                    validationState={errors.name ? 'error' as const : 'default' as const}
                    errorMessage={errors.name}
                    placeholder="e.g. Red - Large"
                  />

                  <TextInput
                    label="Design Name"
                    fullWidth
                    required
                    name="designName"
                    maxLength={100}
                    value={formData.designName}
                    onChange={handleChange}
                    validationState={errors.designName ? 'error' as const : 'default' as const}
                    errorMessage={errors.designName}
                    placeholder="e.g. Classic Logo"
                  />
                </div>
              </section>

              {/* Variation Type & Price */}
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900/88 dark:shadow-[0_18px_44px_-34px_rgba(2,6,23,0.92)]">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                    Variation Type &amp; Pricing
                  </h4>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {isStyle
                      ? 'Styles group colours. They have no price or stock of their own.'
                      : 'Colours are purchasable options. Set price, stock, and optionally assign to a style.'}
                  </p>
                </div>

                <div className="space-y-4">
                  <SelectInput
                    label="Variation Type"
                    options={[
                      { value: 'styling', label: 'Styling' },
                      { value: 'colour', label: 'Colour' },
                    ]}
                    fullWidth
                    required
                    value={formData.variationType}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === 'styling' || val === 'colour') {
                        setFormData((prev) => ({
                          ...prev,
                          variationType: val,
                          styleId: val === 'styling' ? '' : prev.styleId,
                        }))
                      }
                    }}
                  />

                  {formData.variationType === 'colour' && (
                    <div>
                      <SelectInput
                        label="Parent Style"
                        options={[
                          { value: '', label: 'Base Product (no style)' },
                          ...styles.map((s) => ({
                            value: s.id,
                            label: `${s.name} — ${s.designName}`,
                          })),
                        ]}
                        fullWidth
                        value={formData.styleId}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            styleId: e.target.value,
                          }))
                        }
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Leave as &quot;Base Product&quot; for colours that
                        belong directly to the product.
                      </p>
                    </div>
                  )}

                  {/* Style info banner */}
                  {isStyle && (
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      <strong>Styles are grouping-only.</strong> Price and stock
                      are set on each colour within this style. After creating
                      the style, add colours to it.
                    </div>
                  )}

                  {!isStyle && (
                    <div>
                      <div className="flex gap-2">
                        <SelectInput
                          label="Currency"
                          options={availableCurrencies.map((code) => ({
                            value: code,
                            label: `${code} (${CURRENCIES[code].symbol})`,
                          }))}
                          value={priceCurrency}
                          onChange={(e) =>
                            handlePriceCurrencyChange(
                              e.target.value as CurrencyCode
                            )
                          }
                        />
                        <NumberInput
                          label="Price"
                          min={0}
                          step={0.01}
                          fullWidth
                          required
                          value={Number(formData.price) || 0}
                          onChange={(v) => {
                            setFormData((prev) => ({
                              ...prev,
                              price: String(v ?? 0),
                            }))
                            setErrors((prev) => {
                              const next = { ...prev }
                              delete next.price
                              return next
                            })
                          }}
                          validationState={errors.price ? 'error' as const : 'default' as const}
                          errorMessage={errors.price}
                          placeholder="e.g. 150.00"
                        />
                      </div>
                      <p
                        className={`mt-2 text-sm ${priceWarning ? 'font-medium text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
                      >
                        {priceWarning
                          ? `Price must be greater than 0.00 ${priceCurrency}`
                          : `This price is set independently from the base product price.`}
                      </p>
                    </div>
                  )}

                  {!isStyle && (
                    <NumberInput
                      label="Stock"
                      min={0}
                      step={1}
                      fullWidth
                      required
                      value={Number(formData.stock) || 0}
                      onChange={(v) => {
                        setFormData((prev) => ({
                          ...prev,
                          stock: String(v ?? 0),
                        }))
                        setErrors((prev) => {
                          const next = { ...prev }
                          delete next.stock
                          return next
                        })
                      }}
                      validationState={errors.stock ? 'error' as const : 'default' as const}
                      errorMessage={errors.stock}
                      placeholder="0"
                    />
                  )}
                </div>
              </section>

              {/* Primary Image */}
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900/88 dark:shadow-[0_18px_44px_-34px_rgba(2,6,23,0.92)]">
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                    Media
                  </h4>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Upload a primary image and optional gallery images for this
                    variation.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    {(primaryImageUrl || primaryImageFile) &&
                      currentPrimaryImagePreview && (
                        <div className="relative mb-3 h-28 w-28 overflow-hidden rounded-[1.25rem] bg-slate-100 dark:bg-slate-800">
                          <Image
                            src={currentPrimaryImagePreview}
                            alt="Variation preview"
                            fill
                            className="object-cover"
                            sizes="112px"
                          />
                        </div>
                      )}
                    <FileInput
                      label="Primary Image"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      fullWidth
                      showFileNames
                      dropzone
                      onChange={handlePrimaryImageChange}
                    />
                  </div>

                  {/* Additional Images */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Additional Images ({additionalImageUrls.length}/
                        {MAX_ADDITIONAL_IMAGES})
                      </span>
                      <button
                        type="button"
                        onClick={addImageSlot}
                        disabled={
                          additionalImageUrls.length >= MAX_ADDITIONAL_IMAGES
                        }
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-40 dark:border-sky-900/70 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25"
                      >
                        + Add Image
                      </button>
                    </div>
                    {additionalImageUrls.map((url, idx) => {
                      const pendingFile = additionalImageFiles[idx] ?? null
                      const previewSrc = pendingFile
                        ? URL.createObjectURL(pendingFile)
                        : url

                      return (
                        <div
                          key={
                            additionalImageSlotIds[idx] ??
                            `variation-image-slot-${idx}`
                          }
                          className="mb-3 flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/65"
                        >
                          {(pendingFile || url) && (
                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
                              <Image
                                src={previewSrc}
                                alt={`Additional ${idx + 1}`}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              handleAdditionalImageChange(idx, e)
                            }
                            className="flex-1 text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 dark:text-slate-300 dark:file:bg-slate-900 dark:file:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeAdditionalImage(idx)}
                            className="text-sm text-rose-500 transition hover:text-rose-700"
                            aria-label={`Remove image ${idx + 1}`}
                          >
                            &times;
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900/88 dark:shadow-[0_18px_44px_-34px_rgba(2,6,23,0.92)]">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Preview
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/65">
                    <span className="text-slate-500 dark:text-slate-400">
                      Type
                    </span>
                    <strong className="capitalize text-slate-950 dark:text-slate-50">
                      {formData.variationType === 'styling'
                        ? '🎨 Style (group)'
                        : '🌈 Colour'}
                    </strong>
                  </div>
                  {formData.variationType === 'colour' && (
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/65">
                      <span className="text-slate-500 dark:text-slate-400">
                        Parent style
                      </span>
                      <strong className="text-slate-950 dark:text-slate-50">
                        {formData.styleId
                          ? (styles.find((s) => s.id === formData.styleId)
                              ?.name ?? '—')
                          : 'Base product'}
                      </strong>
                    </div>
                  )}
                  {!isStyle && (
                    <div className="rounded-2xl bg-emerald-50 px-4 py-4 dark:bg-emerald-950/45">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Colour price
                      </p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
                        {priceNum > 0 ? priceNum.toFixed(2) : '—'}{' '}
                        {priceCurrency}
                      </p>
                    </div>
                  )}
                  {isStyle && (
                    <div className="rounded-2xl bg-amber-50 px-4 py-4 dark:bg-amber-950/45">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Grouping only
                      </p>
                      <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                        Add colours to this style after creation.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900/88 dark:shadow-[0_18px_44px_-34px_rgba(2,6,23,0.92)]">
                <h4 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  Editing notes
                </h4>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <li>
                    Name each variation so admins can identify it quickly in
                    search and order history.
                  </li>
                  <li>
                    Keep design naming consistent so media and stock updates
                    stay easy to trace.
                  </li>
                  <li>
                    Use the lead image for the option customers should recognize
                    first.
                  </li>
                </ul>
              </section>
            </aside>
          </div>

          {/* Actions */}
          <div className="border-t border-slate-200/80 bg-white/90 px-6 py-4 sm:px-8 dark:border-slate-700/80 dark:bg-slate-950/85">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || priceWarning}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  submitButtonLabel
                )}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </div>
  )
}

export default VariationFormModal
