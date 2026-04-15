'use client'

import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react'
import Link from 'next/link'
import { Product } from '@/lib/types'
import { useCurrency } from '@/contexts/CurrencyContext'
import toast from 'react-hot-toast'
import { useDispatch } from 'react-redux'
import { upsertProduct } from '@/features/admin/store/adminSlice'
import type { AppDispatch } from '@/lib/store'
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
import { DataTable, type DataTableColumn } from 'zenput'

const ProductFormModal = lazy(
  () => import('@/features/admin/components/ProductFormModal')
)
const DeleteConfirmModal = lazy(
  () => import('@/features/admin/components/DeleteConfirmModal')
)

const PAGE_SIZE = 20

type ProductRow = {
  id: string
  name: string
  category: string
  price: string
  stock: number
}

export default function ProductsManagement() {
  const { formatPrice } = useCurrency()
  const dispatch = useDispatch<AppDispatch>()

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
    if (!productToDelete || deleting) return
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
      setShowDeleteModal(false)
      setProductToDelete(null)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteModal(false)
    setProductToDelete(null)
  }

  const productColumns: DataTableColumn<ProductRow>[] = [
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'price', header: 'Price' },
    { key: 'stock', header: 'Stock', filterable: true },
    {
      key: 'actions',
      header: 'Actions',
      render: (_value, row) => (
        <div className="flex gap-2">
          <Link
            href={`/admin/products/${row.id}`}
            className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Open
          </Link>
          <button
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
    <DataTable
      columns={productColumns}
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
    />
  )

  const inStockProducts = products.filter(
    (product) => getVariantTotalStock(product.variants) > 0
  ).length
  const lowStockProducts = products.filter(
    (product) =>
      getVariantTotalStock(product.variants) > 0 &&
      getVariantTotalStock(product.variants) <= 5
  ).length

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Products' }]}
      eyebrow="Catalog operations"
      title="Product Management"
      description="Manage the product catalogue, review stock levels, and update product details."
      actions={
        <>
          <button
            onClick={handleReset}
            disabled={loading}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
          <button
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
          <DeleteConfirmModal
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
            loading={deleting}
          />
        </Suspense>
      )}
    </AdminPageShell>
  )
}
