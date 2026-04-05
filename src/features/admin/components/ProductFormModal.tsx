'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { type Product } from '@/lib/types'
import {
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from '@/lib/upload-constants'
import { CURRENCIES, type CurrencyCode } from '@/contexts/CurrencyContext'
import useProductForm, {
  MAX_IMAGES,
} from '@/features/admin/hooks/useProductForm'
import { TextInput, TextArea, NumberInput, SelectInput, FileInput } from 'zenput'

interface ProductFormModalProps {
  readonly editingProduct: Product | null
  readonly onClose: () => void
  readonly onSuccess: (product: Product) => void
  readonly layout?: 'modal' | 'page'
}

interface AdditionalImageRowProps {
  readonly idx: number
  readonly imgUrl: string
  readonly pendingFile: File | null
  readonly onFileChange: (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void
  readonly onRemove: (idx: number) => void
}

const PendingFileNotice = ({ fileName }: { readonly fileName: string }) => (
  <p className="text-xs text-green-600 mt-1">Selected: {fileName}</p>
)

const AdditionalImageRow = ({
  idx,
  imgUrl,
  pendingFile,
  onFileChange,
  onRemove,
}: AdditionalImageRowProps) => {
  const showCurrent = Boolean(imgUrl) && pendingFile === null
  const labelText = `Image ${idx + 2}${showCurrent ? ' (current)' : ''}`
  return (
    <div className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
      {showCurrent && (
        <div className="relative flex-shrink-0 w-14 h-14">
          <Image
            src={imgUrl}
            alt={`Additional image ${idx + 1}`}
            fill
            sizes="56px"
            className="object-contain rounded border bg-white dark:bg-gray-800"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <label
          htmlFor={`additional-image-${idx}`}
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
        >
          {labelText}
        </label>
        <input
          id={`additional-image-${idx}`}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          onChange={(e) => onFileChange(idx, e)}
          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {pendingFile && <PendingFileNotice fileName={pendingFile.name} />}
      </div>
      <button
        type="button"
        onClick={() => onRemove(idx)}
        aria-label={`Remove image ${idx + 2}`}
        className="flex-shrink-0 text-red-400 hover:text-red-600 transition mt-1"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}

const ProductFormModal = ({
  editingProduct,
  onClose,
  onSuccess,
  layout = 'modal',
}: ProductFormModalProps) => {
  const {
    formData,
    setFormData,
    imageFile,
    additionalFiles,
    slotIds,
    uploading,
    saving,
    fieldErrors,
    categoryList,
    priceCurrency,
    availableCurrencies,
    totalImages,
    submitButtonText,
    clearFieldError,
    handlePriceCurrencyChange,
    handleImageChange,
    handleAdditionalImageChange,
    addImageSlot,
    removeAdditionalImage,
    handleSubmit,
  } = useProductForm(editingProduct, onClose, onSuccess)
  const isPageLayout = layout === 'page'

  const currencyOptions = useMemo(
    () =>
      availableCurrencies.map((code) => ({
        value: code,
        label: `${code} (${CURRENCIES[code].symbol})`,
      })),
    [availableCurrencies]
  )

  const formBody = (
    <>
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        {editingProduct ? 'Edit Product' : 'Add Product'}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <TextInput
              label="Name"
              fullWidth
              required
              maxLength={200}
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                clearFieldError('name')
              }}
              validationState={fieldErrors.name ? 'error' as const : 'default' as const}
              errorMessage={fieldErrors.name}
            />

          <TextArea
              label="Description"
              fullWidth
              required
              autoResize
              showCharCount
              maxLength={2000}
              rows={4}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                clearFieldError('description')
              }}
              validationState={fieldErrors.description ? 'error' as const : 'default' as const}
              errorMessage={fieldErrors.description}
            />

          <div className="flex gap-2">
              <SelectInput
                label="Currency"
                options={currencyOptions}
                value={priceCurrency}
                onChange={(e) => handlePriceCurrencyChange(e.target.value as CurrencyCode)}
              />
              <NumberInput
                label="Price"
                min={0.01}
                step={0.01}
                required
                fullWidth
                value={formData.price}
                onChange={(v) => {
                  setFormData({ ...formData, price: v ?? 0 })
                  clearFieldError('price')
                }}
                validationState={fieldErrors.price ? 'error' as const : 'default' as const}
                errorMessage={fieldErrors.price}
              />
            </div>

            <NumberInput
              label="Stock"
              min={0}
              step={1}
              required
              fullWidth
              value={formData.stock}
              onChange={(v) => {
                setFormData({ ...formData, stock: v ?? 0 })
                clearFieldError('stock')
              }}
              validationState={fieldErrors.stock ? 'error' as const : 'default' as const}
              errorMessage={fieldErrors.stock}
            />

          <SelectInput
              label="Category"
              options={categoryList.map((cat) => ({ value: cat, label: cat }))}
              placeholder="Select a category"
              required
              fullWidth
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value })
                clearFieldError('category')
              }}
              validationState={fieldErrors.category ? 'error' as const : 'default' as const}
              errorMessage={fieldErrors.category}
            />

          {/* Primary Image */}
          <div>
            {formData.image && !imageFile && (
              <div className="mb-2 relative w-20 h-20">
                <Image
                  src={formData.image}
                  alt="Current product"
                  fill
                  sizes="80px"
                  className="object-contain rounded border bg-gray-50 dark:bg-gray-700"
                />
              </div>
            )}
            <FileInput
              label="Primary Image (required)"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              fullWidth
              showFileNames
              dropzone
              onChange={handleImageChange}
              validationState={fieldErrors.image ? 'error' as const : 'default' as const}
              errorMessage={fieldErrors.image}
              helperText={
                editingProduct
                  ? `Leave empty to keep current image. Max ${MAX_FILE_SIZE / 1024 / 1024}MB. Formats: ${VALID_IMAGE_TYPES_DISPLAY}`
                  : `Required. Max ${MAX_FILE_SIZE / 1024 / 1024}MB. Formats: ${VALID_IMAGE_TYPES_DISPLAY}`
              }
            />
          </div>

          {/* Additional Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Additional Images{' '}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  ({formData.images.length}/{MAX_IMAGES - 1} extra,{' '}
                  {totalImages}/{MAX_IMAGES} total)
                </span>
              </label>
              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={addImageSlot}
                  className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                >
                  + Add Image
                </button>
              )}
            </div>

            {formData.images.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                No additional images. Click &ldquo;+ Add Image&rdquo; to add up
                to {MAX_IMAGES - 1} more images.
              </p>
            )}

            <div className="space-y-3">
              {formData.images.map((imgUrl, idx) => (
                <AdditionalImageRow
                  key={slotIds[idx] ?? `slot-${idx}`}
                  idx={idx}
                  imgUrl={imgUrl}
                  pendingFile={additionalFiles[idx] ?? null}
                  onFileChange={handleAdditionalImageChange}
                  onRemove={removeAdditionalImage}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {submitButtonText}
          </button>
        </div>
      </form>
    </>
  )

  if (isPageLayout) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        {formBody}
      </section>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">{formBody}</div>
      </div>
    </div>
  )
}

export default ProductFormModal
