'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Image from 'next/image';
import { Product } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import toast from 'react-hot-toast';
import {
  fetchAdminProducts,
  selectAdminProducts,
  selectAdminProductsLoading,
  selectAdminError,
  removeProduct,
  upsertProduct,
} from '@/lib/features/admin/adminSlice';
import type { AppDispatch } from '@/lib/store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';

// Lazy-load heavy modal components to reduce initial bundle size
const ProductFormModal = lazy(() => import('@/components/admin/ProductFormModal'));
const DeleteConfirmModal = lazy(() => import('@/components/admin/DeleteConfirmModal'));

export default function ProductsManagement() {
  const { formatPrice } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const products = useSelector(selectAdminProducts) as Product[];
  const loading = useSelector(selectAdminProductsLoading);
  const error = useSelector(selectAdminError);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    dispatch(fetchAdminProducts());
  }, [dispatch]);

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
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete product');
      }

      toast.success('Product deleted successfully');
      dispatch(removeProduct(productToDelete));
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProductToDelete(null);
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Product Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your product inventory</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => dispatch(fetchAdminProducts())}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 transition"
          >
            Refresh
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {products.length === 0 ? (
        <EmptyState title="No products found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col">
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
                <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">{product.name}</h3>
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
                  <button
                    onClick={() => handleOpenModal(product)}
                    disabled={deleting}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition"
                  >
                    Edit
                  </button>
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
      )}

      {/* Modal - Lazy-loaded */}
      {showModal && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
              <LoadingSpinner />
            </div>
          </div>
        }>
          <ProductFormModal
            editingProduct={editingProduct}
            onClose={handleCloseModal}
            onSuccess={handleProductSaved}
          />
        </Suspense>
      )}

      {/* Delete Confirmation Modal - Lazy-loaded */}
      {showDeleteModal && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
              <LoadingSpinner />
            </div>
          </div>
        }>
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
