'use client'

import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/types'
import ProductFormModal from '@/features/admin/components/ProductFormModal'
import { useLocale } from '@/contexts/LocaleContext'

interface ProductEditPageFormProps {
  readonly product: Product
}

export default function ProductEditPageForm({
  product,
}: ProductEditPageFormProps) {
  const router = useRouter()
  const { localizePath } = useLocale()

  const handleCancel = () => {
    router.push(localizePath(`/admin/products/${product.id}`))
  }

  const handleSuccess = (savedProduct: Product) => {
    router.push(localizePath(`/admin/products/${savedProduct.id}`))
    router.refresh()
  }

  return (
    <ProductFormModal
      editingProduct={product}
      layout="page"
      onClose={handleCancel}
      onSuccess={handleSuccess}
    />
  )
}
