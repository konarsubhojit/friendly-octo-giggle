'use client';

import { useState } from 'react';
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

interface ProductFormModalProps {
  readonly editingProduct: Product | null;
  readonly onClose: () => void;
  readonly onSuccess: (product: Product) => void;
}

export default function ProductFormModal({
  editingProduct,
  onClose,
  onSuccess,
}: ProductFormModalProps) {
  const [formData, setFormData] = useState<ProductFormData>(
    editingProduct
      ? {
          name: editingProduct.name,
          description: editingProduct.description,
          price: editingProduct.price,
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isValidImageType(file.type)) {
        toast.error(`Invalid file type. Only ${VALID_IMAGE_TYPES_DISPLAY} are allowed.`);
        return;
      }

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
      console.error('Error uploading image:', err);
      toast.error('Something went wrong. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const getSubmitButtonText = (): string => {
    if (saving || uploading) {
      return uploading ? 'Uploading...' : 'Saving...';
    }
    return editingProduct ? 'Update Product' : 'Create Product';
  };

  const handleSubmit = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setSaving(true);

    void (async () => {
      try {
        let imageUrl = formData.image;
        if (imageFile) {
          const uploadedUrl = await uploadImage();
          if (!uploadedUrl) {
            setSaving(false);
            return;
          }
          imageUrl = uploadedUrl;
        }

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

        const saved = await res.json();
        const savedProduct = saved.data?.product || saved.product || saved;

        toast.success(
          editingProduct
            ? 'Product updated successfully'
            : 'Product created successfully'
        );

        onSuccess(savedProduct);
        onClose();
      } catch (err) {
        console.error('Error saving product:', err);
        toast.error('Something went wrong. Please try again.');
      } finally {
        setSaving(false);
      }
    })();
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
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  maxLength={200}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="product-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="product-description"
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
                  <label htmlFor="product-price" className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    id="product-price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => {
                      const value = Number.parseFloat(e.target.value);
                      if (!Number.isNaN(value)) {
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
                  <label htmlFor="product-stock" className="block text-sm font-medium text-gray-700 mb-1">
                    Stock
                  </label>
                  <input
                    id="product-stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(value)) {
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
                <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  id="product-category"
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
