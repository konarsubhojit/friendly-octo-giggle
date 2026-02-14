'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

export default function CartIcon() {
  const [itemCount, setItemCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      const count = data.cart?.items?.reduce((total: number, item: { quantity: number }) => total + item.quantity, 0) || 0;
      setItemCount(count);
    } catch (err) {
      console.error('Error fetching cart count:', err);
    }
  }, []);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

  return (
    <Link href="/cart" className="relative text-gray-700 hover:text-blue-600 transition-all duration-300" aria-label="Shopping cart">
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
