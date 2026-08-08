/* eslint-disable no-console */

/**
 * Seed the preview database with a representative dataset.
 *
 * Purpose: give the storefront, admin, and recommendation surfaces enough data
 * to be exercised at a realistic scale — 2 000 products and 5 000 orders, with
 * every related table populated in proportion.
 *
 * ── Baskets are correlated, not random ──────────────────────────────────────
 * The recommendation scoring job discards any product pair backed by fewer
 * than MIN_SUPPORT (3) distinct orders. Random baskets over 2 000 products
 * would produce almost no pair above that floor, so the affinity table would
 * come out empty and the feature would look broken rather than untested.
 * Products are therefore grouped into affinity clusters, and most orders draw
 * their items from a single cluster. That reproduces the co-purchase structure
 * a real catalog has and yields pairs comfortably above the support floor.
 *
 * ── Reversibility ───────────────────────────────────────────────────────────
 * Every seeded row carries a marker: short IDs begin with `Zz`, order IDs with
 * `ORDZz`, and seeded users use the reserved `.invalid` TLD. `--reset` removes
 * exactly those rows in foreign-key-safe order and touches nothing else.
 *
 * Caveat: `generateShortId()` is uniform random, so a genuine future row has a
 * ~1-in-3 844 chance of also starting with `Zz`. The script refuses to seed if
 * any pre-existing row already matches, but a row created *after* seeding
 * could in principle be caught by `--reset`. Acceptable for a preview
 * database; do not point this script at production.
 *
 * Usage:
 *   node scripts/seed-preview-data.mjs --yes
 *   node scripts/seed-preview-data.mjs --yes --products 2000 --orders 5000
 *   node scripts/seed-preview-data.mjs --reset --yes
 */

import process from 'node:process'

import { config } from 'dotenv'
import pg from 'pg'
import bcrypt from 'bcryptjs'

config({ path: '.env.local' })
config({ path: '.env', override: false })

const { Client } = pg

// ─── Configuration ──────────────────────────────────────────────────────────

/** Marks every row this script creates, so `--reset` can find them again. */
const ID_MARKER = 'Zz'
const ORDER_ID_MARKER = `ORD${ID_MARKER}`
/** RFC 2606 reserved TLD: these addresses can never reach a real inbox. */
const SEED_EMAIL_DOMAIN = 'kiyon-seed.invalid'

/**
 * Shared password for every seeded account, so the preview environment can be
 * signed into for UI verification. Synthetic accounts in a throwaway database;
 * override with SEED_USER_PASSWORD if you want something else.
 */
const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'SeedUser!2026'

/** Kept inside the scoring job's 180-day window so every order is in scope. */
const HISTORY_DAYS = 175

/**
 * Share of the catalog that orders actually draw from.
 *
 * Spreading 5 000 orders evenly across 2 000 products gives each product ~6
 * orders, and a given *pair* barely one — far below MIN_SUPPORT (3), so the
 * scoring job would discard almost everything. Real catalogs are Pareto-
 * shaped: a minority of products carry most of the volume. Concentrating
 * orders on a quarter of the catalog reproduces that, pushes pair support for
 * the active products well clear of the floor, and leaves a long tail with no
 * affinity data — which is exactly the case the bestseller fallback exists to
 * cover. Both code paths therefore get exercised.
 */
const ACTIVE_CATALOG_SHARE = 0.25

const DEFAULTS = {
  products: 2000,
  orders: 5000,
  users: 600,
  wishlists: 3000,
  reviews: 2500,
  reviewVotes: 2000,
  shares: 1500,
  /** Products per affinity cluster; drives co-purchase pair support. */
  clusterSize: 12,
}

const parseArgs = (argv) => {
  const args = { reset: false, yes: false, ...DEFAULTS }
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--reset') args.reset = true
    else if (token === '--yes' || token === '-y') args.yes = true
    else if (token.startsWith('--')) {
      const key = token.slice(2)
      if (key in DEFAULTS) {
        const value = Number.parseInt(argv[++i], 10)
        if (Number.isNaN(value) || value < 0) {
          throw new Error(`--${key} needs a non-negative integer`)
        }
        args[key] = value
      }
    }
  }
  return args
}

// ─── Deterministic randomness ───────────────────────────────────────────────

/** Seeded PRNG, so two runs with the same options produce the same catalog. */
const createRandom = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = createRandom(20260808)
const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1))
const pick = (items) => items[Math.floor(random() * items.length)]
const chance = (probability) => random() < probability

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** A 7-character Base62 id in the project's format, carrying the seed marker. */
const seededId = () => {
  let suffix = ''
  for (let i = 0; i < 7 - ID_MARKER.length; i++) suffix += pick([...BASE62])
  return `${ID_MARKER}${suffix}`
}

/** Unique ids, because the marker shrinks the random space to 5 characters. */
const makeIdFactory = () => {
  const used = new Set()
  return () => {
    let id = seededId()
    while (used.has(id)) id = seededId()
    used.add(id)
    return id
  }
}

const daysAgo = (days) =>
  new Date(
    Date.now() - days * 24 * 60 * 60 * 1000 - randomInt(0, 86_399) * 1000
  )

// ─── Catalog vocabulary ─────────────────────────────────────────────────────

const CATEGORY_WORDS = {
  Handbag: {
    nouns: ['Tote', 'Clutch', 'Sling Bag', 'Shoulder Bag', 'Pouch', 'Satchel'],
    adjectives: ['Woven', 'Crocheted', 'Quilted', 'Embroidered', 'Braided'],
  },
  Flowers: {
    nouns: ['Bouquet', 'Posy', 'Stem Set', 'Arrangement', 'Bunch'],
    adjectives: ['Rose', 'Tulip', 'Lily', 'Daisy', 'Orchid', 'Sunflower'],
  },
  'Flower Pots': {
    nouns: ['Planter', 'Pot', 'Vase', 'Hanging Basket', 'Trough'],
    adjectives: ['Terracotta', 'Ceramic', 'Macrame', 'Glazed', 'Stoneware'],
  },
  Keychains: {
    nouns: ['Keychain', 'Key Ring', 'Charm', 'Bag Tag'],
    adjectives: ['Beaded', 'Crocheted', 'Resin', 'Felt', 'Wooden'],
  },
  'Hair Accessories': {
    nouns: ['Scrunchie', 'Hair Clip', 'Headband', 'Hair Tie', 'Bow'],
    adjectives: ['Satin', 'Velvet', 'Floral', 'Pearl', 'Ribbed'],
  },
  Decors: {
    nouns: [
      'Wall Hanging',
      'Table Piece',
      'Ornament',
      'Garland',
      'Coaster Set',
    ],
    adjectives: ['Boho', 'Rustic', 'Minimal', 'Handwoven', 'Pastel'],
  },
}

const COLOURWAYS = [
  'Blush',
  'Sage',
  'Ivory',
  'Terracotta',
  'Lavender',
  'Mustard',
  'Charcoal',
  'Teal',
]

const SIZES = ['Small', 'Medium', 'Large']

/**
 * Collapse a display word into a SKU token: strip anything that is not
 * alphanumeric so multi-word nouns ("Bag Tag", "Sling Bag") stay readable as a
 * single segment.
 */
const skuToken = (value) => value.replace(/[^a-zA-Z0-9]/gu, '')

/**
 * Build a stock keeping unit for one variant.
 *
 * Mirrors the convention already present in the catalog (`Keychain-Pink-Small`,
 * `Plushie-Yellow-Large`): human-readable, dash-separated tokens that name the
 * item type and the variant's distinguishing attribute.
 *
 * This is customer-visible, not internal bookkeeping — `VariantButton` renders
 * `SKU: {variant.sku}` on the product page, and `variantLabel()` in
 * `src/lib/ai/product-rag.ts` falls back to the SKU as the variant's display
 * name whenever a variant carries no option values (every single-variant
 * product). An opaque identifier here surfaces directly to shoppers and to the
 * AI assistant.
 *
 * The zero-padded product sequence keeps the value unique across the catalog,
 * which a bare type/attribute pair would not be at this volume.
 */
const buildSku = (noun, optionValue, sequence) => {
  const seq = String(sequence).padStart(4, '0')
  return optionValue
    ? `${skuToken(noun)}-${skuToken(optionValue)}-${seq}`
    : `${skuToken(noun)}-${seq}`
}

const CITIES = [
  ['Mumbai', 'Maharashtra', '400001'],
  ['Bengaluru', 'Karnataka', '560001'],
  ['Kolkata', 'West Bengal', '700001'],
  ['Chennai', 'Tamil Nadu', '600001'],
  ['Pune', 'Maharashtra', '411001'],
  ['Hyderabad', 'Telangana', '500001'],
  ['Jaipur', 'Rajasthan', '302001'],
  ['Ahmedabad', 'Gujarat', '380001'],
]

const FIRST_NAMES = [
  'Aarav',
  'Diya',
  'Vihaan',
  'Ananya',
  'Arjun',
  'Ishita',
  'Kabir',
  'Meera',
  'Rohan',
  'Saanvi',
  'Aditya',
  'Nisha',
  'Kunal',
  'Priya',
  'Rahul',
  'Tara',
]
const LAST_NAMES = [
  'Sharma',
  'Iyer',
  'Bose',
  'Nair',
  'Gupta',
  'Reddy',
  'Kapoor',
  'Menon',
  'Chatterjee',
  'Desai',
  'Rao',
  'Verma',
]

// ─── Bulk insert helper ─────────────────────────────────────────────────────

/** Postgres caps a statement at 65 535 bound parameters. */
const MAX_PARAMS = 60_000

const insertRows = async (client, table, columns, rows, label) => {
  if (rows.length === 0) return 0
  const batchSize = Math.max(
    1,
    Math.min(1000, Math.floor(MAX_PARAMS / columns.length))
  )
  const quoted = columns.map((c) => `"${c}"`).join(', ')
  let written = 0

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const chunk = rows.slice(offset, offset + batchSize)
    const params = []
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value)
        return `$${params.length}`
      })
      return `(${placeholders.join(',')})`
    })
    const result = await client.query(
      `INSERT INTO "${table}" (${quoted}) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`,
      params
    )
    written += result.rowCount ?? 0
    process.stdout.write(
      `\r  ${label}: ${Math.min(offset + batchSize, rows.length)}/${rows.length}   `
    )
  }
  process.stdout.write('\n')
  return written
}

// ─── Reset ──────────────────────────────────────────────────────────────────

/** Ordered child-first so no delete trips a foreign key. */
const RESET_STEPS = [
  ['ReviewVote', `id LIKE '${ID_MARKER}%'`],
  ['Review', `id LIKE '${ID_MARKER}%'`],
  ['Wishlist', `id LIKE '${ID_MARKER}%'`],
  ['ProductShare', `key LIKE '${ID_MARKER}%'`],
  [
    'ProductAffinityScore',
    `"anchorProductId" LIKE '${ID_MARKER}%' OR "recommendedProductId" LIKE '${ID_MARKER}%'`,
  ],
  ['CartItem', `id LIKE '${ID_MARKER}%'`],
  ['OrderItem', `id LIKE '${ID_MARKER}%'`],
  ['Order', `id LIKE '${ORDER_ID_MARKER}%'`],
  ['ProductVariantOptionValue', `"variantId" LIKE '${ID_MARKER}%'`],
  ['ProductVariant', `id LIKE '${ID_MARKER}%'`],
  ['ProductOptionValue', `id LIKE '${ID_MARKER}%'`],
  ['ProductOption', `id LIKE '${ID_MARKER}%'`],
  ['Product', `id LIKE '${ID_MARKER}%'`],
  ['Address', `id LIKE '${ID_MARKER}%'`],
  ['User', `email LIKE '%@${SEED_EMAIL_DOMAIN}'`],
]

const resetSeedData = async (client) => {
  console.log('\nRemoving previously seeded rows...')
  for (const [table, predicate] of RESET_STEPS) {
    const result = await client.query(
      `DELETE FROM "${table}" WHERE ${predicate}`
    )
    if (result.rowCount) console.log(`  ${table}: ${result.rowCount} removed`)
  }
  console.log('Reset complete.')
}

// ─── Generation ─────────────────────────────────────────────────────────────

const buildProducts = (count, categories, images, nextId) => {
  const products = []
  const options = []
  const optionValues = []
  const variants = []
  const variantOptionValues = []

  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length]
    const words = CATEGORY_WORDS[category] ?? CATEGORY_WORDS.Decors
    const adjective = pick(words.adjectives)
    const noun = pick(words.nouns)
    const productId = nextId()
    const image = images[i % images.length]
    const createdAt = daysAgo(randomInt(10, HISTORY_DAYS))

    products.push([
      productId,
      `${adjective} ${noun} ${String(i + 1).padStart(4, '0')}`,
      `Handcrafted ${adjective.toLowerCase()} ${noun.toLowerCase()} finished by hand in small batches. Part of the ${category.toLowerCase()} collection.`,
      image,
      JSON.stringify([image]),
      category,
      createdAt,
      createdAt,
    ])

    // Multi-variant products get a real option axis so the variant selector,
    // option filters, and variant-aware cart paths are all exercised.
    const variantCount = chance(0.55) ? randomInt(2, 3) : 1
    const useSize = chance(0.5)
    const axisName = useSize ? 'Size' : 'Colour'
    const axisValues = (useSize ? SIZES : COLOURWAYS).slice(0, variantCount)

    let optionId = null
    const valueIds = []
    if (variantCount > 1) {
      optionId = nextId()
      options.push([optionId, productId, axisName, 0, createdAt])
      axisValues.forEach((value, index) => {
        const valueId = nextId()
        valueIds.push(valueId)
        optionValues.push([valueId, optionId, value, index, createdAt])
      })
    }

    const basePrice = randomInt(199, 4999)
    for (let v = 0; v < variantCount; v++) {
      const variantId = nextId()
      variants.push([
        variantId,
        productId,
        buildSku(noun, variantCount > 1 ? axisValues[v] : null, i + 1),
        basePrice + v * randomInt(50, 400),
        randomInt(0, 60), // some out-of-stock, to exercise the filters
        0,
        randomInt(120, 1500),
        image,
        JSON.stringify([image]),
        v,
        createdAt,
        createdAt,
      ])
      if (variantCount > 1 && valueIds[v]) {
        variantOptionValues.push([variantId, valueIds[v]])
      }
    }
  }

  return { products, options, optionValues, variants, variantOptionValues }
}

const buildUsers = (count, passwordHash, nextId) => {
  const users = []
  const addresses = []

  for (let i = 0; i < count; i++) {
    const userId = crypto.randomUUID()
    const first = pick(FIRST_NAMES)
    const last = pick(LAST_NAMES)
    const createdAt = daysAgo(randomInt(HISTORY_DAYS - 20, HISTORY_DAYS))
    const [city, state, pin] = pick(CITIES)

    users.push([
      userId,
      `${first} ${last}`,
      `seed.${String(i + 1).padStart(5, '0')}@${SEED_EMAIL_DOMAIN}`,
      createdAt,
      passwordHash,
      // Deterministic and unique: the column carries a UNIQUE constraint.
      `+9190${String(i + 1).padStart(8, '0')}`,
      'CUSTOMER',
      createdAt,
      createdAt,
    ])

    addresses.push([
      nextId(),
      userId,
      'Home',
      `${randomInt(1, 260)} ${pick(['Lake', 'Garden', 'Hill', 'Park', 'Rose'])} Road`,
      `Flat ${randomInt(1, 40)}`,
      pin,
      city,
      state,
      true,
      createdAt,
      createdAt,
    ])
  }

  return { users, addresses, ids: users.map((row) => row[0]) }
}

/**
 * Group products into clusters that get bought together.
 *
 * This is what makes the seeded data useful to the recommendation job: without
 * it, no pair reaches the minimum-support floor and every rail falls back to
 * bestsellers regardless of how many orders exist.
 *
 * Only the active slice of the catalog is clustered (see
 * ACTIVE_CATALOG_SHARE); the tail is deliberately left without co-purchase
 * history.
 */
const buildClusters = (productIds, clusterSize) => {
  const activeCount = Math.max(
    clusterSize * 2,
    Math.round(productIds.length * ACTIVE_CATALOG_SHARE)
  )
  const active = productIds.slice(0, Math.min(activeCount, productIds.length))
  const clusters = []
  for (let i = 0; i < active.length; i += clusterSize) {
    clusters.push(active.slice(i, i + clusterSize))
  }
  return clusters.filter((cluster) => cluster.length >= 2)
}

const buildOrders = ({ count, users, variantsByProduct, clusters, nextId }) => {
  const orders = []
  const orderItems = []
  const nextOrderId = () => `ORD${seededId()}`
  const usedOrderIds = new Set()

  for (let i = 0; i < count; i++) {
    let orderId = nextOrderId()
    while (usedOrderIds.has(orderId)) orderId = nextOrderId()
    usedOrderIds.add(orderId)

    const userIndex = randomInt(0, users.users.length - 1)
    const user = users.users[userIndex]
    const address = users.addresses[userIndex]
    const createdAt = daysAgo(randomInt(1, HISTORY_DAYS))

    // Most baskets come from one cluster; the rest are cross-cluster noise, so
    // the scoring job has to actually discriminate rather than see a clean
    // block structure.
    const cluster = pick(clusters)
    const itemCount = randomInt(2, 4)
    const chosen = new Set()
    for (let n = 0; n < itemCount; n++) {
      const source = chance(0.85) ? cluster : pick(clusters)
      chosen.add(pick(source))
    }

    let subtotal = 0
    for (const productId of chosen) {
      const variants = variantsByProduct.get(productId)
      if (!variants?.length) continue
      const variant = pick(variants)
      const quantity = chance(0.8) ? 1 : randomInt(2, 3)
      const price = variant.price
      subtotal += price * quantity
      orderItems.push([
        nextId(),
        orderId,
        productId,
        variant.id,
        quantity,
        price,
        null,
      ])
    }
    if (subtotal === 0) continue

    const shipping = chance(0.3) ? 0 : randomInt(40, 120)
    const tax = Math.round(subtotal * 0.05 * 100) / 100
    const total = Math.round((subtotal + shipping + tax) * 100) / 100

    // Cancelled orders are excluded from co-purchase scoring and bestsellers,
    // so a realistic slice of them keeps those exclusions under test.
    const status = chance(0.08)
      ? 'CANCELLED'
      : pick([
          'DELIVERED',
          'DELIVERED',
          'DELIVERED',
          'SHIPPED',
          'PROCESSING',
          'PENDING',
        ])
    const isPaid = status !== 'CANCELLED' && status !== 'PENDING'
    const provider = chance(0.7) ? 'RAZORPAY' : 'COD'

    orders.push([
      orderId,
      user[0],
      user[1],
      user[2],
      `${address[3]}, ${address[4]}, ${address[6]}, ${address[7]} ${address[5]}`,
      address[3],
      address[4],
      address[5],
      address[6],
      address[7],
      subtotal,
      shipping,
      tax,
      chance(0.25) ? 'EXPRESS' : 'STANDARD',
      total,
      0,
      isPaid ? 'PAID' : 'PENDING',
      provider,
      isPaid ? `seedpay_${orderId}` : null,
      isPaid ? total : 0,
      isPaid ? createdAt : null,
      status,
      createdAt,
      createdAt,
    ])
  }

  return { orders, orderItems }
}

const buildEngagement = ({
  wishlistCount,
  reviewCount,
  voteCount,
  shareCount,
  productIds,
  userIds,
  clusters,
  nextId,
}) => {
  const wishlists = []
  const reviews = []
  const reviewVotes = []
  const shares = []

  // Wishlists follow the same clusters as orders, so wishlist co-occurrence is
  // a genuine second signal rather than uniform noise.
  const wishlistPairs = new Set()
  while (wishlists.length < wishlistCount) {
    const userId = pick(userIds)
    const cluster = pick(clusters)
    const productId = pick(cluster)
    const key = `${userId}:${productId}`
    if (wishlistPairs.has(key)) continue
    wishlistPairs.add(key)
    wishlists.push([
      nextId(),
      userId,
      productId,
      daysAgo(randomInt(1, HISTORY_DAYS)),
    ])
  }

  const reviewPairs = new Set()
  const reviewIds = []
  const comments = [
    'Beautiful craftsmanship, exactly as pictured.',
    'Arrived quickly and very well packaged.',
    'Lovely colour, slightly smaller than expected.',
    'Gifted this and it was a big hit.',
    'Good quality for the price.',
    'The detailing is gorgeous in person.',
  ]
  while (reviews.length < reviewCount) {
    const userId = pick(userIds)
    const productId = pick(productIds)
    const key = `${userId}:${productId}`
    if (reviewPairs.has(key)) continue
    reviewPairs.add(key)
    const reviewId = nextId()
    reviewIds.push(reviewId)
    const createdAt = daysAgo(randomInt(1, HISTORY_DAYS))
    reviews.push([
      reviewId,
      productId,
      userId,
      // Skewed positive, like a real catalog, so rating filters are meaningful.
      pick([5, 5, 5, 4, 4, 3, 2]),
      pick(comments),
      false,
      chance(0.6),
      0,
      0,
      false,
      false,
      createdAt,
      createdAt,
    ])
  }

  const votePairs = new Set()
  while (reviewVotes.length < voteCount && reviewIds.length > 0) {
    const reviewId = pick(reviewIds)
    const userId = pick(userIds)
    const key = `${reviewId}:${userId}`
    if (votePairs.has(key)) continue
    votePairs.add(key)
    const createdAt = daysAgo(randomInt(1, HISTORY_DAYS))
    reviewVotes.push([
      nextId(),
      reviewId,
      userId,
      chance(0.8) ? 1 : -1,
      createdAt,
      createdAt,
    ])
  }

  // Shares are day-bucketed by the scoring job, so cluster them onto a limited
  // set of days to produce pairs above the support floor.
  for (let i = 0; i < shareCount; i++) {
    const cluster = pick(clusters)
    shares.push([nextId(), pick(cluster), null, daysAgo(randomInt(1, 60))])
  }

  return { wishlists, reviews, reviewVotes, shares }
}

// ─── Main ───────────────────────────────────────────────────────────────────

const summarise = async (client, heading) => {
  const tables = [
    'User',
    'Product',
    'ProductVariant',
    'Order',
    'OrderItem',
    'Wishlist',
    'Review',
    'ReviewVote',
    'ProductShare',
    'ProductAffinityScore',
  ]
  console.log(`\n${heading}`)
  for (const table of tables) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c FROM "${table}"`
    )
    console.log(`  ${String(rows[0].c).padStart(8)}  ${table}`)
  }
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  // Hard stop: this writes thousands of synthetic rows and must never reach a
  // production database.
  if (process.env.VERCEL_ENV === 'production') {
    console.error('Refusing to run: VERCEL_ENV is "production".')
    process.exit(1)
  }

  const host = databaseUrl.replace(/^.*:\/\/[^@]*@/, '').split('?')[0]
  const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl)
  const client = new Client({
    connectionString: databaseUrl,
    ssl:
      isLocal || databaseUrl.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false, checkServerIdentity: () => undefined },
  })

  await client.connect()
  console.log(`Target: ${host}`)
  console.log(`Environment: VERCEL_ENV=${process.env.VERCEL_ENV ?? '(unset)'}`)

  if (!args.yes) {
    console.error(
      '\nRefusing to write without --yes. Re-run with --yes to proceed.'
    )
    await client.end()
    process.exit(1)
  }

  try {
    if (args.reset) {
      await resetSeedData(client)
      await summarise(client, 'Row counts after reset:')
      return
    }

    // Re-seeding on top of an existing seed would double the catalog, so clear
    // any previous run first. Only marker-matched rows are touched.
    await resetSeedData(client)

    const { rows: categoryRows } = await client.query(
      `SELECT name FROM "Category" WHERE "deletedAt" IS NULL ORDER BY "sortOrder"`
    )
    const categories = categoryRows.map((row) => row.name)
    if (categories.length === 0)
      throw new Error('No categories found to assign products to.')

    // Reuse image URLs that already exist in the catalog: they are real blob
    // objects on an allowed remote host, so seeded product cards render
    // properly instead of showing broken images in screenshots.
    const { rows: imageRows } = await client.query(
      `SELECT DISTINCT image FROM "Product" WHERE image LIKE 'https://%' AND id NOT LIKE '${ID_MARKER}%' LIMIT 40`
    )
    const images = imageRows.map((row) => row.image)
    if (images.length === 0)
      throw new Error('No existing product images to reuse.')

    console.log(`\nCategories: ${categories.join(', ')}`)
    console.log(`Reusing ${images.length} real image URLs`)

    const nextId = makeIdFactory()
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

    console.log('\nGenerating...')
    const catalog = buildProducts(args.products, categories, images, nextId)
    const productIds = catalog.products.map((row) => row[0])
    const users = buildUsers(args.users, passwordHash, nextId)
    const clusters = buildClusters(productIds, args.clusterSize)

    const variantsByProduct = new Map()
    for (const row of catalog.variants) {
      const list = variantsByProduct.get(row[1]) ?? []
      list.push({ id: row[0], price: row[3] })
      variantsByProduct.set(row[1], list)
    }

    const { orders, orderItems } = buildOrders({
      count: args.orders,
      users,
      variantsByProduct,
      clusters,
      nextId,
    })

    const engagement = buildEngagement({
      wishlistCount: args.wishlists,
      reviewCount: args.reviews,
      voteCount: args.reviewVotes,
      shareCount: args.shares,
      productIds,
      userIds: users.ids,
      clusters,
      nextId,
    })

    console.log(
      `  ${clusters.length} affinity clusters of ~${args.clusterSize} products`
    )
    console.log(
      `  active catalog: ${clusters.reduce((n, c) => n + c.length, 0)} of ${productIds.length} products carry order volume`
    )
    console.log('\nWriting...')

    await insertRows(
      client,
      'User',
      [
        'id',
        'name',
        'email',
        'emailVerified',
        'passwordHash',
        'phoneNumber',
        'role',
        'createdAt',
        'updatedAt',
      ],
      users.users,
      'User'
    )
    await insertRows(
      client,
      'Address',
      [
        'id',
        'userId',
        'label',
        'addressLine1',
        'addressLine2',
        'pinCode',
        'city',
        'state',
        'isDefault',
        'createdAt',
        'updatedAt',
      ],
      users.addresses,
      'Address'
    )
    await insertRows(
      client,
      'Product',
      [
        'id',
        'name',
        'description',
        'image',
        'images',
        'category',
        'createdAt',
        'updatedAt',
      ],
      catalog.products,
      'Product'
    )
    await insertRows(
      client,
      'ProductOption',
      ['id', 'productId', 'name', 'sortOrder', 'createdAt'],
      catalog.options,
      'ProductOption'
    )
    await insertRows(
      client,
      'ProductOptionValue',
      ['id', 'optionId', 'value', 'sortOrder', 'createdAt'],
      catalog.optionValues,
      'ProductOptionValue'
    )
    await insertRows(
      client,
      'ProductVariant',
      [
        'id',
        'productId',
        'sku',
        'price',
        'stock',
        'reservedStock',
        'weightGrams',
        'image',
        'images',
        'sortOrder',
        'createdAt',
        'updatedAt',
      ],
      catalog.variants,
      'ProductVariant'
    )
    await insertRows(
      client,
      'ProductVariantOptionValue',
      ['variantId', 'optionValueId'],
      catalog.variantOptionValues,
      'ProductVariantOptionValue'
    )
    await insertRows(
      client,
      'Order',
      [
        'id',
        'userId',
        'customerName',
        'customerEmail',
        'customerAddress',
        'addressLine1',
        'addressLine2',
        'pinCode',
        'city',
        'state',
        'subtotalAmount',
        'shippingAmount',
        'taxAmount',
        'shippingMethod',
        'totalAmount',
        'discountAmount',
        'paymentStatus',
        'paymentProvider',
        'paymentTransactionId',
        'amountPaid',
        'paidAt',
        'status',
        'createdAt',
        'updatedAt',
      ],
      orders,
      'Order'
    )
    await insertRows(
      client,
      'OrderItem',
      [
        'id',
        'orderId',
        'productId',
        'variantId',
        'quantity',
        'price',
        'customizationNote',
      ],
      orderItems,
      'OrderItem'
    )
    await insertRows(
      client,
      'Wishlist',
      ['id', 'userId', 'productId', 'createdAt'],
      engagement.wishlists,
      'Wishlist'
    )
    await insertRows(
      client,
      'Review',
      [
        'id',
        'productId',
        'userId',
        'rating',
        'comment',
        'isAnonymous',
        'isVerifiedBuyer',
        'helpfulCount',
        'notHelpfulCount',
        'isFeatured',
        'isHidden',
        'createdAt',
        'updatedAt',
      ],
      engagement.reviews,
      'Review'
    )
    await insertRows(
      client,
      'ReviewVote',
      ['id', 'reviewId', 'userId', 'vote', 'createdAt', 'updatedAt'],
      engagement.reviewVotes,
      'ReviewVote'
    )
    await insertRows(
      client,
      'ProductShare',
      ['key', 'productId', 'variantId', 'createdAt'],
      engagement.shares,
      'ProductShare'
    )

    await summarise(client, 'Row counts after seeding:')
    console.log(
      `\nSeeded accounts: seed.00001@${SEED_EMAIL_DOMAIN} … seed.${String(args.users).padStart(5, '0')}@${SEED_EMAIL_DOMAIN}`
    )
    console.log(
      'Password: see SEED_PASSWORD in this script (all seeded accounts share it, role CUSTOMER).'
    )
    console.log(
      '\nRemove everything with: node scripts/seed-preview-data.mjs --reset --yes'
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message)
  process.exit(1)
})
