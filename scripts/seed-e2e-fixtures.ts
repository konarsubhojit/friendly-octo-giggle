/* eslint-disable no-console */
import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, inArray } from 'drizzle-orm'
import { Pool } from 'pg'
import {
  accounts,
  categories,
  productOptions,
  productOptionValues,
  productVariantOptionValues,
  productVariants,
  products,
  users,
} from '../src/lib/schema'

const BCRYPT_COST = 12

const CATEGORY_ID = 'e2ecat1'
const CATALOG_PRODUCT_ID = 'e2eprd1'
const VARIANT_PRODUCT_ID = 'e2eprd2'

const OPTION_SIZE_ID = 'e2eopt1'
const OPTION_COLOR_ID = 'e2eopt2'

const OPTION_VALUE_IDS = {
  sizeSmall: 'e2eov01',
  sizeLarge: 'e2eov02',
  colorRed: 'e2eov03',
  colorBlue: 'e2eov04',
} as const

const VARIANT_IDS = {
  catalog: 'e2evar0',
  smallRed: 'e2evar1',
  smallBlue: 'e2evar2',
  largeRed: 'e2evar3',
  largeBlue: 'e2evar4',
} as const

const PRODUCT_IDS = [CATALOG_PRODUCT_ID, VARIANT_PRODUCT_ID]

const IMAGE = 'https://placehold.co/600x600/png'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set to seed end-to-end fixtures`)
  }
  return value
}

const seedAdminUser = async (
  database: ReturnType<typeof drizzle>
): Promise<void> => {
  const email = requireEnv('COPILOT_DEV_EMAIL').toLowerCase()
  const password = requireEnv('COPILOT_DEV_PASS')
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  const [existing] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing) {
    await database.delete(accounts).where(eq(accounts.userId, existing.id))
    await database.delete(users).where(eq(users.id, existing.id))
  }

  await database.insert(users).values({
    email,
    name: 'E2E Admin',
    passwordHash,
    role: 'ADMIN',
    emailVerified: new Date(),
    sessionVersion: 1,
    lockedUntil: null,
  })
}

const seedCatalog = async (
  database: ReturnType<typeof drizzle>
): Promise<void> => {
  await database.delete(products).where(inArray(products.id, PRODUCT_IDS))
  await database.delete(categories).where(eq(categories.id, CATEGORY_ID))

  await database.insert(categories).values({
    id: CATEGORY_ID,
    name: 'E2E Fixtures',
    sortOrder: 0,
  })

  await database.insert(products).values([
    {
      id: CATALOG_PRODUCT_ID,
      name: 'E2E Catalog Product',
      description:
        'A deterministic catalog fixture guaranteeing at least one browsable product card.',
      image: IMAGE,
      images: [IMAGE],
      category: 'E2E Fixtures',
    },
    {
      id: VARIANT_PRODUCT_ID,
      name: 'E2E Variant Product',
      description:
        'A deterministic fixture carrying two option dimensions and four purchasable variants.',
      image: IMAGE,
      images: [IMAGE],
      category: 'E2E Fixtures',
    },
  ])

  await database.insert(productVariants).values({
    id: VARIANT_IDS.catalog,
    productId: CATALOG_PRODUCT_ID,
    sku: 'E2E-CATALOG',
    price: 19.99,
    stock: 50,
    image: IMAGE,
    images: [IMAGE],
    sortOrder: 0,
  })
}

const seedVariantMatrix = async (
  database: ReturnType<typeof drizzle>
): Promise<void> => {
  await database.insert(productOptions).values([
    {
      id: OPTION_SIZE_ID,
      productId: VARIANT_PRODUCT_ID,
      name: 'Size',
      sortOrder: 0,
    },
    {
      id: OPTION_COLOR_ID,
      productId: VARIANT_PRODUCT_ID,
      name: 'Color',
      sortOrder: 1,
    },
  ])

  await database.insert(productOptionValues).values([
    {
      id: OPTION_VALUE_IDS.sizeSmall,
      optionId: OPTION_SIZE_ID,
      value: 'Small',
      sortOrder: 0,
    },
    {
      id: OPTION_VALUE_IDS.sizeLarge,
      optionId: OPTION_SIZE_ID,
      value: 'Large',
      sortOrder: 1,
    },
    {
      id: OPTION_VALUE_IDS.colorRed,
      optionId: OPTION_COLOR_ID,
      value: 'Red',
      sortOrder: 0,
    },
    {
      id: OPTION_VALUE_IDS.colorBlue,
      optionId: OPTION_COLOR_ID,
      value: 'Blue',
      sortOrder: 1,
    },
  ])

  await database.insert(productVariants).values([
    {
      id: VARIANT_IDS.smallRed,
      productId: VARIANT_PRODUCT_ID,
      sku: 'E2E-SMALL-RED',
      price: 29.99,
      stock: 25,
      image: IMAGE,
      images: [IMAGE],
      sortOrder: 0,
    },
    {
      id: VARIANT_IDS.smallBlue,
      productId: VARIANT_PRODUCT_ID,
      sku: 'E2E-SMALL-BLUE',
      price: 29.99,
      stock: 25,
      image: IMAGE,
      images: [IMAGE],
      sortOrder: 1,
    },
    {
      id: VARIANT_IDS.largeRed,
      productId: VARIANT_PRODUCT_ID,
      sku: 'E2E-LARGE-RED',
      price: 34.99,
      stock: 25,
      image: IMAGE,
      images: [IMAGE],
      sortOrder: 2,
    },
    {
      id: VARIANT_IDS.largeBlue,
      productId: VARIANT_PRODUCT_ID,
      sku: 'E2E-LARGE-BLUE',
      price: 34.99,
      stock: 25,
      image: IMAGE,
      images: [IMAGE],
      sortOrder: 3,
    },
  ])

  await database.insert(productVariantOptionValues).values([
    {
      variantId: VARIANT_IDS.smallRed,
      optionValueId: OPTION_VALUE_IDS.sizeSmall,
    },
    {
      variantId: VARIANT_IDS.smallRed,
      optionValueId: OPTION_VALUE_IDS.colorRed,
    },
    {
      variantId: VARIANT_IDS.smallBlue,
      optionValueId: OPTION_VALUE_IDS.sizeSmall,
    },
    {
      variantId: VARIANT_IDS.smallBlue,
      optionValueId: OPTION_VALUE_IDS.colorBlue,
    },
    {
      variantId: VARIANT_IDS.largeRed,
      optionValueId: OPTION_VALUE_IDS.sizeLarge,
    },
    {
      variantId: VARIANT_IDS.largeRed,
      optionValueId: OPTION_VALUE_IDS.colorRed,
    },
    {
      variantId: VARIANT_IDS.largeBlue,
      optionValueId: OPTION_VALUE_IDS.sizeLarge,
    },
    {
      variantId: VARIANT_IDS.largeBlue,
      optionValueId: OPTION_VALUE_IDS.colorBlue,
    },
  ])
}

const main = async (): Promise<void> => {
  const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })
  const database = drizzle(pool)

  try {
    await seedAdminUser(database)
    await seedCatalog(database)
    await seedVariantMatrix(database)
    console.log('Seeded end-to-end fixtures')
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Failed to seed end-to-end fixtures:', error)
  process.exit(1)
})
