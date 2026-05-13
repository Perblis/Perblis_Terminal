#!/usr/bin/env bash
set -euo pipefail

BASE="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000}"
echo "Pulling OpenAPI schema from ${BASE}/api/schema/"

npx openapi-typescript "${BASE}/api/schema/?format=json" \
  --output src/lib/api/types.gen.ts

echo "✓ src/lib/api/types.gen.ts updated."
