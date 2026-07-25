import { describe, it, expect } from 'vitest'
import {
  getFirstVariant,
  resolveInitialVariant,
  getClampedQtyState,
  getOptionButtonClassName,
  buildValueMap,
  getVariantLabel,
  buildSelectedOptionValues,
  buildVariantValueIndex,
  getVariantOptionValueSet,
  updateValueStatus,
  deriveOptionsFromSkus,
  type OptionValueStatus,
} from '@/app/(public)/products/[id]/lib/variant-utils'
import type { Product, ProductVariant } from '@/lib/types'

const makeVariant = (
  overrides: Partial<ProductVariant> & { id: string }
): ProductVariant =>
  ({
    productId: 'p1',
    sku: null,
    image: null,
    images: [],
    price: 10,
    stock: 5,
    deletedAt: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }) as ProductVariant

const makeProduct = (variants: ProductVariant[]): Product =>
  ({ id: 'p1', variants }) as Product

const options = [
  {
    id: 'opt1',
    productId: 'p1',
    name: 'Color',
    sortOrder: 0,
    createdAt: '',
    values: [
      { id: 'v1', optionId: 'opt1', value: 'Red', sortOrder: 0, createdAt: '' },
      {
        id: 'v2',
        optionId: 'opt1',
        value: 'Blue',
        sortOrder: 1,
        createdAt: '',
      },
    ],
  },
] as NonNullable<Product['options']>

describe('getFirstVariant', () => {
  it('returns the first variant', () => {
    const variant = makeVariant({ id: 'a' })
    expect(getFirstVariant(makeProduct([variant]))).toBe(variant)
  })

  it('returns null when there are no variants', () => {
    expect(getFirstVariant({ id: 'p1' } as Product)).toBeNull()
    expect(getFirstVariant(makeProduct([]))).toBeNull()
  })
})

describe('resolveInitialVariant', () => {
  const a = makeVariant({ id: 'a' })
  const b = makeVariant({ id: 'b' })

  it('returns the first variant when no id is requested', () => {
    expect(resolveInitialVariant(makeProduct([a, b]), null)).toBe(a)
  })

  it('returns the requested variant', () => {
    expect(resolveInitialVariant(makeProduct([a, b]), 'b')).toBe(b)
  })

  it('falls back to the first variant for an unknown id', () => {
    expect(resolveInitialVariant(makeProduct([a, b]), 'zzz')).toBe(a)
  })

  it('handles a product without variants', () => {
    expect(resolveInitialVariant({ id: 'p1' } as Product, 'b')).toBeNull()
  })
})

describe('getClampedQtyState', () => {
  it('keeps the quantity when the product is out of stock', () => {
    expect(getClampedQtyState(3, 0)).toEqual({ qty: 3, message: '' })
  })

  it('clamps the quantity to the available stock', () => {
    expect(getClampedQtyState(9, 4)).toEqual({
      qty: 4,
      message: 'Only 4 available',
    })
  })

  it('keeps a quantity within stock', () => {
    expect(getClampedQtyState(2, 4)).toEqual({ qty: 2, message: '' })
  })
})

describe('getOptionButtonClassName', () => {
  it.each([
    [true, true],
    [false, true],
    [true, false],
    [false, false],
  ])('returns a class for active=%s outOfStock=%s', (active, oos) => {
    const className = getOptionButtonClassName(active, oos)
    expect(className).toContain('rounded-lg')
    expect(className.includes('line-through')).toBe(oos)
  })

  it('distinguishes active from inactive states', () => {
    expect(getOptionButtonClassName(true, false)).not.toBe(
      getOptionButtonClassName(false, false)
    )
    expect(getOptionButtonClassName(true, true)).not.toBe(
      getOptionButtonClassName(false, true)
    )
  })
})

describe('buildValueMap', () => {
  it('maps value ids to labels', () => {
    expect(buildValueMap(options).get('v1')).toBe('Red')
  })

  it('tolerates options without values', () => {
    const map = buildValueMap([
      { ...options[0], values: undefined },
    ] as unknown as NonNullable<Product['options']>)
    expect(map.size).toBe(0)
  })
})

describe('getVariantLabel', () => {
  const valueMap = buildValueMap(options)

  it('joins the resolved option values', () => {
    const variant = makeVariant({
      id: 'a',
      optionValues: [{ id: 'v1' }, { id: 'v2' }],
    } as never)
    expect(getVariantLabel(variant, valueMap)).toBe('Red / Blue')
  })

  it('falls back to the SKU when there are no option values', () => {
    expect(
      getVariantLabel(makeVariant({ id: 'a', sku: 'SKU-1' }), valueMap)
    ).toBe('SKU-1')
    expect(
      getVariantLabel(
        makeVariant({ id: 'a', sku: 'SKU-1', optionValues: [] } as never),
        valueMap
      )
    ).toBe('SKU-1')
  })

  it('falls back to a generic label without a SKU', () => {
    expect(getVariantLabel(makeVariant({ id: 'a' }), valueMap)).toBe('Variant')
  })

  it('falls back when no option value resolves', () => {
    const variant = makeVariant({
      id: 'a',
      optionValues: [{ id: 'unknown' }],
    } as never)
    expect(getVariantLabel(variant, valueMap)).toBe('Variant')
  })
})

describe('buildSelectedOptionValues', () => {
  it('returns an empty map without a variant', () => {
    expect(buildSelectedOptionValues(null, options).size).toBe(0)
    expect(
      buildSelectedOptionValues(makeVariant({ id: 'a' }), options).size
    ).toBe(0)
  })

  it('maps option ids to the selected value id', () => {
    const variant = makeVariant({
      id: 'a',
      optionValues: [{ id: 'v2' }],
    } as never)
    expect(buildSelectedOptionValues(variant, options).get('opt1')).toBe('v2')
  })

  it('ignores values that belong to no option', () => {
    const variant = makeVariant({
      id: 'a',
      optionValues: [{ id: 'nope' }],
    } as never)
    expect(buildSelectedOptionValues(variant, options).size).toBe(0)
  })
})

describe('buildVariantValueIndex', () => {
  it('indexes option value ids per variant', () => {
    const index = buildVariantValueIndex([
      makeVariant({ id: 'a', optionValues: [{ id: 'v1' }] } as never),
      makeVariant({ id: 'b' }),
    ])
    expect(index.get('a')).toEqual(new Set(['v1']))
    expect(index.get('b')).toEqual(new Set())
  })

  it('returns an empty set for unknown variants', () => {
    const index = buildVariantValueIndex([])
    expect(getVariantOptionValueSet(makeVariant({ id: 'x' }), index)).toEqual(
      new Set()
    )
  })
})

describe('updateValueStatus', () => {
  it('marks a value available when there is stock', () => {
    const map = new Map<string, OptionValueStatus>()
    updateValueStatus(map, 'v1', 3)
    expect(map.get('v1')).toBe('available')
  })

  it('marks a value out of stock when there is none', () => {
    const map = new Map<string, OptionValueStatus>()
    updateValueStatus(map, 'v1', 0)
    expect(map.get('v1')).toBe('outOfStock')
  })

  it('does not downgrade an available value', () => {
    const map = new Map<string, OptionValueStatus>([['v1', 'available']])
    updateValueStatus(map, 'v1', 0)
    expect(map.get('v1')).toBe('available')
  })

  it('upgrades an out-of-stock value', () => {
    const map = new Map<string, OptionValueStatus>([['v1', 'outOfStock']])
    updateValueStatus(map, 'v1', 2)
    expect(map.get('v1')).toBe('available')
  })
})

describe('deriveOptionsFromSkus', () => {
  it('returns null without variants', () => {
    expect(deriveOptionsFromSkus([])).toBeNull()
  })

  it('returns null when a SKU is missing', () => {
    expect(deriveOptionsFromSkus([makeVariant({ id: 'a' })])).toBeNull()
  })

  it('returns null for single-segment SKUs', () => {
    expect(
      deriveOptionsFromSkus([makeVariant({ id: 'a', sku: 'Red' })])
    ).toBeNull()
  })

  it('returns null for inconsistent segment counts', () => {
    expect(
      deriveOptionsFromSkus([
        makeVariant({ id: 'a', sku: 'Red-L' }),
        makeVariant({ id: 'b', sku: 'Red-L-Extra' }),
      ])
    ).toBeNull()
  })

  it('returns null when every dimension has a single value', () => {
    expect(
      deriveOptionsFromSkus([
        makeVariant({ id: 'a', sku: 'Red-L' }),
        makeVariant({ id: 'b', sku: 'Red-L' }),
      ])
    ).toBeNull()
  })

  it('derives options and patches variants', () => {
    const result = deriveOptionsFromSkus([
      makeVariant({ id: 'a', sku: 'Red-L' }),
      makeVariant({ id: 'b', sku: 'Blue-XL' }),
    ])

    expect(result).not.toBeNull()
    expect(result?.options).toHaveLength(2)
    expect(result?.options[0].name).toBe('Option 1')
    expect(result?.options[0].values.map((v) => v.value)).toEqual([
      'Red',
      'Blue',
    ])
    expect(result?.variants[0].optionValues).toEqual([
      expect.objectContaining({ value: 'Red', optionId: '_derived_opt_0' }),
      expect.objectContaining({ value: 'L', optionId: '_derived_opt_1' }),
    ])
  })

  it('supports a custom delimiter and trims segments', () => {
    const result = deriveOptionsFromSkus(
      [
        makeVariant({ id: 'a', sku: 'Red | L' }),
        makeVariant({ id: 'b', sku: 'Blue | L' }),
      ],
      '|'
    )

    expect(result?.options[0].values.map((v) => v.value)).toEqual([
      'Red',
      'Blue',
    ])
  })
})
