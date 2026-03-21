"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { upsertProduct } from "@/lib/features/admin/adminSlice";
import type { AppDispatch } from "@/lib/store";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";

// Lazy-load heavy modal components to reduce initial bundle size
const ProductFormModal = lazy(
  () => import("@/components/admin/ProductFormModal"),
);
const DeleteConfirmModal = lazy(
  () => import("@/components/admin/DeleteConfirmModal"),
);

const PAGE_SIZE = 20;

export default function ProductsManagement() {
  const { formatPrice } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(
    async (cursorParam: string | null, searchQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursorParam) params.set("cursor", cursorParam);
        if (searchQuery) params.set("search", searchQuery);

        const res = await fetch(`/api/admin/products?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load products");
        }
        const data = await res.json();
        const items: Product[] = data.data?.products ?? data.products ?? [];
        setProducts(items);
        setNextCursor(data.data?.nextCursor ?? null);
        setHasMore(data.data?.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchProducts(cursor, search);
  }, [fetchProducts, cursor, search]);

  const handleSearch = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setCursor(null);
    setCursorHistory([]);
    setSearch(searchInput.trim());
  };

  const handleNext = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  };

  const handlePrev = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const prevCursor = prev.pop() ?? null;
    setCursorHistory(prev);
    setCursor(prevCursor);
  };

  const handleReset = () => {
    setCursor(null);
    setCursorHistory([]);
    setSearch("");
    setSearchInput("");
  };

  const handleOpenModal = (product?: Product) => {
    setEditingProduct(product || null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleProductSaved = (product: Product) => {
    dispatch(upsertProduct(product));
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = product;
        return updated;
      }
      return [product, ...prev];
    });
  };

  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${productToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete product");
      }
      toast.success("Product deleted successfully");
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete));
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProductToDelete(null);
  };

  const currentPage = cursorHistory.length + 1;

  const productsListContent =
    products.length === 0 ? (
      <EmptyState
        title="No products found"
        message={search ? "Try a different search term." : undefined}
      />
    ) : (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col"
            >
              <div className="aspect-square relative bg-gray-100 dark:bg-gray-700">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Stock: {product.stock}
                  </span>
                </div>
                <div className="mb-3">
                  <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-semibold rounded">
                    {product.category}
                  </span>
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition text-center"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deleting}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cursor Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={cursorHistory.length === 0 || loading}
              className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasMore || loading}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      </>
    );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Products" }]}
      />
      {/* Header */}
      <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Product Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your product inventory
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 transition text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
          >
            Add Product
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search products…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search products by name"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Clear
            </button>
          )}
        </div>
        {search && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Showing results for &ldquo;<strong>{search}</strong>&rdquo;
          </p>
        )}
      </form>

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        productsListContent
      )}

      {showModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
                <LoadingSpinner />
              </div>
            </div>
          }
        >
          <ProductFormModal
            editingProduct={editingProduct}
            onClose={handleCloseModal}
            onSuccess={handleProductSaved}
          />
        </Suspense>
      )}

      {showDeleteModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
                <LoadingSpinner />
              </div>
            </div>
          }
        >
          <DeleteConfirmModal
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
            loading={deleting}
          />
        </Suspense>
      )}
    </main>
  );
}
