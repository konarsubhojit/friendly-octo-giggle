"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductVariation } from "@/lib/types";
import toast from "react-hot-toast";
import {
  CURRENCIES,
  type CurrencyCode,
  useCurrency,
} from "@/contexts/CurrencyContext";
import {
  isValidImageType,
  MAX_FILE_SIZE,
  VALID_IMAGE_TYPES_DISPLAY,
} from "@/lib/upload-constants";

const MAX_ADDITIONAL_IMAGES = 10;

interface VariationFormModalProps {
  readonly productId: string;
  readonly productPrice: number;
  readonly variation?: ProductVariation;
  readonly onClose: () => void;
  readonly onSuccess: (variation: ProductVariation) => void;
}

interface FormData {
  name: string;
  designName: string;
  priceModifier: string;
  stock: string;
}

function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<CurrencyCode, number>,
): number {
  const amountInBase = amount / rates[from];
  return Number((amountInBase * rates[to]).toFixed(2));
}

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload image");
  }
  const data = await res.json();
  return data.data.url;
}

export default function VariationFormModal({
  productId,
  productPrice,
  variation,
  onClose,
  onSuccess,
}: VariationFormModalProps) {
  const isEditing = !!variation;
  const { availableCurrencies, currency, rates } = useCurrency();
  const [priceCurrency, setPriceCurrency] = useState<CurrencyCode>(currency);
  const [additionalImageSlotIds, setAdditionalImageSlotIds] = useState<
    string[]
  >(() => (variation?.images ?? []).map(() => crypto.randomUUID()));

  const [formData, setFormData] = useState<FormData>({
    name: variation?.name ?? "",
    designName: variation?.designName ?? "",
    priceModifier: variation
      ? convertCurrency(
          variation.priceModifier,
          "INR",
          currency,
          rates,
        ).toString()
      : "0",
    stock: variation?.stock?.toString() ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Image state
  const primaryImageUrl = variation?.image ?? null;
  const [primaryImageFile, setPrimaryImageFile] = useState<File | null>(null);
  const [additionalImageUrls, setAdditionalImageUrls] = useState<string[]>(
    variation?.images ?? [],
  );
  const [additionalImageFiles, setAdditionalImageFiles] = useState<
    (File | null)[]
  >((variation?.images ?? []).map(() => null));

  const priceModifierNum = Number.parseFloat(formData.priceModifier) || 0;
  const priceModifierInInr = convertCurrency(
    priceModifierNum,
    priceCurrency,
    "INR",
    rates,
  );
  const effectivePriceInInr = productPrice + priceModifierInInr;
  const effectivePriceDisplay = convertCurrency(
    effectivePriceInInr,
    "INR",
    priceCurrency,
    rates,
  );
  const effectivePriceWarning = effectivePriceInInr <= 0;

  const validateImageFile = (file: File): string | null => {
    if (!isValidImageType(file.type)) {
      return `Invalid type. Allowed: ${VALID_IMAGE_TYPES_DISPLAY}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    else if (formData.name.length > 100)
      errs.name = "Name must be under 100 characters";
    if (!formData.designName.trim())
      errs.designName = "Design name is required";
    else if (formData.designName.length > 100)
      errs.designName = "Design name must be under 100 characters";
    if (formData.priceModifier === "")
      errs.priceModifier = "Price modifier is required";
    else if (Number.isNaN(Number.parseFloat(formData.priceModifier)))
      errs.priceModifier = "Must be a number";
    if (formData.stock === "") errs.stock = "Stock is required";
    else if (
      !Number.isInteger(Number(formData.stock)) ||
      Number(formData.stock) < 0
    ) {
      errs.stock = "Stock must be a non-negative integer";
    }
    return errs;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handlePriceCurrencyChange = (newCurrency: CurrencyCode) => {
    const currentModifier = Number.parseFloat(formData.priceModifier) || 0;
    const convertedModifier = convertCurrency(
      currentModifier,
      priceCurrency,
      newCurrency,
      rates,
    );

    setPriceCurrency(newCurrency);
    setFormData((prev) => ({
      ...prev,
      priceModifier: convertedModifier.toString(),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.priceModifier;
      return next;
    });
  };

  const handlePrimaryImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setPrimaryImageFile(file);
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
    const newFiles = [...additionalImageFiles];
    newFiles[idx] = file;
    setAdditionalImageFiles(newFiles);
  };

  const addImageSlot = () => {
    if (additionalImageUrls.length >= MAX_ADDITIONAL_IMAGES) {
      toast.error(`Maximum ${MAX_ADDITIONAL_IMAGES} additional images`);
      return;
    }
    setAdditionalImageUrls((prev) => [...prev, ""]);
    setAdditionalImageFiles((prev) => [...prev, null]);
    setAdditionalImageSlotIds((prev) => [...prev, crypto.randomUUID()]);
  };

  const removeAdditionalImage = (idx: number) => {
    setAdditionalImageUrls((prev) => prev.filter((_, i) => i !== idx));
    setAdditionalImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setAdditionalImageSlotIds((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      // Upload primary image if a new file was selected
      let imageUrl: string | null | undefined = primaryImageUrl;
      if (primaryImageFile) {
        imageUrl = await uploadImage(primaryImageFile);
      }

      // Upload additional images (only files that are new)
      const finalAdditionalUrls: string[] = [];
      for (let i = 0; i < additionalImageUrls.length; i++) {
        const pendingFile = additionalImageFiles[i];
        if (pendingFile) {
          const url = await uploadImage(pendingFile);
          finalAdditionalUrls.push(url);
        } else if (additionalImageUrls[i]) {
          finalAdditionalUrls.push(additionalImageUrls[i]);
        }
      }

      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        designName: formData.designName.trim(),
        priceModifier: priceModifierInInr,
        stock: Number.parseInt(formData.stock, 10),
      };

      // Only include images if they were changed or new
      if (imageUrl !== undefined) payload.image = imageUrl;
      if (
        finalAdditionalUrls.length > 0 ||
        (variation && variation.images.length > 0)
      ) {
        payload.images = finalAdditionalUrls;
      }

      const url = isEditing
        ? `/api/admin/products/${productId}/variations/${variation.id}`
        : `/api/admin/products/${productId}/variations`;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      toast.success(isEditing ? "Variation updated" : "Variation created");
      onSuccess(data.data.variation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  let submitButtonLabel = "Create";
  if (submitting) {
    submitButtonLabel = "Saving...";
  } else if (isEditing) {
    submitButtonLabel = "Update";
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {isEditing ? "Edit Variation" : "Add Variation"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="var-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="var-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Red - Large"
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Design Name */}
          <div>
            <label
              htmlFor="var-designName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Design Name <span className="text-red-500">*</span>
            </label>
            <input
              id="var-designName"
              type="text"
              name="designName"
              value={formData.designName}
              onChange={handleChange}
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Classic Logo"
            />
            {errors.designName && (
              <p className="text-sm text-red-500 mt-1">{errors.designName}</p>
            )}
          </div>

          {/* Price Modifier */}
          <div>
            <label
              htmlFor="var-priceModifier"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Price Modifier <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                id="var-priceCurrency"
                value={priceCurrency}
                onChange={(e) =>
                  handlePriceCurrencyChange(e.target.value as CurrencyCode)
                }
                aria-label="Price modifier currency"
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableCurrencies.map((code) => (
                  <option key={code} value={code}>
                    {code} ({CURRENCIES[code].symbol})
                  </option>
                ))}
              </select>
              <input
                id="var-priceModifier"
                type="number"
                name="priceModifier"
                value={formData.priceModifier}
                onChange={handleChange}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {errors.priceModifier && (
              <p className="text-sm text-red-500 mt-1">
                {errors.priceModifier}
              </p>
            )}
            <p
              className={`text-sm mt-1 ${effectivePriceWarning ? "text-red-500 font-medium" : "text-gray-500 dark:text-gray-400"}`}
            >
              Effective price: {effectivePriceDisplay.toFixed(2)}{" "}
              {priceCurrency}
              {effectivePriceWarning &&
                ` — must be greater than 0.00 ${priceCurrency}`}
            </p>
          </div>

          {/* Stock */}
          <div>
            <label
              htmlFor="var-stock"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Stock <span className="text-red-500">*</span>
            </label>
            <input
              id="var-stock"
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleChange}
              min="0"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
            {errors.stock && (
              <p className="text-sm text-red-500 mt-1">{errors.stock}</p>
            )}
          </div>

          {/* Primary Image */}
          <div>
            <label
              htmlFor="var-image"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Primary Image
            </label>
            {(primaryImageUrl || primaryImageFile) && (
              <div className="relative w-24 h-24 mb-2 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700">
                <Image
                  src={
                    primaryImageFile
                      ? URL.createObjectURL(primaryImageFile)
                      : (primaryImageUrl ?? "")
                  }
                  alt="Variation preview"
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
            )}
            <input
              id="var-image"
              type="file"
              accept="image/*"
              onChange={handlePrimaryImageChange}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
          </div>

          {/* Additional Images */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Additional Images ({additionalImageUrls.length}/
                {MAX_ADDITIONAL_IMAGES})
              </span>
              <button
                type="button"
                onClick={addImageSlot}
                disabled={additionalImageUrls.length >= MAX_ADDITIONAL_IMAGES}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40"
              >
                + Add Image
              </button>
            </div>
            {additionalImageUrls.map((url, idx) => {
              const pendingFile = additionalImageFiles[idx] ?? null;
              const previewSrc = pendingFile
                ? URL.createObjectURL(pendingFile)
                : url;

              return (
                <div
                  key={
                    additionalImageSlotIds[idx] ?? `variation-image-slot-${idx}`
                  }
                  className="flex items-center gap-2 mb-2"
                >
                  {(pendingFile || url) && (
                    <div className="relative w-10 h-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
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
                    onChange={(e) => handleAdditionalImageChange(idx, e)}
                    className="flex-1 text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => removeAdditionalImage(idx)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    aria-label={`Remove image ${idx + 1}`}
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || effectivePriceWarning}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
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
        </form>
      </div>
    </div>
  );
}
