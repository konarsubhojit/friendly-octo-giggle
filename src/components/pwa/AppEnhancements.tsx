'use client'

import dynamic from 'next/dynamic'

const Toaster = dynamic(
  () => import('react-hot-toast').then((module) => ({ default: module.Toaster })),
  { ssr: false }
)
const InstallBanner = dynamic(
  () =>
    import('@/components/pwa/InstallBanner').then((module) => ({
      default: module.InstallBanner,
    })),
  { ssr: false }
)
const ServiceWorkerRegistration = dynamic(
  () =>
    import('@/components/pwa/ServiceWorkerRegistration').then((module) => ({
      default: module.ServiceWorkerRegistration,
    })),
  { ssr: false }
)

export function AppEnhancements() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          ariaProps: {
            role: 'status',
            'aria-live': 'polite',
          },
          style: {
            background: 'var(--surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--border-warm)',
            borderRadius: '16px',
          },
        }}
      />
      <InstallBanner />
      <ServiceWorkerRegistration />
    </>
  )
}
