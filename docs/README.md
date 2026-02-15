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
- **[Database Migrations](./development.md#database-migrations)** - Managing schema changes with Prisma
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
- **Product Management**: Full CRUD with images, variations, and stock tracking
- **Order Processing**: Complete order lifecycle management
- **User Authentication**: Google OAuth with NextAuth.js v5
- **Role-Based Access**: Customer and Admin roles
- **Shopping Cart**: Session-based for guests, persistent for logged-in users
- **Admin Panel**: Product, order, and user management

### Technical Highlights
- **Serverless-First**: Optimized for platforms like Vercel, AWS Lambda
- **Performance**: Redis caching with stampede prevention
- **Type Safety**: Full TypeScript with Zod validation
- **Modern Stack**: Next.js 16, Prisma 7, Tailwind CSS v4
- **Scalable**: Connection pooling, edge-ready architecture
- **Observable**: Structured logging with Pino

## 📦 Technology Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 with App Router |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL with Prisma ORM v7 |
| **Cache** | Redis (ioredis) |
| **Authentication** | NextAuth.js v5 |
| **Validation** | Zod |
| **Styling** | Tailwind CSS v4 |
| **Logging** | Pino |
| **Image Storage** | Vercel Blob |

## 🔧 System Requirements

- **Node.js**: 18.0.0 or higher
- **PostgreSQL**: 12.0 or higher
- **Redis**: 6.0 or higher (Upstash recommended for serverless)

## 📖 Documentation Updates

This documentation is maintained as the single source of truth for the project. When making changes:

1. Update relevant documentation files in `/docs`
2. Keep documentation in sync with code changes
3. Do not create standalone MD files in the root directory
4. Follow the established structure

**Last Updated**: 2026-02-15

## 🤝 Contributing

When contributing to this project:
1. Read the [Development Guide](./development.md)
2. Follow the [Code Style Guide](./development.md#code-style-guide)
3. Update documentation for any new features or changes
4. Test your changes thoroughly

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/konarsubhojit/friendly-octo-giggle/issues)
- **Documentation**: This docs folder
- **Code Examples**: See `/app`, `/lib`, and `/components` directories

## 🗺️ Navigation

- **← [Back to Repository](../)** 
- **→ [Get Started](./getting-started.md)**
