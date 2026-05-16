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

See root `README.md` and `AGENTS.md` for full-stack development.
