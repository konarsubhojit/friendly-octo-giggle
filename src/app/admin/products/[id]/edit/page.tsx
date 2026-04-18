import { and, eq, isNull } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { AdminPageShell } from '@/features/admin/components/AdminPageShell'
import ProductEditPageForm from '@/features/admin/components/ProductEditPageForm'
import VariantList from '@/features/admin/components/VariantList'
import { auth } from '@/lib/auth'
import { drizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'
import { serializeVariant } from '@/lib/serializers'

export const dynamic = 'force-dynamic'

interface PageProps {
  readonly params: Promise<{ id: string }>
}

export default async function AdminProductEditFormPage({ params }: PageProps) {
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
  }

  const serializedVariants = product.variants.map(serializeVariant)

  const variantsInStock = serializedVariants.filter(
    (variant) => variant.stock > 0
  ).length

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Products', href: '/admin/products' },
        {
          label: serializedProduct.name,
          href: `/admin/products/${serializedProduct.id}`,
        },
        { label: 'Edit Product' },
      ]}
      eyebrow="Catalog editing"
      title="Edit Product"
      description="Update product information and manage variants."
      actions={
        <Link
          href={`/admin/products/${serializedProduct.id}`}
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
        >
          Back to Overview
        </Link>
      }
      metrics={[
        {
          label: 'Variants',
          value: String(serializedVariants.length),
          hint: 'Active product variants.',
          tone: 'amber',
        },
        {
          label: 'In stock',
          value: String(variantsInStock),
          hint: 'Variants with available stock.',
          tone: variantsInStock > 0 ? 'emerald' : 'rose',
        },
      ]}
    >
      <ProductEditPageForm product={serializedProduct} />
      <VariantList
        productId={serializedProduct.id}
        initialVariants={serializedVariants}
      />
    </AdminPageShell>
  )
}
