'use client'

import { useState, useMemo } from 'react'
import type { ProductOption, ProductVariant } from '@/lib/types'
import toast from 'react-hot-toast'

/* ── Shared class-name constants (theme-aware via CSS custom properties) ── */

const SECTION_CARD =
  'rounded-[1.75rem] border border-[var(--border-warm)] bg-[var(--surface)] p-6 shadow-warm'

const INPUT_BASE =
  'w-full rounded-lg border border-[var(--border-warm)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent transition-colors'

const OPTION_CARD =
  'rounded-2xl border border-[var(--border-warm)] bg-[var(--accent-cream)] p-4'

const LABEL_SM = 'mb-1 block text-xs font-semibold text-[var(--text-muted)]'

const PILL =
  'inline-flex items-center rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border-warm)]'

const DELETE_BUTTON =
  'inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50'

const PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[var(--btn-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--btn-primary-hover)] disabled:opacity-50'

const DASHED_BOX =
  'rounded-2xl border border-dashed border-[var(--border-warm)] bg-[var(--accent-cream)]/80 p-5'

interface OptionManagerProps {
  readonly productId: string
  readonly initialOptions: ProductOption[]
  readonly variants: ProductVariant[]
}

export default function OptionManager({
  productId,
  initialOptions,
  variants,
}: OptionManagerProps) {
  const [options, setOptions] = useState<ProductOption[]>(initialOptions)
  const [optionNames, setOptionNames] = useState('')
  const [delimiter, setDelimiter] = useState('-')
  const [generating, setGenerating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Live preview: parse variant SKUs with the current option names + delimiter
  const skuPreview = useMemo(() => {
    const names = optionNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length === 0 || variants.length === 0) return null

    const rows: { sku: string; segments: string[]; valid: boolean }[] = []
    for (const v of variants) {
      if (!v.sku) {
        rows.push({ sku: v.id, segments: [], valid: false })
        continue
      }
      const segments = v.sku.split(delimiter).map((s) => s.trim())
      rows.push({
        sku: v.sku,
        segments,
        valid: segments.length === names.length,
      })
    }
    return { names, rows }
  }, [optionNames, delimiter, variants])

  const handleGenerate = async () => {
    const names = optionNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)

    if (names.length === 0) {
      toast.error('Enter at least one option name (e.g. Color, Size)')
      return
    }

    if (variants.length === 0) {
      toast.error('Create variants with SKUs first, then generate options')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/options/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionNames: names, delimiter }),
        }
      )

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String(data.error)
            : 'Failed to generate options'
        )
      }

      setOptions(data.data.options)
      toast.success(
        `Generated ${data.data.options.length} options from ${data.data.variantsLinked} variants`
      )
      setOptionNames('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteOption = async (optionId: string) => {
    setDeletingId(optionId)
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/options/${optionId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String(data.error)
            : 'Failed to delete option'
        )
      }
      setOptions((prev) => prev.filter((o) => o.id !== optionId))
      toast.success('Option deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={SECTION_CARD}>
      <div className="mb-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--accent-sage)]">
          Option dimensions
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--foreground)]">
          Product Options
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Define option dimensions (Color, Size, Material) so customers can
          choose each attribute separately. Options are generated automatically
          from variant SKUs.
        </p>
      </div>

      {/* Current options */}
      {options.length > 0 && (
        <div className="mb-6 space-y-3">
          {options.map((option) => (
            <div key={option.id} className={OPTION_CARD}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {option.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {option.values.map((val) => (
                      <span key={val.id} className={PILL}>
                        {val.value}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteOption(option.id)}
                  disabled={deletingId === option.id}
                  className={DELETE_BUTTON}
                  aria-label={`Delete ${option.name} option`}
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
          ))}
        </div>
      )}

      {/* Generate from SKUs */}
      <div className={DASHED_BOX}>
        <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
          Generate from variant SKUs
        </p>
        <p className="mb-4 text-xs leading-5 text-[var(--text-muted)]">
          If your variant SKUs follow a pattern like{' '}
          <code className="rounded bg-[var(--accent-cream)] px-1.5 py-0.5 text-[var(--foreground)]">
            Red-XL
          </code>{' '}
          or{' '}
          <code className="rounded bg-[var(--accent-cream)] px-1.5 py-0.5 text-[var(--foreground)]">
            Cotton-Blue-L
          </code>
          , enter the option names in the same order, separated by commas.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="option-names" className={LABEL_SM}>
              Option Names (comma-separated)
            </label>
            <input
              id="option-names"
              type="text"
              value={optionNames}
              onChange={(e) => setOptionNames(e.target.value)}
              placeholder="e.g. Color, Size"
              className={INPUT_BASE}
            />
          </div>
          <div className="w-20">
            <label htmlFor="option-delimiter" className={LABEL_SM}>
              Delimiter
            </label>
            <input
              id="option-delimiter"
              type="text"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              minLength={1}
              maxLength={5}
              aria-invalid={!delimiter.trim()}
              aria-describedby={
                !delimiter.trim() ? 'option-delimiter-error' : undefined
              }
              className={`${INPUT_BASE} text-center`}
            />
            {!delimiter.trim() && (
              <p
                id="option-delimiter-error"
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                Delimiter is required
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !optionNames.trim() || !delimiter.trim()}
            className={PRIMARY_BUTTON}
          >
            {generating ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                Generating…
              </>
            ) : (
              'Generate Options'
            )}
          </button>
        </div>

        {/* Live SKU preview */}
        {skuPreview && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-warm)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-warm)] bg-[var(--accent-cream)]">
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                    SKU
                  </th>
                  {skuPreview.names.map((name, i) => (
                    <th
                      key={`header-${name}-${i}`}
                      className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)]"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuPreview.rows.map((row) => (
                  <tr
                    key={row.sku}
                    className={
                      row.valid
                        ? 'border-b border-[var(--border-warm)]'
                        : 'border-b border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30'
                    }
                  >
                    <td className="px-3 py-1.5 font-mono text-[var(--foreground)]">
                      {row.sku}
                    </td>
                    {row.valid ? (
                      row.segments.map((seg, i) => (
                        <td
                          key={`${row.sku}-${i}-${seg}`}
                          className="px-3 py-1.5 text-[var(--foreground)]"
                        >
                          <span className="inline-flex rounded-full bg-[var(--accent-cream)] px-2 py-0.5 text-[var(--foreground)]">
                            {seg}
                          </span>
                        </td>
                      ))
                    ) : (
                      <td
                        colSpan={skuPreview.names.length}
                        className="px-3 py-1.5 text-rose-600 dark:text-rose-400"
                      >
                        {row.segments.length === 0
                          ? 'No SKU'
                          : `Splits into ${row.segments.length} parts (expected ${skuPreview.names.length})`}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {variants.length === 0 && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            No variants found. Create variants with SKUs first.
          </p>
        )}
      </div>
    </section>
  )
}
