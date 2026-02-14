'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Product } from '@/lib/types';
import toast from 'react-hot-toast';
import { isValidImageType, MAX_FILE_SIZE, VALID_IMAGE_TYPES_DISPLAY } from '@/lib/upload-constants';

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
}

export default function ProductsManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: '',
    image: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/products');
      
      if (!res.ok) {
        throw new Error('Failed to load products');
      }
      
      const data = await res.json();
      setProducts(data.data?.products || data.products || []);
    } catch (err) {
      console.error('Error loading products:', err);
      const errorMsg = 'Unable to load data';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        image: product.image,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        category: '',
        image: '',
      });
    }
    setImageFile(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setImageFile(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      stock: 0,
      category: '',
      image: '',
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!isValidImageType(file.type)) {
        toast.error(`Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`);
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
      }

      setImageFile(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const data = await res.json();
      return data.data.url;
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Something went wrong. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // Upload image if a new file is selected
      let imageUrl = formData.image;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) {
          setSaving(false);
          return;
        }
        imageUrl = uploadedUrl;
      }

      // Validate image URL
      if (!imageUrl) {
        toast.error('Product image is required');
        setSaving(false);
        return;
      }

      const productData = {
        ...formData,
        image: imageUrl,
      };

      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';

      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save product');
      }

      toast.success(
        editingProduct
          ? 'Product updated successfully'
          : 'Product created successfully'
      );

      handleCloseModal();
      await loadProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      const errorMsg = 'Something went wrong. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setProductToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;

    try {
      const res = await fetch(`/api/admin/products/${productToDelete}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete product');
      }

      toast.success('Product deleted successfully');
      setShowDeleteModal(false);
      setProductToDelete(null);
      await loadProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('Something went wrong. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setProductToDelete(null);
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
          <p className="text-gray-600 mt-2">Manage your product inventory</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadProducts}
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
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <p className="text-gray-600">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="aspect-square relative bg-gray-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {product.description}
                </p>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-bold text-gray-900">
                    ${product.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-600">
                    Stock: {product.stock}
                  </span>
                </div>
                <div className="mb-3">
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                    {product.category}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(product)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h3>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      maxLength={200}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      required
                      maxLength={2000}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          if (!isNaN(value)) {
                            setFormData({ ...formData, price: value });
                          }
                        }}
                        required
                        min="0.01"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        value={formData.stock}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value)) {
                            setFormData({ ...formData, stock: value });
                          }
                        }}
                        required
                        min="0"
                        step="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      required
                      maxLength={100}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      onChange={handleImageChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editingProduct
                        ? 'Leave empty to keep current image. '
                        : 'Required. '}
                      Max {MAX_FILE_SIZE / 1024 / 1024}MB. Formats: {VALID_IMAGE_TYPES_DISPLAY}
                    </p>
                    {imageFile && (
                      <p className="text-sm text-green-600 mt-1">
                        Selected: {imageFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
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
                    {saving || uploading
                      ? uploading
                        ? 'Uploading...'
                        : 'Saving...'
                      : editingProduct
                      ? 'Update Product'
                      : 'Create Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
