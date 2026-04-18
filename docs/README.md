# E-Commerce Platform Documentation

Welcome to the comprehensive documentation for the e-commerce platform built with Next.js, PostgreSQL, and Redis.

## 📚 Documentation Structure

### Getting Started

- **[Getting Started Guide](./getting-started.md)** - Setup, installation, and first-time configuration
- **[Quick Start](./getting-started.md#quick-start)** - Get running in 5 minutes

### Architecture & Design

- **[System Architecture](./architecture.md)** - Technical design, data flow, and system components
- **[Database Schema](./architecture.md#database-schema)** - Entity relationships and data models
- **[Caching Strategy](./architecture.md#caching-strategy)** - Redis caching implementation

### Development

- **[Development Guide](./development.md)** - Development workflows, best practices, and coding standards
- **[Database Migrations](./development.md#database-migrations)** - Managing schema changes with Drizzle
- **[Testing](./development.md#testing)** - Testing strategies and examples
- **[Logging](./development.md#logging)** - Server-side logging and monitoring

### API Reference

- **[API Documentation](./api-reference.md)** - Complete API endpoint reference
- **[Authentication](./api-reference.md#authentication)** - Auth flows and session management
- **[Error Handling](./api-reference.md#error-handling)** - Error responses and codes

### Deployment

- **[Deployment Guide](./deployment.md)** - Platform-specific deployment instructions
- **[Environment Variables](./deployment.md#environment-variables)** - Configuration reference
- **[Production Checklist](./deployment.md#production-checklist)** - Pre-launch verification

### Operations

- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
- **[Monitoring](./troubleshooting.md#monitoring)** - Performance monitoring and logging
- **[Security](./troubleshooting.md#security)** - Security best practices

## 🚀 Quick Links

### For Developers

- [Setup Instructions](./getting-started.md#setup-instructions)
- [Development Workflow](./development.md#development-workflow)
- [Code Style Guide](./development.md#code-style-guide)
- [API Endpoints](./api-reference.md#endpoints)

### For DevOps

- [Deploy to Vercel](./deployment.md#vercel)
- [Environment Configuration](./deployment.md#environment-variables)
- [Database Setup](./deployment.md#database-setup)
- [Monitoring Setup](./troubleshooting.md#monitoring)

### For Product Managers

- [Feature Overview](./architecture.md#features)
- [User Flows](./architecture.md#user-flows)
- [Admin Panel](./api-reference.md#admin-apis)

## 🏗️ Project Overview

This is a highly scalable e-commerce platform designed for serverless deployment with the following key characteristics:

### Core Features

- **Product Management**: Full CRUD with images, variants, categories, and stock tracking
- **Product Search**: Upstash Search with automatic DB fallback
- **Order Processing**: Queue-based checkout with complete order lifecycle management
- **User Authentication**: Google OAuth, Microsoft Entra ID, and email/password with NextAuth.js v5
- **Role-Based Access**: Customer and Admin roles
- **Shopping Cart**: Session-based for guests, persistent for logged-in users, with guest-to-user cart merge
- **Wishlist**: Per-user product wishlist
- **AI Product Assistant**: AI-powered product Q&A via AI SDK and RAG
- **Admin Panel**: Product, order, user, category, review, and email-failure management
- **Checkout Flow**: Policy confirmation, address collection, Vercel Queue-backed order creation
- **Email System**: Async delivery via QStash with retry and failed-email tracking
- **Feature Flags**: Vercel Edge Config for maintenance mode, sale mode, and shipping settings

### Technical Highlights

- **Serverless-First**: Optimized for platforms like Vercel, AWS Lambda
- **Feature-Based Architecture**: Domain code organized in `src/features/` (admin, auth, cart, orders, product, wishlist)
- **Performance**: Redis caching with stampede prevention
- **Type Safety**: Full TypeScript with Zod validation
- **Modern Stack**: Next.js 16, Drizzle ORM, Tailwind CSS v4
- **AI Integration**: Product assistant powered by AI SDK and RAG
- **Queue-Based Checkout**: Vercel Queues for reliable order processing
- **Scalable**: Connection pooling, read replicas, edge-ready architecture
- **Observable**: Structured logging with Pino

## 📦 Technology Stack

| Category           | Technology                          |
| ------------------ | ----------------------------------- |
| **Framework**      | Next.js 16 with App Router          |
| **Language**       | TypeScript 6.x (strict mode)        |
| **Database**       | PostgreSQL (Neon) with Drizzle ORM  |
| **Cache**          | Redis (Upstash, HTTP-based)         |
| **Authentication** | NextAuth.js v5                      |
| **Validation**     | Zod 4.x                             |
| **Styling**        | Tailwind CSS v4                     |
| **State**          | Redux Toolkit 2.x                   |
| **Logging**        | Pino                                |
| **Image Storage**  | Vercel Blob                         |
| **Search**         | Upstash Search (with DB fallback)   |
| **Queues**         | Vercel Queues (checkout)            |
| **AI**             | AI SDK (product assistant)          |
| **Email**          | MailerSend / Google SMTP via QStash |
| **Feature Flags**  | Vercel Edge Config                  |

## 🔧 System Requirements

- **Node.js**: 22.0.0 or higher
- **PostgreSQL**: 12.0 or higher
- **Redis**: 6.0 or higher (optional for local dev; Upstash recommended for production)

## 📖 Documentation Updates

This documentation is maintained as the single source of truth for the project. When making changes:

1. Update relevant documentation files in `/docs`
2. Keep documentation in sync with code changes
3. Do not create standalone MD files in the root directory
4. Follow the established structure

**Last Updated**: 2026-04-03

## 🤝 Contributing

When contributing to this project:

1. Read the [Development Guide](./development.md)
2. Follow the [Code Style Guide](./development.md#code-style-guide)
3. Update documentation for any new features or changes
4. Test your changes thoroughly

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/konarsubhojit/friendly-octo-giggle/issues)
- **Documentation**: This docs folder
- **Code Examples**: See `src/app`, `src/lib`, `src/components`, and `src/features` directories

## 🗺️ Navigation

- **← [Back to Repository](../)**
- **→ [Get Started](./getting-started.md)**
