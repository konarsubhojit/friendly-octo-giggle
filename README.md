# E-Commerce Platform

A highly scalable, serverless-first e-commerce platform built with Next.js 16, PostgreSQL, and Redis.

## 🚀 Quick Start

```bash
git clone https://github.com/konarsubhojit/friendly-octo-giggle.git
cd friendly-octo-giggle
npm install
cp .env.example .env
# Edit .env with your credentials
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

Complete documentation is available in the [`/docs`](./docs) folder:

- **[Getting Started](./docs/getting-started.md)** - Setup and installation guide
- **[Architecture](./docs/architecture.md)** - System design and technical overview
- **[Development](./docs/development.md)** - Development workflows and best practices
- **[API Reference](./docs/api-reference.md)** - Complete API documentation
- **[Deployment](./docs/deployment.md)** - Platform-specific deployment guides
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions

## ✨ Key Features

- 🛒 **Full E-Commerce**: Products, cart, orders, and checkout
- 🔐 **Google OAuth**: Secure authentication with NextAuth.js v5
- 👥 **Role-Based Access**: Customer and Admin roles
- ⚡ **Redis Caching**: Smart caching with stampede prevention
- 📦 **Product Variations**: Support for colors, sizes, designs
- 🎨 **Modern UI**: Responsive design with Tailwind CSS v4
- 🚀 **Serverless-Ready**: Optimized for Vercel, AWS Lambda, etc.
- 📊 **Structured Logging**: Production-ready logging with Pino
- ✅ **Type-Safe**: Full TypeScript with Zod validation

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **PostgreSQL** | Primary database |
| **Drizzle ORM** | Database toolkit |
| **Redis** | Caching layer |
| **NextAuth.js v5** | Authentication |
| **Tailwind CSS v4** | Styling |
| **Pino** | Structured logging |
| **Vercel Blob** | Image storage |

## 📋 Requirements

- **Node.js**: 18.0.0 or higher
- **PostgreSQL**: 12.0 or higher  
- **Redis**: 6.0 or higher (optional for local dev; recommended for production)

## 🎯 Features Overview

### For Customers
- Browse and search products
- View product details with variations
- Add items to cart (session-based for guests, persistent for logged-in users)
- **Google OAuth sign-in required for checkout**
- Place orders with automatic order tracking
- View order history (linked to account)

### For Administrators
- Product management (CRUD operations)
- Order management and status updates
- User role management
- Image upload to Vercel Blob
- Real-time inventory tracking
- Access via `/admin` URL (no navigation link)

## 🧪 Development

```bash
# Development server (HTTP)
npm run dev

# Development server (HTTPS, experimental)
npm run dev:https

# Database commands
npm run db:generate    # Generate Drizzle migrations
npm run db:migrate     # Run migrations
npm run db:seed        # Seed test data

# Testing
npm run test           # Run unit tests
npm run test:coverage  # Run unit tests with coverage

# Linting
npm run lint           # Run ESLint

# Production build
npm run build
npm run start
```

See [Development Guide](./docs/development.md) for detailed workflows.

## 🚀 Deployment

Deploy to your preferred platform:

- **[Vercel](./docs/deployment.md#vercel)** (Recommended)
- **[AWS Lambda](./docs/deployment.md#aws-lambda)**
- **[Google Cloud Run](./docs/deployment.md#google-cloud-run)**
- **[Railway](./docs/deployment.md#railway)**

See [Deployment Guide](./docs/deployment.md) for detailed instructions.

## 📖 Learn More

- **[System Architecture](./docs/architecture.md)** - Understand the technical design
- **[API Reference](./docs/api-reference.md)** - Explore available endpoints
- **[Troubleshooting](./docs/troubleshooting.md)** - Solve common issues

## 🤝 Contributing

Contributions are welcome! Please read the [Development Guide](./docs/development.md) for:
- Code style guidelines
- Development workflow
- Testing procedures
- Pull request process

## 📄 License

ISC

## 🆘 Support

- **Documentation**: [`/docs`](./docs)
- **Issues**: [GitHub Issues](https://github.com/konarsubhojit/friendly-octo-giggle/issues)

---

**Built with ❤️ using Next.js and modern web technologies**
