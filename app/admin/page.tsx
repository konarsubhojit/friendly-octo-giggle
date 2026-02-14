'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product, Order, ProductInput, OrderStatus } from '@/lib/types';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>({
    name: '',
    description: '',
    price: 0,
    image: '',
    stock: 0,
    category: '',
  });

  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) {
      setAdminToken(storedToken);
      setIsAuthenticated(true);
      loadData(storedToken);
    }
  }, []);

  const handleLogin = () => {
    if (adminToken.trim()) {
      localStorage.setItem('adminToken', adminToken);
      setIsAuthenticated(true);
      loadData(adminToken);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken('');
    setIsAuthenticated(false);
    setProducts([]);
    setOrders([]);
  };

  const loadData = async (token: string) => {
    setLoading(true);
    setError('');
    
    try {
      // Load products
      const productsRes = await fetch('/api/admin/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!productsRes.ok) {
        throw new Error('Authentication failed');
      }
      
      const productsData = await productsRes.json();
      setProducts(productsData.products);

      // Load orders
      const ordersRes = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const ordersData = await ordersRes.json();
      setOrders(ordersData.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setIsAuthenticated(false);
      localStorage.removeItem('adminToken');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(productForm),
      });

      if (!res.ok) {
        throw new Error('Failed to save product');
      }

      await loadData(adminToken);
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: 0,
        image: '',
        stock: 0,
        category: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!res.ok) {
        throw new Error('Failed to delete product');
      }

      await loadData(adminToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      stock: product.stock,
      category: product.category,
    });
    setShowProductForm(true);
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update order status');
      }

      await loadData(adminToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Admin Token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Login
            </button>
            <Link href="/" className="block text-center text-sm text-gray-600 hover:text-gray-900">
              Back to Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <div className="flex gap-4">
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
                View Store
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'products'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-semibold ${
              activeTab === 'orders'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Orders
          </button>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({
                    name: '',
                    description: '',
                    price: 0,
                    image: '',
                    stock: 0,
                    category: '',
                  });
                  setShowProductForm(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Add Product
              </button>
            </div>

            {showProductForm && (
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h2 className="text-xl font-bold mb-4">
                  {editingProduct ? 'Edit Product' : 'Add Product'}
                </h2>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      required
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Stock</label>
                      <input
                        type="number"
                        required
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <input
                      type="text"
                      required
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Image URL</label>
                    <input
                      type="url"
                      required
                      value={productForm.image}
                      onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="relative h-48 w-full">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {product.description}
                    </p>
                    <p className="font-bold text-xl mb-2">${product.price.toFixed(2)}</p>
                    <p className="text-sm text-gray-600 mb-4">
                      Stock: {product.stock} | {product.category}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-600">No orders yet</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Order #{order.id.slice(0, 8)}</h3>
                      <p className="text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {Object.values(OrderStatus).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <p className="font-semibold">Customer: {order.customerName}</p>
                    <p className="text-sm text-gray-600">{order.customerEmail}</p>
                    <p className="text-sm text-gray-600">{order.customerAddress}</p>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Items:</h4>
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm mb-1">
                        <span>
                          {item.product.name} x {item.quantity}
                        </span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                      <span>Total:</span>
                      <span>${order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
