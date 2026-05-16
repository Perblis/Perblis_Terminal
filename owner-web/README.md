# Terminal Owner Web

Next.js 16 (App Router) portal for equipment owners: sign-in, dashboard, listings, bookings, messages, analytics, and settings. It calls the Django API in the repo root (`/api/v1/…`) using JWT stored in `localStorage` and optional BFF routes under `src/app/api/auth/`.

## Prerequisites

- Node.js 20+ (matches `@types/node` in devDependencies)
- Django API running locally on port **8000** (or set `NEXT_PUBLIC_API_BASE_URL` to your deployed API)

## Setup

```bash
cd owner-web
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_API_BASE_URL (no trailing slash), e.g. http://localhost:8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |

## Deploy notes (e.g. Railway)

- Set `NEXT_PUBLIC_API_BASE_URL` on the **Next.js** service to your API origin (no trailing slash).
- For cross-origin browser calls, configure Django `CORS_ALLOWED_ORIGINS` / `OWNER_WEB_URL` in production settings (see root `.env.example`).

## E2E: image uploads (including production)

Playwright exercises every image upload in the app: **listing photos**, **business logo** (settings), and **KYC** (government ID + business registration).

```bash
cd owner-web
npm install
npx playwright install chromium

# Local (starts `npm run dev` unless E2E_BASE_URL is set)
npm run e2e:uploads

# Production: point the browser at your deployed Next app and use a real owner account
# that exists in that production database (seed emails usually do not exist on prod).
E2E_BASE_URL=https://your-owner-web.up.railway.app \
E2E_OWNER_EMAIL=you@example.com \
E2E_OWNER_PASSWORD='your-password' \
npm run e2e:uploads
```

See `e2e/image-uploads.spec.ts` and fixture `e2e/fixtures/test-upload.png`.

If the **business logo** test fails on production with **HTTP 405** (`Method "POST" not allowed`), redeploy owner-web after this change: multipart business profile updates must use **PATCH**, matching `GET|PUT|PATCH` on `/api/v1/owner/business-profile/`.

See root `README.md` and `AGENTS.md` for full-stack development.
