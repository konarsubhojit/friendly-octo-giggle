'use client'

import { useState, lazy, Suspense } from 'react'
import Image from 'next/image'
import type { ProductVariant } from '@/lib/types'
import toast from 'react-hot-toast'
import { useCurrency } from '@/contexts/CurrencyContext'
import { getVariantTotalStock } from '@/features/product/variant-utils'

const VariantFormModal = lazy(
  () => import('@/features/admin/components/VariantFormModal')
)
const DeleteConfirmModal = lazy(
  () => import('@/features/admin/components/DeleteConfirmModal')
)

interface VariantListProps {
  readonly productId: string
  readonly initialVariants: ProductVariant[]
}

interface QuickEditDraft {
  price: string
  stock: string
}

interface QuickEditUiState {
  readonly hasDraftChanges: boolean
  readonly hasValidPrice: boolean
  readonly isQuickSaveDisabled: boolean
}

const convertCurrency = (
  amount: number,
  fromRate: number,
  toRate: number
): number => {
  if (fromRate <= 0 || toRate <= 0) return amount
  return Number(((amount / fromRate) * toRate).toFixed(2))
}

interface QuickEditPanelProps {
  readonly draft: QuickEditDraft
  readonly saving: boolean
  readonly variantSku: string | null
  readonly onPriceChange: (value: string) => void
  readonly onStockChange: (value: string) => void
  readonly onSave: () => void
  readonly onReset: () => void
  readonly ui: QuickEditUiState
}

const QuickEditPanel = ({
  draft,
  saving,
  variantSku,
  onPriceChange,
  onStockChange,
  onSave,
  onReset,
  ui,
}: QuickEditPanelProps) => {
  const priceId = `quick-edit-price-${variantSku ?? 'variant'}`
  const stockId = `quick-edit-stock-${variantSku ?? 'variant'}`

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[100px]">
          <label
            htmlFor={priceId}
            className="mb-1 block text-xs font-semibold text-slate-500"
          >
            Price
          </label>
          <input
            id={priceId}
            type="number"
            step="0.01"
            min="0"
            value={draft.price}
            onChange={(e) => onPriceChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
            aria-label={`Price for ${variantSku ?? 'variant'}`}
          />
        </div>
        <div className="flex-1 min-w-[100px]">
          <label
            htmlFor={stockId}
            className="mb-1 block text-xs font-semibold text-slate-500"
          >
            Stock
          </label>
          <input
            id={stockId}
            type="number"
            step="1"
            min="0"
            value={draft.stock}
            onChange={(e) => onStockChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
            aria-label={`Stock for ${variantSku ?? 'variant'}`}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={ui.isQuickSaveDisabled}
          onClick={onSave}
          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {ui.hasDraftChanges && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

interface VariantCardProps {
  readonly variant: ProductVariant
  readonly currency: string
  readonly draft: QuickEditDraft
  readonly expandedVariantId: string | null
  readonly formatPrice: (amount: number) => string
  readonly getDefaultDraft: (variant: ProductVariant) => QuickEditDraft
  readonly handleDeleteClick: (variant: ProductVariant) => void
  readonly handleQuickEditToggle: (variantId: string) => void
  readonly handleQuickSave: (variant: ProductVariant) => void
  readonly rates: Record<string, number>
  readonly resetQuickDraft: (variant: ProductVariant) => void
  readonly savingVariantId: string | null
  readonly updateQuickDraft: (
    variantId: string,
    field: keyof QuickEditDraft,
    value: string
  ) => void
}

const VariantCard = ({
  variant,
  currency,
  draft,
  expandedVariantId,
  formatPrice,
  getDefaultDraft,
  handleDeleteClick,
  handleQuickEditToggle,
  handleQuickSave,
  rates,
  resetQuickDraft,
  savingVariantId,
  updateQuickDraft,
}: VariantCardProps) => {
  const isExpanded = expandedVariantId === variant.id
  const defaultDraft = getDefaultDraft(variant)

  const ui: QuickEditUiState = {
    hasDraftChanges:
      draft.price !== defaultDraft.price || draft.stock !== defaultDraft.stock,
    hasValidPrice:
      !Number.isNaN(Number.parseFloat(draft.price)) &&
      Number.parseFloat(draft.price) > 0,
    isQuickSaveDisabled:
      savingVariantId === variant.id ||
      (draft.price === defaultDraft.price &&
        draft.stock === defaultDraft.stock),
  }

  const displayLabel = variant.sku ?? variant.id

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-start gap-4">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          {variant.image ? (
            <Image
              src={variant.image}
              alt={displayLabel}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-lg">
              📦
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                {displayLabel}
              </p>
              {variant.optionValues && variant.optionValues.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {variant.optionValues.map((ov) => ov.value).join(' / ')}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                Updated{' '}
                {new Date(variant.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-950 dark:text-slate-50">
                {formatPrice(
                  convertCurrency(variant.price, rates.INR, rates[currency])
                )}
              </p>
              <p className="text-xs text-slate-500">{variant.stock} in stock</p>
            </div>
          </div>

          {isExpanded && (
            <QuickEditPanel
              draft={draft}
              saving={savingVariantId === variant.id}
              variantSku={displayLabel}
              onPriceChange={(value) =>
                updateQuickDraft(variant.id, 'price', value)
              }
              onStockChange={(value) =>
                updateQuickDraft(variant.id, 'stock', value)
              }
              onSave={() => handleQuickSave(variant)}
              onReset={() => resetQuickDraft(variant)}
              ui={ui}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickEditToggle(variant.id)}
            aria-label={`${isExpanded ? 'Close quick edit for' : 'Open quick edit for'} ${displayLabel}`}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
              isExpanded
                ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-400'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
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
            onClick={() => handleDeleteClick(variant)}
            aria-label={`Delete ${displayLabel}`}
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
    </div>
  )
}

export default function VariantList({
  productId,
  initialVariants,
}: VariantListProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants)
  const { currency, formatPrice, rates } = useCurrency()
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingVariant, setEditingVariant] = useState<
    ProductVariant | undefined
  >(undefined)
  const [deleteTarget, setDeleteTarget] = useState<ProductVariant | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [quickEdits, setQuickEdits] = useState<Record<string, QuickEditDraft>>(
    {}
  )
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null)
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(
    null
  )

  const totalVariantStock = getVariantTotalStock(variants)
  const stockedVariants = variants.filter((variant) => variant.stock > 0).length

  const handleAddClick = () => {
    setEditingVariant(undefined)
    setShowFormModal(true)
  }

  const handleQuickEditToggle = (variantId: string) => {
    setExpandedVariantId((currentId) =>
      currentId === variantId ? null : variantId
    )
  }

  const handleFormClose = () => {
    setShowFormModal(false)
    setEditingVariant(undefined)
  }

  const handleFormSuccess = (saved: ProductVariant) => {
    setVariants((prev) => {
      const idx = prev.findIndex((v) => v.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      return [...prev, saved]
    })
    setShowFormModal(false)
    setEditingVariant(undefined)
  }

  const handleDeleteClick = (variant: ProductVariant) => {
    setDeleteTarget(variant)
  }

  const getDefaultDraft = (variant: ProductVariant): QuickEditDraft => ({
    price: convertCurrency(
      variant.price,
      rates.INR,
      rates[currency]
    ).toString(),
    stock: variant.stock.toString(),
  })

  const getDraft = (variant: ProductVariant) =>
    quickEdits[variant.id] ?? getDefaultDraft(variant)

  const updateQuickDraft = (
    variantId: string,
    field: keyof QuickEditDraft,
    value: string
  ) => {
    setQuickEdits((prev) => ({
      ...prev,
      [variantId]: {
        ...(prev[variantId] ?? { price: '', stock: '' }),
        [field]: value,
      },
    }))
  }

  const resetQuickDraft = (variant: ProductVariant) => {
    setQuickEdits((prev) => {
      const next = { ...prev }
      delete next[variant.id]
      return next
    })
  }

  const handleQuickSave = async (variant: ProductVariant) => {
    const draft = getDraft(variant)
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

    setSavingVariantId(variant.id)

    try {
      const res = await fetch(`/api/admin/variants/${variant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: priceInInr,
          stock: stockValue,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update variant')
      }

      handleFormSuccess(data.data.variant)
      toast.success('Variant updated')
      resetQuickDraft(variant)
      setExpandedVariantId(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update variant'
      )
    } finally {
      setSavingVariantId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/variants/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete variant')
      }
      setVariants((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete variant'
      toast.error(message)
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
      Add Variant
    </button>
  )

  const modalFallback = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm dark:bg-slate-950/70">
      <div className="rounded-3xl border border-white/60 bg-white p-8 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.6)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_30px_80px_-38px_rgba(2,6,23,0.9)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      </div>
    </div>
  )

  if (variants.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] dark:border-slate-700/70 dark:bg-slate-900/88 dark:shadow-[0_24px_60px_-42px_rgba(2,6,23,0.92)]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-amber-700">
              Variant management
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
              Variants
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Add sellable variants here so pricing, stock, and imagery can be
              managed per combination.
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
            No variants yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add a variant to define purchasable options with pricing and stock.
          </p>
        </div>
        {showFormModal && (
          <Suspense fallback={modalFallback}>
            <VariantFormModal
              productId={productId}
              variant={editingVariant}
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
            Variant management
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Variants ({variants.length})
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Review variant pricing, stock, and imagery. Use quick edit to update
            price and stock inline.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800/90">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Total stock
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-slate-50">
              {totalVariantStock}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              In stock
            </p>
            <p className="mt-2 text-lg font-bold text-slate-950 dark:text-slate-50">
              {stockedVariants}
            </p>
          </div>
          {addButton}
        </div>
      </div>

      <div className="space-y-3">
        {variants.map((variant) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            currency={currency}
            draft={getDraft(variant)}
            expandedVariantId={expandedVariantId}
            formatPrice={formatPrice}
            getDefaultDraft={getDefaultDraft}
            handleDeleteClick={handleDeleteClick}
            handleQuickEditToggle={handleQuickEditToggle}
            handleQuickSave={handleQuickSave}
            rates={rates}
            resetQuickDraft={resetQuickDraft}
            savingVariantId={savingVariantId}
            updateQuickDraft={updateQuickDraft}
          />
        ))}
      </div>

      {showFormModal && (
        <Suspense fallback={modalFallback}>
          <VariantFormModal
            productId={productId}
            variant={editingVariant}
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
