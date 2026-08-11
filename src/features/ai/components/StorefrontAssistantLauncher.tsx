'use client'

import dynamic from 'next/dynamic'

const StorefrontAssistant = dynamic(
  () => import('@/features/ai/components/StorefrontAssistant'),
  { ssr: false }
)

export default function StorefrontAssistantLauncher() {
  return <StorefrontAssistant />
}
