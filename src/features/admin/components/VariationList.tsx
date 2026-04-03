'use client'

import { useState, lazy, Suspense } from 'react'
import Image from 'next/image'
import type { ProductVariation } from '@/lib/types'
import toast from 'react-hot-toast'
import { useCurrency } from '@/contexts/CurrencyContext'

const VariationFormModal = lazy(
  () => import('@/features/admin/components/VariationFormModal')
)
const DeleteConfirmModal = lazy(
  () => import('@/features/admin/components/DeleteConfirmModal')
)

interface VariationListProps {
  readonly productId: string
  readonly productPrice: number
  readonly initialVariations: ProductVariation[]
}

interface QuickEditDraft {
  price: string
  stock: string
}

interface QuickEditUiState {
  readonly hasDraftChanges: boolean
  readonly hasValidPrice: boolean
  readonly isQuickSaveDisabled: boolean
  readonly previewLabel: string
  readonly quickEffectivePrice: number
  readonly showPriceError: boolean
  readonly showStockError: boolean
}

interface VariationQuickEditPanelProps {
  readonly currency: string
  readonly draft: QuickEditDraft
  readonly onPriceChange: (value: string) => void
  readonly onReset: () => void
  readonly onSave: () => void
  readonly onStockChange: (value: string) => void
  readonly saving: boolean
  readonly state: QuickEditUiState
  readonly variationName: string
}

function convertCurrency(
  amount: number,
  fromRate: number,
  toRate: number
): number {
  const amountInInr = amount / fromRate
  return Number((amountInInr * toRate).toFixed(2))
}

function getQuickEditUiState({
  currency,
  draft,
  formatPrice,
  getDefaultDraft,
  rates,
  saving,
  variation,
}: {
  readonly currency: string
  readonly draft: QuickEditDraft
  readonly formatPrice: (amount: number) => string
  readonly getDefaultDraft: (variation: ProductVariation) => QuickEditDraft
  readonly rates: Record<string, number>
  readonly saving: boolean
  readonly variation: ProductVariation
}): QuickEditUiState {
  const defaultDraft = getDefaultDraft(variation)
  const priceValue = Number.parseFloat(draft.price)
  const priceInInr = Number.isNaN(priceValue)
    ? Number.NaN
    : convertCurrency(priceValue, rates[currency], rates.INR)
  const stockValue = Number.parseInt(draft.stock, 10)
  const hasDraftChanges =
    draft.price !== defaultDraft.price || draft.stock !== defaultDraft.stock
  const hasValidStock = Number.isInteger(stockValue) && stockValue >= 0
  const hasValidPrice = !Number.isNaN(priceValue) && priceValue > 0

  return {
    hasDraftChanges,
    hasValidPrice,
    isQuickSaveDisabled:
      !hasDraftChanges ||
      !hasValidStock ||
      !hasValidPrice ||
      Number.isNaN(priceInInr) ||
      priceInInr <= 0 ||
      saving,
    previewLabel:
      hasValidPrice && !Number.isNaN(priceInInr)
        ? formatPrice(priceInInr)
        : 'Enter valid values',
    quickEffectivePrice: priceInInr,
    showPriceError: hasValidPrice === false,
    showStockError: hasValidStock === false,
  }
}

function VariationQuickEditPanel({
  currency,
  draft,
  onPriceChange,
  onReset,
  onSave,
  onStockChange,
  saving,
  state,
  variationName,
}: VariationQuickEditPanelProps) {
  return (
    <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/55">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
            Quick edit
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Adjust price and stock.
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Preview after save: {state.previewLabel}
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Price ({currency})</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={draft.price}
            onChange={(event) => onPriceChange(event.target.value)}
            aria-label={`Price for ${variationName}`}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-50 dark:focus:border-sky-500 dark:focus:ring-sky-500/20"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          <span>Stock</span>
          <input
            type="number"
            min="0"
            step="1"
            value={draft.stock}
            onChange={(event) => onStockChange(event.target.value)}
            aria-label={`Stock for ${variationName}`}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-50 dark:focus:border-sky-500 dark:focus:ring-sky-500/20"
          />
        </label>

        <div className="flex gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onReset}
            disabled={!state.hasDraftChanges || saving}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={state.isQuickSaveDisabled}
            className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {state.showPriceError ? (
        <p className="mt-3 text-xs font-medium text-rose-500 dark:text-rose-400">
          Enter a valid price greater than zero.
        </p>
      ) : null}
      {state.showStockError ? (
        <p className="mt-3 text-xs font-medium text-rose-500 dark:text-rose-400">
          Stock must be a non-negative integer.
        </p>
      ) : null}
      {state.hasValidPrice && state.quickEffectivePrice <= 0 ? (
        <p className="mt-3 text-xs font-medium text-rose-500 dark:text-rose-400">
          Price must be greater than zero.
        </p>
      ) : null}
    </div>
  )
}

interface ColourCardProps {
  readonly variation: ProductVariation
  readonly currency: string
  readonly draft: QuickEditDraft
  readonly expandedVariationId: string | null
  readonly formatPrice: (amount: number) => string
  readonly getDefaultDraft: (variation: ProductVariation) => QuickEditDraft
  readonly handleDeleteClick: (variation: ProductVariation) => void
  readonly handleQuickEditToggle: (variationId: string) => void
  readonly handleQuickSave: (variation: ProductVariation) => void
  readonly rates: Record<string, number>
  readonly resetQuickDraft: (variation: ProductVariation) => void
  readonly savingVariationId: string | null
  readonly updateQuickDraft: (
    variationId: string,
    field: keyof QuickEditDraft,
    value: string
  ) => void
}

function ColourCard({
  variation,
  currency,
  draft,
  expandedVariationId,
  formatPrice,
  getDefaultDraft,
  handleDeleteClick,
  handleQuickEditToggle,
  handleQuickSave,
  rates,
  resetQuickDraft,
  savingVariationId,
  updateQuickDraft,
}: ColourCardProps) {
  const isExpanded = expandedVariationId === variation.id
  const quickEditState = getQuickEditUiState({
    currency,
    draft,
    formatPrice,
    getDefaultDraft,
    rates,
    saving: savingVariationId === variation.id,
    variation,
  })

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.38)] transition hover:border-slate-300 hover:shadow-[0_24px_54px_-34px_rgba(15,23,42,0.42)] sm:p-5 dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.88)_100%)] dark:hover:border-slate-600 dark:hover:shadow-[0_24px_54px_-34px_rgba(2,6,23,0.92)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-slate-100 dark:bg-slate-800">
            {variation.image ? (
              <Image
                src={variation.image}
                alt={variation.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {variation.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {variation.designName}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Updated{' '}
                {new Date(variation.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:bg-slate-950/70 dark:shadow-none">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Price
                </p>
                <p className="mt-2 text-base font-bold text-slate-950 dark:text-slate-50">
                  {formatPrice(variation.price)}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:bg-slate-950/70 dark:shadow-none">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Stock
                </p>
                <p className="mt-2 text-base font-bold text-slate-950 dark:text-slate-50">
                  {variation.stock}
                </p>
              </div>
            </div>

            {isExpanded ? (
              <VariationQuickEditPanel
                currency={currency}
                draft={draft}
                onPriceChange={(value) =>
                  updateQuickDraft(variation.id, 'price', value)
                }
                onReset={() => resetQuickDraft(variation)}
                onSave={() => handleQuickSave(variation)}
                onStockChange={(value) =>
                  updateQuickDraft(variation.id, 'stock', value)
                }
                saving={savingVariationId === variation.id}
                state={quickEditState}
                variationName={variation.name}
              />
            ) : null}
          </div>
        </div>

        <div className="flex gap-3 lg:w-auto lg:flex-col lg:items-end">
          <button
            type="button"
            onClick={() => handleQuickEditToggle(variation.id)}
            aria-label={`${isExpanded ? 'Close quick edit for' : 'Open quick edit for'} ${variation.name}`}
            aria-expanded={isExpanded}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16.862 4.487a2.1 2.1 0 113.03 2.902L9.91 17.37 6 18l.63-3.91 10.232-9.603z"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => handleDeleteClick(variation)}
            aria-label={`Delete ${variation.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M6 7h12m-9 0V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7m-7.5 0l.75 11.25A1.5 1.5 0 009.75 19.5h4.5a1.5 1.5 0 001.5-1.25L16.5 7m-6 3v5m3-5v5"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VariationList({
  productId,
  productPrice: _productPrice,
  initialVariations,
}: VariationListProps) {
  const [variations, setVariations] =
    useState<ProductVariation[]>(initialVariations)
  const { currency, formatPrice, rates } = useCurrency()
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingVariation, setEditingVariation] = useState<
    ProductVariation | undefined
  >(undefined)
  const [deleteTarget, setDeleteTarget] = useState<ProductVariation | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)
  const [quickEdits, setQuickEdits] = useState<Record<string, QuickEditDraft>>(
    {}
  )
  const [savingVariationId, setSavingVariationId] = useState<string | null>(
    null
  )
  const [expandedVariationId, setExpandedVariationId] = useState<string | null>(
    null
  )

  // Separate styles and colours
  const styleVariations = variations.filter(
    (v) => v.variationType === 'styling'
  )
  const colourVariations = variations.filter(
    (v) => v.variationType === 'colour'
  )
  const baseProductColours = colourVariations.filter((c) => !c.styleId)
  const coloursByStyleId = new Map<string, ProductVariation[]>()
  for (const colour of colourVariations) {
    if (colour.styleId) {
      const existing = coloursByStyleId.get(colour.styleId) ?? []
      existing.push(colour)
      coloursByStyleId.set(colour.styleId, existing)
    }
  }

  // Only count colours for stock stats (styles are groupings)
  const totalVariationStock = colourVariations.reduce(
    (sum, variation) => sum + variation.stock,
    0
  )
  const stockedVariations = colourVariations.filter(
    (variation) => variation.stock > 0
  ).length

  const handleAddClick = () => {
    setEditingVariation(undefined)
    setShowFormModal(true)
  }

  const handleQuickEditToggle = (variationId: string) => {
    setExpandedVariationId((currentId) =>
      currentId === variationId ? null : variationId
    )
  }

  const handleFormClose = () => {
    setShowFormModal(false)
    setEditingVariation(undefined)
  }

  const handleFormSuccess = (saved: ProductVariation) => {
    setVariations((prev) => {
      const idx = prev.findIndex((v) => v.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      return [...prev, saved]
    })
    setShowFormModal(false)
    setEditingVariation(undefined)
  }

  const handleDeleteClick = (variation: ProductVariation) => {
    setDeleteTarget(variation)
  }

  const getDefaultDraft = (variation: ProductVariation): QuickEditDraft => ({
    price: convertCurrency(
      variation.price,
      rates.INR,
      rates[currency]
    ).toString(),
    stock: variation.stock.toString(),
  })

  const getDraft = (variation: ProductVariation) =>
    quickEdits[variation.id] ?? getDefaultDraft(variation)

  const updateQuickDraft = (
    variationId: string,
    field: keyof QuickEditDraft,
    value: string
  ) => {
    setQuickEdits((prev) => ({
      ...prev,
      [variationId]: {
        ...(prev[variationId] ?? { price: '', stock: '' }),
        [field]: value,
      },
    }))
  }

  const resetQuickDraft = (variation: ProductVariation) => {
    setQuickEdits((prev) => {
      const next = { ...prev }
      delete next[variation.id]
      return next
    })
  }

  const handleQuickSave = async (variation: ProductVariation) => {
    const draft = getDraft(variation)
    const priceValue = Number.parseFloat(draft.price)
    const stockValue = Number.parseInt(draft.stock, 10)

    if (Number.isNaN(priceValue) || priceValue <= 0) {
      toast.error('Price must be a positive number')
      return
    }

    if (!Number.isInteger(stockValue) || stockValue < 0) {
      toast.error('Stock must be a non-negative integer')
      return
    }

    const priceInInr = convertCurrency(priceValue, rates[currency], rates.INR)

    if (priceInInr <= 0) {
      toast.error('Price must be greater than zero')
      return
    }

    setSavingVariationId(variation.id)

    try {
      const res = await fetch(`/api/admin/variations/${variation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: priceInInr,
          stock: stockValue,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update variation')
      }

      handleFormSuccess(data.data.variation)
      toast.success('Variation updated')
      resetQuickDraft(variation)
      setExpandedVariationId(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update variation'
      )
    } finally {
      setSavingVariationId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/variations/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete variation')
      }
      setVariations((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      // Toast is optional here — error is visible via alert or could be added later
    } finally {
      setDeleting(false)
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={handleAddClick}
      className="inline-flex items-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Add Variation
    </button>
  )

  const modalFallback = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm dark:bg-slate-950/70">
      <div className="rounded-3xl border border-white/60 bg-white p-8 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.6)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_30px_80px_-38px_rgba(2,6,23,0.9)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      </div>
    </div>
  )

  if (variations.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] dark:border-slate-700/70 dark:bg-slate-900/88 dark:shadow-[0_24px_60px_-42px_rgba(2,6,23,0.92)]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-amber-700">
              Variation management
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
              Variations
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Add sellable options here so pricing, stock, and imagery can be
              updated without leaving the product editing workspace.
            </p>
          </div>
          {addButton}
        </div>
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-none">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <h3 className="mb-1 text-lg font-medium text-slate-950 dark:text-slate-50">
            No variations yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add a variation to offer different colors, designs, or options for
            this product.
          </p>
        </div>
        {showFormModal && (
          <Suspense fallback={modalFallback}>
            <VariationFormModal
              productId={productId}
              variation={editingVariation}
              styles={styleVariations}
              onClose={handleFormClose}
              onSuccess={handleFormSuccess}
            />
          </Suspense>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] dark:border-slate-700/70 dark:bg-slate-900/88 dark:shadow-[0_24px_60px_-42px_rgba(2,6,23,0.92)]">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-amber-700">
            Variation management
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Variations ({variations.length})
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Review variation pricing, stock, imagery, and design naming in one
            queue, then open the editor only for the row you need to change.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800/90">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Total stock
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-slate-50">
              {totalVariationStock}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              In stock
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-slate-50">
              {stockedVariations}
            </p>
          </div>
          {addButton}
        </div>
      </div>

      <div className="space-y-6">
        {/* Base product colours (colours without a parent style) */}
        {baseProductColours.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
              <span className="text-lg">🏠</span>
              <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Base Product Colours
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {baseProductColours.length}
              </span>
            </div>
            <div className="space-y-3 pl-4">
              {baseProductColours.map((colour) => (
                <ColourCard
                  key={colour.id}
                  variation={colour}
                  currency={currency}
                  draft={getDraft(colour)}
                  expandedVariationId={expandedVariationId}
                  formatPrice={formatPrice}
                  getDefaultDraft={getDefaultDraft}
                  handleDeleteClick={handleDeleteClick}
                  handleQuickEditToggle={handleQuickEditToggle}
                  handleQuickSave={handleQuickSave}
                  rates={rates}
                  resetQuickDraft={resetQuickDraft}
                  savingVariationId={savingVariationId}
                  updateQuickDraft={updateQuickDraft}
                />
              ))}
            </div>
          </div>
        )}

        {/* Named styles with their colours */}
        {styleVariations.map((style) => {
          const styleColours = coloursByStyleId.get(style.id) ?? []
          return (
            <div key={style.id} className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎨</span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                      {style.name}
                    </h3>
                    {style.designName && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {style.designName}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {styleColours.length} colour
                    {styleColours.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVariation(style)
                      setShowFormModal(true)
                    }}
                    aria-label={`Edit style ${style.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M16.862 4.487a2.1 2.1 0 113.03 2.902L9.91 17.37 6 18l.63-3.91 10.232-9.603z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(style)}
                    aria-label={`Delete style ${style.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M6 7h12m-9 0V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7m-7.5 0l.75 11.25A1.5 1.5 0 009.75 19.5h4.5a1.5 1.5 0 001.5-1.25L16.5 7m-6 3v5m3-5v5"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {styleColours.length > 0 ? (
                <div className="space-y-3 pl-6">
                  {styleColours.map((colour) => (
                    <ColourCard
                      key={colour.id}
                      variation={colour}
                      currency={currency}
                      draft={getDraft(colour)}
                      expandedVariationId={expandedVariationId}
                      formatPrice={formatPrice}
                      getDefaultDraft={getDefaultDraft}
                      handleDeleteClick={handleDeleteClick}
                      handleQuickEditToggle={handleQuickEditToggle}
                      handleQuickSave={handleQuickSave}
                      rates={rates}
                      resetQuickDraft={resetQuickDraft}
                      savingVariationId={savingVariationId}
                      updateQuickDraft={updateQuickDraft}
                    />
                  ))}
                </div>
              ) : (
                <div className="ml-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                  No colours added to this style yet
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showFormModal && (
        <Suspense fallback={modalFallback}>
          <VariationFormModal
            productId={productId}
            variation={editingVariation}
            styles={styleVariations}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        </Suspense>
      )}

      {deleteTarget && (
        <Suspense fallback={modalFallback}>
          <DeleteConfirmModal
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleting}
          />
        </Suspense>
      )}
    </section>
  )
}
