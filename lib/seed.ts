import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Required: Node.js needs ws for WebSocket support (Neon driver uses WebSockets)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

const db = drizzle(pool, { schema });

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.cartItems);
  await db.delete(schema.carts);
  await db.delete(schema.productVariations);
  await db.delete(schema.products);

  // Seed products - Decorations & Wearables
  const [bouquet] = await db.insert(schema.products).values({
    name: 'Rose Flower Bouquet',
    description: 'Stunning hand-arranged bouquet of beautiful roses, perfect for gifting or decorating your home. Each bouquet is crafted with care and wrapped in elegant packaging.',
    price: 29.99,
    image: 'https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=500&h=500&fit=crop',
    stock: 40,
    category: 'Flowers',
    updatedAt: new Date(),
  }).returning();

  await db.insert(schema.productVariations).values([
    {
      productId: bouquet.id,
      name: 'Red Roses',
      designName: 'Classic Red Romance',
      priceModifier: 0,
      stock: 20,
      image: 'https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=500&h=500&fit=crop',
      updatedAt: new Date(),
    },
    {
      productId: bouquet.id,
      name: 'Pink Roses',
      designName: 'Blush Pink Elegance',
      priceModifier: 5,
      stock: 12,
      image: 'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=500&h=500&fit=crop',
      updatedAt: new Date(),
    },
    {
      productId: bouquet.id,
      name: 'Mixed Wildflowers',
      designName: 'Rustic Wildflower Mix',
      priceModifier: 8,
      stock: 8,
      image: 'https://images.unsplash.com/photo-1468327768560-75b778cbb551?w=500&h=500&fit=crop',
      updatedAt: new Date(),
    },
  ]);

  await db.insert(schema.products).values({
    name: 'Handmade Keyring Set',
    description: 'Set of 3 beautifully handcrafted keyrings with unique charm designs. Made with premium beads and durable metal rings — a perfect small gift or personal accessory.',
    price: 12.99,
    image: 'https://images.unsplash.com/photo-1579783928621-7a13d66a62d1?w=500&h=500&fit=crop',
    stock: 80,
    category: 'Accessories',
    updatedAt: new Date(),
  });

  const [handWarmers] = await db.insert(schema.products).values({
    name: 'Knitted Hand Warmers',
    description: 'Cozy fingerless hand warmers knitted from soft wool blend yarn. Keep your hands warm while staying stylish — great for winter or chilly evenings.',
    price: 18.99,
    image: 'https://images.unsplash.com/photo-1608541737042-87a12275d313?w=500&h=500&fit=crop',
    stock: 55,
    category: 'Wearables',
    updatedAt: new Date(),
  }).returning();

  await db.insert(schema.productVariations).values([
    {
      productId: handWarmers.id,
      name: 'Charcoal Grey',
      designName: 'Classic Charcoal',
      priceModifier: 0,
      stock: 25,
      updatedAt: new Date(),
    },
    {
      productId: handWarmers.id,
      name: 'Cream White',
      designName: 'Warm Cream',
      priceModifier: 2,
      stock: 20,
      updatedAt: new Date(),
    },
    {
      productId: handWarmers.id,
      name: 'Blush Pink',
      designName: 'Soft Blush',
      priceModifier: 3,
      stock: 10,
      updatedAt: new Date(),
    },
  ]);

  await db.insert(schema.products).values({
    name: 'Wool Muffler Scarf',
    description: 'Premium quality wool muffler scarf with a soft, luxurious feel. Perfect for cold weather — wraps comfortably around your neck with timeless style.',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=500&h=500&fit=crop',
    stock: 35,
    category: 'Wearables',
    updatedAt: new Date(),
  });

  const [mikasa] = await db.insert(schema.products).values({
    name: 'Mikasa Scarf',
    description: 'Iconic Mikasa-inspired scarf with bold patterns. A must-have for anime fans and fashion-forward individuals alike. Soft fabric with detailed design.',
    price: 22.99,
    image: 'https://images.unsplash.com/photo-1601924921557-45e6ddf0c665?w=500&h=500&fit=crop',
    stock: 45,
    category: 'Wearables',
    updatedAt: new Date(),
  }).returning();

  await db.insert(schema.productVariations).values([
    {
      productId: mikasa.id,
      name: 'Classic Red',
      designName: 'Mikasa Classic Red',
      priceModifier: 0,
      stock: 25,
      updatedAt: new Date(),
    },
    {
      productId: mikasa.id,
      name: 'Navy Blue',
      designName: 'Mikasa Navy Edition',
      priceModifier: 3,
      stock: 20,
      updatedAt: new Date(),
    },
  ]);

  await db.insert(schema.products).values({
    name: 'Decorative Flower Arrangement',
    description: 'Beautiful artificial flower arrangement in a ceramic vase. Long-lasting centerpiece for tables, shelves, or entryways — no watering needed!',
    price: 34.99,
    image: 'https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=500&h=500&fit=crop',
    stock: 25,
    category: 'Decorations',
    updatedAt: new Date(),
  });

  console.log('Created 7 products with variations (decorations & wearables)');

  await pool.end();
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
