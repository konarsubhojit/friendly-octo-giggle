import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { drizzleDb } from '@/lib/db'
import { db } from '@/lib/db'
import { products } from '@/lib/schema'
import { searchProductIds, searchProductIdsCached } from '@/lib/search'
import { convertPriceToINR, type CurrencyCode } from '@/lib/currency'
import { getVariantMinPrice, getVariantTotalStock } from '@/features/product/variant-utils'
import {
  CATALOG_SEARCH_MAX_RESULTS,
  TOOL_RESULT_MAX_CHARS,
} from './chat-constants'
import { toStockLabel } from './chat-commerce-context'
import type { AssistantTool } from './chat-types'

const MAX_QUERY_LENGTH = 200
const MAX_CATEGORY_LENGTH = 100
const MAX_PRODUCT_LOOKUPS = 4
const TOOL_DEFAULT_LIMIT = 6

const escapeLikeValue = (value: string): string =>
  value.replace(/[\\%_]/g, String.raw`\$&`)

const truncateToolResult = (value: string): string =>
  value.length > TOOL_RESULT_MAX_CHARS
    ? `${value.slice(0, TOOL_RESULT_MAX_CHARS - 1)}…`
    : value

type CatalogResultProduct = {
  id: string
  name: string
  category: string
  description: string
  minPrice: number
  stockLabel: string
}

const toCatalogResultProduct = (product: {
  id: string
  name: string
  category: string
  description: string
  variants?: Array<{ price: number; stock: number }>
}): CatalogResultProduct => ({
  id: product.id,
  name: product.name,
  category: product.category,
  description: product.description,
  minPrice: getVariantMinPrice(product.variants ?? []),
  stockLabel: toStockLabel(getVariantTotalStock(product.variants ?? [])),
})

const formatCatalogProductLine = (
  product: CatalogResultProduct,
  formatPrice: (priceInINR: number) => string
): string =>
  `- [${product.name}](/products/${product.id}) — ${formatPrice(product.minPrice)} — ${product.stockLabel}`

const formatCatalogProductDetailsLine = (
  product: CatalogResultProduct,
  formatPrice: (priceInINR: number) => string
): string =>
  `- [${product.name}](/products/${product.id}) — Category: ${product.category} — Price: ${formatPrice(product.minPrice)} — Availability: ${product.stockLabel} — Description: ${product.description}`

const applyBudgetFilter = (
  productsToFilter: CatalogResultProduct[],
  maxPriceInDisplayCurrency: number | undefined,
  currencyCode: CurrencyCode
): CatalogResultProduct[] => {
  if (!maxPriceInDisplayCurrency) return productsToFilter
  const maxPriceInINR = convertPriceToINR(maxPriceInDisplayCurrency, currencyCode)
  return productsToFilter.filter((product) => product.minPrice <= maxPriceInINR)
}

const orderProductsByIdList = (
  idList: readonly string[],
  rows: CatalogResultProduct[]
): CatalogResultProduct[] => {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return idList.map((id) => byId.get(id)).filter(Boolean) as CatalogResultProduct[]
}

const searchCatalogFallback = async (params: {
  query: string
  category?: string
  limit: number
}): Promise<CatalogResultProduct[]> => {
  const likeQuery = `%${escapeLikeValue(params.query)}%`
  const rows = await drizzleDb.query.products.findMany({
    where: and(
      isNull(products.deletedAt),
      params.category ? eq(products.category, params.category) : undefined,
      or(ilike(products.name, likeQuery), ilike(products.description, likeQuery))
    ),
    with: {
      variants: {
        where: (variant, { isNull: isVariantNull }) =>
          isVariantNull(variant.deletedAt),
        columns: { price: true, stock: true },
      },
    },
    orderBy: [desc(products.createdAt)],
    limit: params.limit,
  })

  return rows.map(toCatalogResultProduct)
}

const resolveCatalogSearchResults = async (params: {
  query: string
  category?: string
  limit: number
}): Promise<CatalogResultProduct[]> => {
  const matchedIds =
    (await searchProductIdsCached(params.query, {
      limit: params.limit,
      category: params.category,
    })) ??
    (await searchProductIds(params.query, {
      limit: params.limit,
      category: params.category,
    }))

  if (matchedIds && matchedIds.length > 0) {
    const rows = await db.products.findMinimalByIds(
      matchedIds.slice(0, params.limit),
      params.category
    )
    return orderProductsByIdList(
      matchedIds,
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        minPrice: row.price,
        stockLabel: toStockLabel(row.stock),
      }))
    ).slice(0, params.limit)
  }

  return searchCatalogFallback(params)
}

const resolveProductByIdOrName = async (
  term: string
): Promise<CatalogResultProduct | null> => {
  const productById = await db.products.findById(term, false)
  if (productById) {
    return toCatalogResultProduct(productById)
  }

  const likeQuery = `%${escapeLikeValue(term)}%`
  const row = await drizzleDb.query.products.findFirst({
    where: and(isNull(products.deletedAt), ilike(products.name, likeQuery)),
    with: {
      variants: {
        where: (variant, { isNull: isVariantNull }) =>
          isVariantNull(variant.deletedAt),
        columns: { price: true, stock: true },
      },
    },
    orderBy: [desc(products.createdAt)],
  })

  return row ? toCatalogResultProduct(row) : null
}

export const SearchCatalogArgs = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  category: z.string().trim().max(MAX_CATEGORY_LENGTH).optional(),
  maxPriceInDisplayCurrency: z.number().positive().optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(CATALOG_SEARCH_MAX_RESULTS)
    .default(TOOL_DEFAULT_LIMIT),
})

export const GetProductDetailsArgs = z.object({
  productIdsOrNames: z
    .array(z.string().trim().min(1).max(MAX_QUERY_LENGTH))
    .min(1)
    .max(MAX_PRODUCT_LOOKUPS),
})

export const searchCatalogTool: AssistantTool<z.infer<typeof SearchCatalogArgs>> =
  {
    name: 'search_catalog',
    description:
      'Search the storefront catalog for matching products and return grounded markdown links, prices, and qualitative availability.',
    argsSchema: SearchCatalogArgs,
    requiresAuth: false,
    async execute(args, ctx) {
      const matchingProducts = applyBudgetFilter(
        await resolveCatalogSearchResults({
          query: args.query,
          category: args.category,
          limit: args.limit,
        }),
        args.maxPriceInDisplayCurrency,
        ctx.currencyCode
      ).slice(0, args.limit)

      if (matchingProducts.length === 0) {
        return truncateToolResult(
          `No catalog product matches "${args.query}" right now.`
        )
      }

      return truncateToolResult(
        [
          `Catalog matches for "${args.query}":`,
          ...matchingProducts.map((product) =>
            formatCatalogProductLine(product, ctx.formatPrice)
          ),
        ].join('\n')
      )
    },
  }

export const getProductDetailsTool: AssistantTool<
  z.infer<typeof GetProductDetailsArgs>
> = {
  name: 'get_product_details',
  description:
    'Look up up to four specific products by id or fuzzy name and return grounded markdown links, prices, descriptions, and qualitative availability.',
  argsSchema: GetProductDetailsArgs,
  requiresAuth: false,
  async execute(args, ctx) {
    const resolvedProducts = (
      await Promise.all(
        args.productIdsOrNames.map((term) => resolveProductByIdOrName(term))
      )
    ).filter((product): product is CatalogResultProduct => product !== null)

    if (resolvedProducts.length === 0) {
      return truncateToolResult('No matching catalog products were found.')
    }

    return truncateToolResult(
      [
        'Product details:',
        ...resolvedProducts.map((product) =>
          formatCatalogProductDetailsLine(product, ctx.formatPrice)
        ),
      ].join('\n')
    )
  },
}
