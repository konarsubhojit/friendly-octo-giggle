import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { db, drizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'
import { searchProductIds, searchProductIdsCached } from '@/lib/search'
import { convertPriceToINR, type CurrencyCode } from '@/lib/currency'
import {
  getVariantMinPrice,
  getVariantTotalStock,
} from '@/features/product/variant-utils'
import {
  CATALOG_SEARCH_MAX_RESULTS,
  TOOL_RESULT_MAX_CHARS,
} from './chat-constants'
import { toStockLabel } from './chat-commerce-context'
import { sanitizeToolResultText } from './chat-prompt'
import type { AssistantTool } from './chat-types'

const MAX_QUERY_LENGTH = 200
const MAX_CATEGORY_LENGTH = 100
const MAX_PRODUCT_LOOKUPS = 4
const MAX_COMPARISON_TERMS = 3
const TOOL_DEFAULT_LIMIT = 6

const escapeLikeValue = (value: string): string =>
  value.replace(/[\\%_]/g, String.raw`\$&`)

const truncateToolResult = (value: string): string =>
  sanitizeToolResultText(
    value.length > TOOL_RESULT_MAX_CHARS
      ? `${value.slice(0, TOOL_RESULT_MAX_CHARS - 1)}…`
      : value
  )

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

export const extractComparisonTerms = (
  text: string,
  fallbackProductName?: string
): string[] => {
  const normalized = text
    .replace(/\bcompare\b/gi, ' ')
    .replace(/\bdifference\s+between\b/gi, ' ')
  const terms = normalized
    .split(/\b(?:vs\.?|versus|and|with)\b/gi)
    .map((part) => part.replace(/[^\w\s-]/g, ' ').trim())
    .filter((part) => part.length >= 3)
    .slice(0, MAX_COMPARISON_TERMS)

  if (terms.length > 0) return terms
  return fallbackProductName ? [fallbackProductName] : []
}

const formatComparableProduct = (
  product: CatalogResultProduct,
  formatPrice: (priceInINR: number) => string
): string =>
  `- [${product.name}](/products/${product.id}) — Category: ${product.category} — Price: ${formatPrice(product.minPrice)} — Availability: ${product.stockLabel}`

const applyBudgetFilter = (
  productsToFilter: CatalogResultProduct[],
  maxPriceInDisplayCurrency: number | undefined,
  currencyCode: CurrencyCode
): CatalogResultProduct[] => {
  if (!maxPriceInDisplayCurrency) return productsToFilter
  const maxPriceInINR = convertPriceToINR(
    maxPriceInDisplayCurrency,
    currencyCode
  )
  return productsToFilter.filter((product) => product.minPrice <= maxPriceInINR)
}

const orderProductsByIdList = (
  idList: readonly string[],
  rows: CatalogResultProduct[]
): CatalogResultProduct[] => {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return idList
    .map((id) => byId.get(id))
    .filter(Boolean) as CatalogResultProduct[]
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
      or(
        ilike(products.name, likeQuery),
        ilike(products.description, likeQuery)
      )
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

export const CompareProductsArgs = z.object({
  terms: z
    .array(z.string().trim().min(1).max(120))
    .min(1)
    .max(MAX_COMPARISON_TERMS),
})

export const searchCatalogTool: AssistantTool<
  z.infer<typeof SearchCatalogArgs>
> = {
  name: 'search_catalog',
  description:
    'Search the storefront catalog for matching products and return grounded markdown links, prices, and qualitative availability.',
  argsSchema: SearchCatalogArgs,
  requiresAuth: false,
  async execute(args, ctx) {
    const candidateProducts = await resolveCatalogSearchResults({
      query: args.query,
      category: args.category,
      limit: args.limit,
    })
    const matchingProducts = applyBudgetFilter(
      candidateProducts,
      args.maxPriceInDisplayCurrency,
      ctx.currencyCode
    ).slice(0, args.limit)

    if (matchingProducts.length === 0) {
      if (args.maxPriceInDisplayCurrency && candidateProducts.length > 0) {
        const nearestAlternatives = [...candidateProducts]
          .sort((left, right) => left.minPrice - right.minPrice)
          .slice(0, Math.min(3, candidateProducts.length))
        return truncateToolResult(
          [
            `No catalog product matches "${args.query}" within ${ctx.formatPrice(
              convertPriceToINR(
                args.maxPriceInDisplayCurrency,
                ctx.currencyCode
              )
            )}.`,
            'Nearest alternatives:',
            ...nearestAlternatives.map((product) =>
              formatCatalogProductLine(product, ctx.formatPrice)
            ),
          ].join('\n')
        )
      }

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

export const compareProductsTool: AssistantTool<
  z.infer<typeof CompareProductsArgs>
> = {
  name: 'compare_products',
  description:
    'Compare up to three catalog products using only grounded product attributes, prices, and qualitative availability.',
  argsSchema: CompareProductsArgs,
  requiresAuth: false,
  async execute(args, ctx) {
    const conditions = args.terms.map((term) =>
      ilike(products.name, `%${escapeLikeValue(term)}%`)
    )
    if (conditions.length === 0) {
      return 'I could not find enough catalog products to compare.'
    }

    const rows = await drizzleDb.query.products.findMany({
      where: and(isNull(products.deletedAt), or(...conditions)),
      with: {
        variants: {
          where: (variant, { isNull: isVariantNull }) =>
            isVariantNull(variant.deletedAt),
          columns: { price: true, stock: true },
        },
      },
      limit: 4,
    })

    if (rows.length <= 1) {
      return 'I could not find enough catalog products to compare.'
    }

    return truncateToolResult(
      [
        'Comparison candidates:',
        ...rows.map((row) =>
          formatComparableProduct(toCatalogResultProduct(row), ctx.formatPrice)
        ),
      ].join('\n')
    )
  },
}
