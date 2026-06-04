# ─────────────────────────────────────────────────────────────
# Frontend — React + TypeScript + Vite
# Multi-stage: development (HMR) | production (nginx)
# ─────────────────────────────────────────────────────────────

# ── Base Node ─────────────────────────────────
FROM node:20-slim AS base

WORKDIR /app

# ── Dependencies ──────────────────────────────
FROM base AS deps

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else npm install; \
  fi

# ── Development ───────────────────────────────
FROM deps AS development

# node_modules baked in; source mounted via volume in docker-compose
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ── Production builder ────────────────────────
FROM deps AS builder

COPY . .

RUN npm run build

# ── Production — serve via Nginx ──────────────
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY infra/nginx/frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
