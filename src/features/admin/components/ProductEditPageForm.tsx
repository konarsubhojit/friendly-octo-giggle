'use client'

import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/types'
import ProductFormModal from '@/features/admin/components/ProductFormModal'
import { getProductFormPresentation } from '@/features/admin/services/form-presentation-rule'

interface ProductEditPageFormProps {
  readonly product: Product
}

export default function ProductEditPageForm({
  product,
}: ProductEditPageFormProps) {
  const router = useRouter()

  const handleCancel = () => {
    router.push(`/admin/products/${product.id}`)
  }

  const handleSuccess = (savedProduct: Product) => {
    router.push(`/admin/products/${savedProduct.id}`)
    router.refresh()
  }

  // FR-B02/T065: editing a product also curates variants/options — the
  // nested structure the presentation rule routes to a dedicated screen.
  const layout =
    getProductFormPresentation('edit') === 'dedicated-screen'
      ? 'page'
      : 'modal'

  return (
    <ProductFormModal
      editingProduct={product}
      layout={layout}
      onClose={handleCancel}
      onSuccess={handleSuccess}
    />
  )
}
