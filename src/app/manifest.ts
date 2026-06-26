import type { MetadataRoute } from 'next'
import { STORE_NAME, STORE_SHORT_NAME } from '@/lib/constants/store'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: STORE_NAME,
    short_name: STORE_SHORT_NAME,
    description:
      'Handmade crochet flowers, bags, keychains, and accessories — crafted with love.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf5ee',
    theme_color: '#e89588',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/mobile-home.png',
        sizes: '390x844',
        form_factor: 'narrow',
      },
    ],
    shortcuts: [
      {
        name: 'Shop',
        short_name: 'Shop',
        description: 'Browse all products',
        url: '/shop',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Cart',
        short_name: 'Cart',
        description: 'View your cart',
        url: '/cart',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
