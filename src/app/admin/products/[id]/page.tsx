import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { drizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'
import { eq, and, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { AdminPageShell } from '@/features/admin/components/AdminPageShell'
import VariationList from '@/features/admin/components/VariationList'
import ProductEditForm from '@/features/admin/components/ProductEditForm'
import { serializeVariant } from '@/lib/serializers'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'

export const dynamic = 'force-dynamic'

interface PageProps {
  readonly params: Promise<{ id: string }>
}

export default async function AdminProductEditPage({ params }: PageProps) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') {
    redirect('/auth/signin')
  }

  const { id } = await params

  const product = await drizzleDb.query.products.findFirst({
    where: and(eq(products.id, id), isNull(products.deletedAt)),
    with: {
      variants: {
        where: (v, { isNull }) => isNull(v.deletedAt),
      },
    },
  })

  if (!product) {
    notFound()
  }

  const serializedVariants = product.variants.map(serializeVariant)

  const minPrice = getVariantMinPrice(serializedVariants)
  const totalStock = getVariantTotalStock(serializedVariants)

  const serializedProduct = {
    id: product.id,
    name: product.name,
    description: product.description,
    image: product.image,
    images: product.images ?? [],
    category: product.category,
    deletedAt: null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: serializedVariants,
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Products', href: '/admin/products' },
        { label: serializedProduct.name },
      ]}
      eyebrow="Product overview"
      title={serializedProduct.name}
      description="View product details, pricing, stock, and variants."
      actions={
        <Link
          href={`/admin/products/${serializedProduct.id}/edit`}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Edit Product
        </Link>
      }
      metrics={[
        {
          label: 'From price',
          value: `$${minPrice.toFixed(2)}`,
          hint: 'Lowest variant price.',
          tone: 'emerald',
        },
        {
          label: 'Total stock',
          value: String(totalStock),
          hint: 'Combined variant stock.',
          tone: totalStock > 0 ? 'sky' : 'rose',
        },
        {
          label: 'Variants',
          value: String(serializedVariants.length),
          hint: 'Active product variants.',
          tone: 'amber',
        },
      ]}
    >
      <ProductEditForm product={serializedProduct} />
      <VariationList
        productId={product.id}
        initialVariants={serializedVariants}
      />
    </AdminPageShell>
  )
}
