"use client";

import { useState, lazy, Suspense } from "react";
import Image from "next/image";
import type { ProductVariation } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";

const VariationFormModal = lazy(
  () => import("@/components/admin/VariationFormModal"),
);
const DeleteConfirmModal = lazy(
  () => import("@/components/admin/DeleteConfirmModal"),
);

interface VariationListProps {
  readonly productId: string;
  readonly productPrice: number;
  readonly initialVariations: ProductVariation[];
}

export default function VariationList({
  productId,
  productPrice,
  initialVariations,
}: VariationListProps) {
  const [variations, setVariations] =
    useState<ProductVariation[]>(initialVariations);
  const { formatPrice } = useCurrency();
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVariation, setEditingVariation] = useState<
    ProductVariation | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ProductVariation | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const handleAddClick = () => {
    setEditingVariation(undefined);
    setShowFormModal(true);
  };

  const handleEditClick = (variation: ProductVariation) => {
    setEditingVariation(variation);
    setShowFormModal(true);
  };

  const handleFormClose = () => {
    setShowFormModal(false);
    setEditingVariation(undefined);
  };

  const handleFormSuccess = (saved: ProductVariation) => {
    setVariations((prev) => {
      const idx = prev.findIndex((v) => v.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    setShowFormModal(false);
    setEditingVariation(undefined);
  };

  const handleDeleteClick = (variation: ProductVariation) => {
    setDeleteTarget(variation);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/products/${productId}/variations/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete variation");
      }
      setVariations((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // Toast is optional here — error is visible via alert or could be added later
    } finally {
      setDeleting(false);
    }
  };

  const addButton = (
    <button
      type="button"
      onClick={handleAddClick}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
    >
      Add Variation
    </button>
  );

  const modalFallback = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    </div>
  );

  if (variations.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Variations
          </h2>
          {addButton}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4"
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No variations yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add a variation to offer different colors, designs, or options for
            this product.
          </p>
        </div>
        {showFormModal && (
          <Suspense fallback={modalFallback}>
            <VariationFormModal
              productId={productId}
              productPrice={productPrice}
              variation={editingVariation}
              onClose={handleFormClose}
              onSuccess={handleFormSuccess}
            />
          </Suspense>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Variations ({variations.length})
        </h2>
        {addButton}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {variations.map((variation) => {
          const effectivePrice = productPrice + variation.priceModifier;
          return (
            <div
              key={variation.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div className="aspect-video relative bg-gray-100 dark:bg-gray-700">
                {variation.image ? (
                  <Image
                    src={variation.image}
                    alt={variation.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <svg
                      className="w-10 h-10"
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

              {/* Card Content */}
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {variation.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {variation.designName}
                </p>
                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    {variation.priceModifier >= 0 ? "+" : ""}
                    {formatPrice(variation.priceModifier)} modifier
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(effectivePrice)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Stock: {variation.stock}
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    type="button"
                    onClick={() => handleEditClick(variation)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(variation)}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showFormModal && (
        <Suspense fallback={modalFallback}>
          <VariationFormModal
            productId={productId}
            productPrice={productPrice}
            variation={editingVariation}
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
  );
}
