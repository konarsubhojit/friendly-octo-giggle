"use client";

import Image from "next/image";
import type { Product } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductEditFormProps {
  readonly product: Product;
}

export default function ProductEditForm({ product }: ProductEditFormProps) {
  const { formatPrice } = useCurrency();

  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)]">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="relative h-48 w-full flex-shrink-0 overflow-hidden rounded-[1.5rem] bg-slate-100 md:w-48">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="192px"
          />
        </div>
        <div className="flex-1">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-sky-700">
                Product summary
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                {product.name}
              </h2>
            </div>
          </div>
          <p className="mb-5 max-w-3xl text-sm leading-6 text-slate-600">
            {product.description}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Base price
              </p>
              <p className="mt-2 text-lg font-bold text-slate-950">
                {formatPrice(product.price)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Stock
              </p>
              <p className="mt-2 text-lg font-bold text-slate-950">
                {product.stock}
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Category
              </p>
              <p className="mt-2 text-lg font-bold text-slate-950">
                {product.category}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
