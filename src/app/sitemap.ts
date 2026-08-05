import type { MetadataRoute } from 'next'

const ROUTES = [
  '/',
  '/about',
  '/contact',
  '/shipping',
  '/returns',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  return ROUTES.map((route) => ({
    url: `${base}${route === '/' ? '' : route}`,
  }))
}
