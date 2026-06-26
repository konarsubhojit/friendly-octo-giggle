import type { Metadata } from 'next'
import Hero from '@/components/sections/Hero'
import { STORE_NAME } from '@/lib/constants/store'

export const revalidate = 60

export const metadata: Metadata = {
  title: `${STORE_NAME} | Handcrafted with Love`,
  description:
    'Handmade crochet flowers, bags, keychains, and accessories — crafted with love, delivered to your door.',
}

export default async function Home() {
  return (
    <div className="bg-warm-gradient flex flex-col">
      <Hero />
    </div>
  )
}
