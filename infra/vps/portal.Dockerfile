# Supplier Portal production image — Next.js standalone on Node 22 (D-027).
# Build context is the REPO ROOT (pnpm workspace: portal + packages/tokens):
#   docker build -f infra/vps/portal.Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps: portal + its workspace deps from the frozen lockfile ──────────
FROM base AS deps
# Pin pnpm before any manifest exists: corepack would otherwise resolve the
# "packageManager" field at RUN time (network) or fall back to latest.
RUN corepack prepare pnpm@10.33.0 --activate
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tokens/package.json packages/tokens/
COPY portal/package.json portal/
# --ignore-scripts: the tokens package's prepare hook runs `tsx build.ts`,
# but at this stage only manifests are copied (no sources) — the build stage
# below builds tokens explicitly after COPYing the sources.
RUN pnpm install --frozen-lockfile --filter @terminal/portal... --ignore-scripts

# ── build: tokens (tailwind preset) then the Next standalone bundle ─────
FROM base AS build
# tokens has zero runtime deps, so the deps stage creates no node_modules
# dir for it — the glob keeps the COPY from failing on the absent path.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/portal/node_modules ./portal/node_modules
COPY --from=deps /repo/packages/tokens/node_module[s] ./packages/tokens/node_modules/
# Manifests come from the deps stage unchanged; --offline stops pnpm's
# pre-run deps-status check from reaching for the registry.
COPY packages/tokens ./packages/tokens
COPY portal ./portal
RUN pnpm --offline --filter @terminal/tokens build && pnpm --offline --filter @terminal/portal build

# ── runner: the standalone server only (no pnpm store, no sources) ──────
FROM node:22-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/portal/.next/standalone ./
COPY --from=build --chown=node:node /repo/portal/.next/static ./portal/.next/static
COPY --from=build --chown=node:node /repo/portal/public ./portal/public
USER node
EXPOSE 3000
CMD ["node", "portal/server.js"]
