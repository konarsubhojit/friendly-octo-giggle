import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductEditFormProps {
  readonly product: Product;
}

export default function ProductEditForm({ product }: ProductEditFormProps) {
  const { formatPrice } = useCurrency();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-48 h-48 relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="192px"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2 gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {product.name}
            </h1>
            <Link
              href={`/admin/products/${product.id}/edit`}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition flex-shrink-0"
            >
              Edit Product
            </Link>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
            {product.description}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                Base Price:{" "}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatPrice(product.price)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Stock: </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {product.stock}
              </span>
            </div>
            <div>
              <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-semibold rounded">
                {product.category}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
