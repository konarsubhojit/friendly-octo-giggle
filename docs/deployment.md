# Deployment Guide

This guide covers deploying the e-commerce application to various serverless platforms.

## Prerequisites for All Platforms

1. PostgreSQL database (managed service recommended)
2. Redis instance (Upstash Redis recommended for serverless)
3. Admin token for authentication

## Recommended Services

### PostgreSQL Database
- **Vercel Postgres** (easiest for Vercel deployment)
- **Supabase** (free tier, good for all platforms)
- **Neon** (serverless PostgreSQL, free tier)
- **AWS RDS** (production-grade)
- **Railway** (simple setup)

### Redis Cache
- **Upstash Redis** (serverless-optimized, free tier, works everywhere)
- **Redis Labs** (managed Redis)
- **AWS ElastiCache** (for AWS deployments)

## Platform-Specific Instructions

### 1. Vercel (Recommended)

**Step 1: Prepare your database**
```bash
# Use Vercel Postgres or external provider
# For Vercel Postgres:
vercel postgres create
```

**Step 2: Set up Redis**
- Sign up at [Upstash](https://upstash.com)
- Create a Redis database
- Copy the connection URL

**Step 3: Deploy**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables via Vercel dashboard or CLI:
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add ADMIN_TOKEN

# Redeploy to apply environment variables
vercel --prod
```

**Step 4: Initialize Database**
After deployment, initialize the production database:

**Option 1: Using idempotent SQL script (Recommended for production)**
```bash
# Safe to run multiple times, won't affect existing data
psql $DATABASE_URL -f scripts/init-database.sql
```

**Option 2: Using Drizzle Kit**
```bash
# Push schema directly (development/testing)
npm run db:push

# Or generate and run migrations
npm run db:generate
npm run db:migrate
```

**Step 5: Seed Initial Data (Optional)**
```bash
npm run db:seed
```

**Vercel-specific notes:**
- Automatically runs `drizzle-kit generate` during build if configured
- Edge runtime compatible with minor adjustments
- Built-in CDN for static assets
- Automatic HTTPS

---

### 2. AWS (Lambda + API Gateway)

**Prerequisites:**
- AWS account
- AWS CLI configured

**Step 1: Set up infrastructure**
```bash
# Install Serverless Framework
npm i -g serverless

# Create serverless.yml in project root
```

**serverless.yml example:**
```yaml
service: ecommerce-app

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    DATABASE_URL: ${env:DATABASE_URL}
    REDIS_URL: ${env:REDIS_URL}
    ADMIN_TOKEN: ${env:ADMIN_TOKEN}

functions:
  app:
    handler: .next/standalone/index.handler
    events:
      - http: ANY /
      - http: 'ANY /{proxy+}'

plugins:
  - serverless-nextjs-plugin
```

**Step 2: Deploy**
```bash
serverless deploy
```

---

### 3. Google Cloud Run

**Prerequisites:**
- Google Cloud account
- gcloud CLI installed

**Step 1: Create Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**Step 2: Deploy**
```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/ecommerce

# Deploy to Cloud Run
gcloud run deploy ecommerce \
  --image gcr.io/PROJECT_ID/ecommerce \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL,REDIS_URL=$REDIS_URL,ADMIN_TOKEN=$ADMIN_TOKEN
```

---

### 4. Cloudflare Pages

**Step 1: Prepare for Cloudflare**
- Cloudflare Pages uses edge runtime
- May need to adjust Prisma connection for edge

**Step 2: Connect repository**
- Go to Cloudflare Pages dashboard
- Connect your GitHub repository
- Configure build settings:
  - Build command: `npm run build`
  - Build output directory: `.next`
  - Root directory: `/`

**Step 3: Add environment variables**
Add in Cloudflare Pages dashboard:
- `DATABASE_URL`
- `REDIS_URL`
- `ADMIN_TOKEN`

**Step 4: Deploy**
- Cloudflare automatically deploys on git push

---

### 5. Railway

**Easiest option for beginners**

**Step 1: Sign up**
- Go to [railway.app](https://railway.app)
- Connect GitHub account

**Step 2: Deploy**
1. Click "New Project" → "Deploy from GitHub repo"
2. Select your repository
3. Railway auto-detects Next.js

**Step 3: Add services**
1. Add PostgreSQL database (built-in)
2. Add Redis (built-in)
3. Railway automatically sets DATABASE_URL

**Step 4: Configure environment variables**
- `REDIS_URL` (from Railway Redis)
- `ADMIN_TOKEN` (your secret)

**Step 5: Initialize Database**
```bash
# Option 1: Using idempotent SQL script (Recommended)
railway run psql $DATABASE_URL -f scripts/init-database.sql

# Option 2: Using Drizzle Kit
railway run npm run db:push

# Seed initial data
railway run npm run db:seed
```

---

## Post-Deployment Checklist

- [ ] Database schema initialized (using `init-database.sql` or Drizzle)
- [ ] Seed data loaded
- [ ] Environment variables set
- [ ] Redis connection working
- [ ] Admin panel accessible
- [ ] Product listing displays correctly
- [ ] Order creation works
- [ ] Cache invalidation working

## Database Initialization

### Using the Idempotent SQL Script

The `scripts/init-database.sql` file provides a safe, idempotent way to initialize your production database schema:

**Advantages:**
- ✅ Safe to run multiple times (won't affect existing data)
- ✅ No build-time dependencies required
- ✅ Fast execution
- ✅ No schema drift concerns
- ✅ Works with any PostgreSQL 15+ database

**Usage:**
```bash
# Direct execution
psql $DATABASE_URL -f scripts/init-database.sql

# With specific connection details
psql -h hostname -U username -d dbname -f scripts/init-database.sql

# Via cloud provider CLI (Railway example)
railway run psql $DATABASE_URL -f scripts/init-database.sql
```

**What it creates:**
- All required enums (UserRole, OrderStatus)
- 10 tables (User, Account, Session, Product, Order, Cart, etc.)
- All necessary indexes for optimal performance
- Foreign key constraints with proper cascade rules

**Alternative: Using Drizzle Kit**
```bash
# Generate migration files
npm run db:generate

# Push schema directly (dev/test only)
npm run db:push

# Apply migrations
npm run db:migrate
```

For detailed information, see [`scripts/README.md`](../scripts/README.md).

## Monitoring

### Check Application Health
```bash
# Test product API
curl https://your-domain.com/api/products

# Test admin API (requires token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/admin/products
```

### Monitor Performance
- Set up logging (Sentry, LogRocket, Datadog)
- Monitor database connections
- Monitor Redis cache hit rate
- Track API response times

## Scaling Considerations

### Database
- Enable connection pooling (PgBouncer for PostgreSQL)
- Use read replicas for high read loads
- Consider Prisma Accelerate for connection pooling

### Redis
- Monitor memory usage
- Adjust TTL values based on traffic
- Consider Redis Cluster for high traffic

### Application
- Enable CDN for static assets
- Use edge locations when available
- Monitor cold start times
- Optimize image sizes

## Security Best Practices

1. **Rotate admin token regularly**
2. **Use SSL/TLS for all connections**
3. **Enable database SSL** (set `sslmode=require` in DATABASE_URL)
4. **Use environment-specific secrets**
5. **Enable rate limiting** (Vercel/Cloudflare built-in, or use middleware)
6. **Monitor for suspicious activity**

## Troubleshooting

### Build Failures
- Check Node.js version (18+)
- Ensure all dependencies installed
- Verify Prisma generates successfully

### Database Connection Issues
- Check DATABASE_URL format
- Verify network access (whitelist IPs)
- Enable SSL if required
- Check connection limits

### Redis Connection Issues
- Verify REDIS_URL format
- Check Redis instance is running
- Ensure firewall allows connections
- Test connection independently

### Cache Not Working
- Verify Redis connection
- Check TTL values
- Monitor cache hit/miss rates
- Ensure cache keys are correct

## Cost Optimization

### Free Tier Options
- **Vercel**: 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth
- **Upstash Redis**: 10,000 requests/day
- **Railway**: $5 free credit/month

### Paid Recommendations
- Start with smallest plans
- Monitor usage patterns
- Scale based on actual needs
- Use autoscaling when available

## Support

For issues:
1. Check [GitHub Issues](https://github.com/konarsubhojit/friendly-octo-giggle/issues)
2. Review deployment platform docs
3. Check database/Redis provider status pages
