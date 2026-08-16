# Image Resizing Worker

Cloudflare Worker that validates, resizes (via `cf.image`), and immutably
caches image requests at the edge. It is the origin `next/image` is pointed
at through `NEXT_PUBLIC_IMAGE_WORKER_URL` and the custom loader in
`src/lib/image-loader.ts`.

## Request contract

```
GET https://<worker-domain>/?url=<https source>&w=<width>&q=<quality>&f=<format>
```

| Param | Required | Constraint                                                       |
| ----- | -------- | ---------------------------------------------------------------- |
| `url` | yes      | Absolute `https://` URL whose hostname is on `ALLOWED_HOSTNAMES` |
| `w`   | yes      | Integer, `16`–`3840`                                             |
| `q`   | no       | Integer, `1`–`100` (default `75`)                                |
| `f`   | no       | One of `avif`, `webp`, `auto` (default `auto`, edge-negotiated)  |

Every parameter is validated strictly in `src/validation.ts` before any
origin fetch is attempted — invalid input never reaches `fetch()`. A
disallowed hostname returns `403`; every other validation failure returns
`400` with a JSON `{ "error": "..." }` body naming the specific rule that
failed.

## Why the hostname allow-list lives here, not in `next.config.ts`

Next.js forbids combining a custom `images.loader` with
`images.remotePatterns`/`domains` — a custom loader takes full ownership of
image URL construction, so Next has nothing left to check. `ALLOWED_HOSTNAMES`
in `wrangler.toml` is the replacement enforcement point; update it whenever a
new image origin is introduced (see the comment beside it).

## Dual-provider (R2 / Vercel) reads

This Worker does not itself choose between storage providers. By the time a
request reaches it, `url` is already a single concrete, reachable source —
resolved upstream by `resolveStorageUrl` in `src/lib/storage/index.ts`, which
reads through the active provider (`STORAGE_PROVIDER`) and falls back to the
other one, with structured logging, when an object has not been migrated yet.

## Local development

```bash
cd workers/images
npx wrangler dev
```

## Deployment

Handled by [`deploy-images-worker.yml`](../../.github/workflows/deploy-images-worker.yml)
on pushes to `develop` touching this directory, or via manual dispatch. It
runs `npx wrangler deploy --env production` using the `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Image Resizing (`cf.image`)
requires the destination zone to have the Cloudflare Images / Image Resizing
feature enabled — see `docs/deployment.md`.
