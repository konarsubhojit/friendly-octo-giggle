"use client";

import { useState } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";
import toast from "react-hot-toast";
import { logError } from "@/lib/logger";
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from "@/lib/upload-constants";
import {
  useCurrency,
  CURRENCIES,
  type CurrencyCode,
} from "@/contexts/CurrencyContext";
import { PRODUCT_ERRORS, API_ERRORS } from "@/lib/constants/error-messages";
import { PRODUCT_CATEGORIES } from "@/lib/constants/categories";

const MAX_IMAGES = 10;

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  images: string[];
}

interface ProductFormModalProps {
  readonly editingProduct: Product | null;
  readonly onClose: () => void;
  readonly onSuccess: (product: Product) => void;
}

const DEFAULT_PRICE_CURRENCY: CurrencyCode = "INR";

/** Convert an amount from one currency to another using the provided live rates. */
function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>,
): number {
  const amountInBase = amount / rates[from];
  return Number((amountInBase * rates[to]).toFixed(2));
}

interface AdditionalImageRowProps {
  readonly idx: number;
  readonly imgUrl: string;
  readonly pendingFile: File | null;
  readonly onFileChange: (idx: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onRemove: (idx: number) => void;
}

const AdditionalImageRow = ({ idx, imgUrl, pendingFile, onFileChange, onRemove }: AdditionalImageRowProps) => (
  <div className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
    {imgUrl && !pendingFile && (
      <div className="relative flex-shrink-0 w-14 h-14">
        <Image src={imgUrl} alt={`Additional image ${idx + 1}`} fill sizes="56px" className="object-contain rounded border bg-white dark:bg-gray-800" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <label htmlFor={`additional-image-${idx}`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        Image {idx + 2}{imgUrl && !pendingFile && " (current)"}
      </label>
      <input
        id={`additional-image-${idx}`}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={(e) => onFileChange(idx, e)}
        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-900 dark:text-gray-100 dark:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {pendingFile && (
        <p className="text-xs text-green-600 mt-1">Selected: {pendingFile.name}</p>
      )}
    </div>
    <button
      type="button"
      onClick={() => onRemove(idx)}
      aria-label={`Remove image ${idx + 2}`}
      className="flex-shrink-0 text-red-400 hover:text-red-600 transition mt-1"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

export default function ProductFormModal({
  editingProduct,
  onClose,
  onSuccess,
}: ProductFormModalProps) {
  const { availableCurrencies, rates } = useCurrency();
  const [priceCurrency, setPriceCurrency] = useState<CurrencyCode>(
    DEFAULT_PRICE_CURRENCY,
  );
  const [formData, setFormData] = useState<ProductFormData>(
    editingProduct
      ? {
          name: editingProduct.name,
          description: editingProduct.description,
          price: convertCurrency(
            editingProduct.price,
            "INR",
            DEFAULT_PRICE_CURRENCY,
            rates,
          ),
          stock: editingProduct.stock,
          category: editingProduct.category,
          image: editingProduct.image,
          images: editingProduct.images ?? [],
        }
      : {
          name: "",
          description: "",
          price: 0,
          stock: 0,
          category: "",
          image: "",
          images: [],
        },
  );
  const [stockInput, setStockInput] = useState(
    String(editingProduct ? editingProduct.stock : 0),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  // Additional image files to upload (paired with formData.images slots)
  const [additionalFiles, setAdditionalFiles] = useState<(File | null)[]>(
    () => Array((editingProduct?.images ?? []).length).fill(null),
  );
  // Stable IDs for additional image slots (avoids React index-key warnings)
  const [slotIds, setSlotIds] = useState<string[]>(
    () => (editingProduct?.images ?? []).map(() => crypto.randomUUID()),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProductFormData, string>>
  >({});

  const totalImages =
    (formData.image || imageFile ? 1 : 0) + formData.images.length;

  /** Per-field validators — each returns an error string or undefined. */
  const validateName = (v: string) => {
    if (!v.trim()) return PRODUCT_ERRORS.NAME_REQUIRED;
    if (v.trim().length < 2) return PRODUCT_ERRORS.NAME_TOO_SHORT;
    return undefined;
  };
  const validateDescription = (v: string) =>
    v.trim() ? undefined : PRODUCT_ERRORS.DESCRIPTION_REQUIRED;
  const validatePrice = (v: number) =>
    !v || v <= 0 ? PRODUCT_ERRORS.PRICE_POSITIVE : undefined;
  const validateStock = (v: number) =>
    v < 0 || !Number.isInteger(v) ? PRODUCT_ERRORS.STOCK_INVALID : undefined;
  const validateCategory = (v: string) =>
    v.trim() ? undefined : PRODUCT_ERRORS.CATEGORY_REQUIRED;
  const validateImage = (hasExisting: boolean, hasFile: boolean) =>
    !hasExisting && !hasFile ? PRODUCT_ERRORS.IMAGE_REQUIRED : undefined;

  /** Validate all fields and return true if there are no errors. */
  const validate = (): boolean => {
    const errors: Partial<Record<keyof ProductFormData, string>> = {
      name: validateName(formData.name),
      description: validateDescription(formData.description),
      price: validatePrice(formData.price),
      stock: validateStock(formData.stock),
      category: validateCategory(formData.category),
      image: editingProduct
        ? undefined
        : validateImage(Boolean(formData.image), Boolean(imageFile)),
    };
    const filtered = Object.fromEntries(
      Object.entries(errors).filter(([, v]) => v !== undefined),
    ) as Partial<Record<keyof ProductFormData, string>>;
    setFieldErrors(filtered);
    return Object.keys(filtered).length === 0;
  };

  const clearFieldError = (field: keyof ProductFormData) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePriceCurrencyChange = (newCurrency: CurrencyCode) => {
    setFormData({
      ...formData,
      price: convertCurrency(formData.price, priceCurrency, newCurrency, rates),
    });
    setPriceCurrency(newCurrency);
  };

  const validateImageFile = (file: File): string | null => {
    if (!isValidImageType(file.type)) {
      return PRODUCT_ERRORS.IMAGE_TYPE_INVALID(VALID_IMAGE_TYPES_DISPLAY);
    }
    if (file.size > MAX_FILE_SIZE) {
      return PRODUCT_ERRORS.IMAGE_SIZE_EXCEEDED(MAX_FILE_SIZE / 1024 / 1024);
    }
    return null;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setFieldErrors((prev) => ({ ...prev, image: err }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    setImageFile(file);
  };

  const handleAdditionalImageChange = (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    const newFiles = [...additionalFiles];
    newFiles[idx] = file;
    setAdditionalFiles(newFiles);
  };

  const addImageSlot = () => {
    if (totalImages >= MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    setFormData((prev) => ({ ...prev, images: [...prev.images, ""] }));
    setAdditionalFiles((prev) => [...prev, null]);
    setSlotIds((prev) => [...prev, crypto.randomUUID()]);
  };

  const removeAdditionalImage = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
    setAdditionalFiles((prev) => prev.filter((_, i) => i !== idx));
    setSlotIds((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadSingleImage = async (file: File): Promise<string | null> => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formDataUpload,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to upload image");
    }
    const data = await res.json();
    return data.data.url;
  };

  const getSubmitButtonText = (): string => {
    if (uploading) return "Uploading...";
    if (saving) return "Saving...";
    return editingProduct ? "Update Product" : "Create Product";
  };

  const getApiEndpoint = () =>
    editingProduct
      ? { url: `/api/admin/products/${editingProduct.id}`, method: "PUT" as const }
      : { url: "/api/admin/products", method: "POST" as const };

  const saveProductToApi = async (
    imageUrl: string,
    additionalImages: string[],
  ) => {
    const productData = {
      ...formData,
      price: convertCurrency(formData.price, priceCurrency, "INR", rates),
      image: imageUrl,
      images: additionalImages,
    };
    const { url, method } = getApiEndpoint();
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productData),
    });
    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(
        (errorBody as { error?: string }).error ?? "Failed to save product",
      );
    }
    const saved = (await res.json()) as {
      data?: { product?: Product };
      product?: Product;
    };
    return saved.data?.product ?? saved.product ?? (saved as unknown as Product);
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setStockInput(raw);
    if (raw === "") {
      setFormData({ ...formData, stock: 0 });
      clearFieldError("stock");
      return;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isNaN(value) && value >= 0) {
      setFormData({ ...formData, stock: value });
      clearFieldError("stock");
    }
  };

  const resolveImageUrl = async (): Promise<string | null> => {
    if (imageFile) {
      setUploading(true);
      try {
        return await uploadSingleImage(imageFile);
      } catch (err) {
        logError({ error: err, context: "resolveImageUrl" });
        toast.error(API_ERRORS.IMAGE_UPLOAD);
        return null;
      } finally {
        setUploading(false);
      }
    }
    if (!formData.image) {
      setFieldErrors((prev) => ({ ...prev, image: PRODUCT_ERRORS.IMAGE_REQUIRED }));
      return null;
    }
    return formData.image;
  };

  const uploadAdditionalImages = async (): Promise<string[]> => {
    const additionalUrls: string[] = [];
    for (let i = 0; i < formData.images.length; i++) {
      const file = additionalFiles[i];
      if (file) {
        setUploading(true);
        try {
          const url = await uploadSingleImage(file);
          if (url) additionalUrls.push(url);
        } catch {
          // skip failed uploads
        } finally {
          setUploading(false);
        }
      } else if (formData.images[i]) {
        additionalUrls.push(formData.images[i]);
      }
    }
    return additionalUrls;
  };

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const primaryUrl = await resolveImageUrl();
      if (!primaryUrl) {
        setSaving(false);
        return;
      }

      const additionalUrls = await uploadAdditionalImages();
      const savedProduct = await saveProductToApi(primaryUrl, additionalUrls);
      toast.success(
        editingProduct ? "Product updated successfully" : "Product created successfully",
      );
      onSuccess(savedProduct);
      onClose();
    } catch (err) {
      logError({ error: err, context: "handleSubmit" });
      toast.error(API_ERRORS.PRODUCT_SAVE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
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
                    fieldErrors.description ? "product-description-error" : undefined
                  }
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${fieldErrors.description ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
                />
                {fieldErrors.description && (
                  <p id="product-description-error" className="text-xs text-red-600 mt-1">
                    {fieldErrors.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                      onChange={(e) =>
                        handlePriceCurrencyChange(e.target.value as CurrencyCode)
                      }
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
                      value={formData.price}
                      onChange={(e) => {
                        const value = Number.parseFloat(e.target.value);
                        if (!Number.isNaN(value)) {
                          setFormData({ ...formData, price: value });
                          clearFieldError("price");
                        }
                      }}
                      required
                      min="0.01"
                      step="0.01"
                      aria-describedby={
                        fieldErrors.price ? "product-price-error" : undefined
                      }
                      className={`flex-1 min-w-0 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${fieldErrors.price ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
                    />
                  </div>
                  {fieldErrors.price && (
                    <p id="product-price-error" className="text-xs text-red-600 mt-1">
                      {fieldErrors.price}
                    </p>
                  )}
                </div>

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
                    <p id="product-stock-error" className="text-xs text-red-600 mt-1">
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
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <p id="product-category-error" className="text-xs text-red-600 mt-1">
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
                  <span className="text-gray-400 dark:text-gray-500 font-normal">(required)</span>
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
                  {editingProduct ? "Leave empty to keep current image. " : "Required. "}
                  Max {MAX_FILE_SIZE / 1024 / 1024}MB. Formats: {VALID_IMAGE_TYPES_DISPLAY}
                </p>
                {fieldErrors.image && (
                  <p id="product-image-error" className="text-xs text-red-600 mt-1">
                    {fieldErrors.image}
                  </p>
                )}
                {imageFile && !fieldErrors.image && (
                  <p className="text-sm text-green-600 mt-1">Selected: {imageFile.name}</p>
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
                    No additional images. Click &ldquo;+ Add Image&rdquo; to add up to{" "}
                    {MAX_IMAGES - 1} more images.
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
                {getSubmitButtonText()}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

