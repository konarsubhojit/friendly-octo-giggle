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

  // Seed products
  const [headphones] = await db.insert(schema.products).values({
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life and superior sound quality.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
    stock: 45,
    category: 'Electronics',
    updatedAt: new Date(),
  }).returning();

  await db.insert(schema.productVariations).values([
    {
      productId: headphones.id,
      name: 'Black',
      designName: 'Classic Black',
      priceModifier: 0,
      stock: 20,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
      updatedAt: new Date(),
    },
    {
      productId: headphones.id,
      name: 'Silver',
      designName: 'Premium Silver',
      priceModifier: 20,
      stock: 15,
      image: 'https://images.unsplash.com/photo-1545127398-14699f92334b?w=500&h=500&fit=crop',
      updatedAt: new Date(),
    },
    {
      productId: headphones.id,
      name: 'Rose Gold',
      designName: 'Elegant Rose Gold',
      priceModifier: 30,
      stock: 10,
      image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500&h=500&fit=crop',
      updatedAt: new Date(),
    },
  ]);

  await db.insert(schema.products).values({
    name: 'Ergonomic Office Chair',
    description: 'Comfortable mesh back office chair with adjustable height and lumbar support. Perfect for long work sessions.',
    price: 299.99,
    image: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500&h=500&fit=crop',
    stock: 23,
    category: 'Furniture',
    updatedAt: new Date(),
  });

  const [watch] = await db.insert(schema.products).values({
    name: 'Smart Watch Series X',
    description: 'Advanced fitness tracking, heart rate monitoring, and smartphone notifications. Water-resistant up to 50m.',
    price: 399.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
    stock: 67,
    category: 'Electronics',
    updatedAt: new Date(),
  }).returning();

  await db.insert(schema.productVariations).values([
    {
      productId: watch.id,
      name: '42mm',
      designName: 'Standard 42mm',
      priceModifier: 0,
      stock: 30,
      updatedAt: new Date(),
    },
    {
      productId: watch.id,
      name: '46mm',
      designName: 'Large 46mm',
      priceModifier: 50,
      stock: 37,
      updatedAt: new Date(),
    },
  ]);

  const [bag] = await db.insert(schema.products).values({
    name: 'Leather Laptop Bag',
    description: 'Genuine leather messenger bag with padded laptop compartment. Fits up to 15-inch laptops.',
    price: 149.99,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&h=500&fit=crop',
    stock: 34,
    category: 'Accessories',
    updatedAt: new Date(),
  }).returning();

  await db.insert(schema.productVariations).values([
    {
      productId: bag.id,
      name: 'Brown',
      designName: 'Classic Brown Leather',
      priceModifier: 0,
      stock: 20,
      updatedAt: new Date(),
    },
    {
      productId: bag.id,
      name: 'Black',
      designName: 'Professional Black',
      priceModifier: 10,
      stock: 14,
      updatedAt: new Date(),
    },
  ]);

  await db.insert(schema.products).values({
    name: 'Portable Power Bank',
    description: '20,000mAh high-capacity power bank with fast charging support for multiple devices simultaneously.',
    price: 49.99,
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop',
    stock: 120,
    category: 'Electronics',
    updatedAt: new Date(),
  });

  await db.insert(schema.products).values({
    name: 'Standing Desk Converter',
    description: 'Adjustable height desk converter that transforms any desk into a standing desk. Easy assembly required.',
    price: 249.99,
    image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=500&h=500&fit=crop',
    stock: 18,
    category: 'Furniture',
    updatedAt: new Date(),
  });

  console.log('Created 6 products with variations');

  await pool.end();
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
