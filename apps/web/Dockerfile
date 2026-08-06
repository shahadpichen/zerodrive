# Build stage
FROM node:24-alpine AS builder

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm -r --filter './packages/*' build
RUN pnpm --filter @zerodrive/web build

# Production stage
FROM nginx:alpine

# Copy built app from builder
COPY --from=builder /repo/apps/web/build /usr/share/nginx/html

# Copy nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
