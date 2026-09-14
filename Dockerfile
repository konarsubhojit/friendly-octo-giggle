# Container image for the `DEPLOY_TARGET=self-hosted` profile.
#
# Not used by Vercel. Vercel builds from source and ignores this file entirely,
# so nothing here can change the Vercel deployment.
#
# ---------------------------------------------------------------------------
# Node version
# ---------------------------------------------------------------------------
# Pinned to Node 24 to match every other place the project fixes a runtime:
# `.github/workflows/build.yml`, `.github/workflows/deploy-images-worker.yml`,
# and `.github/workflows/copilot-setup-steps.yml` all set `node-version: 24`,
# and `package.json` declares no `engines` range that would narrow it further.
# Next.js 16 supports Node >= 20.9, so 24 (the active LTS line) is inside the
# supported range. Building the image on a different major than the one that
# gates the pull request would mean shipping a runtime CI never exercised, so
# change this and the CI `node-version` keys together or not at all.
#
# ---------------------------------------------------------------------------
# Architecture
# ---------------------------------------------------------------------------
# The image is architecture-neutral; `linux/arm64` (Oracle Ampere A1) is built
# natively by `.github/workflows/deploy-selfhost.yml` on the GitHub-hosted
# `ubuntu-24.04-arm` runner. Do not build arm64 under QEMU emulation — with
# `reactCompiler` and Turbopack the emulated compile runs roughly an order of
# magnitude slower than native and routinely exceeds job timeouts.
#
# ---------------------------------------------------------------------------
# Build-time DATABASE_URL (read this before building a production image)
# ---------------------------------------------------------------------------
# `generateStaticParams` in `src/app/(public)/products/[id]/page.tsx` queries
# the catalog to decide which product pages to prerender. Those queries — and
# the bestseller/category reads on the shop route — degrade gracefully when the
# database is unreachable, so the build still completes, logging
# `Failed query ... getaddrinfo ENOTFOUND` under the `product_static_params`
# and `shop_bestsellers_fetch` contexts.
#
# The cost of that graceful degradation is real: with no reachable database the
# resulting image contains **zero prerendered product pages** and
# `/products/[id]` collapses to a single `/products/__no_products__` entry, so
# every product URL falls back to on-demand rendering on the first request.
# That is fine for a CI smoke build and wrong for a production image. Pass a
# reachable `DATABASE_URL` when building anything you intend to serve:
#
#   docker build --build-arg DATABASE_URL="postgresql://..." -t app .
#
# See `docs/oracle-ampere-deployment.md` for the full explanation.

FROM node:24-alpine AS base

# ---------------------------------------------------------------------------
# deps — production + dev dependencies, needed to compile
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
# libc6-compat backs the glibc-linked prebuilt binaries some transitive
# dependencies ship on Alpine's musl.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json .npmrc ./
# `.npmrc` is tracked and carries `legacy-peer-deps=true`. The lockfile was
# generated under that setting, so omitting the file makes `npm ci` fail with
# ERESOLVE on peer ranges the tree already resolves. It contains no credentials.
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# builder — `next build` with the self-hosted provider profile
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `DEPLOY_TARGET=self-hosted` is what turns on `output: 'standalone'` in
# next.config.ts. Without it the build emits the Vercel-shaped output and the
# runner stage below has no `server.js` to copy.
ENV DEPLOY_TARGET=self-hosted
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time-only values. `ARG` (not `ENV`) so they do not persist into the
# final image, and so a caller can override them without editing this file.
# The DATABASE_URL default is a deliberately unresolvable hostname: a build
# without a real database must fail DNS loudly in the logs rather than
# silently connect to something unintended.
ARG DATABASE_URL="postgresql://BUILD_TIME_PLACEHOLDER_DO_NOT_USE:5432/build"
ARG NEXTAUTH_URL="http://localhost:3000"

# `next build` requires NEXTAUTH_SECRET to be set but never uses its value —
# nothing at build time signs or verifies a token. It is exported for the
# duration of this one command rather than via `ENV`, so it is neither baked
# into a layer nor reported by image scanners as a committed secret.
RUN DATABASE_URL="$DATABASE_URL" \
  NEXTAUTH_URL="$NEXTAUTH_URL" \
  NEXTAUTH_SECRET="build-time-only-never-used-to-sign-anything" \
  npm run build

# ---------------------------------------------------------------------------
# runner — the shipped image
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DEPLOY_TARGET=self-hosted
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public

# The standalone tracer emits a pruned `node_modules` alongside `server.js`.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# `india-pincode` is in `serverExternalPackages`, so it is never bundled; it
# reads `data/pincodes.json.gz` from disk at runtime through `fs`. The
# standalone trace follows the CommonJS entry point but not the data file it
# resolves dynamically, so stage it explicitly or every pincode lookup throws
# ENOENT. See `src/server/pincode-loader.ts`.
COPY --from=builder --chown=nextjs:nodejs \
  /app/node_modules/india-pincode/data/pincodes.json.gz \
  ./node_modules/india-pincode/data/pincodes.json.gz

USER nextjs
EXPOSE 3000

# `GET /api/health` always returns 200 with a `status` of `ok` or `degraded`,
# so this probe reports process liveness, not provider readiness. Alert on the
# response body (`degraded`) separately — restarting the container cannot fix a
# missing credential.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
