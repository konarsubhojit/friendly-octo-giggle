import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  // Seed products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Wireless Bluetooth Headphones',
        description: 'Premium noise-cancelling wireless headphones with 30-hour battery life and superior sound quality.',
        price: 199.99,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
        stock: 45,
        category: 'Electronics',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Ergonomic Office Chair',
        description: 'Comfortable mesh back office chair with adjustable height and lumbar support. Perfect for long work sessions.',
        price: 299.99,
        image: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500&h=500&fit=crop',
        stock: 23,
        category: 'Furniture',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Smart Watch Series X',
        description: 'Advanced fitness tracking, heart rate monitoring, and smartphone notifications. Water-resistant up to 50m.',
        price: 399.99,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
        stock: 67,
        category: 'Electronics',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Leather Laptop Bag',
        description: 'Genuine leather messenger bag with padded laptop compartment. Fits up to 15-inch laptops.',
        price: 149.99,
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&h=500&fit=crop',
        stock: 34,
        category: 'Accessories',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Portable Power Bank',
        description: '20,000mAh high-capacity power bank with fast charging support for multiple devices simultaneously.',
        price: 49.99,
        image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop',
        stock: 120,
        category: 'Electronics',
      },
    }),
    prisma.product.create({
      data: {
        name: 'Standing Desk Converter',
        description: 'Adjustable height desk converter that transforms any desk into a standing desk. Easy assembly required.',
        price: 249.99,
        image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=500&h=500&fit=crop',
        stock: 18,
        category: 'Furniture',
      },
    }),
  ]);

  console.log(`Created ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
