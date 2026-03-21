/* eslint-disable no-console */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import { randomBytes } from "node:crypto";
import { Pool } from "@neondatabase/serverless";

type QueryableClient = Pick<Pool, "query">;

type ProductSourceRow = {
  id: string;
  category: string;
  image: string;
  images: string[] | null;
};

type ProductInsertRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  images: string[];
  stock: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
};

type ProductVariationInsertRow = {
  id: string;
  productId: string;
  name: string;
  designName: string;
  image: string;
  images: string[];
  priceModifier: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
};

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_PRODUCT_COUNT = 5000;
const PRODUCT_BATCH_SIZE = 200;
const PRODUCT_VARIATION_BATCH_SIZE = 400;
const MAX_PRODUCTS = 10000;
const MAX_VARIATIONS_PER_PRODUCT = 10;
const PRODUCT_NAME_PARTS = [
  "Bloom",
  "Velvet",
  "Daisy",
  "Aura",
  "Petal",
  "Luna",
  "Moss",
  "Willow",
  "Ivory",
  "Coral",
  "Meadow",
  "Drift",
  "Flora",
  "Nest",
  "Pearl",
  "Sage",
  "Blush",
  "Cove",
  "Charm",
  "Whim",
] as const;
const PRODUCT_SUFFIXES = [
  "Tote",
  "Bouquet",
  "Planter",
  "Charm",
  "Clip",
  "Keeper",
  "Bloom",
  "Carryall",
  "Accent",
  "Bundle",
] as const;
const DESCRIPTION_PARTS = [
  "handcrafted texture",
  "gift-ready finish",
  "soft seasonal palette",
  "lightweight everyday build",
  "carefully layered detail",
  "playful studio-made design",
  "neat premium stitching",
  "easy styling versatility",
  "artisan-inspired silhouette",
  "bright display appeal",
] as const;
const VARIATION_NAMES = [
  "Mini",
  "Classic",
  "Deluxe",
  "Festive",
  "Pastel",
  "Bold",
  "Gift Set",
  "Signature",
] as const;
const DESIGN_PREFIXES = [
  "Soft",
  "Layered",
  "Modern",
  "Studio",
  "Garden",
  "Ribbon",
  "Sunny",
  "Cozy",
] as const;
const DESIGN_SUFFIXES = [
  "Edit",
  "Mix",
  "Story",
  "Palette",
  "Arrangement",
  "Look",
  "Collection",
  "Finish",
] as const;

const parseCount = (): number => {
  const rawCount = process.argv[2] ?? String(DEFAULT_PRODUCT_COUNT);
  const parsed = Number.parseInt(rawCount, 10);

  if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_PRODUCTS) {
    throw new Error(
      `Product count must be an integer between 1 and ${MAX_PRODUCTS}`,
    );
  }

  return parsed;
};

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomDateWithinLast365Days = (): Date => {
  const now = Date.now();
  const oldest = now - 365 * 24 * 60 * 60 * 1000;
  return new Date(randomInt(oldest, now));
};

const createBase62Id = (length: number): string => {
  const limit = 248;
  let result = "";

  while (result.length < length) {
    const bytes = randomBytes(length - result.length);
    for (
      let index = 0;
      index < bytes.length && result.length < length;
      index++
    ) {
      if (bytes[index] < limit) {
        result += BASE62_CHARS[bytes[index] % 62];
      }
    }
  }

  return result;
};

const shuffle = <T>(items: readonly T[]): T[] => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const pickRandom = <T>(items: readonly T[]): T =>
  items[randomInt(0, items.length - 1)];

const pickImageSet = (imagePool: readonly string[]): string[] => {
  const requestedCount = randomInt(1, Math.min(4, imagePool.length));
  return shuffle(imagePool).slice(0, requestedCount);
};

const createProductName = (): string =>
  `${pickRandom(PRODUCT_NAME_PARTS)} ${pickRandom(PRODUCT_SUFFIXES)} ${randomInt(100, 9999)}`;

const createDescription = (): string =>
  `${pickRandom(PRODUCT_NAME_PARTS)} ${pickRandom(PRODUCT_SUFFIXES).toLowerCase()} with ${pickRandom(DESCRIPTION_PARTS)}, ${pickRandom(DESCRIPTION_PARTS)}, and ${pickRandom(DESCRIPTION_PARTS)}.`;

const createDesignName = (): string =>
  `${pickRandom(DESIGN_PREFIXES)} ${pickRandom(DESIGN_SUFFIXES)}`;

const createVariationName = (variationIndex: number): string =>
  `${pickRandom(VARIATION_NAMES)} ${pickRandom(DESIGN_SUFFIXES)} ${variationIndex + 1}`;

const createPrice = (): number => Number(randomInt(199, 4999).toFixed(2));

const createPriceModifier = (): number =>
  Number((randomInt(0, 1500) / 100).toFixed(2));

const normalizeImagePool = (rows: readonly ProductSourceRow[]): string[] => {
  const imageSet = new Set<string>();

  for (const row of rows) {
    if (row.image.trim()) {
      imageSet.add(row.image);
    }

    if (Array.isArray(row.images)) {
      for (const image of row.images) {
        if (typeof image === "string" && image.trim()) {
          imageSet.add(image);
        }
      }
    }
  }

  return [...imageSet];
};

const normalizeCategories = (rows: readonly ProductSourceRow[]): string[] => {
  const categorySet = new Set<string>();

  for (const row of rows) {
    if (row.category.trim()) {
      categorySet.add(row.category);
    }
  }

  return [...categorySet];
};

const insertProductBatch = async (
  client: QueryableClient,
  rows: readonly ProductInsertRow[],
): Promise<void> => {
  for (let start = 0; start < rows.length; start += PRODUCT_BATCH_SIZE) {
    const chunk = rows.slice(start, start + PRODUCT_BATCH_SIZE);
    const values: string[] = [];
    const params: Array<string | number | Date> = [];
    let paramIndex = 1;

    for (const row of chunk) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}::json, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
      );
      params.push(
        row.id,
        row.name,
        row.description,
        row.price,
        row.image,
        JSON.stringify(row.images),
        row.stock,
        row.category,
        row.createdAt,
        row.updatedAt,
      );
    }

    await client.query(
      `INSERT INTO "Product" (id, name, description, price, image, images, stock, category, "createdAt", "updatedAt") VALUES ${values.join(", ")}`,
      params,
    );
  }
};

const insertProductVariationBatch = async (
  client: QueryableClient,
  rows: readonly ProductVariationInsertRow[],
): Promise<void> => {
  for (
    let start = 0;
    start < rows.length;
    start += PRODUCT_VARIATION_BATCH_SIZE
  ) {
    const chunk = rows.slice(start, start + PRODUCT_VARIATION_BATCH_SIZE);
    const values: string[] = [];
    const params: Array<string | number | Date> = [];
    let paramIndex = 1;

    for (const row of chunk) {
      values.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}::json, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
      );
      params.push(
        row.id,
        row.productId,
        row.name,
        row.designName,
        row.image,
        JSON.stringify(row.images),
        row.priceModifier,
        row.stock,
        row.createdAt,
        row.updatedAt,
      );
    }

    await client.query(
      `INSERT INTO "ProductVariation" (id, "productId", name, "designName", image, images, "priceModifier", stock, "createdAt", "updatedAt") VALUES ${values.join(", ")}`,
      params,
    );
  }
};

const main = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const requestedCount = parseCount();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const [productSourceResult, countBeforeResult, variationCountBeforeResult] =
      await Promise.all([
        pool.query<ProductSourceRow>(
          'SELECT id, category, image, images FROM "Product" WHERE "deletedAt" IS NULL ORDER BY "createdAt" ASC',
        ),
        pool.query<{ count: number }>(
          'SELECT COUNT(*)::int AS count FROM "Product"',
        ),
        pool.query<{ count: number }>(
          'SELECT COUNT(*)::int AS count FROM "ProductVariation"',
        ),
      ]);

    const sourceProducts = productSourceResult.rows;
    if (sourceProducts.length === 0) {
      throw new Error(
        "At least one active product is required to source images",
      );
    }

    const imagePool = normalizeImagePool(sourceProducts);
    const categoryPool = normalizeCategories(sourceProducts);

    if (imagePool.length === 0) {
      throw new Error("No reusable product image URLs found");
    }

    if (categoryPool.length === 0) {
      throw new Error("No reusable product categories found");
    }

    const productRows: ProductInsertRow[] = [];
    const variationRows: ProductVariationInsertRow[] = [];
    const usedProductIds = new Set(sourceProducts.map((product) => product.id));
    const usedVariationIds = new Set<string>();

    for (let productIndex = 0; productIndex < requestedCount; productIndex++) {
      let productId = createBase62Id(7);
      while (usedProductIds.has(productId)) {
        productId = createBase62Id(7);
      }
      usedProductIds.add(productId);

      const productImages = pickImageSet(imagePool);
      const createdAt = randomDateWithinLast365Days();
      const updatedAt = new Date(
        createdAt.getTime() + randomInt(0, 45) * 24 * 60 * 60 * 1000,
      );
      const variationCount = randomInt(0, MAX_VARIATIONS_PER_PRODUCT);

      productRows.push({
        id: productId,
        name: createProductName(),
        description: createDescription(),
        price: createPrice(),
        image: productImages[0],
        images: productImages,
        stock: randomInt(0, 250),
        category: pickRandom(categoryPool),
        createdAt,
        updatedAt,
      });

      for (
        let variationIndex = 0;
        variationIndex < variationCount;
        variationIndex++
      ) {
        let variationId = createBase62Id(7);
        while (usedVariationIds.has(variationId)) {
          variationId = createBase62Id(7);
        }
        usedVariationIds.add(variationId);

        const variationImages = pickImageSet(imagePool);
        variationRows.push({
          id: variationId,
          productId,
          name: createVariationName(variationIndex),
          designName: createDesignName(),
          image: variationImages[0],
          images: variationImages,
          priceModifier: createPriceModifier(),
          stock: randomInt(0, 150),
          createdAt,
          updatedAt,
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await insertProductBatch(client, productRows);
      await insertProductVariationBatch(client, variationRows);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const [countAfterResult, variationCountAfterResult] = await Promise.all([
      pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM "Product"',
      ),
      pool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM "ProductVariation"',
      ),
    ]);

    console.log(
      JSON.stringify(
        {
          imagePoolSize: imagePool.length,
          categoryPoolSize: categoryPool.length,
          productsBefore: countBeforeResult.rows[0].count,
          productsAfter: countAfterResult.rows[0].count,
          productsInserted:
            countAfterResult.rows[0].count - countBeforeResult.rows[0].count,
          variationsBefore: variationCountBeforeResult.rows[0].count,
          variationsAfter: variationCountAfterResult.rows[0].count,
          variationsInserted:
            variationCountAfterResult.rows[0].count -
            variationCountBeforeResult.rows[0].count,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
