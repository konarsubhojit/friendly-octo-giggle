"use client";

import Image from "next/image";
import { type Product } from "@/lib/types";
import {
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from "@/lib/upload-constants";
import { CURRENCIES, type CurrencyCode } from "@/contexts/CurrencyContext";
import useProductForm, { MAX_IMAGES } from "./useProductForm";

interface ProductFormModalProps {
  readonly editingProduct: Product | null;
  readonly onClose: () => void;
  readonly onSuccess: (product: Product) => void;
  readonly layout?: "modal" | "page";
}

interface AdditionalImageRowProps {
  readonly idx: number;
  readonly imgUrl: string;
  readonly pendingFile: File | null;
  readonly onFileChange: (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  readonly onRemove: (idx: number) => void;
}

const PendingFileNotice = ({ fileName }: { readonly fileName: string }) => (
  <p className="text-xs text-green-600 mt-1">Selected: {fileName}</p>
);

const AdditionalImageRow = ({
  idx,
  imgUrl,
  pendingFile,
  onFileChange,
  onRemove,
}: AdditionalImageRowProps) => {
  const showCurrent = Boolean(imgUrl) && pendingFile === null;
  const labelText = `Image ${idx + 2}${showCurrent ? " (current)" : ""}`;
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
  );
};

interface PriceFieldProps {
  readonly priceCurrency: CurrencyCode;
  readonly priceValue: number;
  readonly error?: string;
  readonly availableCurrencies: CurrencyCode[];
  readonly onCurrencyChange: (code: CurrencyCode) => void;
  readonly onPriceChange: (value: number) => void;
}

const PriceField = ({
  priceCurrency,
  priceValue,
  error,
  availableCurrencies,
  onCurrencyChange,
  onPriceChange,
}: PriceFieldProps) => (
  <div>
    <label
      htmlFor="product-price"
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
    >
      Price
    </label>
    <div className="flex gap-2">
      <select
        id="product-price-currency"
        value={priceCurrency}
        onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
        aria-label="Price currency"
        className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        {availableCurrencies.map((code) => (
          <option key={code} value={code}>
            {code} ({CURRENCIES[code].symbol})
          </option>
        ))}
      </select>
      <input
        id="product-price"
        type="number"
        value={priceValue}
        onChange={(e) => {
          const value = Number.parseFloat(e.target.value);
          if (!Number.isNaN(value)) onPriceChange(value);
        }}
        required
        min="0.01"
        step="0.01"
        aria-describedby={error ? "product-price-error" : undefined}
        className={`flex-1 min-w-0 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${error ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
      />
    </div>
    {error && (
      <p id="product-price-error" className="text-xs text-red-600 mt-1">
        {error}
      </p>
    )}
  </div>
);

const ProductFormModal = ({
  editingProduct,
  onClose,
  onSuccess,
  layout = "modal",
}: ProductFormModalProps) => {
  const {
    formData,
    setFormData,
    stockInput,
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
    handleStockChange,
    handleSubmit,
  } = useProductForm(editingProduct, onClose, onSuccess);
  const isPageLayout = layout === "page";

  const formBody = (
    <>
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        {editingProduct ? "Edit Product" : "Add Product"}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="product-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name
            </label>
            <input
              id="product-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                clearFieldError("name");
              }}
              required
              maxLength={200}
              aria-describedby={
                fieldErrors.name ? "product-name-error" : undefined
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${fieldErrors.name ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {fieldErrors.name && (
              <p id="product-name-error" className="text-xs text-red-600 mt-1">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="product-description"
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                clearFieldError("description");
              }}
              required
              maxLength={2000}
              rows={4}
              aria-describedby={
                fieldErrors.description
                  ? "product-description-error"
                  : undefined
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${fieldErrors.description ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            {fieldErrors.description && (
              <p
                id="product-description-error"
                className="text-xs text-red-600 mt-1"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PriceField
              priceCurrency={priceCurrency}
              priceValue={formData.price}
              error={fieldErrors.price}
              availableCurrencies={availableCurrencies}
              onCurrencyChange={handlePriceCurrencyChange}
              onPriceChange={(value) => {
                setFormData({ ...formData, price: value });
                clearFieldError("price");
              }}
            />

            <div>
              <label
                htmlFor="product-stock"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Stock
              </label>
              <input
                id="product-stock"
                type="number"
                value={stockInput}
                onChange={handleStockChange}
                required
                min="0"
                step="1"
                aria-describedby={
                  fieldErrors.stock ? "product-stock-error" : undefined
                }
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${fieldErrors.stock ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
              />
              {fieldErrors.stock && (
                <p
                  id="product-stock-error"
                  className="text-xs text-red-600 mt-1"
                >
                  {fieldErrors.stock}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="product-category"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Category
            </label>
            <select
              id="product-category"
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value });
                clearFieldError("category");
              }}
              required
              aria-describedby={
                fieldErrors.category ? "product-category-error" : undefined
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${fieldErrors.category ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="">Select a category</option>
              {categoryList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {fieldErrors.category && (
              <p
                id="product-category-error"
                className="text-xs text-red-600 mt-1"
              >
                {fieldErrors.category}
              </p>
            )}
          </div>

          {/* Primary Image */}
          <div>
            <label
              htmlFor="product-image"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Primary Image{" "}
              <span className="text-gray-400 dark:text-gray-500 font-normal">
                (required)
              </span>
            </label>
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
            <input
              id="product-image"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              aria-describedby={
                fieldErrors.image ? "product-image-error" : undefined
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-300 dark:bg-gray-700 ${fieldErrors.image ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {editingProduct
                ? "Leave empty to keep current image. "
                : "Required. "}
              Max {MAX_FILE_SIZE / 1024 / 1024}MB. Formats:{" "}
              {VALID_IMAGE_TYPES_DISPLAY}
            </p>
            {fieldErrors.image && (
              <p id="product-image-error" className="text-xs text-red-600 mt-1">
                {fieldErrors.image}
              </p>
            )}
            {imageFile && !fieldErrors.image && (
              <p className="text-sm text-green-600 mt-1">
                Selected: {imageFile.name}
              </p>
            )}
          </div>

          {/* Additional Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Additional Images{" "}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  ({formData.images.length}/{MAX_IMAGES - 1} extra,{" "}
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
  );

  if (isPageLayout) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
        {formBody}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">{formBody}</div>
      </div>
    </div>
  );
};

export default ProductFormModal;
