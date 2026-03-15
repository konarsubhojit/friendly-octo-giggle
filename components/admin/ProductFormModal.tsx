'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Product } from '@/lib/types';
import toast from 'react-hot-toast';
import { logError } from '@/lib/logger';
import { isValidImageType, MAX_FILE_SIZE, VALID_IMAGE_TYPES_DISPLAY } from '@/lib/upload-constants';
import { useCurrency, CURRENCIES, type CurrencyCode } from '@/contexts/CurrencyContext';
import { PRODUCT_ERRORS, API_ERRORS } from '@/lib/constants/error-messages';

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
}

interface ProductFormModalProps {
  readonly editingProduct: Product | null;
  readonly onClose: () => void;
  readonly onSuccess: (product: Product) => void;
}

const DEFAULT_PRICE_CURRENCY: CurrencyCode = 'INR';

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

export default function ProductFormModal({
  editingProduct,
  onClose,
  onSuccess,
}: ProductFormModalProps) {
  const { availableCurrencies, rates } = useCurrency();
  const [priceCurrency, setPriceCurrency] = useState<CurrencyCode>(DEFAULT_PRICE_CURRENCY);
  const [formData, setFormData] = useState<ProductFormData>(
    editingProduct
      ? {
          name: editingProduct.name,
          description: editingProduct.description,
          price: convertCurrency(editingProduct.price, 'INR', DEFAULT_PRICE_CURRENCY, rates),
          stock: editingProduct.stock,
          category: editingProduct.category,
          image: editingProduct.image,
        }
      : {
          name: '',
          description: '',
          price: 0,
          stock: 0,
          category: '',
          image: '',
        }
  );
  // Separate string state for the stock input to allow intermediate empty values
  // (e.g. clearing "5" before typing "0" without the field reverting)
  const [stockInput, setStockInput] = useState(
    String(editingProduct ? editingProduct.stock : 0),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProductFormData, string>>>({});

  /** Per-field validators — each returns an error string or undefined. */
  const validateName = (v: string) => {
    if (!v.trim()) return PRODUCT_ERRORS.NAME_REQUIRED;
    if (v.trim().length < 2) return PRODUCT_ERRORS.NAME_TOO_SHORT;
    return undefined;
  };
  const validateDescription = (v: string) => v.trim() ? undefined : PRODUCT_ERRORS.DESCRIPTION_REQUIRED;
  const validatePrice = (v: number) => (!v || v <= 0) ? PRODUCT_ERRORS.PRICE_POSITIVE : undefined;
  const validateStock = (v: number) => (v < 0 || !Number.isInteger(v)) ? PRODUCT_ERRORS.STOCK_INVALID : undefined;
  const validateCategory = (v: string) => v.trim() ? undefined : PRODUCT_ERRORS.CATEGORY_REQUIRED;
  const validateImage = (hasExisting: boolean, hasFile: boolean) =>
    (!hasExisting && !hasFile) ? PRODUCT_ERRORS.IMAGE_REQUIRED : undefined;

  /** Validate all fields and return true if there are no errors. */
  const validate = (): boolean => {
    const errors: Partial<Record<keyof ProductFormData, string>> = {
      name: validateName(formData.name),
      description: validateDescription(formData.description),
      price: validatePrice(formData.price),
      stock: validateStock(formData.stock),
      category: validateCategory(formData.category),
      image: editingProduct ? undefined : validateImage(!!formData.image, !!imageFile),
    };
    // Remove undefined entries before setting
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
    setFormData({ ...formData, price: convertCurrency(formData.price, priceCurrency, newCurrency, rates) });
    setPriceCurrency(newCurrency);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageType(file.type)) {
      setFieldErrors((prev) => ({ ...prev, image: PRODUCT_ERRORS.IMAGE_TYPE_INVALID(VALID_IMAGE_TYPES_DISPLAY) }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFieldErrors((prev) => ({ ...prev, image: PRODUCT_ERRORS.IMAGE_SIZE_EXCEEDED(MAX_FILE_SIZE / 1024 / 1024) }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, image: undefined }));
    setImageFile(file);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', imageFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await res.json();
      return data.data.url;
    } catch (err) {
      logError({ error: err, context: 'uploadImage' });
      toast.error(API_ERRORS.IMAGE_UPLOAD);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const getSubmitButtonText = (): string => {
    const textMap: Record<string, string> = {
      uploading: 'Uploading...',
      saving: 'Saving...',
      update: 'Update Product',
      create: 'Create Product',
    };
    let mode: 'uploading' | 'saving' | 'update' | 'create';
    if (uploading) {
      mode = 'uploading';
    } else if (saving) {
      mode = 'saving';
    } else if (editingProduct) {
      mode = 'update';
    } else {
      mode = 'create';
    }
    return textMap[mode];
  };

  /** Call the save API and return the saved product, or throw on error. */
  const saveProductToApi = async (imageUrl: string) => {
    const productData = {
      ...formData,
      price: convertCurrency(formData.price, priceCurrency, 'INR', rates),
      image: imageUrl,
    };
    const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';
    const method = editingProduct ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(productData) });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save product');
    }
    const saved = await res.json();
    return saved.data?.product || saved.product || saved;
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setStockInput(raw);
    if (raw === '') {
      // Allow clearing the field; treat as 0 for form submission
      setFormData({ ...formData, stock: 0 });
      clearFieldError('stock');
      return;
    }
    const value = Number.parseInt(raw, 10);
    if (!Number.isNaN(value) && value >= 0) {
      setFormData({ ...formData, stock: value });
      clearFieldError('stock');
    }
  };

  /** Resolve the final image URL (uploading a new file if selected). */
  const resolveImageUrl = async (): Promise<string | null> => {
    if (imageFile) {
      const uploadedUrl = await uploadImage();
      if (!uploadedUrl) return null;
      return uploadedUrl;
    }
    if (!formData.image) {
      setFieldErrors((prev) => ({ ...prev, image: PRODUCT_ERRORS.IMAGE_REQUIRED }));
      return null;
    }
    return formData.image;
  };

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const imageUrl = await resolveImageUrl();
      if (!imageUrl) { setSaving(false); return; }
      const savedProduct = await saveProductToApi(imageUrl);
      toast.success(editingProduct ? 'Product updated successfully' : 'Product created successfully');
      onSuccess(savedProduct);
      onClose();
    } catch (err) {
      logError({ error: err, context: 'handleSubmit' });
      toast.error(API_ERRORS.PRODUCT_SAVE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4">
            {editingProduct ? 'Edit Product' : 'Add Product'}
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    clearFieldError('name');
                  }}
                  required
                  maxLength={200}
                  aria-describedby={fieldErrors.name ? 'product-name-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.name ? 'border-red-400' : 'border-gray-300'}`}
                />
                {fieldErrors.name && (
                  <p id="product-name-error" className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="product-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="product-description"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    clearFieldError('description');
                  }}
                  required
                  maxLength={2000}
                  rows={4}
                  aria-describedby={fieldErrors.description ? 'product-description-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.description ? 'border-red-400' : 'border-gray-300'}`}
                />
                {fieldErrors.description && (
                  <p id="product-description-error" className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-price" className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="product-price-currency"
                      value={priceCurrency}
                      onChange={(e) => handlePriceCurrencyChange(e.target.value as CurrencyCode)}
                      aria-label="Price currency"
                      className="px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
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
                          clearFieldError('price');
                        }
                      }}
                      required
                      min="0.01"
                      step="0.01"
                      aria-describedby={fieldErrors.price ? 'product-price-error' : undefined}
                      className={`flex-1 min-w-0 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.price ? 'border-red-400' : 'border-gray-300'}`}
                    />
                  </div>
                  {fieldErrors.price && (
                    <p id="product-price-error" className="text-xs text-red-600 mt-1">{fieldErrors.price}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="product-stock" className="block text-sm font-medium text-gray-700 mb-1">
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
                    aria-describedby={fieldErrors.stock ? 'product-stock-error' : undefined}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.stock ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {fieldErrors.stock && (
                    <p id="product-stock-error" className="text-xs text-red-600 mt-1">{fieldErrors.stock}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  id="product-category"
                  type="text"
                  value={formData.category}
                  onChange={(e) => {
                    setFormData({ ...formData, category: e.target.value });
                    clearFieldError('category');
                  }}
                  required
                  maxLength={100}
                  aria-describedby={fieldErrors.category ? 'product-category-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.category ? 'border-red-400' : 'border-gray-300'}`}
                />
                {fieldErrors.category && (
                  <p id="product-category-error" className="text-xs text-red-600 mt-1">{fieldErrors.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="product-image" className="block text-sm font-medium text-gray-700 mb-1">
                  Product Image
                </label>
                {formData.image && !imageFile && (
                  <div className="mb-2 relative w-32 h-32">
                    <Image
                      src={formData.image}
                      alt="Current product"
                      fill
                      sizes="128px"
                      className="object-cover rounded border"
                    />
                  </div>
                )}
                <input
                  id="product-image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  aria-describedby={fieldErrors.image ? 'product-image-error' : undefined}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${fieldErrors.image ? 'border-red-400' : 'border-gray-300'}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingProduct
                    ? 'Leave empty to keep current image. '
                    : 'Required. '}
                  Max {MAX_FILE_SIZE / 1024 / 1024}MB. Formats: {VALID_IMAGE_TYPES_DISPLAY}
                </p>
                {fieldErrors.image && (
                  <p id="product-image-error" className="text-xs text-red-600 mt-1">{fieldErrors.image}</p>
                )}
                {imageFile && !fieldErrors.image && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {imageFile.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || uploading}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 transition"
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
