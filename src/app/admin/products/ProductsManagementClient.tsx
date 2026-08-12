'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
  useRef,
} from 'react'
import Link from 'next/link'
import { Product } from '@/lib/types'
import { useCurrency } from '@/contexts/CurrencyContext'
import toast from 'react-hot-toast'
import { useDispatch } from 'react-redux'
import { upsertProduct } from '@/features/admin/store/adminSlice'
import type { AdminDispatch } from '@/lib/store'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { AdminSearchForm } from '@/features/admin/components/AdminSearchForm'
import { Badge, type DataTableColumn } from 'zenput'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import {
  createProductsDefinition,
  type ProductRow as ProductDefinitionRow,
} from '@/features/admin/resources/products'
import type {
  BulkResult,
  BulkSelection,
} from '@/features/admin/components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

const ProductFormModal = lazy(
  () => import('@/features/admin/components/ProductFormModal')
)
const AdminConfirmDialog = lazy(
  () => import('@/features/admin/components/AdminConfirmDialog')
)

const PAGE_SIZE = 20

type ProductRow = ProductDefinitionRow

interface ProductsManagementProps {
  readonly permissions: readonly AdminPermission[]
}

export default function ProductsManagementClient({
  permissions,
}: ProductsManagementProps) {
  const { formatPrice } = useCurrency()
  const dispatch = useDispatch<AdminDispatch>()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const pageCursorsRef = useRef<Array<string | null>>([null])
  const pendingOffsetRef = useRef<number | null>(null)

  const syncPageCursors = useCallback((nextValue: Array<string | null>) => {
    pageCursorsRef.current = nextValue
  }, [])

  const fetchProducts = useCallback(
    async (
      cursorParam: string | null,
      searchQuery: string,
      offsetVal?: number
    ) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
        if (offsetVal !== undefined && offsetVal > 0) {
          params.set('offset', String(offsetVal))
        } else if (cursorParam) {
          params.set('cursor', cursorParam)
        }
        if (searchQuery) params.set('search', searchQuery)

        const res = await fetch(`/api/admin/products?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load products')
        }
        const data = await res.json()
        const items: Product[] = data.data?.products ?? data.products ?? []
        setProducts(items)
        setTotalCount(Number(data.data?.totalCount ?? data.totalCount ?? 0))
        const discoveredCursors = pageCursorsRef.current.slice(0, currentPage)
        if (data.data?.nextCursor) {
          discoveredCursors[currentPage] = data.data.nextCursor
        }
        syncPageCursors(discoveredCursors)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [currentPage, syncPageCursors]
  )

  useEffect(() => {
    const pendingOffset = pendingOffsetRef.current
    pendingOffsetRef.current = null
    const effectiveCursor = pendingOffset === null ? cursor : null
    fetchProducts(effectiveCursor, search, pendingOffset ?? undefined)
  }, [fetchProducts, cursor, search])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handleSearch = (e: React.BaseSyntheticEvent) => {
    e.preventDefault()
    syncPageCursors([null])
    setCurrentPage(1)
    setCursor(null)
    setSearch(searchInput.trim())
  }

  const handleFirst = () => {
    if (currentPage === 1) return
    setCurrentPage(1)
    setCursor(null)
  }

  const handlePageSelect = (page: number) => {
    const targetPage = Math.min(Math.max(1, page), totalPages)
    if (targetPage === currentPage) return

    if (targetPage === 1) {
      handleFirst()
      return
    }

    const knownCursor = pageCursorsRef.current[targetPage - 1]
    if (knownCursor !== undefined) {
      setCurrentPage(targetPage)
      setCursor(knownCursor)
      return
    }

    pendingOffsetRef.current = (targetPage - 1) * PAGE_SIZE
    setCurrentPage(targetPage)
  }

  const handleReset = () => {
    syncPageCursors([null])
    setCurrentPage(1)
    setCursor(null)
    setTotalCount(0)
    setSearch('')
    setSearchInput('')
  }

  const handleOpenModal = (product?: Product) => {
    setEditingProduct(product || null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingProduct(null)
  }

  const handleProductSaved = (product: Product) => {
    dispatch(upsertProduct(product))
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = product
        return updated
      }
      return [product, ...prev]
    })
  }

  const handleDelete = (id: string) => {
    setProductToDelete(id)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!productToDelete || deleting) {
      return { status: 'failure', reason: 'No product selected.' } as const
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/products/${productToDelete}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete product')
      }
      toast.success('Product deleted successfully')
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete))
      return { status: 'success' } as const
    } catch (err) {
      const reason =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      toast.error(reason)
      return { status: 'failure', reason } as const
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setProductToDelete(null)
  }

  // Resolves the set of product ids a bulk action applies to. For the
  // "selected rows on this page" scope the ids are already known; for
  // "entire filtered result" the current search snapshot is replayed
  // against the list endpoint to discover every matching id server-side.
  const resolveBulkProductIds = useCallback(
    async (selection: BulkSelection): Promise<string[]> => {
      if (selection.scope === 'loaded_page') {
        return selection.rowIds.map(String)
      }
      const snapshot = selection.filterSnapshot as { search?: string }
      const params = new URLSearchParams({
        limit: String(Math.max(totalCount, PAGE_SIZE)),
      })
      if (snapshot.search) params.set('search', snapshot.search)
      const res = await fetch(`/api/admin/products?${params.toString()}`)
      if (!res.ok) return []
      const data = await res.json().catch(() => ({}))
      const items: Product[] = data.data?.products ?? data.products ?? []
      return items.map((product) => product.id)
    },
    [totalCount]
  )

  const applyBulkDelete = useCallback(
    async (selection: BulkSelection): Promise<BulkResult> => {
      const productIds = await resolveBulkProductIds(selection)
      if (productIds.length === 0) {
        return { succeeded: [], failed: [] }
      }
      try {
        const res = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'bulk_soft_delete', productIds }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const reason = data.error ?? 'Failed to delete products'
          return {
            succeeded: [],
            failed: productIds.map((rowId) => ({ rowId, reason })),
          }
        }
        setProducts((prev) => prev.filter((p) => !productIds.includes(p.id)))
        return { succeeded: productIds, failed: [] }
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : 'Failed to delete products'
        return {
          succeeded: [],
          failed: productIds.map((rowId) => ({ rowId, reason })),
        }
      }
    },
    [resolveBulkProductIds]
  )

  const productsDefinition = useMemo(
    () =>
      createProductsDefinition(permissions, {
        // Row actions aren't rendered by AdminDataView yet (only columns
        // and bulk actions are consumed today) — the equivalent affordances
        // are handled inline via the "actions" column appended below. See
        // specs/024-admin-console-revamp/tasks.md for tracked follow-up.
        onEdit: () => {},
        onViewDetail: () => {},
        onDelete: (row) => handleDelete(row.id),
        onBulkDelete: applyBulkDelete,
      }),
    [permissions, applyBulkDelete]
  )

  const productColumns: DataTableColumn<ProductRow>[] = [
    ...productsDefinition.columns,
    {
      key: 'actions',
      header: 'Actions',
      sticky: 'right',
      render: (_value, row) => (
        <div className="flex gap-2">
          <Link
            href={`/admin/products/${row.id}`}
            className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(row.id)}
            disabled={deleting}
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      ),
    },
  ]

  const productRows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: formatPrice(getVariantMinPrice(p.variants)),
    stock: getVariantTotalStock(p.variants),
  }))

  const productsListContent = (
    <AdminDataView
      ariaLabel="Products"
      definition={{ ...productsDefinition, columns: productColumns }}
      data={productRows}
      rowKey={(row) => row.id}
      loading={loading}
      skeletonRowCount={PAGE_SIZE}
      emptyMessage={
        search ? 'No products match your search.' : 'No products yet.'
      }
      pagination={{
        currentPage,
        pageSize: PAGE_SIZE,
        totalCount,
        onPageChange: handlePageSelect,
      }}
      filterSnapshot={{ search }}
      csvExport={{
        exportUrl: '/api/admin/export/products',
        filenameFallback: 'products.csv',
      }}
      renderMobileCard={(row) => (
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-slate-950 dark:text-slate-50">
                {row.name}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {row.category}
              </p>
            </div>
            <Badge tone={row.stock > 0 ? 'success' : 'danger'} size="sm">
              {row.stock > 0 ? `${row.stock} in stock` : 'Out of stock'}
            </Badge>
          </div>
          <p className="mt-4 text-lg font-bold text-slate-950 dark:text-slate-50">
            {row.price}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            <Link
              href={`/admin/products/${row.id}`}
              className="min-tap inline-flex items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open product
            </Link>
            <button
              type="button"
              onClick={() => handleDelete(row.id)}
              disabled={deleting}
              className="min-tap rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    />
  )

  const stockValues = productRows.map((r) => r.stock)
  const inStockProducts = stockValues.filter((s) => s > 0).length
  const lowStockProducts = stockValues.filter((s) => s > 0 && s <= 5).length

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Products' }]}
      eyebrow="Catalog operations"
      title="Product Management"
      description="Manage the product catalogue, review stock levels, and update product details."
      actions={
        <>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Add Product
          </button>
        </>
      }
      metrics={[
        {
          label: 'Catalog size',
          value: String(totalCount),
          hint: 'Total products in the catalogue.',
          tone: 'sky',
        },
        {
          label: 'In stock',
          value: String(inStockProducts),
          hint: 'Products with available stock.',
          tone: 'emerald',
        },
        {
          label: 'Low stock',
          value: String(lowStockProducts),
          hint: 'Products at 5 units or fewer.',
          tone: lowStockProducts > 0 ? 'amber' : 'slate',
        },
      ]}
    >
      <AdminPanel title="Search" description="Filter by product name.">
        <AdminSearchForm
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          search={search}
          onSearch={handleSearch}
          onClear={handleReset}
          placeholder="Search products…"
          ariaLabel="Search products by name"
        />
      </AdminPanel>

      {error ? (
        <AlertBanner message={error} variant="error" className="mb-0" />
      ) : null}

      <AdminPanel
        title="Results"
        description="Click a product to view details and edit."
      >
        {productsListContent}
      </AdminPanel>

      {showModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
                <LoadingSpinner />
              </div>
            </div>
          }
        >
          <ProductFormModal
            editingProduct={editingProduct}
            onClose={handleCloseModal}
            onSuccess={handleProductSaved}
          />
        </Suspense>
      )}

      {showDeleteModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
                <LoadingSpinner />
              </div>
            </div>
          }
        >
          <AdminConfirmDialog
            open={showDeleteModal}
            onClose={cancelDelete}
            title="Delete product"
            description={`Delete product ${productToDelete ?? ''} from the catalogue.`}
            reversible={false}
            confirmLabel="Delete product"
            onConfirm={confirmDelete}
          />
        </Suspense>
      )}
    </AdminPageShell>
  )
}
