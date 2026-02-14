import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getProducts(): Promise<Product[]> {
  try {
    // In production, use absolute URL or environment variable
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/products`, {
      cache: 'no-store',
    });
    
    if (!res.ok) {
      console.error('Failed to fetch products');
      return [];
    }
    
    const data = await res.json();
    return data.data?.products || data.products || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              E-Store
            </Link>
            <Link
              href="/admin"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Admin Panel
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Featured Products
        </h1>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              No items found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                <div className="relative h-64 w-full">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {product.name}
                  </h2>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-gray-900">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {product.stock > 0 ? (
                        <span className="text-green-600">In Stock ({product.stock})</span>
                      ) : (
                        <span className="text-red-600">Out of Stock</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">
                      {product.category}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-600 text-sm">
            © 2026 E-Store. Powered by Next.js, Redis, and PostgreSQL.
          </p>
        </div>
      </footer>
    </div>
  );
}
